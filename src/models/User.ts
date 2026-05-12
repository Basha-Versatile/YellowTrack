import "server-only";
import { Schema, model, models, type Model, type InferSchemaType, type HydratedDocument } from "mongoose";
import bcrypt from "bcryptjs";

export const USER_ROLES = ["SUPERADMIN", "ADMIN", "OPERATOR"] as const;
export type UserRole = (typeof USER_ROLES)[number];

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    password: { type: String, required: true, select: false },
    name: { type: String, required: true, trim: true },
    role: { type: String, enum: USER_ROLES, default: "OPERATOR" },
    // null for SUPERADMIN; required for ADMIN/OPERATOR (enforced in service layer + post-backfill).
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      default: null,
      index: true,
    },
    // Optional fine-grained role within the tenant (overrides the `role`
    // enum's default permission set). Null = use the role enum defaults.
    roleId: {
      type: Schema.Types.ObjectId,
      ref: "Role",
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "SUSPENDED"],
      default: "ACTIVE",
      index: true,
    },
    mustResetPassword: { type: Boolean, default: false },
    lastLoginAt: { type: Date },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } },
);

// Tenancy invariant: SUPERADMIN has no tenant; ADMIN/OPERATOR must have one.
userSchema.pre("validate", function (next) {
  if (this.role === "SUPERADMIN" && this.tenantId) {
    return next(new Error("SUPERADMIN users must not have a tenantId"));
  }
  if (this.role !== "SUPERADMIN" && !this.tenantId) {
    return next(new Error("ADMIN and OPERATOR users require a tenantId"));
  }
  next();
});

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
