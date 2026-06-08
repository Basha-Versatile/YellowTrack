import { withRoute, parseJson } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { z } from "zod";
import { tenantOf } from "@/lib/auth/tenant-context";
import { UnauthorizedError } from "@/lib/errors";
import { verifyAndUnlock } from "@/server/services/customComplianceLock.service";
import { logFromRequest } from "@/server/services/activityLog.service";
import { CustomComplianceGroup } from "@/models";

export const runtime = "nodejs";

/**
 * Verify the typed password. On success, the caller gets a 3-minute
 * per-user unlock grant; the response carries the absolute unlock-until
 * timestamp so the UI can run an accurate countdown without any clock
 * drift assumptions.
 *
 * On failure the route returns 401 (incorrect password) or 429 (folder
 * is currently rate-limited because of too many recent failures).
 */
const bodySchema = z.object({
  password: z.string().min(1).max(200),
});

export const POST = withRoute<{ id: string }>(
  async ({ req, params, session }) => {
    if (!session) throw new UnauthorizedError();
    const ctx = tenantOf(session);
    const input = await parseJson(req, bodySchema);
    const result = await verifyAndUnlock(
      ctx,
      params.id,
      session.id,
      input.password,
    );
    const group = await CustomComplianceGroup.findById(params.id)
      .select("name")
      .lean();
    const name = (group as { name?: string } | null)?.name ?? "Folder";
    await logFromRequest(req, ctx, session, {
      action: "customCompliance.group.lock.unlocked",
      entityType: "customComplianceGroup",
      entityId: params.id,
      entityLabel: name,
      summary: `Unlocked compliance folder "${name}"`,
    });
    return success(
      { unlockedUntil: result.unlockedUntil.toISOString() },
      "Folder unlocked",
    );
  },
  { auth: true },
);
