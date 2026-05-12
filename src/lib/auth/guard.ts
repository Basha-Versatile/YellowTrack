import "server-only";
import { ForbiddenError, UnauthorizedError } from "../errors";
import { Role, User } from "@/models";
import {
  type Permission,
  defaultPermissionsForRole,
} from "./permissions";
import type { Session } from "./session";

/**
 * Permission gate for tenant-admin / operator routes.
 *
 * Strategy:
 *   1. Read the User document for `session.id`.
 *   2. If User.roleId is set, fetch the Role and use Role.permissions.
 *   3. Otherwise, use the default permission set for User.role (the enum).
 *
 * SUPERADMIN sessions: refused here. Superadmin uses /superadmin routes
 * which have their own role guard at the chokepoint primitive level.
 */
export async function getEffectivePermissions(
  session: Session,
): Promise<Set<Permission>> {
  if (session.role === "SUPERADMIN") {
    // SUPERADMIN doesn't belong in tenant scope — bail.
    return new Set();
  }

  const user = await User.findById(session.id).select("role roleId").lean();
  if (!user) return new Set();

  if (user.roleId) {
    const role = await Role.findById(user.roleId).select("permissions").lean();
    if (role) {
      return new Set(role.permissions as Permission[]);
    }
  }
  return new Set(defaultPermissionsForRole(user.role));
}

export async function hasPermission(
  session: Session | null,
  permission: Permission,
): Promise<boolean> {
  if (!session) return false;
  const perms = await getEffectivePermissions(session);
  return perms.has(permission);
}

/**
 * Use inside route handlers (after `tenantOf(session)`). Throws Forbidden
 * if the session lacks the permission. SUPERADMIN sessions are rejected —
 * they should not be hitting tenant routes.
 */
export async function requirePermission(
  session: Session | null,
  permission: Permission,
): Promise<void> {
  if (!session) throw new UnauthorizedError();
  if (session.role === "SUPERADMIN") {
    throw new ForbiddenError("Tenant routes require a tenant-scoped session");
  }
  const ok = await hasPermission(session, permission);
  if (!ok) {
    throw new ForbiddenError(`Missing permission: ${permission}`);
  }
}

/**
 * Convenience for the client: returns the permission set as a string[] for
 * the current session, so the UI can hide buttons / disable actions without
 * making a separate roundtrip per check.
 */
export async function listEffectivePermissions(
  session: Session,
): Promise<string[]> {
  const set = await getEffectivePermissions(session);
  return Array.from(set);
}
