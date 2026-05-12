import { withRoute, parseJson } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { z } from "zod";
import { tenantOf } from "@/lib/auth/tenant-context";
import { requirePermission } from "@/lib/auth/guard";
import {
  deleteUserAccount,
  updateUserRole,
} from "@/server/services/role.service";

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
    return success(user, "User updated");
  },
  { auth: true },
);

export const DELETE = withRoute<{ id: string }>(
  async ({ params, session }) => {
    await requirePermission(session, "settings.users:manage");
    const ctx = tenantOf(session);
    await deleteUserAccount(ctx, params.id);
    return success(null, "User deleted");
  },
  { auth: true },
);
