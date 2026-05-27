import { withRoute, parseJson } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { z } from "zod";
import { tenantOf, tenantFilter } from "@/lib/auth/tenant-context";
import { requirePermission } from "@/lib/auth/guard";
import {
  deleteUserAccount,
  updateUserRole,
} from "@/server/services/role.service";
import { logFromRequest } from "@/server/services/activityLog.service";
import { User } from "@/models";

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
    // Snapshot only the fields being changed so revert restores exactly them.
    const before = await User.findOne(
      tenantFilter(ctx, { _id: params.id }),
    ).lean();
    const user = await updateUserRole(ctx, params.id, input);
    const u = user as { name?: string; email?: string };
    const beforeSnapshot = before
      ? Object.fromEntries(
          Object.keys(input as Record<string, unknown>).map((k) => [
            k,
            (before as unknown as Record<string, unknown>)[k] ?? null,
          ]),
        )
      : null;
    await logFromRequest(req, ctx, session, {
      action: "user.update",
      entityType: "user",
      entityId: params.id,
      entityLabel: u.name ?? u.email ?? params.id,
      summary: `Updated ${u.name ?? u.email ?? "user"}`,
      metadata: input as Record<string, unknown>,
      revertable: Boolean(beforeSnapshot),
      beforeSnapshot,
    });
    return success(user, "User updated");
  },
  { auth: true },
);

export const DELETE = withRoute<{ id: string }>(
  async ({ req, params, session }) => {
    await requirePermission(session, "settings.users:manage");
    const ctx = tenantOf(session);
    // Snapshot the full row BEFORE deletion so revert can rebuild it.
    const before = await User.findOne(
      tenantFilter(ctx, { _id: params.id }),
    ).lean();
    await deleteUserAccount(ctx, params.id);
    const label =
      (before as { name?: string; email?: string } | null)?.name ??
      (before as { email?: string } | null)?.email ??
      params.id;
    await logFromRequest(req, ctx, session, {
      action: "user.delete",
      entityType: "user",
      entityId: params.id,
      entityLabel: label,
      summary: `Deleted user account`,
      revertable: Boolean(before),
      beforeSnapshot: before as Record<string, unknown> | null,
    });
    return success(null, "User deleted");
  },
  { auth: true },
);
