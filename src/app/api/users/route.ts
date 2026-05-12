import { withRoute, parseJson } from "@/lib/api-handler";
import { success, created } from "@/lib/http";
import { z } from "zod";
import { tenantOf } from "@/lib/auth/tenant-context";
import { requirePermission } from "@/lib/auth/guard";
import {
  inviteUser,
  listTenantUsers,
} from "@/server/services/role.service";

export const runtime = "nodejs";

const inviteSchema = z.object({
  name: z.string().min(1).max(80).trim(),
  email: z.string().email(),
  roleId: z.string().nullable().optional(),
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
    const input = await parseJson(req, inviteSchema);
    const result = await inviteUser(ctx, input);
    return created(result, "User invited");
  },
  { auth: true },
);
