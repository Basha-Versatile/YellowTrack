import { withRoute, parseJson } from "@/lib/api-handler";
import { success, created } from "@/lib/http";
import { tenantOf } from "@/lib/auth/tenant-context";
import { UnauthorizedError } from "@/lib/errors";
import {
  listBrandsForTenant,
  requestBrandFromTenant,
} from "@/server/services/vehicleBrand.service";
import { requestVehicleBrandSchema } from "@/validations/vehicleBrand.schema";

export const runtime = "nodejs";

/**
 * Tenant-scoped brand catalog.
 *
 * GET  → every APPROVED brand + this tenant's own PENDING requests.
 * POST → submit a new brand request (becomes PENDING; superadmin gets emailed).
 */

export const GET = withRoute(
  async ({ session }) => {
    if (!session) throw new UnauthorizedError();
    const ctx = tenantOf(session);
    const brands = await listBrandsForTenant(ctx.tenantId);
    return success(brands, "Brands");
  },
  { auth: true },
);

export const POST = withRoute(
  async ({ req, session }) => {
    if (!session) throw new UnauthorizedError();
    const ctx = tenantOf(session);
    const input = await parseJson(req, requestVehicleBrandSchema);
    const brand = await requestBrandFromTenant(input, {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
    });
    return created(brand, "Brand request submitted");
  },
  { auth: true },
);
