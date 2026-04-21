import { z } from "zod";

export const createGroupSchema = z.object({
  name: z.string().min(1, "Group name is required").max(50),
  icon: z.string().min(1, "Icon is required"),
  color: z.string().optional(),
  order: z.coerce.number().int().optional(),
  tyreCount: z.coerce
    .number()
    .int()
    .min(4, "Minimum 4 tyres (4+ wheelers only)")
    .max(20)
    .optional(),
  requiredDocTypeIds: z.array(z.string()).optional(),
});

export const updateGroupSchema = createGroupSchema.partial();

export type CreateGroupInput = z.infer<typeof createGroupSchema>;
export type UpdateGroupInput = z.infer<typeof updateGroupSchema>;
