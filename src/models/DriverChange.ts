import "server-only";
import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

export const DRIVER_CHANGE_TYPES = [
  "PROFILE_UPDATED",
  "ADDRESS_UPDATED",
  "EMERGENCY_CONTACTS_UPDATED",
  "PROFILE_PHOTO_UPDATED",
  "ADDRESS_PHOTO_ADDED",
  "ADDRESS_PHOTO_REMOVED",
] as const;

export type DriverChangeType = (typeof DRIVER_CHANGE_TYPES)[number];

const fieldDiffSchema = new Schema(
  {
    field: { type: String, required: true },
    before: { type: Schema.Types.Mixed, default: null },
    after: { type: Schema.Types.Mixed, default: null },
  },
  { _id: false },
);

const driverChangeSchema = new Schema(
  {
    driverId: { type: Schema.Types.ObjectId, ref: "Driver", required: true, index: true },
    changeType: { type: String, enum: DRIVER_CHANGE_TYPES, required: true },
    fields: { type: [fieldDiffSchema], default: [] },
    note: { type: String },
    actor: { type: String, required: true },
    actorRole: { type: String, enum: ["ADMIN", "DRIVER"], required: true },
  },
  { timestamps: true },
);

driverChangeSchema.index({ driverId: 1, createdAt: -1 });

export type DriverChangeAttrs = InferSchemaType<typeof driverChangeSchema>;

export const DriverChange: Model<DriverChangeAttrs> =
  (models.DriverChange as Model<DriverChangeAttrs>) ??
  model<DriverChangeAttrs>("DriverChange", driverChangeSchema);
