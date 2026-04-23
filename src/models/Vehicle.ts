import "server-only";
import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

const vehicleSchema = new Schema(
  {
    registrationNumber: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    ownerName: { type: String },
    make: { type: String, required: true },
    model: { type: String, required: true },
    fuelType: { type: String, required: true },
    chassisNumber: { type: String },
    engineNumber: { type: String },
    gvw: { type: Number },
    seatingCapacity: { type: Number },
    permitType: { type: String },
    vehicleUsage: { type: String, enum: ["PRIVATE", "COMMERCIAL"] },
    registrationDate: { type: Date },
    qrCodeUrl: { type: String },
    invoiceUrl: { type: String },
    images: { type: [String], default: [] },
    profileImage: { type: String },
    groupId: { type: Schema.Types.ObjectId, ref: "VehicleGroup", index: true },

    // Surepass enrichment
    rcStatus: { type: String },
    blacklistStatus: { type: String },
    financed: { type: Boolean },
    financer: { type: String },
    ownerNumber: { type: Number },
    registeredAt: { type: String },
    manufacturingDate: { type: String },
    ownerPhone: { type: String },
    ownerAddress: { type: String },
    fatherName: { type: String },
    color: { type: String },
    bodyType: { type: String },
    vehicleCategory: { type: String },
    normsType: { type: String },
    cubicCapacity: { type: String },
    cylinders: { type: Number },
    wheelbase: { type: Number },
    unladenWeight: { type: Number },
    taxMode: { type: String },
    surepassRaw: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

export type VehicleAttrs = InferSchemaType<typeof vehicleSchema>;

export const Vehicle: Model<VehicleAttrs> =
  (models.Vehicle as Model<VehicleAttrs>) ??
  model<VehicleAttrs>("Vehicle", vehicleSchema);
