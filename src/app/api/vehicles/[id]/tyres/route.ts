import { withRoute, parseJson } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { z } from "zod";
import { NotFoundError } from "@/lib/errors";
import { Tyre } from "@/models";
import { tenantOf, tenantFilter, tenantStamp } from "@/lib/auth/tenant-context";
import * as vehicleRepo from "@/server/repositories/vehicle.repository";
import { getVehicleById } from "@/server/services/vehicle.service";

export const runtime = "nodejs";

const tyreSchema = z.object({
  position: z.string().min(1),
  size: z.string().optional().nullable(),
  brand: z.string().max(80).optional().nullable(),
});

const bodySchema = z.object({
  tyreCount: z.coerce.number().int().min(2).max(20).optional(),
  tyres: z.array(tyreSchema),
});

export const PUT = withRoute<{ id: string }>(
  async ({ req, params, session }) => {
    const ctx = tenantOf(session);
    const { tyres, tyreCount } = await parseJson(req, bodySchema);

    const vehicle = await vehicleRepo.findById(ctx, params.id);
    if (!vehicle) throw new NotFoundError("Vehicle not found");

    if (typeof tyreCount === "number") {
      await vehicleRepo.update(ctx, params.id, { tyreCount });
    }

    await Tyre.deleteMany(tenantFilter(ctx, { vehicleId: params.id }));
    if (tyres.length > 0) {
      const stamp = tenantStamp(ctx);
      await Tyre.insertMany(
        tyres.map((t) => ({
          ...stamp,
          vehicleId: params.id,
          position: t.position,
          size: t.size ?? null,
          brand: t.brand?.trim() || null,
        })),
      );
    }

    const updated = await getVehicleById(ctx, params.id);
    return success(updated, "Tyres updated successfully");
  },
  { auth: true },
);
