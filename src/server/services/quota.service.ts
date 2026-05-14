import "server-only";
import { ForbiddenError } from "@/lib/errors";
import { Driver, Plan, Role, Tenant, User, Vehicle } from "@/models";

/**
 * Plan-level quota enforcement.
 *
 * Each plan may set optional quotas for vehicles / drivers / users / roles.
 * If a quota field is null/undefined on the plan, that resource is unlimited
 * under this plan. Tenants on TRIAL (no plan attached) are also unlimited —
 * the superadmin assigns a plan to start enforcing limits.
 */

export type QuotaResource = "vehicle" | "driver" | "user" | "role";

const LABELS: Record<QuotaResource, string> = {
  vehicle: "vehicles",
  driver: "drivers",
  user: "users",
  role: "roles",
};

const QUOTA_KEY: Record<QuotaResource, "maxVehicles" | "maxDrivers" | "maxUsers" | "maxRoles"> = {
  vehicle: "maxVehicles",
  driver: "maxDrivers",
  user: "maxUsers",
  role: "maxRoles",
};

export type QuotaUsage = {
  resource: QuotaResource;
  used: number;
  /** `null` means unlimited under this plan (or tenant has no plan). */
  limit: number | null;
};

async function countCurrent(
  tenantId: string,
  resource: QuotaResource,
): Promise<number> {
  switch (resource) {
    case "vehicle":
      return Vehicle.countDocuments({ tenantId });
    case "driver":
      return Driver.countDocuments({ tenantId });
    case "user":
      return User.countDocuments({ tenantId });
    case "role":
      return Role.countDocuments({ tenantId });
  }
}

async function getPlanLimit(
  tenantId: string,
  resource: QuotaResource,
): Promise<number | null> {
  const tenant = await Tenant.findById(tenantId).select("planId").lean();
  if (!tenant?.planId) return null;
  const plan = await Plan.findById(tenant.planId).select(QUOTA_KEY[resource]).lean();
  if (!plan) return null;
  const raw = (plan as Record<string, unknown>)[QUOTA_KEY[resource]];
  if (raw === null || raw === undefined) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * Throw if creating one more record of this resource would exceed the plan
 * limit. No-op when there is no plan or the plan does not constrain this
 * resource.
 */
export async function assertQuota(
  tenantId: string,
  resource: QuotaResource,
): Promise<void> {
  const limit = await getPlanLimit(tenantId, resource);
  if (limit === null) return;
  const used = await countCurrent(tenantId, resource);
  if (used >= limit) {
    throw new ForbiddenError(
      `Plan limit reached — your current plan allows up to ${limit} ${LABELS[resource]}. Upgrade your plan or contact your administrator.`,
    );
  }
}

/** Resolve usage + limit for all four quota resources for a tenant. */
export async function getTenantQuotaSummary(
  tenantId: string,
): Promise<QuotaUsage[]> {
  const tenant = await Tenant.findById(tenantId).select("planId").lean();
  const plan = tenant?.planId
    ? await Plan.findById(tenant.planId)
        .select("maxVehicles maxDrivers maxUsers maxRoles")
        .lean()
    : null;

  const resources: QuotaResource[] = ["vehicle", "driver", "user", "role"];
  const usage = await Promise.all(
    resources.map(async (resource) => {
      const used = await countCurrent(tenantId, resource);
      const raw = plan
        ? (plan as Record<string, unknown>)[QUOTA_KEY[resource]]
        : null;
      const limit =
        raw === null || raw === undefined || Number.isNaN(Number(raw))
          ? null
          : Number(raw);
      return { resource, used, limit };
    }),
  );
  return usage;
}
