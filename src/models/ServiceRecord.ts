import "server-only";
import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

const servicePartSchema = new Schema(
  {
    name: { type: String, required: true },
    quantity: { type: Number, default: 1 },
    unitCost: { type: Number, required: true },
    proofUrl: { type: String },
  },
  { _id: false },
);

const serviceRecordSchema = new Schema(
  {
    vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle", required: true, index: true },
    title: { type: String, required: true },
    description: { type: String },
    serviceDate: { type: Date, required: true, index: true },
    odometerKm: { type: Number },
    totalCost: { type: Number, default: 0 },
    receiptUrls: { type: [String], default: [] },
    parts: { type: [servicePartSchema], default: [] },
    nextDueDate: { type: Date },
    nextDueKm: { type: Number },
    status: { type: String, enum: ["COMPLETED", "UPCOMING"], default: "COMPLETED" },
  },
  { timestamps: true },
);

export type ServiceRecordAttrs = InferSchemaType<typeof serviceRecordSchema>;

export const ServiceRecord: Model<ServiceRecordAttrs> =
  (models.ServiceRecord as Model<ServiceRecordAttrs>) ??
  model<ServiceRecordAttrs>("ServiceRecord", serviceRecordSchema);
