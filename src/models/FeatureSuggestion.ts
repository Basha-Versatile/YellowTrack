import "server-only";
import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

export const SUGGESTION_CATEGORIES = [
  "NEW_FEATURE",
  "IMPROVEMENT",
  "BUG_REPORT",
  "UI_UX",
  "PERFORMANCE",
  "INTEGRATION",
  "OTHER",
] as const;

export const SUGGESTION_PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;

export const SUGGESTION_STATUSES = [
  "NEW",
  "UNDER_REVIEW",
  "PLANNED",
  "IMPLEMENTED",
  "REJECTED",
] as const;

const featureSuggestionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    userEmail: { type: String, required: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    category: { type: String, enum: SUGGESTION_CATEGORIES, default: "NEW_FEATURE" },
    priority: { type: String, enum: SUGGESTION_PRIORITIES, default: "MEDIUM" },
    status: { type: String, enum: SUGGESTION_STATUSES, default: "NEW", index: true },
    adminResponse: { type: String, maxlength: 1000 },
  },
  { timestamps: true },
);

export type FeatureSuggestionAttrs = InferSchemaType<typeof featureSuggestionSchema>;

export const FeatureSuggestion: Model<FeatureSuggestionAttrs> =
  (models.FeatureSuggestion as Model<FeatureSuggestionAttrs>) ??
  model<FeatureSuggestionAttrs>("FeatureSuggestion", featureSuggestionSchema);
