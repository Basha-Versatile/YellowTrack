import "server-only";
import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

export const CUSTOM_COMPLIANCE_STATUS = ["GREEN", "YELLOW", "ORANGE", "RED"] as const;

/**
 * A single document tracked under a CustomComplianceGroup. Mirrors the vehicle
 * ComplianceDocument shape (issuedDate / expiryDate / multi-file / status)
 * but the owner is a group rather than a vehicle.
 */
const customComplianceDocumentSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    groupId: {
      type: Schema.Types.ObjectId,
      ref: "CustomComplianceGroup",
      required: true,
      index: true,
    },
    // Free-form label — "GST Certificate", "Labour Licence", "Partnership Deed".
    label: { type: String, required: true, trim: true, maxlength: 120 },
    // Optional reference number printed on the document.
    documentNumber: { type: String, trim: true, default: null, maxlength: 120 },
    issuedDate: { type: Date, default: null },
    // null + an issuedDate = lifetime. Status calculation treats null
    // expiryDate as "no expiry tracked".
    expiryDate: { type: Date, default: null },
    // Singular kept as fallback pointer to first file for older readers.
    documentUrl: { type: String, default: null },
    documentUrls: { type: [String], default: [] },
    status: {
      type: String,
      enum: CUSTOM_COMPLIANCE_STATUS,
      default: "GREEN",
      index: true,
    },
    notes: { type: String, trim: true, default: null, maxlength: 500 },
    lastVerifiedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true },
);

customComplianceDocumentSchema.index({ tenantId: 1, groupId: 1 });

type DocQuery = {
  getOptions: () => { includeDeleted?: boolean };
  getFilter: () => Record<string, unknown>;
  where: (cond: Record<string, unknown>) => unknown;
};
function excludeDeleted(this: DocQuery): void {
  if (this.getOptions().includeDeleted) return;
  const filter = this.getFilter();
  if (Object.prototype.hasOwnProperty.call(filter, "deletedAt")) return;
  this.where({ deletedAt: null });
}
customComplianceDocumentSchema.pre(/^find/, excludeDeleted as never);
customComplianceDocumentSchema.pre("countDocuments", excludeDeleted as never);

export type CustomComplianceDocumentAttrs = InferSchemaType<
  typeof customComplianceDocumentSchema
>;

if (process.env.NODE_ENV !== "production" && models.CustomComplianceDocument) {
  delete models.CustomComplianceDocument;
}

export const CustomComplianceDocument: Model<CustomComplianceDocumentAttrs> =
  (models.CustomComplianceDocument as Model<CustomComplianceDocumentAttrs>) ??
  model<CustomComplianceDocumentAttrs>(
    "CustomComplianceDocument",
    customComplianceDocumentSchema,
  );
