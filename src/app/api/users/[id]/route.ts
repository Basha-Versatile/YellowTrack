import { withRoute, parseJson } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { z } from "zod";
import { tenantOf } from "@/lib/auth/tenant-context";
import { requirePermission } from "@/lib/auth/guard";
import {
  deleteUserAccount,
  updateUserRole,
} from "@/server/services/role.service";
import { logFromRequest } from "@/server/services/activityLog.service";

export const runtime = "nodejs";

const updateSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  roleId: z.string().nullable().optional(),
});

export const PATCH = withRoute<{ id: string }>(
  async ({ req, params, session }) => {
    await requirePermission(session, "settings.users:manage");
    const ctx = tenantOf(session);
    const input = await parseJson(req, updateSchema);
    const user = await updateUserRole(ctx, params.id, input);
    const u = user as { name?: string; email?: string };
    await logFromRequest(req, ctx, session, {
      action: "user.update",
      entityType: "user",
      entityId: params.id,
      entityLabel: u.name ?? u.email ?? params.id,
      summary: `Updated ${u.name ?? u.email ?? "user"}`,
      metadata: input as Record<string, unknown>,
    });
    return success(user, "User updated");
  },
  { auth: true },
);

export const DELETE = withRoute<{ id: string }>(
  async ({ req, params, session }) => {
    await requirePermission(session, "settings.users:manage");
    const ctx = tenantOf(session);
    await deleteUserAccount(ctx, params.id);
    await logFromRequest(req, ctx, session, {
      action: "user.delete",
      entityType: "user",
      entityId: params.id,
      entityLabel: params.id,
      summary: `Deleted user account`,
    });
    return success(null, "User deleted");
  },
  { auth: true },
);
