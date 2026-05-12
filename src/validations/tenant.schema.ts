import { z } from "zod";

const slugRule = z
  .string()
  .min(2)
  .max(40)
  .regex(/^[a-z0-9-]+$/, "Slug may contain only lowercase letters, digits, and dashes");

export const createTenantSchema = z.object({
  name: z.string().min(2).max(80).trim(),
  slug: slugRule,
  plan: z.enum(["FREE", "PRO", "ENTERPRISE"]).optional(),
  billingEmail: z.string().email().optional().nullable(),
  limits: z
    .object({
      maxVehicles: z.coerce.number().int().positive().optional(),
      maxDrivers: z.coerce.number().int().positive().optional(),
      maxUsers: z.coerce.number().int().positive().optional(),
    })
    .optional(),
  admin: z.object({
    name: z.string().min(2).max(80).trim(),
    email: z.string().email().toLowerCase(),
  }),
});

export const updateTenantSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  plan: z.enum(["FREE", "PRO", "ENTERPRISE"]).optional(),
  billingEmail: z.string().email().nullable().optional(),
  limits: z
    .object({
      maxVehicles: z.coerce.number().int().positive().optional(),
      maxDrivers: z.coerce.number().int().positive().optional(),
      maxUsers: z.coerce.number().int().positive().optional(),
    })
    .optional(),
});

export const listTenantsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  status: z.enum(["ACTIVE", "SUSPENDED", "DELETED"]).optional(),
  plan: z.enum(["FREE", "PRO", "ENTERPRISE"]).optional(),
});

export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;
