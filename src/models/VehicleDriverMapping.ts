import "server-only";
import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

const vehicleDriverMappingSchema = new Schema(
  {
    vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle", required: true, index: true },
    driverId: { type: Schema.Types.ObjectId, ref: "Driver", required: true, index: true },
    assignedAt: { type: Date, default: () => new Date() },
    unassignedAt: { type: Date },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: false },
);

export type VehicleDriverMappingAttrs = InferSchemaType<typeof vehicleDriverMappingSchema>;

export const VehicleDriverMapping: Model<VehicleDriverMappingAttrs> =
  (models.VehicleDriverMapping as Model<VehicleDriverMappingAttrs>) ??
  model<VehicleDriverMappingAttrs>("VehicleDriverMapping", vehicleDriverMappingSchema);
