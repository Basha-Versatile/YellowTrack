import "server-only";
import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

export const COMPLIANCE_DOC_TYPES = [
  "RC",
  "INSURANCE",
  "PERMIT",
  "PUCC",
  "FITNESS",
  "TAX",
] as const;

export const COMPLIANCE_STATUS = ["GREEN", "YELLOW", "RED"] as const;

const complianceDocumentSchema = new Schema(
  {
    vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle", required: true },
    type: { type: String, required: true }, // kept as string to support route_permit variants
    expiryDate: { type: Date },
    documentUrl: { type: String },
    status: { type: String, enum: COMPLIANCE_STATUS, default: "GREEN" },
    isActive: { type: Boolean, default: true },
    archivedAt: { type: Date },
    lastVerifiedAt: { type: Date },
  },
  { timestamps: true },
);

complianceDocumentSchema.index({ vehicleId: 1, type: 1, isActive: 1 });

export type ComplianceDocumentAttrs = InferSchemaType<typeof complianceDocumentSchema>;

export const ComplianceDocument: Model<ComplianceDocumentAttrs> =
  (models.ComplianceDocument as Model<ComplianceDocumentAttrs>) ??
  model<ComplianceDocumentAttrs>("ComplianceDocument", complianceDocumentSchema);
