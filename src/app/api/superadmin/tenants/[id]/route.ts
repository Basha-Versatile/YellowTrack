import { withRoute, parseJson } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { updateTenantSchema } from "@/validations/tenant.schema";
import {
  deleteTenant,
  getTenantById,
  updateTenant,
} from "@/server/services/tenant.service";

export const runtime = "nodejs";

export const GET = withRoute<{ id: string }>(
  async ({ params }) => {
    const tenant = await getTenantById(params.id);
    return success(tenant, "Tenant fetched");
  },
  { auth: true, roles: ["SUPERADMIN"] },
);

export const PATCH = withRoute<{ id: string }>(
  async ({ req, params }) => {
    const input = await parseJson(req, updateTenantSchema);
    const tenant = await updateTenant(params.id, input);
    return success(tenant, "Tenant updated");
  },
  { auth: true, roles: ["SUPERADMIN"] },
);

export const DELETE = withRoute<{ id: string }>(
  async ({ params }) => {
    await deleteTenant(params.id);
    return success(null, "Tenant deleted");
  },
  { auth: true, roles: ["SUPERADMIN"] },
);
