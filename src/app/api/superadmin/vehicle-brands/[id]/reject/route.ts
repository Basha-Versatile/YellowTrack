import { withRoute, parseJson } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { UnauthorizedError } from "@/lib/errors";
import { rejectBrand } from "@/server/services/vehicleBrand.service";
import { rejectVehicleBrandSchema } from "@/validations/vehicleBrand.schema";

export const runtime = "nodejs";

export const POST = withRoute<{ id: string }>(
  async ({ req, params, session }) => {
    if (!session) throw new UnauthorizedError();
    const input = await parseJson(req, rejectVehicleBrandSchema);
    const brand = await rejectBrand(params.id, input.reason, session.id);
    return success(brand, "Brand rejected");
  },
  { auth: true, roles: ["SUPERADMIN"] },
);
