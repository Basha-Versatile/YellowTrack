import "server-only";
import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

const vehicleSaleSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle", required: true, index: true, unique: true },
    buyerName: { type: String, required: true, trim: true },
    buyerPhone: { type: String, required: true, trim: true },
    buyerEmail: { type: String, trim: true, default: null },
    soldPrice: { type: Number, min: 0, default: null },
    saleDate: { type: Date, required: true },
    pendingChallansCleared: { type: Boolean, default: false },
    buyerDocumentUrls: { type: [String], default: [] },
    transferDocumentUrls: { type: [String], default: [] },
    notes: { type: String, trim: true, default: null },
  },
  { timestamps: true },
);

export type VehicleSaleAttrs = InferSchemaType<typeof vehicleSaleSchema>;

export const VehicleSale: Model<VehicleSaleAttrs> =
  (models.VehicleSale as Model<VehicleSaleAttrs>) ??
  model<VehicleSaleAttrs>("VehicleSale", vehicleSaleSchema);
