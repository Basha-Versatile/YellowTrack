import "server-only";
import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

const emergencyContactSchema = new Schema(
  {
    name: { type: String, required: true },
    relation: { type: String, required: true },
    phone: { type: String, required: true },
  },
  { _id: false },
);

const driverSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String },
    aadhaarLast4: { type: String, maxlength: 4 },
    licenseNumber: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    licenseExpiry: { type: Date, required: true },
    vehicleClass: { type: String, required: true },
    riskScore: { type: Number, default: 0 },
    bloodGroup: { type: String },
    fatherName: { type: String },
    motherName: { type: String },
    emergencyContact: { type: String },
    emergencyContacts: { type: [emergencyContactSchema], default: undefined },
    currentAddress: { type: String },
    currentAddressPhotos: { type: [String], default: [] },
    permanentAddress: { type: String },
    permanentAddressPhotos: { type: [String], default: [] },
    verificationToken: { type: String, unique: true, sparse: true, index: true },
    profilePhoto: { type: String },
    currentAddressLat: { type: Number },
    currentAddressLng: { type: Number },
    permanentAddressLat: { type: Number },
    permanentAddressLng: { type: Number },
    selfVerifiedAt: { type: Date },
    adminVerified: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export type DriverAttrs = InferSchemaType<typeof driverSchema>;

export const Driver: Model<DriverAttrs> =
  (models.Driver as Model<DriverAttrs>) ?? model<DriverAttrs>("Driver", driverSchema);
