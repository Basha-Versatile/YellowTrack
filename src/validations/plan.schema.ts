import { z } from "zod";

const positiveNumber = z.coerce.number().min(0);
const positiveInt = z.coerce.number().int().min(0);

export const createPlanSchema = z
  .object({
    name: z.string().min(1).max(80).trim(),
    description: z.string().max(240).nullable().optional(),
    currency: z.string().length(3).optional(),
    isActive: z.boolean().optional(),

    fleetSizeMin: positiveInt.default(0),
    // null/undefined → unlimited upper bound.
    fleetSizeMax: positiveInt.nullable().optional(),

    perVehiclePerMonth: positiveNumber,
    perVehiclePerYear: positiveNumber,
    perDriverPerMonth: positiveNumber.default(0),
    gstPercent: z.coerce.number().min(0).max(100).default(18),
  })
  .refine(
    (d) =>
      d.fleetSizeMax === null ||
      d.fleetSizeMax === undefined ||
      d.fleetSizeMax >= d.fleetSizeMin,
    {
      message: "Fleet-size max must be greater than or equal to fleet-size min",
      path: ["fleetSizeMax"],
    },
  );

export const updatePlanSchema = createPlanSchema.innerType().partial();

export type CreatePlanInput = z.infer<typeof createPlanSchema>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;
