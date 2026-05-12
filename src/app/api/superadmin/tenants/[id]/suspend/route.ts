import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import {
  resumeTenant,
  suspendTenant,
} from "@/server/services/tenant.service";

export const runtime = "nodejs";

export const POST = withRoute<{ id: string }>(
  async ({ params }) => {
    const tenant = await suspendTenant(params.id);
    return success(tenant, "Tenant suspended");
  },
  { auth: true, roles: ["SUPERADMIN"] },
);

export const DELETE = withRoute<{ id: string }>(
  async ({ params }) => {
    const tenant = await resumeTenant(params.id);
    return success(tenant, "Tenant resumed");
  },
  { auth: true, roles: ["SUPERADMIN"] },
);
