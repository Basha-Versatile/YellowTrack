import "server-only";
import { User } from "@/models";
import type { ScopedContext } from "@/lib/auth/tenant-context";
import type { Session } from "@/lib/auth/session";
import type { ActivityEntityType } from "@/models";
import * as repo from "../repositories/activityLog.repository";

export type LogActivityInput = {
  action: string;
  entityType: ActivityEntityType;
  entityId?: string | null;
  entityLabel?: string | null;
  summary: string;
  fields?: Array<{ field: string; before: unknown; after: unknown }>;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  // Revert support — set when the caller has captured enough state to undo
  // this action. `revertable` is the gate the UI honors.
  revertable?: boolean;
  beforeSnapshot?: Record<string, unknown> | null;
  createdSnapshot?: Record<string, unknown> | null;
  childSnapshots?: Record<string, unknown[]> | null;
  revertedFromActivityId?: string | null;
};

/**
 * Append one entry to the tenant's activity log. Never throws — logging
 * failures must not break the underlying mutation. The actor identity is
 * snapshotted from the session at write time so future user renames or
 * deletions don't rewrite history.
 */
export async function logActivity(
  ctx: ScopedContext,
  session: Session | null | undefined,
  input: LogActivityInput,
): Promise<{ id: string } | null> {
  try {
    let userName: string | null = null;
    if (session?.id) {
      const u = await User.findById(session.id).select("name").lean();
      userName = (u?.name as string | undefined) ?? null;
    }
    return await repo.insertLog(ctx, {
      userId: session?.id ?? null,
      userName,
      userEmail: session?.email ?? null,
      userRole: session?.role ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      entityLabel: input.entityLabel ?? null,
      summary: input.summary,
      fields: input.fields ?? [],
      metadata: input.metadata ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      revertable: input.revertable ?? false,
      beforeSnapshot: input.beforeSnapshot ?? null,
      createdSnapshot: input.createdSnapshot ?? null,
      childSnapshots: input.childSnapshots ?? null,
      revertedFromActivityId: input.revertedFromActivityId ?? null,
    });
  } catch (err) {
    console.warn("[activityLog] failed to record:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Build a field diff array from a "before" snapshot and "after" patch. Only
 * keys present in `patch` with values that differ from `before` are emitted,
 * so logs stay compact and accurate.
 */
export function diffFields(
  before: Record<string, unknown> | null | undefined,
  patch: Record<string, unknown>,
  options: { ignore?: string[] } = {},
): Array<{ field: string; before: unknown; after: unknown }> {
  const ignore = new Set(options.ignore ?? []);
  const out: Array<{ field: string; before: unknown; after: unknown }> = [];
  for (const [k, after] of Object.entries(patch)) {
    if (ignore.has(k)) continue;
    const prev = before?.[k] ?? null;
    if (JSON.stringify(prev) === JSON.stringify(after ?? null)) continue;
    out.push({ field: k, before: prev, after: after ?? null });
  }
  return out;
}

export async function listActivities(ctx: ScopedContext, query: repo.ActivityLogQuery = {}) {
  return repo.findLogs(ctx, query);
}

export async function listActors(ctx: ScopedContext) {
  return repo.findActors(ctx);
}

/**
 * Convenience wrapper for use inside `withRoute(...)` route handlers.
 * Pulls IP + user agent off the request automatically so callers can stay
 * one-liners. Use this when the route has a session in scope; the underlying
 * `logActivity` already swallows errors so this is safe to fire-and-forget.
 */
export async function logFromRequest(
  req: Request,
  ctx: ScopedContext,
  session: Session | null | undefined,
  input: LogActivityInput,
): Promise<{ id: string } | null> {
  const headers = req.headers;
  const ip =
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    null;
  const ua = headers.get("user-agent") ?? null;
  return logActivity(ctx, session, {
    ...input,
    ipAddress: input.ipAddress ?? ip,
    userAgent: input.userAgent ?? ua,
  });
}
