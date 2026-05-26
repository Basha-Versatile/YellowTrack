import "server-only";
import crypto from "crypto";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "@/lib/errors";
import {
  DEFAULT_OPERATOR_PERMISSIONS,
  PERMISSIONS,
  type Permission,
} from "@/lib/auth/permissions";
import {
  type ScopedContext,
  tenantStamp,
} from "@/lib/auth/tenant-context";
import { env } from "@/lib/env";
import {
  passwordResetEmail,
  sendEmail,
  userInviteEmail,
} from "@/lib/email";
import { Role, Tenant, User } from "@/models";
import { assertQuota } from "./quota.service";
import * as roleRepo from "../repositories/role.repository";

function generateTempPassword(): string {
  return crypto
    .randomBytes(12)
    .toString("base64")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 14);
}

async function isTenantOwner(ctx: ScopedContext, userId: string): Promise<boolean> {
  const tenant = await Tenant.findById(ctx.tenantId).select("ownerUserId").lean();
  return Boolean(tenant?.ownerUserId && String(tenant.ownerUserId) === String(userId));
}

const SIGN_IN_URL = () => `${env.FRONTEND_URL.replace(/\/$/, "")}/signin`;

function validatePermissions(input: string[]): Permission[] {
  const valid = new Set(PERMISSIONS as readonly string[]);
  const unique: Permission[] = [];
  for (const p of input) {
    if (!valid.has(p)) throw new BadRequestError(`Unknown permission: ${p}`);
    if (!unique.includes(p as Permission)) unique.push(p as Permission);
  }
  return unique;
}

export async function listRoles(ctx: ScopedContext) {
  let roles = await roleRepo.findAll(ctx);
  // Hide any legacy "Admin" role — workspace admin access is implicit, not
  // through a Role document.
  roles = roles.filter((r) => r.name !== "Admin");
  // Lazy-seed defaults the first time an existing tenant opens the role
  // editor (i.e., tenants that existed before the RBAC feature shipped).
  if (roles.length === 0) {
    await seedDefaultRoles(ctx);
    roles = (await roleRepo.findAll(ctx)).filter((r) => r.name !== "Admin");
  }
  return roles;
}

export async function getRoleById(ctx: ScopedContext, id: string) {
  const role = await roleRepo.findById(ctx, id);
  if (!role) throw new NotFoundError("Role not found");
  return role;
}

export async function createRole(
  ctx: ScopedContext,
  input: { name: string; description?: string; permissions?: string[] },
) {
  const name = input.name.trim();
  if (!name) throw new BadRequestError("Role name is required");
  if (name.toLowerCase() === "admin") {
    throw new ForbiddenError(
      `"Admin" is reserved for the workspace owner — pick a different name.`,
    );
  }
  await assertQuota(tenantStamp(ctx).tenantId, "role");
  const dup = await roleRepo.findByName(ctx, name);
  if (dup) throw new ConflictError("A role with this name already exists");
  const perms = validatePermissions(input.permissions ?? []);
  return roleRepo.create(ctx, {
    name,
    description: input.description?.trim() || undefined,
    permissions: perms,
    isSystem: false,
  });
}

export async function updateRole(
  ctx: ScopedContext,
  id: string,
  input: { name?: string; description?: string | null; permissions?: string[] },
) {
  const current = await roleRepo.findById(ctx, id);
  if (!current) throw new NotFoundError("Role not found");

  const patch: Record<string, unknown> = {};

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new BadRequestError("Role name is required");
    if (current.isSystem && name !== current.name) {
      throw new ForbiddenError("System role names cannot be changed");
    }
    if (name !== current.name) {
      const dup = await roleRepo.findByName(ctx, name);
      if (dup) throw new ConflictError("A role with this name already exists");
    }
    patch.name = name;
  }
  if (input.description !== undefined) {
    patch.description = input.description ? input.description.trim() : null;
  }
  if (input.permissions !== undefined) {
    patch.permissions = validatePermissions(input.permissions);
  }
  return roleRepo.update(ctx, id, patch);
}

export async function deleteRole(ctx: ScopedContext, id: string) {
  const current = await roleRepo.findById(ctx, id);
  if (!current) throw new NotFoundError("Role not found");
  if (current.isSystem) {
    throw new ForbiddenError("System roles cannot be deleted");
  }
  const usage = await roleRepo.countUsingRole(ctx, id);
  if (usage > 0) {
    throw new BadRequestError(
      `Cannot delete a role that's assigned to ${usage} user${usage > 1 ? "s" : ""}. Reassign them first.`,
    );
  }
  await roleRepo.remove(ctx, id);
}

/**
 * Bootstrap the default Operator role for a brand-new tenant. Idempotent —
 * does nothing if it already exists.
 *
 * There is NO "Admin" role. The workspace admin (one per tenant) has
 * implicit full access via `defaultPermissionsForRole("ADMIN")`; their access
 * does not flow through a Role document.
 */
export async function seedDefaultRoles(ctx: ScopedContext) {
  const stamp = tenantStamp(ctx);
  // Clean up any "Admin" Role doc from earlier seed runs — it's no longer
  // exposed in the UI and shouldn't sit around as dead data.
  await Role.deleteOne({ ...stamp, name: "Admin" });
  await Role.updateOne(
    { ...stamp, name: "Operator" },
    {
      $setOnInsert: {
        ...stamp,
        name: "Operator",
        description: "Day-to-day operations and read-only access.",
        permissions: DEFAULT_OPERATOR_PERMISSIONS,
        isSystem: true,
      },
    },
    { upsert: true },
  );
  return Role.find(stamp).lean();
}

// ── User management within the tenant ────────────────────────────────────────

export async function listTenantUsers(ctx: ScopedContext) {
  const tenant = await Tenant.findById(ctx.tenantId).select("ownerUserId").lean();
  const ownerId = tenant?.ownerUserId ? String(tenant.ownerUserId) : null;

  const users = await User.find({
    tenantId: ctx.tenantId,
    role: { $in: ["ADMIN", "OPERATOR"] },
  })
    .select("name email role roleId status mustResetPassword lastLoginAt createdAt")
    .sort({ createdAt: -1 })
    .lean();
  return users.map((u) => ({
    ...u,
    isOwner: ownerId && String(u._id) === ownerId ? true : false,
  }));
}

export async function inviteUser(
  ctx: ScopedContext,
  input: {
    name: string;
    email: string;
    roleId?: string | null;
    profileImage?: string | null;
  },
) {
  const name = input.name.trim();
  const email = input.email.toLowerCase().trim();
  if (!name) throw new BadRequestError("Name is required");
  if (!email) throw new BadRequestError("Email is required");

  await assertQuota(tenantStamp(ctx).tenantId, "user");

  const existing = await User.findOne({ email });
  if (existing) {
    throw new ConflictError("A user with this email already exists");
  }

  let assignedRoleId: unknown = null;
  if (input.roleId) {
    const role = await roleRepo.findById(ctx, input.roleId);
    if (!role) throw new NotFoundError("Role not found");
    assignedRoleId = role._id;
  }

  // Invariant: exactly one ADMIN per tenant (the workspace owner). Every
  // invited user is an OPERATOR; their actual permissions come from the
  // custom role attached via roleId.
  const tempPassword = generateTempPassword();
  const user = await User.create({
    email,
    password: tempPassword, // pre-save hook hashes
    name,
    role: "OPERATOR",
    tenantId: ctx.tenantId,
    roleId: assignedRoleId,
    mustResetPassword: true,
    status: "ACTIVE",
    profileImage: input.profileImage ?? null,
  });

  // Best-effort: invite email + look up tenant name + inviter name.
  try {
    const [tenant, inviter] = await Promise.all([
      Tenant.findById(ctx.tenantId).select("name").lean(),
      User.findById(ctx.userId).select("name").lean(),
    ]);
    await sendEmail(
      userInviteEmail({
        tenantName: (tenant?.name as string) ?? "your workspace",
        invitedByName: (inviter?.name as string) ?? "Your admin",
        userName: name,
        userEmail: email,
        tempPassword,
        loginUrl: SIGN_IN_URL(),
      }),
    );
  } catch (err) {
    console.error(
      "[inviteUser] welcome email failed:",
      err instanceof Error ? err.message : err,
    );
  }

  return {
    user: {
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
      roleId: user.roleId ? String(user.roleId) : null,
    },
    tempPassword,
  };
}

export async function updateUserRole(
  ctx: ScopedContext,
  userId: string,
  input: {
    roleId?: string | null;
    name?: string;
  },
) {
  const user = await User.findOne({
    _id: userId,
    tenantId: ctx.tenantId,
  });
  if (!user) throw new NotFoundError("User not found in this tenant");

  // ADMIN role is invariant — only the tenant owner is ADMIN, and that
  // assignment never changes via this endpoint. UI hides the option but
  // the server is the source of truth.
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new BadRequestError("Name is required");
    user.name = name;
  }
  if (input.roleId !== undefined) {
    if (user.role === "ADMIN") {
      throw new ForbiddenError(
        "The workspace admin's role assignment can't be changed",
      );
    }
    if (input.roleId === null) {
      user.roleId = null;
    } else {
      const role = await roleRepo.findById(ctx, input.roleId);
      if (!role) throw new NotFoundError("Role not found");
      user.roleId = role._id as never;
    }
  }
  await user.save();
  return user.toObject();
}

export async function setUserStatus(
  ctx: ScopedContext,
  userId: string,
  status: "ACTIVE" | "SUSPENDED",
) {
  const user = await User.findOne({ _id: userId, tenantId: ctx.tenantId });
  if (!user) throw new NotFoundError("User not found in this tenant");

  if (status === "SUSPENDED") {
    if (String(user._id) === String(ctx.userId)) {
      throw new ForbiddenError("You can't suspend yourself");
    }
    if (await isTenantOwner(ctx, String(user._id))) {
      throw new ForbiddenError("The tenant owner can't be suspended");
    }
  }
  (user as unknown as { status: string }).status = status;
  await user.save();
  return user.toObject();
}

export async function deleteUserAccount(ctx: ScopedContext, userId: string) {
  const user = await User.findOne({ _id: userId, tenantId: ctx.tenantId });
  if (!user) throw new NotFoundError("User not found in this tenant");
  if (String(user._id) === String(ctx.userId)) {
    throw new ForbiddenError("You can't delete yourself");
  }
  if (await isTenantOwner(ctx, String(user._id))) {
    throw new ForbiddenError("The tenant owner can't be deleted");
  }
  await User.deleteOne({ _id: user._id });
}

export async function resetUserPassword(ctx: ScopedContext, userId: string) {
  const user = await User.findOne({
    _id: userId,
    tenantId: ctx.tenantId,
  }).select("+password");
  if (!user) throw new NotFoundError("User not found in this tenant");

  const tempPassword = generateTempPassword();
  user.password = tempPassword; // pre-save hashes
  (user as unknown as { mustResetPassword: boolean }).mustResetPassword = true;
  await user.save();

  try {
    const inviter = await User.findById(ctx.userId).select("name").lean();
    await sendEmail(
      passwordResetEmail({
        userName: user.name,
        userEmail: user.email,
        tempPassword,
        loginUrl: SIGN_IN_URL(),
        resetByName: (inviter?.name as string) ?? "Your admin",
      }),
    );
  } catch (err) {
    console.error(
      "[resetUserPassword] email failed:",
      err instanceof Error ? err.message : err,
    );
  }

  return { tempPassword };
}
