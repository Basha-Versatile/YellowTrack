import { withRoute, parseJson } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { z } from "zod";
import { NotFoundError } from "@/lib/errors";
import { ServicePart } from "@/models";
import { tenantOf, tenantFilter, tenantStamp } from "@/lib/auth/tenant-context";
import * as vehicleRepo from "@/server/repositories/vehicle.repository";
import { getVehicleById } from "@/server/services/vehicle.service";

export const runtime = "nodejs";

const partSchema = z.object({
  name: z.string().min(1).max(80),
  partNumber: z.string().max(80).optional().nullable(),
  notes: z.string().max(200).optional().nullable(),
});

const bodySchema = z.object({
  parts: z.array(partSchema),
});

export const PUT = withRoute<{ id: string }>(
  async ({ req, params, session }) => {
    const ctx = tenantOf(session);
    const { parts } = await parseJson(req, bodySchema);

    const vehicle = await vehicleRepo.findById(ctx, params.id);
    if (!vehicle) throw new NotFoundError("Vehicle not found");

    await ServicePart.deleteMany(tenantFilter(ctx, { vehicleId: params.id }));
    if (parts.length > 0) {
      const stamp = tenantStamp(ctx);
      await ServicePart.insertMany(
        parts.map((p) => ({
          ...stamp,
          vehicleId: params.id,
          name: p.name.trim(),
          partNumber: p.partNumber?.trim() || null,
          notes: p.notes?.trim() || null,
        })),
      );
    }

    const updated = await getVehicleById(ctx, params.id);
    return success(updated, "Service parts updated successfully");
  },
  { auth: true },
);
