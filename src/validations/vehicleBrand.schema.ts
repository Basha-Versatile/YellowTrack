import { z } from "zod";
import { VEHICLE_BRAND_ICON_KEYS } from "@/lib/vehicle-brand-icons";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

const nameRule = z
  .string()
  .min(1)
  .max(80)
  .transform((v) => v.trim());

const iconKeyRule = z
  .string()
  .nullable()
  .optional()
  .refine(
    (v) => !v || (VEHICLE_BRAND_ICON_KEYS as readonly string[]).includes(v),
    { message: "Unknown icon key" },
  );

export const createVehicleBrandSchema = z.object({
  name: nameRule,
  // logoUrl is filled by the route handler from the multipart upload.
  logoUrl: z.string().min(1).nullable().optional(),
  iconKey: iconKeyRule,
  description: z.string().max(240).nullable().optional(),
});

export const updateVehicleBrandSchema = z.object({
  name: nameRule.optional(),
  logoUrl: z.string().min(1).nullable().optional(),
  iconKey: iconKeyRule,
  description: z.string().max(240).nullable().optional(),
});

export const requestVehicleBrandSchema = z.object({
  name: nameRule,
  iconKey: iconKeyRule,
  description: z.string().max(240).nullable().optional(),
});

export const rejectVehicleBrandSchema = z.object({
  reason: z.string().max(240).optional(),
});

export const listVehicleBrandsQuerySchema = z.object({
  status: z.enum(["APPROVED", "PENDING", "REJECTED"]).optional(),
  search: z.string().optional(),
});

export type CreateVehicleBrandInput = z.infer<typeof createVehicleBrandSchema>;
export type UpdateVehicleBrandInput = z.infer<typeof updateVehicleBrandSchema>;
export type RequestVehicleBrandInput = z.infer<typeof requestVehicleBrandSchema>;

export { slugify as slugifyBrand };
