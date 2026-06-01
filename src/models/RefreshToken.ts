import "server-only";
import { Schema, model, models, Types, type Model, type InferSchemaType } from "mongoose";

const refreshTokenSchema = new Schema(
  {
    token: { type: String, required: true, unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    expiresAt: { type: Date, required: true, index: true },
    // "Remember me" choice from the original login. Propagated to refresh
    // responses so rotated cookies keep matching the user's preference.
    persistent: { type: Boolean, required: true, default: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export type RefreshTokenAttrs = InferSchemaType<typeof refreshTokenSchema>;
export type RefreshTokenDoc = RefreshTokenAttrs & { _id: Types.ObjectId };

export const RefreshToken: Model<RefreshTokenAttrs> =
  (models.RefreshToken as Model<RefreshTokenAttrs>) ??
  model<RefreshTokenAttrs>("RefreshToken", refreshTokenSchema);
