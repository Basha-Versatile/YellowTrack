import "server-only";
import { ForbiddenError, UnauthorizedError } from "../errors";
import type { Session } from "./session";

export function requireRole(session: Session | null, ...roles: string[]): Session {
  if (!session || !roles.includes(session.role)) {
    throw new ForbiddenError();
  }
  return session;
}

export const isAdmin = (session: Session | null): boolean =>
  session?.role === "ADMIN";

export const isSuperadmin = (session: Session | null): boolean =>
  session?.role === "SUPERADMIN";

/**
 * Use inside tenant-scoped route handlers. Asserts the session has a tenantId
 * and returns it as a guaranteed-non-null string. SUPERADMIN must impersonate
 * (get a tenant-scoped JWT) before hitting tenant routes.
 */
export function requireTenant(session: Session | null): {
  session: Session;
  tenantId: string;
} {
  if (!session) throw new UnauthorizedError();
  if (!session.tenantId) {
    throw new ForbiddenError("Tenant context required");
  }
  return { session, tenantId: session.tenantId };
}

export function requireSuperadmin(session: Session | null): Session {
  if (!session) throw new UnauthorizedError();
  if (session.role !== "SUPERADMIN") {
    throw new ForbiddenError("Superadmin access required");
  }
  return session;
}
