import "server-only";
import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

/**
 * Time-bounded public share link for a curated set of compliance documents
 * on a specific vehicle. The recipient hits /public/share/[token] and can
 * download a single merged PDF of the selected documents.
 *
 * The TTL index on `expiresAt` drops expired rows automatically, so we never
 * accidentally honour a stale link.
 */
const documentShareLinkSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    vehicleId: {
      type: Schema.Types.ObjectId,
      ref: "Vehicle",
      required: true,
      index: true,
    },
    // 32-char URL-safe token. Unique, since it IS the access control.
    token: { type: String, required: true, unique: true },
    complianceDocIds: {
      type: [Schema.Types.ObjectId],
      ref: "ComplianceDocument",
      default: [],
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    accessedAt: { type: Date, default: null },
    accessCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export type DocumentShareLinkAttrs = InferSchemaType<typeof documentShareLinkSchema>;

if (process.env.NODE_ENV !== "production" && models.DocumentShareLink) {
  delete models.DocumentShareLink;
}

export const DocumentShareLink: Model<DocumentShareLinkAttrs> =
  (models.DocumentShareLink as Model<DocumentShareLinkAttrs>) ??
  model<DocumentShareLinkAttrs>("DocumentShareLink", documentShareLinkSchema);
