import "server-only";
import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

const tyreSchema = new Schema(
  {
    vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle", required: true, index: true },
    position: { type: String, required: true },
    size: { type: String },
  },
  { timestamps: true },
);

export type TyreAttrs = InferSchemaType<typeof tyreSchema>;

export const Tyre: Model<TyreAttrs> =
  (models.Tyre as Model<TyreAttrs>) ?? model<TyreAttrs>("Tyre", tyreSchema);
