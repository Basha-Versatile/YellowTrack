import { z } from "zod";

const slugRule = z
  .string()
  .min(2)
  .max(40)
  .regex(/^[a-z0-9-]+$/, "Slug may contain only lowercase letters, digits, and dashes");

// Format-only checks — the user can leave these blank. We strip every non-
// alphanumeric character (so spaces, hyphens, and stray punctuation are
// forgiven) and uppercase before testing against the strict Indian patterns.
const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const TAN_REGEX = /^[A-Z]{4}[0-9]{5}[A-Z]$/;

function optionalTaxId(pattern: RegExp, label: string, example: string) {
  return z
    .string()
    .nullable()
    .optional()
    .transform((v) => {
      if (!v) return null;
      const cleaned = v.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
      return cleaned.length === 0 ? null : cleaned;
    })
    .refine((v) => !v || pattern.test(v), {
      message: `Invalid ${label}. Expected format like "${example}".`,
    });
}

export const createTenantSchema = z.object({
  name: z.string().min(2).max(80).trim(),
  slug: slugRule,
  planId: z.string().nullable().optional(),
  billingEmail: z.string().email().nullable().optional(),
  // Optional logo URL — set by the route handler after parsing the
  // multipart file upload via the storage driver.
  logoUrl: z.string().url().nullable().optional(),
  gstNumber: optionalTaxId(GST_REGEX, "GST number", "27AAPCS9988A1Z5"),
  panNumber: optionalTaxId(PAN_REGEX, "PAN number", "AAPCS9988A"),
  tanNumber: optionalTaxId(TAN_REGEX, "TAN number", "BLRA12345C"),
  admin: z.object({
    name: z.string().min(2).max(80).trim(),
    email: z.string().email().toLowerCase(),
    // Optional profile image URL — same pattern as logoUrl.
    profileImage: z.string().url().nullable().optional(),
  }),
});

export const updateTenantSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  billingEmail: z.string().email().nullable().optional(),
  gstNumber: optionalTaxId(GST_REGEX, "GST number", "27AAPCS9988A1Z5"),
  panNumber: optionalTaxId(PAN_REGEX, "PAN number", "AAPCS9988A"),
  tanNumber: optionalTaxId(TAN_REGEX, "TAN number", "BLRA12345C"),
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
