import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { tenantOf } from "@/lib/auth/tenant-context";
import { requirePermission } from "@/lib/auth/guard";
import { setUserStatus } from "@/server/services/role.service";

export const runtime = "nodejs";

export const POST = withRoute<{ id: string }>(
  async ({ params, session }) => {
    await requirePermission(session, "settings.users:manage");
    const ctx = tenantOf(session);
    const user = await setUserStatus(ctx, params.id, "SUSPENDED");
    return success(user, "User suspended");
  },
  { auth: true },
);

export const DELETE = withRoute<{ id: string }>(
  async ({ params, session }) => {
    await requirePermission(session, "settings.users:manage");
    const ctx = tenantOf(session);
    const user = await setUserStatus(ctx, params.id, "ACTIVE");
    return success(user, "User resumed");
  },
  { auth: true },
);
