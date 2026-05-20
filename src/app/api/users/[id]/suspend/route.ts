import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { tenantOf } from "@/lib/auth/tenant-context";
import { requirePermission } from "@/lib/auth/guard";
import { setUserStatus } from "@/server/services/role.service";
import { logFromRequest } from "@/server/services/activityLog.service";

export const runtime = "nodejs";

export const POST = withRoute<{ id: string }>(
  async ({ req, params, session }) => {
    await requirePermission(session, "settings.users:manage");
    const ctx = tenantOf(session);
    const user = await setUserStatus(ctx, params.id, "SUSPENDED");
    const u = user as { name?: string; email?: string };
    await logFromRequest(req, ctx, session, {
      action: "user.suspend",
      entityType: "user",
      entityId: params.id,
      entityLabel: u.name ?? u.email ?? params.id,
      summary: `Suspended ${u.name ?? u.email ?? "user"}`,
    });
    return success(user, "User suspended");
  },
  { auth: true },
);

export const DELETE = withRoute<{ id: string }>(
  async ({ req, params, session }) => {
    await requirePermission(session, "settings.users:manage");
    const ctx = tenantOf(session);
    const user = await setUserStatus(ctx, params.id, "ACTIVE");
    const u = user as { name?: string; email?: string };
    await logFromRequest(req, ctx, session, {
      action: "user.resume",
      entityType: "user",
      entityId: params.id,
      entityLabel: u.name ?? u.email ?? params.id,
      summary: `Resumed ${u.name ?? u.email ?? "user"}`,
    });
    return success(user, "User resumed");
  },
  { auth: true },
);
