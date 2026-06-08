import { withRoute, parseJson } from "@/lib/api-handler";
import { success, created } from "@/lib/http";
import { z } from "zod";
import { tenantOf } from "@/lib/auth/tenant-context";
import { UnauthorizedError } from "@/lib/errors";
import {
  enableLock,
  getLockStatusForUser,
  removeLock,
} from "@/server/services/customComplianceLock.service";
import { logFromRequest } from "@/server/services/activityLog.service";
import { CustomComplianceGroup } from "@/models";

export const runtime = "nodejs";

/**
 * Read-only lock status for the calling user. Powers the UI: returns
 * `{ enabled, recoveryEmail, unlockedUntil, blockedUntil, setAt }`. Safe
 * to call on every page load — no writes.
 */
export const GET = withRoute<{ id: string }>(async ({ params, session }) => {
  if (!session) throw new UnauthorizedError();
  const ctx = tenantOf(session);
  const payload = await getLockStatusForUser(ctx, params.id, session.id);
  return success(payload, "Lock status");
}, { auth: true });

const enableSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(200),
  confirmPassword: z.string().min(6).max(200),
});

/**
 * First-time enable. Workspace ADMIN only — matches the spec ("Lock can be
 * created / modified / removed by Workspace Admin").
 */
export const POST = withRoute<{ id: string }>(async ({ req, params, session }) => {
  if (!session) throw new UnauthorizedError();
  const ctx = tenantOf(session);
  const input = await parseJson(req, enableSchema);
  const result = await enableLock(ctx, params.id, session.id, input);
  await logFromRequest(req, ctx, session, {
    action: "customCompliance.group.lock.enabled",
    entityType: "customComplianceGroup",
    entityId: params.id,
    entityLabel: result.name,
    summary: `Locked compliance folder "${result.name}"`,
    metadata: {
      recoveryEmail: input.email.toLowerCase().trim(),
    },
  });
  return created({ ok: true }, "Folder locked");
}, { auth: true, roles: ["ADMIN"] });

const removeSchema = z.object({
  password: z.string().min(1).max(200),
});

/**
 * Remove the lock entirely. Requires the current password as proof of
 * knowledge — caller who forgot must reset first via the OTP flow.
 */
export const DELETE = withRoute<{ id: string }>(async ({ req, params, session }) => {
  if (!session) throw new UnauthorizedError();
  const ctx = tenantOf(session);
  const input = await parseJson(req, removeSchema);
  await removeLock(ctx, params.id, input.password);
  const after = await CustomComplianceGroup.findById(params.id)
    .select("name")
    .lean();
  const name = (after as { name?: string } | null)?.name ?? "Folder";
  await logFromRequest(req, ctx, session, {
    action: "customCompliance.group.lock.disabled",
    entityType: "customComplianceGroup",
    entityId: params.id,
    entityLabel: name,
    summary: `Removed lock from compliance folder "${name}"`,
  });
  return success({ ok: true }, "Lock removed");
}, { auth: true, roles: ["ADMIN"] });
