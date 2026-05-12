import "server-only";
import {
  Schema,
  model,
  models,
  type Model,
  type InferSchemaType,
} from "mongoose";

/**
 * Tenant-scoped custom role. The built-in `User.role` enum (SUPERADMIN /
 * ADMIN / OPERATOR) is the coarse classification; a `Role` document provides
 * finer-grained permissions on top.
 *
 * Defaults seeded by the tenant provisioning flow:
 *   - "Admin"    — isSystem: true, all permissions
 *   - "Operator" — isSystem: true, the default Operator permission set
 *
 * Admins can create their own roles. System roles can't be deleted; their
 * names can't be changed, but their permission lists CAN — a tenant might
 * want to grant their Operators "challans:pay" for example.
 */

const roleSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    description: { type: String, trim: true, maxlength: 200 },
    permissions: { type: [String], default: [] },
    isSystem: { type: Boolean, default: false }, // can't be deleted or renamed
  },
  { timestamps: true },
);

// One role name per tenant.
roleSchema.index({ tenantId: 1, name: 1 }, { unique: true });

export type RoleAttrs = InferSchemaType<typeof roleSchema>;

export const Role: Model<RoleAttrs> =
  (models.Role as Model<RoleAttrs>) ?? model<RoleAttrs>("Role", roleSchema);
