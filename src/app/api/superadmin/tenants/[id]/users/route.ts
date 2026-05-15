import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { superadminTenantOf } from "@/lib/auth/tenant-context";
import { listTenantUsers } from "@/server/services/role.service";

export const runtime = "nodejs";

export const GET = withRoute<{ id: string }>(
  async ({ session, params }) => {
    const ctx = superadminTenantOf(session, params.id);
    const users = await listTenantUsers(ctx);
    return success(users, "Tenant users");
  },
  { auth: true, roles: ["SUPERADMIN"] },
);
