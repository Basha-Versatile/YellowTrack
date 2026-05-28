import { withRoute, parseJson } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { z } from "zod";
import { tenantOf } from "@/lib/auth/tenant-context";
import * as vehicleRepo from "@/server/repositories/vehicle.repository";
import * as vehicleGroupRepo from "@/server/repositories/vehicleGroup.repository";
import { getVehicleById } from "@/server/services/vehicle.service";

export const runtime = "nodejs";

const bodySchema = z.object({
  groupIds: z.array(z.string()).default([]),
});

export const PATCH = withRoute<{ id: string }>(
  async ({ req, params, session }) => {
    const ctx = tenantOf(session);
    const { groupIds } = await parseJson(req, bodySchema);
    // Empty selection falls back to "Others" — the model invariant is "every
    // vehicle has at least one group".
    let resolved = (groupIds ?? []).filter(Boolean);
    if (resolved.length === 0) {
      const others = await vehicleGroupRepo.findOrCreateOthers(ctx);
      resolved = [String(others._id)];
    }
    await vehicleRepo.update(ctx, params.id, { groupIds: resolved });
    const updated = await getVehicleById(ctx, params.id);
    return success(updated, "Vehicle groups updated");
  },
  { auth: true },
);
