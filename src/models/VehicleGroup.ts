import "server-only";
import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

const vehicleGroupSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    name: { type: String, required: true, trim: true },
    icon: { type: String, required: true },
    color: { type: String },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);

vehicleGroupSchema.index({ tenantId: 1, name: 1 }, { unique: true });

export type VehicleGroupAttrs = InferSchemaType<typeof vehicleGroupSchema>;

export const VehicleGroup: Model<VehicleGroupAttrs> =
  (models.VehicleGroup as Model<VehicleGroupAttrs>) ??
  model<VehicleGroupAttrs>("VehicleGroup", vehicleGroupSchema);
