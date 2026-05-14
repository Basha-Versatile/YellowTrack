import { z } from "zod";

const slugRule = z
  .string()
  .min(2)
  .max(40)
  .regex(/^[a-z0-9-]+$/, "Slug may contain only lowercase letters, digits, and dashes");

export const createTenantSchema = z.object({
  name: z.string().min(2).max(80).trim(),
  slug: slugRule,
  planId: z.string().nullable().optional(),
  billingEmail: z.string().email().nullable().optional(),
  admin: z.object({
    name: z.string().min(2).max(80).trim(),
    email: z.string().email().toLowerCase(),
  }),
});

export const updateTenantSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  billingEmail: z.string().email().nullable().optional(),
});

export const changePlanSchema = z.object({
  planId: z.string().min(1),
});

export const listTenantsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  status: z.enum(["ACTIVE", "SUSPENDED", "DELETED"]).optional(),
  subscriptionStatus: z
    .enum(["TRIAL", "ACTIVE", "EXPIRED", "CANCELLED"])
    .optional(),
});

export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;
