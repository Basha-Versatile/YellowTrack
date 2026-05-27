import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { tenantOf } from "@/lib/auth/tenant-context";
import { requirePermission } from "@/lib/auth/guard";
import { UnauthorizedError } from "@/lib/errors";
import { revertActivity } from "@/server/services/activityRevert.service";

export const runtime = "nodejs";

/**
 * POST /api/activity-log/:id/revert
 *
 * Reverses the action recorded by the given activity log entry. Returns 409
 * with a CONFLICT body when the entity has been modified after the log entry;
 * caller can retry with `?force=1` to override.
 */
export const POST = withRoute<{ id: string }>(
  async ({ req, session, params }) => {
    if (!session) throw new UnauthorizedError();
    await requirePermission(session, "activityLog:revert");
    const ctx = tenantOf(session);

    const url = new URL(req.url);
    const force = url.searchParams.get("force") === "1";

    const result = await revertActivity(ctx, session, params.id, { force });
    return success(result, "Action reverted");
  },
  { auth: true },
);
