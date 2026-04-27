import "server-only";
import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

export const PUBLIC_ACCESS_ACTIONS = ["VIEW", "DOWNLOAD"] as const;
export type PublicAccessAction = (typeof PUBLIC_ACCESS_ACTIONS)[number];

const vehiclePublicAccessLogSchema = new Schema(
  {
    vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle", required: true, index: true },
    /** "VEHICLE" for the verification page itself; otherwise the doc type code (RC, INSURANCE, …) */
    target: { type: String, required: true },
    action: { type: String, enum: PUBLIC_ACCESS_ACTIONS, required: true },
    documentUrl: { type: String },
    accessorName: { type: String, trim: true, maxlength: 80 },
    accessorPhone: { type: String, trim: true, maxlength: 20 },
    ip: { type: String },
    userAgent: { type: String, maxlength: 400 },
  },
  { timestamps: true },
);

vehiclePublicAccessLogSchema.index({ vehicleId: 1, createdAt: -1 });

export type VehiclePublicAccessLogAttrs = InferSchemaType<typeof vehiclePublicAccessLogSchema>;

export const VehiclePublicAccessLog: Model<VehiclePublicAccessLogAttrs> =
  (models.VehiclePublicAccessLog as Model<VehiclePublicAccessLogAttrs>) ??
  model<VehiclePublicAccessLogAttrs>("VehiclePublicAccessLog", vehiclePublicAccessLogSchema);
