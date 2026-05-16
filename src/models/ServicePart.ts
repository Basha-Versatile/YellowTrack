import "server-only";
import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

const servicePartSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    partNumber: { type: String, trim: true, maxlength: 80, default: null },
    notes: { type: String, trim: true, maxlength: 200, default: null },
  },
  { timestamps: true },
);

export type ServicePartAttrs = InferSchemaType<typeof servicePartSchema>;

export const ServicePart: Model<ServicePartAttrs> =
  (models.ServicePart as Model<ServicePartAttrs>) ?? model<ServicePartAttrs>("ServicePart", servicePartSchema);
