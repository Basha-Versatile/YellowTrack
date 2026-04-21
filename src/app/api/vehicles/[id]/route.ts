import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { getVehicleById } from "@/server/services/vehicle.service";

export const runtime = "nodejs";

export const GET = withRoute<{ id: string }>(
  async ({ params }) => {
    const vehicle = await getVehicleById(params.id);
    return success(vehicle, "Vehicle fetched successfully");
  },
  { auth: true },
);
