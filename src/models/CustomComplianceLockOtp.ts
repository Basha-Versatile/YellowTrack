import "server-only";
import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

/**
 * One-time-code rows for the "forgot folder lock password" flow. Mirrors
 * `PasswordResetOtp` shape: hashed OTP at rest, TTL via Mongo `expires`,
 * attempts counter capped by the service layer.
 *
 * Scoped by `groupId` (not email) because the recovery email is the same
 * for everyone unlocking the folder, but the OTP must be tied to a
 * specific folder so a reset request for folder A can't be used to set
 * the password on folder B.
 */
const customComplianceLockOtpSchema = new Schema(
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
    email: { type: String, required: true, lowercase: true, trim: true },
    otpHash: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    attempts: { type: Number, default: 0 },
    used: { type: Boolean, default: false },
    requestedByUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

export type CustomComplianceLockOtpAttrs = InferSchemaType<
  typeof customComplianceLockOtpSchema
>;

if (
  process.env.NODE_ENV !== "production" &&
  models.CustomComplianceLockOtp
) {
  delete models.CustomComplianceLockOtp;
}

export const CustomComplianceLockOtp: Model<CustomComplianceLockOtpAttrs> =
  (models.CustomComplianceLockOtp as Model<CustomComplianceLockOtpAttrs>) ??
  model<CustomComplianceLockOtpAttrs>(
    "CustomComplianceLockOtp",
    customComplianceLockOtpSchema,
  );
