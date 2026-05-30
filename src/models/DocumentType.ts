import "server-only";
import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

const documentTypeSchema = new Schema(
  {
    // null = system-wide doc type (RC, INSURANCE, etc.); set = tenant-custom doc type.
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", default: null, index: true },
    // Uniqueness is now per-tenant (compound index below). Two tenants may
    // each fork the same default code without colliding.
    code: { type: String, required: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String },
    hasExpiry: { type: Boolean, default: true },
    isSystem: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    // When a tenant edits a default (system) doc type, the row is forked into
    // a tenant-scoped clone with this set to the original system code. The
    // list query then hides the parent system row from this tenant so they
    // don't see both.
    clonedFromSystemCode: { type: String, default: null, index: true },
  },
  { timestamps: true },
);

documentTypeSchema.index({ tenantId: 1, code: 1 }, { unique: true });

export type DocumentTypeAttrs = InferSchemaType<typeof documentTypeSchema>;

if (process.env.NODE_ENV !== "production" && models.DocumentType) {
  delete models.DocumentType;
}

export const DocumentType: Model<DocumentTypeAttrs> =
  (models.DocumentType as Model<DocumentTypeAttrs>) ??
  model<DocumentTypeAttrs>("DocumentType", documentTypeSchema);
