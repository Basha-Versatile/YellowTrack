import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { tenantOf } from "@/lib/auth/tenant-context";
import { getVehicleById } from "@/server/services/vehicle.service";

export const runtime = "nodejs";

export const GET = withRoute<{ id: string }>(
  async ({ params, session }) => {
    const ctx = tenantOf(session);
    const vehicle = await getVehicleById(ctx, params.id);
    return success(vehicle, "Vehicle fetched successfully");
  },
  { auth: true },
);
