import { z } from "zod";

export const createDocTypeSchema = z.object({
  code: z
    .string()
    .min(1, "Code is required")
    .max(30)
    .transform((v) => v.toUpperCase().replace(/\s+/g, "_")),
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().optional(),
  hasExpiry: z.boolean().default(true),
});

export const updateDocTypeSchema = z.object({
  // Custom (non-system) types support code renames now. Same normalization as
  // create — uppercased, spaces → underscores. System types reject this in
  // the service layer.
  code: z
    .string()
    .min(1)
    .max(30)
    .transform((v) => v.toUpperCase().replace(/\s+/g, "_"))
    .optional(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  hasExpiry: z.boolean().optional(),
});

export type CreateDocTypeInput = z.infer<typeof createDocTypeSchema>;
export type UpdateDocTypeInput = z.infer<typeof updateDocTypeSchema>;
