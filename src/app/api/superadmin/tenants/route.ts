import { withRoute, parseJson, parseQuery } from "@/lib/api-handler";
import { success, created } from "@/lib/http";
import {
  createTenantSchema,
  listTenantsQuerySchema,
} from "@/validations/tenant.schema";
import {
  listTenants,
  provisionTenant,
} from "@/server/services/tenant.service";

export const runtime = "nodejs";

export const GET = withRoute(
  async ({ req }) => {
    const query = parseQuery(req, listTenantsQuerySchema);
    const result = await listTenants(query);
    return success(result, "Tenants fetched");
  },
  { auth: true, roles: ["SUPERADMIN"] },
);

export const POST = withRoute(
  async ({ req }) => {
    const input = await parseJson(req, createTenantSchema);
    const result = await provisionTenant(input);
    return created(result, "Tenant provisioned");
  },
  { auth: true, roles: ["SUPERADMIN"] },
);
