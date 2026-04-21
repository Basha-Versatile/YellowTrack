import { withRoute, parseJson } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { z } from "zod";
import * as vehicleRepo from "@/server/repositories/vehicle.repository";
import { getVehicleById } from "@/server/services/vehicle.service";

export const runtime = "nodejs";

const bodySchema = z.object({
  groupId: z.string().nullable().optional(),
});

export const PATCH = withRoute<{ id: string }>(
  async ({ req, params }) => {
    const { groupId } = await parseJson(req, bodySchema);
    await vehicleRepo.update(params.id, { groupId: groupId || null });
    const updated = await getVehicleById(params.id);
    return success(updated, "Vehicle group updated");
  },
  { auth: true },
);
