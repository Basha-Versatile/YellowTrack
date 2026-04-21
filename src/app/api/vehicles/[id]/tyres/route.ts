import { withRoute, parseJson } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { z } from "zod";
import { NotFoundError } from "@/lib/errors";
import { Tyre } from "@/models";
import * as vehicleRepo from "@/server/repositories/vehicle.repository";
import { getVehicleById } from "@/server/services/vehicle.service";

export const runtime = "nodejs";

const tyreSchema = z.object({
  position: z.string().min(1),
  brand: z.string().optional().nullable(),
  size: z.string().optional().nullable(),
  installedAt: z.string().optional().nullable(),
  kmAtInstall: z.coerce.number().int().optional().nullable(),
  condition: z.enum(["GOOD", "AVERAGE", "REPLACE"]).optional(),
});

const bodySchema = z.object({
  tyres: z.array(tyreSchema),
});

export const PUT = withRoute<{ id: string }>(
  async ({ req, params }) => {
    const { tyres } = await parseJson(req, bodySchema);

    const vehicle = await vehicleRepo.findById(params.id);
    if (!vehicle) throw new NotFoundError("Vehicle not found");

    await Tyre.deleteMany({ vehicleId: params.id });
    if (tyres.length > 0) {
      await Tyre.insertMany(
        tyres.map((t) => ({
          vehicleId: params.id,
          position: t.position,
          brand: t.brand ?? null,
          size: t.size ?? null,
          installedAt: t.installedAt ? new Date(t.installedAt) : null,
          kmAtInstall: t.kmAtInstall ?? null,
          condition: t.condition ?? "GOOD",
        })),
      );
    }

    const updated = await getVehicleById(params.id);
    return success(updated, "Tyres updated successfully");
  },
  { auth: true },
);
