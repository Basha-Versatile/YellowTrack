import "server-only";
import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

const groupDocumentTypeSchema = new Schema(
  {
    groupId: { type: Schema.Types.ObjectId, ref: "VehicleGroup", required: true, index: true },
    documentTypeId: { type: Schema.Types.ObjectId, ref: "DocumentType", required: true, index: true },
    isRequired: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

groupDocumentTypeSchema.index({ groupId: 1, documentTypeId: 1 }, { unique: true });

export type GroupDocumentTypeAttrs = InferSchemaType<typeof groupDocumentTypeSchema>;

export const GroupDocumentType: Model<GroupDocumentTypeAttrs> =
  (models.GroupDocumentType as Model<GroupDocumentTypeAttrs>) ??
  model<GroupDocumentTypeAttrs>("GroupDocumentType", groupDocumentTypeSchema);
