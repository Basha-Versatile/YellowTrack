import "server-only";
import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

/**
 * Public 24-hour share link for documents in a CustomComplianceGroup. The
 * token is the access control. When `groupId` is set the link covers the
 * whole group (and is auto-resolved at lookup time); when it's null, the
 * link is locked to a curated `documentIds` set.
 */
const customDocumentShareLinkSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    // Either of these is the source: `groupId` shares "everything in this
    // group as of access time"; `documentIds` shares a frozen list.
    groupId: {
      type: Schema.Types.ObjectId,
      ref: "CustomComplianceGroup",
      default: null,
      index: true,
    },
    documentIds: {
      type: [Schema.Types.ObjectId],
      ref: "CustomComplianceDocument",
      default: [],
    },
    token: { type: String, required: true, unique: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    accessedAt: { type: Date, default: null },
    accessCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export type CustomDocumentShareLinkAttrs = InferSchemaType<
  typeof customDocumentShareLinkSchema
>;

if (
  process.env.NODE_ENV !== "production" &&
  models.CustomDocumentShareLink
) {
  delete models.CustomDocumentShareLink;
}

export const CustomDocumentShareLink: Model<CustomDocumentShareLinkAttrs> =
  (models.CustomDocumentShareLink as Model<CustomDocumentShareLinkAttrs>) ??
  model<CustomDocumentShareLinkAttrs>(
    "CustomDocumentShareLink",
    customDocumentShareLinkSchema,
  );
