import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { tenantOf } from "@/lib/auth/tenant-context";
import { requirePermission } from "@/lib/auth/guard";
import { resetUserPassword } from "@/server/services/role.service";

export const runtime = "nodejs";

export const POST = withRoute<{ id: string }>(
  async ({ params, session }) => {
    await requirePermission(session, "settings.users:manage");
    const ctx = tenantOf(session);
    const result = await resetUserPassword(ctx, params.id);
    return success(result, "Password reset. The user must set a new password on next sign-in.");
  },
  { auth: true },
);
