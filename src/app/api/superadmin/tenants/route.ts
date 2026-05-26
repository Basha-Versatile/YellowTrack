import { withRoute, parseQuery } from "@/lib/api-handler";
import { success, created } from "@/lib/http";
import { parseMultipart, firstFile, firstString } from "@/lib/upload";
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
    const { fields, files } = await parseMultipart(req);
    const logoFile = firstFile(files, "logo");
    const adminProfileFile = firstFile(files, "adminProfileImage");

    const input = createTenantSchema.parse({
      name: firstString(fields, "name"),
      slug: firstString(fields, "slug"),
      planId: firstString(fields, "planId") || null,
      billingEmail: firstString(fields, "billingEmail") || null,
      logoUrl: logoFile?.url ?? null,
      gstNumber: firstString(fields, "gstNumber") || null,
      panNumber: firstString(fields, "panNumber") || null,
      tanNumber: firstString(fields, "tanNumber") || null,
      admin: {
        name: firstString(fields, "adminName"),
        email: firstString(fields, "adminEmail"),
        profileImage: adminProfileFile?.url ?? null,
      },
    });

    const result = await provisionTenant(input);
    return created(result, "Tenant provisioned");
  },
  { auth: true, roles: ["SUPERADMIN"] },
);
