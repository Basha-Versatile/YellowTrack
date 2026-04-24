import { z } from "zod";
import {
  SUGGESTION_CATEGORIES,
  SUGGESTION_PRIORITIES,
} from "@/models/FeatureSuggestion";

export const createFeatureSuggestionSchema = z.object({
  title: z
    .string()
    .trim()
    .min(5, "Title must be at least 5 characters")
    .max(120, "Title must be at most 120 characters"),
  description: z
    .string()
    .trim()
    .min(20, "Please describe your idea in at least 20 characters")
    .max(2000, "Description must be at most 2000 characters"),
  category: z.enum(SUGGESTION_CATEGORIES),
  priority: z.enum(SUGGESTION_PRIORITIES),
});

export type CreateFeatureSuggestionInput = z.infer<
  typeof createFeatureSuggestionSchema
>;
