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
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String },
    aadhaarLast4: { type: String, maxlength: 4 },
    licenseNumber: { type: String, required: true, uppercase: true, trim: true, index: true },
    licenseExpiry: { type: Date, required: true },
    dob: { type: Date },
    dateOfIssue: { type: Date },
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

// Tenant-scoped uniqueness: licenseNumber is unique within a tenant.
// verificationToken stays globally unique — it's a public security token.
driverSchema.index({ tenantId: 1, licenseNumber: 1 }, { unique: true });

export type DriverAttrs = InferSchemaType<typeof driverSchema>;

export const Driver: Model<DriverAttrs> =
  (models.Driver as Model<DriverAttrs>) ?? model<DriverAttrs>("Driver", driverSchema);
