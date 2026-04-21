import { z } from "zod";

export const createFastagSchema = z.object({
  vehicleId: z.string().min(1, "Vehicle ID is required"),
  tagId: z
    .string()
    .min(10, "FASTag ID must be at least 10 characters")
    .max(20),
  provider: z.string().optional(),
  initialBalance: z.coerce.number().min(0).default(500),
});

export const rechargeFastagSchema = z.object({
  amount: z.coerce
    .number()
    .positive("Amount must be positive")
    .min(100, "Minimum recharge is ₹100")
    .max(10000, "Maximum recharge is ₹10,000"),
});

export const getFastagsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(["ACTIVE", "INACTIVE", "BLACKLISTED", "EXPIRED"]).optional(),
  search: z.string().optional(),
});

export type CreateFastagInput = z.infer<typeof createFastagSchema>;
export type RechargeFastagInput = z.infer<typeof rechargeFastagSchema>;
export type GetFastagsQuery = z.infer<typeof getFastagsQuerySchema>;
