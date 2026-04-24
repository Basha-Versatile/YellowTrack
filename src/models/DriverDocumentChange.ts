import "server-only";
import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

export const DOC_CHANGE_TYPES = [
  "CREATED",
  "FILE_REPLACED",
  "EXPIRY_UPDATED",
  "LIFETIME_SET",
  "LIFETIME_REMOVED",
  "TYPE_RENAMED",
  "ARCHIVED",
] as const;

export type DocChangeType = (typeof DOC_CHANGE_TYPES)[number];

const changedFieldSchema = new Schema(
  {
    field: { type: String, required: true },
    before: { type: Schema.Types.Mixed, default: null },
    after: { type: Schema.Types.Mixed, default: null },
  },
  { _id: false },
);

const driverDocumentChangeSchema = new Schema(
  {
    documentId: { type: Schema.Types.ObjectId, ref: "DriverDocument", required: true, index: true },
    driverId: { type: Schema.Types.ObjectId, ref: "Driver", required: true, index: true },
    type: { type: String, required: true },
    changeType: { type: String, enum: DOC_CHANGE_TYPES, required: true },
    fields: { type: [changedFieldSchema], default: [] },
    note: { type: String },
    changedBy: { type: String },
  },
  { timestamps: true },
);

driverDocumentChangeSchema.index({ driverId: 1, type: 1, createdAt: -1 });

export type DriverDocumentChangeAttrs = InferSchemaType<typeof driverDocumentChangeSchema>;

export const DriverDocumentChange: Model<DriverDocumentChangeAttrs> =
  (models.DriverDocumentChange as Model<DriverDocumentChangeAttrs>) ??
  model<DriverDocumentChangeAttrs>("DriverDocumentChange", driverDocumentChangeSchema);
