import "server-only";
import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

export const DRIVER_DOC_TYPES = [
  "DL",
  "MEDICAL",
  "POLICE_VERIFICATION",
  "AADHAAR",
  "PAN",
] as const;

const driverDocumentSchema = new Schema(
  {
    driverId: { type: Schema.Types.ObjectId, ref: "Driver", required: true },
    type: { type: String, required: true, trim: true, maxlength: 80 },
    expiryDate: { type: Date },
    documentUrl: { type: String },
    status: { type: String, enum: ["GREEN", "YELLOW", "RED"], default: "GREEN" },
    isActive: { type: Boolean, default: true },
    archivedAt: { type: Date },
  },
  { timestamps: true },
);

driverDocumentSchema.index({ driverId: 1, type: 1, isActive: 1 });

export type DriverDocumentAttrs = InferSchemaType<typeof driverDocumentSchema>;

export const DriverDocument: Model<DriverDocumentAttrs> =
  (models.DriverDocument as Model<DriverDocumentAttrs>) ??
  model<DriverDocumentAttrs>("DriverDocument", driverDocumentSchema);
