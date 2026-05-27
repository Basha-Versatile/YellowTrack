import { withRoute } from "@/lib/api-handler";
import { success, created } from "@/lib/http";
import { z } from "zod";
import { tenantOf } from "@/lib/auth/tenant-context";
import { requirePermission } from "@/lib/auth/guard";
import { parseMultipart, firstFile, firstString } from "@/lib/upload";
import {
  inviteUser,
  listTenantUsers,
} from "@/server/services/role.service";
import { logFromRequest } from "@/server/services/activityLog.service";

export const runtime = "nodejs";

const inviteSchema = z.object({
  name: z.string().min(1).max(80).trim(),
  email: z.string().email(),
  roleId: z.string().nullable().optional(),
  profileImage: z.string().min(1).nullable().optional(),
});

export const GET = withRoute(
  async ({ session }) => {
    await requirePermission(session, "settings.users:manage");
    const ctx = tenantOf(session);
    const users = await listTenantUsers(ctx);
    return success(users, "Users");
  },
  { auth: true },
);

export const POST = withRoute(
  async ({ req, session }) => {
    await requirePermission(session, "settings.users:manage");
    const ctx = tenantOf(session);
    const { fields, files } = await parseMultipart(req);
    const profileFile = firstFile(files, "profileImage");
    const input = inviteSchema.parse({
      name: firstString(fields, "name"),
      email: firstString(fields, "email"),
      roleId: firstString(fields, "roleId") || null,
      profileImage: profileFile?.url ?? null,
    });
    const result = await inviteUser(ctx, input);
    const r = result as { user?: { id?: string; name?: string; email?: string } };
    await logFromRequest(req, ctx, session, {
      action: "user.invite",
      entityType: "user",
      entityId: r.user?.id ?? null,
      entityLabel: r.user?.name ?? input.name,
      summary: `Invited ${input.name} (${input.email})`,
      metadata: { email: input.email, roleId: input.roleId ?? null },
      revertable: true,
    });
    return created(result, "User invited");
  },
  { auth: true },
);
