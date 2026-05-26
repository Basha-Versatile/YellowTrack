import "server-only";
import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

const passwordResetOtpSchema = new Schema(
  {
    // Lower-cased so we can look up regardless of how the user typed it.
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    // SHA-256 hex of the OTP — we never store the OTP in cleartext.
    otpHash: { type: String, required: true },
    // TTL: Mongo removes the document automatically once `expiresAt` passes.
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    attempts: { type: Number, default: 0 },
    // Set true once the OTP has been used to reset a password. We keep the row
    // around (until TTL) so a verifyToken can't be replayed.
    used: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export type PasswordResetOtpAttrs = InferSchemaType<typeof passwordResetOtpSchema>;

export const PasswordResetOtp: Model<PasswordResetOtpAttrs> =
  (models.PasswordResetOtp as Model<PasswordResetOtpAttrs>) ??
  model<PasswordResetOtpAttrs>("PasswordResetOtp", passwordResetOtpSchema);
