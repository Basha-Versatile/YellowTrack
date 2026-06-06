import "server-only";
import {
  CustomComplianceDocument,
  Driver,
  Plan,
  Role,
  Tenant,
  User,
  Vehicle,
} from "@/models";
import { ForbiddenError, NotFoundError } from "@/lib/errors";

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

// ── Custom Compliance per-group document limit ─────────────────────────────
// Tenants pay per group (default ₹30) and each group caps at N documents
// (default 10). The cap lives on the Plan so superadmin can bump it for
// premium tiers without code changes.

const DEFAULT_DOCS_PER_GROUP_LIMIT = 10;

async function resolveDocsPerGroupLimit(tenantId: string): Promise<number> {
  const tenant = await Tenant.findById(tenantId).select("planId").lean();
  const planId = (tenant as { planId?: unknown } | null)?.planId;
  if (!planId) return DEFAULT_DOCS_PER_GROUP_LIMIT;
  const plan = await Plan.findById(planId)
    .select("customComplianceDocsPerGroupLimit")
    .lean();
  const limit = (
    plan as { customComplianceDocsPerGroupLimit?: number } | null
  )?.customComplianceDocsPerGroupLimit;
  return typeof limit === "number" && limit > 0
    ? limit
    : DEFAULT_DOCS_PER_GROUP_LIMIT;
}

/**
 * Throws ForbiddenError when adding one more document to this group would
 * exceed the plan's per-group cap. Called from the document-create route
 * before insertion. Safe under concurrent writes because the cap is a soft
 * fence — a brief race might let through one extra doc, which is fine for
 * a soft business cap (no risk of duplicate IDs or corrupt state).
 */
export async function assertCustomComplianceGroupDocCapacity(
  tenantId: string,
  groupId: string,
): Promise<void> {
  if (!tenantId || !groupId) {
    throw new NotFoundError("Group not found");
  }
  const [limit, used] = await Promise.all([
    resolveDocsPerGroupLimit(tenantId),
    CustomComplianceDocument.countDocuments({ tenantId, groupId }),
  ]);
  if (used >= limit) {
    throw new ForbiddenError(
      `This group already has ${used} documents — the plan cap is ${limit}. Remove a document or upgrade the plan to add more.`,
    );
  }
}

/**
 * Returns the current usage + cap for a group. Used by the admin UI to
 * render an "X / N" badge and disable the Add button at the limit.
 */
export async function getCustomComplianceGroupDocCapacity(
  tenantId: string,
  groupId: string,
): Promise<{ used: number; limit: number }> {
  const [limit, used] = await Promise.all([
    resolveDocsPerGroupLimit(tenantId),
    CustomComplianceDocument.countDocuments({ tenantId, groupId }),
  ]);
  return { used, limit };
}
