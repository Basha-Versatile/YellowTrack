import { withRoute, parseJson } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { z } from "zod";
import { tenantOf } from "@/lib/auth/tenant-context";
import { requirePermission } from "@/lib/auth/guard";
import {
  deleteRole,
  getRoleById,
  updateRole,
} from "@/server/services/role.service";

export const runtime = "nodejs";

const updateSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  description: z.string().max(200).nullable().optional(),
  permissions: z.array(z.string()).optional(),
});

export const GET = withRoute<{ id: string }>(
  async ({ params, session }) => {
    await requirePermission(session, "settings.roles:manage");
    const ctx = tenantOf(session);
    const role = await getRoleById(ctx, params.id);
    return success(role, "Role");
  },
  { auth: true },
);

export const PUT = withRoute<{ id: string }>(
  async ({ req, params, session }) => {
    await requirePermission(session, "settings.roles:manage");
    const ctx = tenantOf(session);
    const input = await parseJson(req, updateSchema);
    const role = await updateRole(ctx, params.id, input);
    return success(role, "Role updated");
  },
  { auth: true },
);

export const DELETE = withRoute<{ id: string }>(
  async ({ params, session }) => {
    await requirePermission(session, "settings.roles:manage");
    const ctx = tenantOf(session);
    await deleteRole(ctx, params.id);
    return success(null, "Role deleted");
  },
  { auth: true },
);
