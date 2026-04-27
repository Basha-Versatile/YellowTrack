import "server-only";
import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

const vehicleGroupSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    icon: { type: String, required: true },
    color: { type: String },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export type VehicleGroupAttrs = InferSchemaType<typeof vehicleGroupSchema>;

export const VehicleGroup: Model<VehicleGroupAttrs> =
  (models.VehicleGroup as Model<VehicleGroupAttrs>) ??
  model<VehicleGroupAttrs>("VehicleGroup", vehicleGroupSchema);
