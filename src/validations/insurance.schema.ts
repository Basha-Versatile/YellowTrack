import { z } from "zod";

export const savePolicySchema = z.object({
  vehicleId: z.string().min(1),
  policyNumber: z.string().optional().nullable(),
  insurer: z.string().optional().nullable(),
  planName: z.string().optional().nullable(),
  startDate: z.coerce.date().optional().nullable(),
  expiryDate: z.coerce.date().optional().nullable(),
  premium: z.coerce.number().optional().nullable(),
  coverageType: z.string().optional().nullable(),
  coverageDetails: z.array(z.string()).optional(),
  addOns: z.array(z.string()).optional(),
  documentUrl: z.string().optional().nullable(),
});

export const purchaseSchema = z.object({
  vehicleId: z.string().min(1),
  provider: z.string().min(1),
  planName: z.string().min(1),
  premium: z.coerce.number().positive(),
  coverage: z.array(z.string()).optional(),
  addOns: z.array(z.string()).optional(),
  paymentMethod: z.string().optional(),
});

export const getInsuranceQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(["ACTIVE", "EXPIRING", "EXPIRED", "RENEWED"]).optional(),
  search: z.string().optional(),
});

export type SavePolicyInput = z.infer<typeof savePolicySchema>;
export type PurchaseInsuranceInput = z.infer<typeof purchaseSchema>;
export type GetInsuranceQuery = z.infer<typeof getInsuranceQuerySchema>;
