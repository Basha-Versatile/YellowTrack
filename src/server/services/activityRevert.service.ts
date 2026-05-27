import "server-only";
import { ActivityLog, ComplianceDocument } from "@/models";
import {
  type ScopedContext,
  tenantFilter,
} from "@/lib/auth/tenant-context";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "@/lib/errors";
import { logActivity } from "./activityLog.service";
import type { Session } from "@/lib/auth/session";
import { calculateComplianceStatus } from "./compliance.service";

/**
 * Action revert orchestrator.
 *
 * Each `action` key (e.g. "compliance.update") maps to a handler that knows
 * how to reverse it using the snapshot captured at write time. New actions
 * become revertable by:
 *   1. Capturing a snapshot at the write site (set `revertable: true` on the
 *      activity entry).
 *   2. Adding a handler entry to `REVERT_HANDLERS` here.
 */

const CONFLICT_SKEW_MS = 5_000;

type ActivityDoc = {
  _id: unknown;
  tenantId: unknown;
  action: string;
  entityType: string;
  entityId: string | null;
  entityLabel: string | null;
  summary: string;
  metadata: Record<string, unknown> | null;
  revertable: boolean;
  beforeSnapshot: Record<string, unknown> | null;
  createdSnapshot: Record<string, unknown> | null;
  childSnapshots: Record<string, unknown[]> | null;
  revertedAt: Date | null;
  createdAt: Date;
};

type RevertHandlerResult = {
  /** Short human summary used on the new revert log entry. */
  summary: string;
  /** Optional fields diff (before/after) for the revert audit. */
  fields?: Array<{ field: string; before: unknown; after: unknown }>;
};

type RevertHandler = (
  ctx: ScopedContext,
  entry: ActivityDoc,
  opts: { force: boolean },
) => Promise<RevertHandlerResult>;

// ─────────────────────────────────────────────────────────────────────────
// Handler: compliance.update
// ─────────────────────────────────────────────────────────────────────────
const revertComplianceUpdate: RevertHandler = async (ctx, entry, opts) => {
  if (!entry.entityId) throw new BadRequestError("Missing entity reference");
  const snap = entry.beforeSnapshot as {
    expiryDate?: Date | string | null;
    issuedDate?: Date | string | null;
    status?: string | null;
    isLifetime?: boolean;
  } | null;
  if (!snap) {
    throw new BadRequestError("No snapshot available to revert");
  }

  const current = await ComplianceDocument.findOne(
    tenantFilter(ctx, { _id: entry.entityId }),
  ).lean();
  if (!current) {
    throw new NotFoundError(
      "The compliance document no longer exists. Nothing to revert.",
    );
  }

  // Conflict check — was the entity touched after the log entry?
  const currentUpdated = (current as { updatedAt?: Date }).updatedAt;
  if (
    !opts.force &&
    currentUpdated &&
    new Date(currentUpdated).getTime() >
      entry.createdAt.getTime() + CONFLICT_SKEW_MS
  ) {
    throw new ConflictError(
      "This document has been edited since the log entry. Revert will discard those changes — confirm to proceed.",
    );
  }

  const before = current as {
    expiryDate?: Date | null;
    issuedDate?: Date | null;
    status?: string | null;
    isLifetime?: boolean;
  };

  const restoredExpiry = snap.expiryDate ? new Date(snap.expiryDate) : null;
  const restoredIssued = snap.issuedDate ? new Date(snap.issuedDate) : null;
  const restoredStatus = snap.status ?? calculateComplianceStatus(restoredExpiry);
  const restoredLifetime = Boolean(snap.isLifetime);

  await ComplianceDocument.findOneAndUpdate(
    tenantFilter(ctx, { _id: entry.entityId }),
    {
      $set: {
        expiryDate: restoredExpiry,
        issuedDate: restoredIssued,
        status: restoredStatus,
        isLifetime: restoredLifetime,
      },
    },
  );

  return {
    summary: `Reverted ${entry.entityLabel ?? "compliance document"}${
      restoredExpiry
        ? ` to expiry ${restoredExpiry.toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}`
        : restoredLifetime
          ? " to lifetime validity"
          : ""
    }`,
    fields: [
      {
        field: "expiryDate",
        before: before.expiryDate ?? null,
        after: restoredExpiry,
      },
      {
        field: "issuedDate",
        before: before.issuedDate ?? null,
        after: restoredIssued,
      },
    ].filter(
      (d) => JSON.stringify(d.before) !== JSON.stringify(d.after),
    ),
  };
};

// Registry of supported action → handler. Extending this is how we onboard
// more revert coverage; the API + UI need no further changes.
const REVERT_HANDLERS: Record<string, RevertHandler> = {
  "compliance.update": revertComplianceUpdate,
};

export function isActionRevertable(action: string): boolean {
  return Object.prototype.hasOwnProperty.call(REVERT_HANDLERS, action);
}

/**
 * Reverse the action recorded by `activityId`. Caller must have permission
 * `activityLog:revert`; this service does NOT recheck — gate at the route.
 */
export async function revertActivity(
  ctx: ScopedContext,
  session: Session,
  activityId: string,
  opts: { force?: boolean } = {},
): Promise<{ ok: true; revertActivityId: string | null }> {
  const entry = (await ActivityLog.findOne(
    tenantFilter(ctx, { _id: activityId }),
  ).lean()) as ActivityDoc | null;

  if (!entry) throw new NotFoundError("Activity entry not found");
  if (entry.revertedAt) {
    throw new ConflictError("This action has already been reverted");
  }
  if (!entry.revertable) {
    throw new ForbiddenError("This action cannot be reverted");
  }

  const handler = REVERT_HANDLERS[entry.action];
  if (!handler) {
    throw new ForbiddenError(
      `Revert is not yet supported for action "${entry.action}"`,
    );
  }

  const result = await handler(ctx, entry, { force: Boolean(opts.force) });

  // Mark the original entry as reverted.
  await ActivityLog.findOneAndUpdate(
    tenantFilter(ctx, { _id: activityId }),
    {
      $set: {
        revertedAt: new Date(),
        revertedByUserId: session.id,
      },
    },
  );

  // Insert a new "*.revert" audit row pointing back at the original.
  const revertEntry = await logActivity(ctx, session, {
    action: `${entry.action.split(".")[0]}.revert`,
    entityType: entry.entityType as Parameters<typeof logActivity>[2]["entityType"],
    entityId: entry.entityId ?? null,
    entityLabel: entry.entityLabel ?? null,
    summary: result.summary,
    fields: result.fields ?? [],
    metadata: { originalAction: entry.action },
    revertable: false,
    revertedFromActivityId: String(entry._id),
  });

  return {
    ok: true,
    revertActivityId: revertEntry?.id ?? null,
  };
}
