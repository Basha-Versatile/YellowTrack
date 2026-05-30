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
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle", required: true },
    type: { type: String, required: true }, // kept as string to support route_permit variants
    // Optional identifier printed on the physical document — policy number,
    // permit number, RC number, etc. Free-form, no validation, since each
    // type has its own format.
    documentNumber: { type: String, trim: true, default: null, maxlength: 120 },
    // `issuedDate` is the "valid from" date — the day the document was
    // issued / started being valid. Optional because legacy docs were
    // added before this field existed.
    issuedDate: { type: Date },
    expiryDate: { type: Date },
    // `documentUrl` is kept for back-compat (single primary file URL,
    // mirrors documentUrls[0]). New code should read `documentUrls`.
    documentUrl: { type: String },
    documentUrls: { type: [String], default: [] },
    status: { type: String, enum: COMPLIANCE_STATUS, default: "GREEN" },
    isActive: { type: Boolean, default: true },
    archivedAt: { type: Date },
    lastVerifiedAt: { type: Date },
  },
  { timestamps: true },
);

complianceDocumentSchema.index({ vehicleId: 1, type: 1, isActive: 1 });

export type ComplianceDocumentAttrs = InferSchemaType<typeof complianceDocumentSchema>;

if (process.env.NODE_ENV !== "production" && models.ComplianceDocument) {
  delete models.ComplianceDocument;
}

export const ComplianceDocument: Model<ComplianceDocumentAttrs> =
  (models.ComplianceDocument as Model<ComplianceDocumentAttrs>) ??
  model<ComplianceDocumentAttrs>("ComplianceDocument", complianceDocumentSchema);
