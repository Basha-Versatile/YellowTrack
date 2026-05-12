import "server-only";
import { ForbiddenError, UnauthorizedError } from "../errors";
import type { Session } from "./session";

/**
 * Tenant isolation chokepoint.
 *
 * Every repository call must accept a `ScopedContext` and route its Mongo
 * filter through `tenantFilter()` (or call `tenantId` on a `TenantContext`).
 * This is the SINGLE place where cross-tenant access is decided.
 *
 *  - `tenantOf(session)`       — for tenant-admin / operator routes.
 *  - `superadminTenantOf(...)` — for superadmin routes that want a specific
 *                                tenant scope (e.g. impersonation, "view
 *                                tenant X usage").
 *  - `crossTenantOf(session)`  — for superadmin routes that intentionally
 *                                query across all tenants (e.g. global
 *                                metrics). Refuses non-superadmin sessions.
 *
 * Never construct a `ScopedContext` outside this module — that would defeat
 * the chokepoint.
 */

export const ALL_TENANTS = Symbol.for("yellowtrack.allTenants");
export type AllTenants = typeof ALL_TENANTS;

export type TenantContext = {
  readonly tenantId: string;
  readonly role: string;
  readonly userId: string;
};

export type CrossTenantContext = {
  readonly tenantId: AllTenants;
  readonly role: "SUPERADMIN";
  readonly userId: string;
};

export type ScopedContext = TenantContext | CrossTenantContext;

/**
 * For tenant-admin/operator routes. Throws if the session lacks a tenant
 * scope. SUPERADMIN sessions are refused here — they must use impersonation
 * (a tenant-scoped JWT) or `crossTenantOf()` for explicit cross-tenant work.
 */
export function tenantOf(session: Session | null): TenantContext {
  if (!session) throw new UnauthorizedError();
  if (!session.tenantId) {
    throw new ForbiddenError("Tenant context required");
  }
  return {
    tenantId: session.tenantId,
    role: session.role,
    userId: session.id,
  };
}

/**
 * For superadmin routes that want to operate on a specific tenant (e.g. read
 * a tenant's vehicles for an admin dashboard). Caller passes the target
 * tenantId explicitly; we verify the session is SUPERADMIN.
 */
export function superadminTenantOf(
  session: Session | null,
  targetTenantId: string,
): TenantContext {
  if (!session) throw new UnauthorizedError();
  if (session.role !== "SUPERADMIN") {
    throw new ForbiddenError("Superadmin access required");
  }
  if (!targetTenantId) {
    throw new ForbiddenError("Target tenantId required");
  }
  return {
    tenantId: targetTenantId,
    role: session.role,
    userId: session.id,
  };
}

/**
 * For public routes that authenticate via an unguessable token (e.g. the
 * driver self-verify link). The token itself is the access control — once
 * we've matched it to a driver record, the driver's `tenantId` becomes the
 * scope for all follow-up writes (update profile, log change, upload photo).
 *
 * Treated as a SUPERADMIN-equivalent for the purposes of this scope: not
 * derived from a session, so `userId` is a synthetic marker. Use only in
 * `public.service` after a token match.
 */
export function tokenScopedTenantOf(tenantId: string): TenantContext {
  if (!tenantId) throw new ForbiddenError("Token-scoped context requires tenantId");
  return { tenantId, role: "PUBLIC_TOKEN", userId: "public-token" };
}

/**
 * For superadmin routes that intentionally read across ALL tenants
 * (e.g. platform-wide metrics, global user search, audit feed).
 */
export function crossTenantOf(session: Session | null): CrossTenantContext {
  if (!session) throw new UnauthorizedError();
  if (session.role !== "SUPERADMIN") {
    throw new ForbiddenError("Superadmin access required");
  }
  return {
    tenantId: ALL_TENANTS,
    role: "SUPERADMIN",
    userId: session.id,
  };
}

/**
 * Build a Mongo filter that always includes the tenant scope. Pass any
 * additional filter conditions via `extra`. Cross-tenant contexts drop the
 * scope.
 */
export function tenantFilter(
  ctx: ScopedContext,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  if (ctx.tenantId === ALL_TENANTS) return extra;
  return { tenantId: ctx.tenantId, ...extra };
}

/**
 * For inserts: returns an object with the tenant stamp. Refuses cross-tenant
 * contexts (you can't insert into "all tenants" — must pick one).
 */
export function tenantStamp(ctx: ScopedContext): { tenantId: string } {
  if (ctx.tenantId === ALL_TENANTS) {
    throw new ForbiddenError(
      "Cannot insert without a specific tenant scope. Use superadminTenantOf().",
    );
  }
  return { tenantId: ctx.tenantId };
}

/** Type guard. */
export function isCrossTenant(ctx: ScopedContext): ctx is CrossTenantContext {
  return ctx.tenantId === ALL_TENANTS;
}
