import "server-only";
import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

export const INSURANCE_STATUS = ["ACTIVE", "EXPIRING", "EXPIRED", "RENEWED"] as const;

const insurancePolicySchema = new Schema(
  {
    vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle", required: true, index: true },
    policyNumber: { type: String },
    insurer: { type: String },
    planName: { type: String },
    startDate: { type: Date },
    expiryDate: { type: Date },
    premium: { type: Number },
    coverageType: { type: String },
    coverageDetails: { type: [String], default: [] },
    addOns: { type: [String], default: [] },
    documentUrl: { type: String },
    status: { type: String, enum: INSURANCE_STATUS, default: "ACTIVE" },
    paidAmount: { type: Number },
    paymentId: { type: String },
    paymentStatus: { type: String },
    extractedData: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

export type InsurancePolicyAttrs = InferSchemaType<typeof insurancePolicySchema>;

export const InsurancePolicy: Model<InsurancePolicyAttrs> =
  (models.InsurancePolicy as Model<InsurancePolicyAttrs>) ??
  model<InsurancePolicyAttrs>("InsurancePolicy", insurancePolicySchema);
