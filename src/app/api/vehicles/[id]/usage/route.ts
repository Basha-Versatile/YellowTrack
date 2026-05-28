import { withRoute, parseJson } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { z } from "zod";
import { tenantOf } from "@/lib/auth/tenant-context";
import * as vehicleRepo from "@/server/repositories/vehicle.repository";
import { getVehicleById } from "@/server/services/vehicle.service";

export const runtime = "nodejs";

const bodySchema = z.object({
  vehicleUsage: z.enum(["PRIVATE", "COMMERCIAL"]).nullable().optional(),
});

export const PATCH = withRoute<{ id: string }>(
  async ({ req, params, session }) => {
    const ctx = tenantOf(session);
    const { vehicleUsage } = await parseJson(req, bodySchema);
    await vehicleRepo.update(ctx, params.id, {
      vehicleUsage: vehicleUsage ?? null,
    });
    const updated = await getVehicleById(ctx, params.id);
    return success(updated, "Vehicle usage updated");
  },
  { auth: true },
);
