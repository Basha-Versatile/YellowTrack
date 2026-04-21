import "server-only";
import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

export const CHALLAN_STATUS = ["PENDING", "PROCESSING", "PAID", "FAILED"] as const;

const challanSchema = new Schema(
  {
    vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle", required: true, index: true },
    challanNumber: { type: String },
    amount: { type: Number, required: true },
    userCharges: { type: Number, default: 0 },
    location: { type: String },
    unitName: { type: String },
    psLimits: { type: String },
    violation: { type: String },
    status: { type: String, enum: CHALLAN_STATUS, default: "PENDING", index: true },
    issuedAt: { type: Date, required: true },
    source: { type: String },
    authorizedBy: { type: String },
    proofImageUrl: { type: String },
    responsibleId: { type: Schema.Types.ObjectId },
    paidAt: { type: Date },
    paymentId: { type: Schema.Types.ObjectId, ref: "Payment", index: true },
  },
  { timestamps: true },
);

export type ChallanAttrs = InferSchemaType<typeof challanSchema>;

export const Challan: Model<ChallanAttrs> =
  (models.Challan as Model<ChallanAttrs>) ??
  model<ChallanAttrs>("Challan", challanSchema);
