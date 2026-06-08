import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { tenantOf } from "@/lib/auth/tenant-context";
import { UnauthorizedError } from "@/lib/errors";
import { relock } from "@/server/services/customComplianceLock.service";

export const runtime = "nodejs";

/**
 * "Re-lock now" — drops the caller's unlock grant immediately. Doesn't
 * affect other users with active grants.
 */
export const POST = withRoute<{ id: string }>(
  async ({ params, session }) => {
    if (!session) throw new UnauthorizedError();
    const ctx = tenantOf(session);
    await relock(ctx, params.id, session.id);
    return success({ ok: true }, "Folder re-locked");
  },
  { auth: true },
);
