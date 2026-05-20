import { withRoute, parseJson } from "@/lib/api-handler";
import { success, created } from "@/lib/http";
import { z } from "zod";
import { tenantOf } from "@/lib/auth/tenant-context";
import { requirePermission } from "@/lib/auth/guard";
import {
  createRole,
  listRoles,
} from "@/server/services/role.service";
import { logFromRequest } from "@/server/services/activityLog.service";

export const runtime = "nodejs";

const createSchema = z.object({
  name: z.string().min(1).max(60).trim(),
  description: z.string().max(200).optional(),
  permissions: z.array(z.string()).default([]),
});

export const GET = withRoute(
  async ({ session }) => {
    await requirePermission(session, "settings.roles:manage");
    const ctx = tenantOf(session);
    const roles = await listRoles(ctx);
    return success(roles, "Roles");
  },
  { auth: true },
);

export const POST = withRoute(
  async ({ req, session }) => {
    await requirePermission(session, "settings.roles:manage");
    const ctx = tenantOf(session);
    const input = await parseJson(req, createSchema);
    const role = await createRole(ctx, input);
    const r = role as unknown as { id?: unknown; _id?: unknown; name?: string };
    await logFromRequest(req, ctx, session, {
      action: "role.create",
      entityType: "role",
      entityId: String(r.id ?? r._id ?? ""),
      entityLabel: r.name ?? input.name,
      summary: `Created role "${input.name}"`,
      metadata: { permissionCount: (input.permissions ?? []).length },
    });
    return created(role, "Role created");
  },
  { auth: true },
);
