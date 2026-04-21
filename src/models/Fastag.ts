import "server-only";
import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

export const FASTAG_STATUS = ["ACTIVE", "INACTIVE", "BLACKLISTED", "EXPIRED"] as const;

const fastagSchema = new Schema(
  {
    vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle", required: true, index: true },
    tagId: { type: String, required: true, unique: true, index: true },
    provider: { type: String },
    balance: { type: Number, default: 0 },
    status: { type: String, enum: FASTAG_STATUS, default: "ACTIVE" },
    enrolledAt: { type: Date, default: () => new Date() },
    expiryDate: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export type FastagAttrs = InferSchemaType<typeof fastagSchema>;

export const Fastag: Model<FastagAttrs> =
  (models.Fastag as Model<FastagAttrs>) ?? model<FastagAttrs>("Fastag", fastagSchema);
