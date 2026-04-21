import { withRoute, parseJson } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { assignDriverSchema } from "@/validations/driver.schema";
import { assignDriverToVehicle } from "@/server/services/driver.service";

export const runtime = "nodejs";

export const POST = withRoute<{ id: string }>(
  async ({ req, params }) => {
    const { vehicleId } = await parseJson(req, assignDriverSchema);
    const mapping = await assignDriverToVehicle(params.id, vehicleId);
    return success(mapping, "Driver assigned to vehicle successfully");
  },
  { auth: true },
);
