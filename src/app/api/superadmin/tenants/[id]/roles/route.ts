import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { superadminTenantOf } from "@/lib/auth/tenant-context";
import { listRoles } from "@/server/services/role.service";

export const runtime = "nodejs";

export const GET = withRoute<{ id: string }>(
  async ({ session, params }) => {
    const ctx = superadminTenantOf(session, params.id);
    const roles = await listRoles(ctx);
    return success(roles, "Tenant roles");
  },
  { auth: true, roles: ["SUPERADMIN"] },
);
