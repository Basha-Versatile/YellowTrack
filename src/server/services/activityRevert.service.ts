import "server-only";
import { Types } from "mongoose";
import {
  ActivityLog,
  ComplianceDocument,
  Driver,
  EMIPayment,
  EMIPlan,
  Role,
  User,
  Vehicle,
  VehicleSale,
} from "@/models";
import {
  type ScopedContext,
  tenantFilter,
  tenantStamp,
} from "@/lib/auth/tenant-context";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "@/lib/errors";
import { logActivity } from "./activityLog.service";
import type { Session } from "@/lib/auth/session";

/**
 * Activity revert orchestrator.
 *
 * Every action key that's reversible has an entry in REVERT_REGISTRY below.
 * Each entry picks a *shape* (update / create / delete / flag) and the engine
 * supplies the generic reversal logic — no per-action handler code needed
 * unless the action does something exotic.
 *
 * Adding revert coverage for a new action is two steps:
 *   1. At the write site, capture the right snapshot
 *      (`beforeSnapshot` for update/delete/flag, nothing for create)
 *      and set `revertable: true` on the logActivity call.
 *   2. Add a registry entry below pointing to the right shape + Mongoose model.
 *
 * Auth actions are intentionally NOT in the registry — login/logout have
 * nothing to undo.
 */

const CONFLICT_SKEW_MS = 5_000;

// ─────────────────────────────────────────────────────────────────────────
// Model registry — each shape needs to know which collection to write to.
// ─────────────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyModel = any;
const MODELS: Record<string, AnyModel> = {
  Vehicle,
  Driver,
  ComplianceDocument,
  User,
  Role,
  EMIPlan,
  EMIPayment,
  VehicleSale,
};

type RevertShape =
  | {
      // Restore the fields listed in beforeSnapshot back onto the entity.
      kind: "update";
      modelName: keyof typeof MODELS;
    }
  | {
      // Delete the entity that was created. Works for both soft and hard
      // delete since we call deleteOne — soft-deleting models will mark
      // their `deletedAt` via their own middleware if configured, otherwise
      // hard delete is fine for a freshly-created row.
      kind: "create";
      modelName: keyof typeof MODELS;
    }
  | {
      // Restore a deleted entity by re-inserting from beforeSnapshot. Works
      // for both hard-deleted entities (full snapshot) and soft-deleted ones
      // (we strip deletedAt). Optionally restores cascaded children.
      kind: "delete";
      modelName: keyof typeof MODELS;
      cascadeChildren?: Array<keyof typeof MODELS>;
    }
  | {
      // Single-flag toggle (suspend/resume, paid/unpaid). The beforeSnapshot
      // carries the prior value of the named field.
      kind: "flag";
      modelName: keyof typeof MODELS;
      field: string;
    };

// ─────────────────────────────────────────────────────────────────────────
// Action → revert shape registry. Every NON-auth action that the codebase
// logs should be listed here.
// ─────────────────────────────────────────────────────────────────────────
const REVERT_REGISTRY: Record<string, RevertShape> = {
  // Vehicle
  "vehicle.create": { kind: "create", modelName: "Vehicle" },
  "vehicle.update": { kind: "update", modelName: "Vehicle" },
  "vehicle.delete": {
    kind: "delete",
    modelName: "Vehicle",
    cascadeChildren: ["ComplianceDocument"],
  },
  "vehicle.sale.cancel": { kind: "update", modelName: "Vehicle" },

  // Driver
  "driver.create": { kind: "create", modelName: "Driver" },
  "driver.update": { kind: "update", modelName: "Driver" },

  // Compliance
  "compliance.create": { kind: "create", modelName: "ComplianceDocument" },
  "compliance.update": { kind: "update", modelName: "ComplianceDocument" },
  "compliance.delete": { kind: "delete", modelName: "ComplianceDocument" },
  // Renew creates a fresh doc and deactivates the old one. Reverting deletes
  // the new doc — restoring the old doc's `isActive: true` is a separate
  // recovery the user can do manually, captured here as a partial revert.
  "compliance.renew": { kind: "create", modelName: "ComplianceDocument" },

  // User
  "user.invite": { kind: "create", modelName: "User" },
  "user.update": { kind: "update", modelName: "User" },
  "user.delete": { kind: "delete", modelName: "User" },
  "user.suspend": { kind: "flag", modelName: "User", field: "status" },
  "user.resume": { kind: "flag", modelName: "User", field: "status" },

  // Role
  "role.create": { kind: "create", modelName: "Role" },
  "role.update": { kind: "update", modelName: "Role" },
  "role.delete": { kind: "delete", modelName: "Role" },

  // EMI
  "emi.plan.create": { kind: "create", modelName: "EMIPlan" },
  "emi.update": { kind: "update", modelName: "EMIPlan" },
  "emi.status": { kind: "flag", modelName: "EMIPlan", field: "status" },
  "emi.payment.paid": { kind: "flag", modelName: "EMIPayment", field: "status" },
  "emi.payment.unpaid": { kind: "flag", modelName: "EMIPayment", field: "status" },
  // Bulk-paid touches many EMIPayments at once and there's no clean way to
  // revert each without a richer snapshot. Left out of the registry; the UI
  // will show "not revertable".
};

export function isActionRevertable(action: string): boolean {
  return Object.prototype.hasOwnProperty.call(REVERT_REGISTRY, action);
}

// ─────────────────────────────────────────────────────────────────────────
// Shape handlers
// ─────────────────────────────────────────────────────────────────────────
type ActivityDoc = {
  _id: unknown;
  tenantId: unknown;
  action: string;
  entityType: string;
  entityId: string | null;
  entityLabel: string | null;
  summary: string;
  revertable: boolean;
  beforeSnapshot: Record<string, unknown> | null;
  createdSnapshot: Record<string, unknown> | null;
  childSnapshots: Record<string, unknown[]> | null;
  revertedAt: Date | null;
  createdAt: Date;
};

type ShapeResult = {
  summary: string;
  fields: Array<{ field: string; before: unknown; after: unknown }>;
};

async function runUpdateShape(
  ctx: ScopedContext,
  entry: ActivityDoc,
  shape: Extract<RevertShape, { kind: "update" }>,
  opts: { force: boolean },
): Promise<ShapeResult> {
  if (!entry.entityId) throw new BadRequestError("Missing entity reference");
  const snap = entry.beforeSnapshot;
  if (!snap || Object.keys(snap).length === 0) {
    throw new BadRequestError("No snapshot available to revert");
  }
  const M = MODELS[shape.modelName];
  const current = await M.findOne(
    tenantFilter(ctx, { _id: entry.entityId }),
  ).lean();
  if (!current) {
    throw new NotFoundError(
      `${shape.modelName} no longer exists. Nothing to revert.`,
    );
  }

  const currentUpdated = (current as { updatedAt?: Date }).updatedAt;
  if (
    !opts.force &&
    currentUpdated &&
    new Date(currentUpdated).getTime() >
      entry.createdAt.getTime() + CONFLICT_SKEW_MS
  ) {
    throw new ConflictError(
      "This record has been edited since the log entry. Revert will discard those changes — confirm to proceed.",
    );
  }

  await M.findOneAndUpdate(
    tenantFilter(ctx, { _id: entry.entityId }),
    { $set: snap },
  );

  // Build a fields[] preview for the new revert audit row.
  const before = current as Record<string, unknown>;
  const fields: ShapeResult["fields"] = [];
  for (const [k, v] of Object.entries(snap)) {
    const prev = before[k] ?? null;
    if (JSON.stringify(prev) !== JSON.stringify(v ?? null)) {
      fields.push({ field: k, before: prev, after: v ?? null });
    }
  }
  return {
    summary: `Reverted ${entry.entityLabel ?? shape.modelName.toLowerCase()}`,
    fields,
  };
}

async function runCreateShape(
  ctx: ScopedContext,
  entry: ActivityDoc,
  shape: Extract<RevertShape, { kind: "create" }>,
  opts: { force: boolean },
): Promise<ShapeResult> {
  if (!entry.entityId) throw new BadRequestError("Missing entity reference");
  const M = MODELS[shape.modelName];
  const current = await M.findOne(
    tenantFilter(ctx, { _id: entry.entityId }),
  ).lean();
  if (!current) {
    throw new NotFoundError(
      `${shape.modelName} no longer exists. Nothing to revert.`,
    );
  }

  // Conflict check — if the entity has been modified since creation, warn.
  const currentUpdated = (current as { updatedAt?: Date }).updatedAt;
  if (
    !opts.force &&
    currentUpdated &&
    new Date(currentUpdated).getTime() >
      entry.createdAt.getTime() + CONFLICT_SKEW_MS
  ) {
    throw new ConflictError(
      "This record has been edited since it was created. Revert will discard those changes — confirm to proceed.",
    );
  }

  // For models with soft-delete support (Vehicle), set deletedAt; for others
  // hard delete. Either way, the entity stops being visible.
  if (shape.modelName === "Vehicle") {
    await M.findOneAndUpdate(
      tenantFilter(ctx, { _id: entry.entityId }),
      { $set: { deletedAt: new Date() } },
    );
  } else {
    await M.deleteOne(tenantFilter(ctx, { _id: entry.entityId }));
  }

  return {
    summary: `Undid creation of ${entry.entityLabel ?? shape.modelName.toLowerCase()}`,
    fields: [],
  };
}

async function runDeleteShape(
  ctx: ScopedContext,
  entry: ActivityDoc,
  shape: Extract<RevertShape, { kind: "delete" }>,
  _opts: { force: boolean },
): Promise<ShapeResult> {
  if (!entry.entityId) throw new BadRequestError("Missing entity reference");
  const snap = entry.beforeSnapshot;
  if (!snap) {
    throw new BadRequestError(
      "No snapshot was captured for this delete — cannot restore.",
    );
  }
  const M = MODELS[shape.modelName];

  // Make sure the entity isn't already restored (avoid duplicate-key errors).
  const existing = await M.findOne(
    tenantFilter(ctx, { _id: entry.entityId }),
  ).lean();
  if (existing) {
    throw new ConflictError(
      `${shape.modelName} already exists. Maybe it was restored already?`,
    );
  }

  // Re-insert from snapshot. Strip soft-delete markers so the row reappears.
  const restored = { ...snap };
  delete (restored as Record<string, unknown>).deletedAt;
  // Preserve original _id so cross-references stay valid.
  if (entry.entityId) {
    (restored as Record<string, unknown>)._id = new Types.ObjectId(
      entry.entityId,
    );
  }
  await M.create({ ...restored, ...tenantStamp(ctx) });

  // Cascade children, if any.
  if (shape.cascadeChildren && entry.childSnapshots) {
    for (const childName of shape.cascadeChildren) {
      const rows = entry.childSnapshots[childName] ?? [];
      if (rows.length === 0) continue;
      const CM = MODELS[childName];
      for (const row of rows) {
        try {
          const r = { ...(row as Record<string, unknown>) };
          delete r.deletedAt;
          await CM.create({ ...r, ...tenantStamp(ctx) });
        } catch (err) {
          console.warn(
            `[activityRevert] cascade restore ${childName} failed:`,
            err instanceof Error ? err.message : err,
          );
        }
      }
    }
  }

  return {
    summary: `Restored ${entry.entityLabel ?? shape.modelName.toLowerCase()}`,
    fields: [],
  };
}

async function runFlagShape(
  ctx: ScopedContext,
  entry: ActivityDoc,
  shape: Extract<RevertShape, { kind: "flag" }>,
  opts: { force: boolean },
): Promise<ShapeResult> {
  if (!entry.entityId) throw new BadRequestError("Missing entity reference");
  const snap = entry.beforeSnapshot;
  if (!snap || !(shape.field in snap)) {
    throw new BadRequestError(
      `No prior value for "${shape.field}" was captured.`,
    );
  }
  const M = MODELS[shape.modelName];
  const current = await M.findOne(
    tenantFilter(ctx, { _id: entry.entityId }),
  ).lean();
  if (!current) {
    throw new NotFoundError(
      `${shape.modelName} no longer exists. Nothing to revert.`,
    );
  }
  const currentUpdated = (current as { updatedAt?: Date }).updatedAt;
  if (
    !opts.force &&
    currentUpdated &&
    new Date(currentUpdated).getTime() >
      entry.createdAt.getTime() + CONFLICT_SKEW_MS
  ) {
    throw new ConflictError(
      "This record has been edited since the log entry. Revert will discard those changes — confirm to proceed.",
    );
  }

  const before = (current as Record<string, unknown>)[shape.field] ?? null;
  const after = snap[shape.field] ?? null;
  await M.findOneAndUpdate(
    tenantFilter(ctx, { _id: entry.entityId }),
    { $set: { [shape.field]: after } },
  );

  return {
    summary: `Reverted ${entry.entityLabel ?? shape.modelName.toLowerCase()} ${shape.field}`,
    fields: [{ field: shape.field, before, after }],
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Public entry point
// ─────────────────────────────────────────────────────────────────────────
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

  const shape = REVERT_REGISTRY[entry.action];
  if (!shape) {
    throw new ForbiddenError(
      `Revert is not yet supported for action "${entry.action}"`,
    );
  }

  const force = Boolean(opts.force);
  let result: ShapeResult;
  if (shape.kind === "update") {
    result = await runUpdateShape(ctx, entry, shape, { force });
  } else if (shape.kind === "create") {
    result = await runCreateShape(ctx, entry, shape, { force });
  } else if (shape.kind === "delete") {
    result = await runDeleteShape(ctx, entry, shape, { force });
  } else {
    result = await runFlagShape(ctx, entry, shape, { force });
  }

  await ActivityLog.findOneAndUpdate(
    tenantFilter(ctx, { _id: activityId }),
    {
      $set: {
        revertedAt: new Date(),
        revertedByUserId: session.id,
      },
    },
  );

  const revertEntry = await logActivity(ctx, session, {
    action: `${entry.action.split(".")[0]}.revert`,
    entityType: entry.entityType as Parameters<typeof logActivity>[2]["entityType"],
    entityId: entry.entityId ?? null,
    entityLabel: entry.entityLabel ?? null,
    summary: result.summary,
    fields: result.fields,
    metadata: { originalAction: entry.action },
    revertable: false,
    revertedFromActivityId: String(entry._id),
  });

  return {
    ok: true,
    revertActivityId: revertEntry?.id ?? null,
  };
}
