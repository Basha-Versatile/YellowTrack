import "server-only";
import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

const documentTypeSchema = new Schema(
  {
    // null = system-wide doc type (RC, INSURANCE, etc.); set = tenant-custom doc type.
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", default: null, index: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String },
    hasExpiry: { type: Boolean, default: true },
    isSystem: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export type DocumentTypeAttrs = InferSchemaType<typeof documentTypeSchema>;

export const DocumentType: Model<DocumentTypeAttrs> =
  (models.DocumentType as Model<DocumentTypeAttrs>) ??
  model<DocumentTypeAttrs>("DocumentType", documentTypeSchema);
