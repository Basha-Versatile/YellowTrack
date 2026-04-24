import { z } from "zod";

const optionalDate = z.preprocess(
  (val) => (val === "" || val === undefined || val === null ? undefined : val),
  z.coerce.date().optional().nullable(),
);

const lifetimeFlag = z.preprocess(
  (val) => val === "true" || val === true,
  z.boolean().default(false),
);

export const uploadComplianceDocSchema = z.object({
  type: z.enum(["RC", "INSURANCE", "PERMIT", "PUCC", "FITNESS", "TAX"]),
  expiryDate: optionalDate,
  lifetime: lifetimeFlag,
});

export const uploadDriverDocSchema = z.object({
  type: z
    .string()
    .trim()
    .min(1, "Document type is required")
    .max(80, "Document type must be at most 80 characters")
    .transform((v) => v.toUpperCase().replace(/[^A-Z0-9 _-]/g, "").replace(/\s+/g, "_")),
  expiryDate: optionalDate,
  lifetime: lifetimeFlag,
});

export type UploadComplianceDocInput = z.infer<typeof uploadComplianceDocSchema>;
export type UploadDriverDocInput = z.infer<typeof uploadDriverDocSchema>;
