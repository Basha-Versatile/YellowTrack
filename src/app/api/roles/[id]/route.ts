import { withRoute, parseJson } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { z } from "zod";
import { tenantOf, tenantFilter } from "@/lib/auth/tenant-context";
import { requirePermission } from "@/lib/auth/guard";
import {
  deleteRole,
  getRoleById,
  updateRole,
} from "@/server/services/role.service";
import { logFromRequest } from "@/server/services/activityLog.service";
import { Role } from "@/models";

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
    const before = await Role.findOne(
      tenantFilter(ctx, { _id: params.id }),
    ).lean();
    const role = await updateRole(ctx, params.id, input);
    const r = role as { name?: string };
    const beforeSnapshot = before
      ? Object.fromEntries(
          Object.keys(input as Record<string, unknown>).map((k) => [
            k,
            (before as unknown as Record<string, unknown>)[k] ?? null,
          ]),
        )
      : null;
    await logFromRequest(req, ctx, session, {
      action: "role.update",
      entityType: "role",
      entityId: params.id,
      entityLabel: r.name ?? params.id,
      summary: `Updated role "${r.name ?? params.id}"`,
      metadata: input as Record<string, unknown>,
      revertable: Boolean(beforeSnapshot),
      beforeSnapshot,
    });
    return success(role, "Role updated");
  },
  { auth: true },
);

export const DELETE = withRoute<{ id: string }>(
  async ({ req, params, session }) => {
    await requirePermission(session, "settings.roles:manage");
    const ctx = tenantOf(session);
    let label = params.id;
    let beforeSnap: Record<string, unknown> | null = null;
    try {
      const r = await Role.findOne(
        tenantFilter(ctx, { _id: params.id }),
      ).lean();
      label = (r as { name?: string } | null)?.name ?? params.id;
      beforeSnap = r as Record<string, unknown> | null;
    } catch { /* ignore */ }
    await deleteRole(ctx, params.id);
    await logFromRequest(req, ctx, session, {
      action: "role.delete",
      entityType: "role",
      entityId: params.id,
      entityLabel: label,
      summary: `Deleted role "${label}"`,
      revertable: Boolean(beforeSnap),
      beforeSnapshot: beforeSnap,
    });
    return success(null, "Role deleted");
  },
  { auth: true },
);
