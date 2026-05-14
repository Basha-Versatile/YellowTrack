import "server-only";
import {
  Schema,
  model,
  models,
  type Model,
  type InferSchemaType,
} from "mongoose";

/**
 * Singleton document for platform-level settings only the superadmin can
 * change. Lookup is always by the literal key "settings" so there's exactly
 * one document; the service layer upserts on read so the doc is always
 * present.
 */
const platformSettingsSchema = new Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: "settings",
    },
    trialDays: {
      type: Number,
      required: true,
      min: 0,
      max: 365,
      default: 15,
    },
  },
  { timestamps: true },
);

export type PlatformSettingsAttrs = InferSchemaType<typeof platformSettingsSchema>;

export const PlatformSettings: Model<PlatformSettingsAttrs> =
  (models.PlatformSettings as Model<PlatformSettingsAttrs>) ??
  model<PlatformSettingsAttrs>("PlatformSettings", platformSettingsSchema);
