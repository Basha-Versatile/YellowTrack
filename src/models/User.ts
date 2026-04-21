import "server-only";
import { Schema, model, models, type Model, type InferSchemaType, type HydratedDocument } from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    password: { type: String, required: true, select: false },
    name: { type: String, required: true, trim: true },
    role: { type: String, enum: ["ADMIN", "OPERATOR"], default: "OPERATOR" },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } },
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.password);
};

export type UserAttrs = InferSchemaType<typeof userSchema>;
export type UserDoc = HydratedDocument<UserAttrs> & {
  comparePassword(candidate: string): Promise<boolean>;
};

export const User: Model<UserAttrs> =
  (models.User as Model<UserAttrs>) ?? model<UserAttrs>("User", userSchema);
