import "server-only";
import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

/**
 * OTP gate for deleting a custom DocumentType. Mirrors the
 * VehicleDeletionOtp pattern — the user requests deletion, we email them a
 * 6-digit code, and confirmation verifies it before the destructive call
 * runs. TTL drops the row 10 minutes after creation.
 */
const docTypeDeletionOtpSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    documentTypeId: {
      type: Schema.Types.ObjectId,
      ref: "DocumentType",
      required: true,
      index: true,
    },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    otp: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true },
);

export type DocTypeDeletionOtpAttrs = InferSchemaType<typeof docTypeDeletionOtpSchema>;

if (process.env.NODE_ENV !== "production" && models.DocTypeDeletionOtp) {
  delete models.DocTypeDeletionOtp;
}

export const DocTypeDeletionOtp: Model<DocTypeDeletionOtpAttrs> =
  (models.DocTypeDeletionOtp as Model<DocTypeDeletionOtpAttrs>) ??
  model<DocTypeDeletionOtpAttrs>("DocTypeDeletionOtp", docTypeDeletionOtpSchema);
