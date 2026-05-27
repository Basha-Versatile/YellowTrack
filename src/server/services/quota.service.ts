import "server-only";
import { Driver, Role, User, Vehicle } from "@/models";

/**
 * Quota enforcement is disabled with the new per-vehicle pricing model.
 *
 * Plans now define fleet-size tiers + per-unit pricing rather than hard caps,
 * so growing the fleet just moves the tenant up to the next tier — it never
 * blocks the operation. `assertQuota` is kept as a no-op so existing callers
 * in vehicle/driver/role services continue to compile and behave identically.
 *
 * `getTenantQuotaSummary` still surfaces current usage for the tenant detail
 * page, but always reports `limit: null` (unlimited).
 */

export type QuotaResource = "vehicle" | "driver" | "user" | "role";

export type QuotaUsage = {
  resource: QuotaResource;
  used: number;
  /** Always `null` under per-vehicle billing — there are no hard caps. */
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

export async function assertQuota(
  _tenantId: string,
  _resource: QuotaResource,
): Promise<void> {
  // No-op — per-vehicle pricing replaces hard quotas.
}

export async function getTenantQuotaSummary(
  tenantId: string,
): Promise<QuotaUsage[]> {
  const resources: QuotaResource[] = ["vehicle", "driver", "user", "role"];
  return Promise.all(
    resources.map(async (resource) => ({
      resource,
      used: await countCurrent(tenantId, resource),
      limit: null,
    })),
  );
}
