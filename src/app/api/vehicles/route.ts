import { withRoute, parseQuery } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { getVehiclesQuerySchema } from "@/validations/vehicle.schema";
import { getAllVehicles } from "@/server/services/vehicle.service";

export const runtime = "nodejs";

export const GET = withRoute(
  async ({ req }) => {
    const query = parseQuery(req, getVehiclesQuerySchema);
    const result = await getAllVehicles(query);
    return success(result, "Vehicles fetched successfully");
  },
  { auth: true },
);
