import "server-only";
import { Schema, model, models, Types, type Model, type InferSchemaType } from "mongoose";

const refreshTokenSchema = new Schema(
  {
    token: { type: String, required: true, unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export type RefreshTokenAttrs = InferSchemaType<typeof refreshTokenSchema>;
export type RefreshTokenDoc = RefreshTokenAttrs & { _id: Types.ObjectId };

export const RefreshToken: Model<RefreshTokenAttrs> =
  (models.RefreshToken as Model<RefreshTokenAttrs>) ??
  model<RefreshTokenAttrs>("RefreshToken", refreshTokenSchema);
