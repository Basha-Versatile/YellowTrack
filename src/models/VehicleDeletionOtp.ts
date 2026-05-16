import "server-only";
import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

const vehicleDeletionOtpSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    otp: { type: String, required: true },
    // TTL index: Mongo will remove the document automatically once `expiresAt` passes.
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true },
);

export type VehicleDeletionOtpAttrs = InferSchemaType<typeof vehicleDeletionOtpSchema>;

export const VehicleDeletionOtp: Model<VehicleDeletionOtpAttrs> =
  (models.VehicleDeletionOtp as Model<VehicleDeletionOtpAttrs>) ??
  model<VehicleDeletionOtpAttrs>("VehicleDeletionOtp", vehicleDeletionOtpSchema);
