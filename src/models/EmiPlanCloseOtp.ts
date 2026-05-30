import "server-only";
import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

/**
 * OTP gate for closing an EMI plan. Mirrors the DocTypeDeletionOtp /
 * VehicleDeletionOtp patterns — user clicks Close, acknowledges a warning,
 * we email a 6-digit code, and confirmation verifies it before flipping the
 * plan to CLOSED. TTL drops the row 10 minutes after creation.
 */
const emiPlanCloseOtpSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    emiPlanId: {
      type: Schema.Types.ObjectId,
      ref: "EMIPlan",
      required: true,
      index: true,
    },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    otp: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true },
);

export type EmiPlanCloseOtpAttrs = InferSchemaType<typeof emiPlanCloseOtpSchema>;

if (process.env.NODE_ENV !== "production" && models.EmiPlanCloseOtp) {
  delete models.EmiPlanCloseOtp;
}

export const EmiPlanCloseOtp: Model<EmiPlanCloseOtpAttrs> =
  (models.EmiPlanCloseOtp as Model<EmiPlanCloseOtpAttrs>) ??
  model<EmiPlanCloseOtpAttrs>("EmiPlanCloseOtp", emiPlanCloseOtpSchema);
