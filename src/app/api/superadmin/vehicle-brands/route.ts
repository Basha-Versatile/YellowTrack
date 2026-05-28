import { withRoute } from "@/lib/api-handler";
import { success, created } from "@/lib/http";
import { UnauthorizedError } from "@/lib/errors";
import { parseMultipart, firstFile, firstString } from "@/lib/upload";
import {
  createBrandAsSuperadmin,
  listBrandsForSuperadmin,
} from "@/server/services/vehicleBrand.service";
import {
  createVehicleBrandSchema,
  listVehicleBrandsQuerySchema,
} from "@/validations/vehicleBrand.schema";

export const runtime = "nodejs";

export const GET = withRoute(
  async ({ req, session }) => {
    if (!session) throw new UnauthorizedError();
    const url = new URL(req.url);
    const params = listVehicleBrandsQuerySchema.parse({
      status: url.searchParams.get("status") ?? undefined,
      search: url.searchParams.get("search") ?? undefined,
    });
    const brands = await listBrandsForSuperadmin(params);
    return success(brands, "Brands");
  },
  { auth: true, roles: ["SUPERADMIN"] },
);

export const POST = withRoute(
  async ({ req, session }) => {
    if (!session) throw new UnauthorizedError();
    const { fields, files } = await parseMultipart(req);
    const logoFile = firstFile(files, "logo");
    const input = createVehicleBrandSchema.parse({
      name: firstString(fields, "name"),
      logoUrl: logoFile?.url ?? null,
      iconKey: firstString(fields, "iconKey") || null,
      description: firstString(fields, "description") || null,
    });
    const brand = await createBrandAsSuperadmin(input, session.id);
    return created(brand, "Brand created");
  },
  { auth: true, roles: ["SUPERADMIN"] },
);
