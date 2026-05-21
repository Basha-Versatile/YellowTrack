import { withRoute, parseJson } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { z } from "zod";
import { tenantOf } from "@/lib/auth/tenant-context";
import * as vehicleRepo from "@/server/repositories/vehicle.repository";
import { getVehicleById } from "@/server/services/vehicle.service";

export const runtime = "nodejs";

const bodySchema = z.object({
  brand: z.string().trim().max(50).nullable().optional(),
});

export const PATCH = withRoute<{ id: string }>(
  async ({ req, params, session }) => {
    const ctx = tenantOf(session);
    const { brand } = await parseJson(req, bodySchema);
    const next = brand && brand.length > 0 ? brand : null;
    await vehicleRepo.update(ctx, params.id, { brand: next });
    const updated = await getVehicleById(ctx, params.id);
    return success(updated, "Vehicle brand updated");
  },
  { auth: true },
);
