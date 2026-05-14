import { z } from "zod";

const quotaField = z.coerce.number().int().min(0).max(1_000_000).nullable().optional();

export const createPlanSchema = z.object({
  name: z.string().min(1).max(80).trim(),
  description: z.string().max(240).nullable().optional(),
  price: z.coerce.number().min(0),
  currency: z.string().length(3).optional(),
  durationDays: z.coerce.number().int().min(1).max(3650),
  isActive: z.boolean().optional(),
  maxVehicles: quotaField,
  maxDrivers: quotaField,
  maxUsers: quotaField,
  maxRoles: quotaField,
});

export const updatePlanSchema = createPlanSchema.partial();

export type CreatePlanInput = z.infer<typeof createPlanSchema>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;
