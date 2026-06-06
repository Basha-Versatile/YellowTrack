import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { Tenant } from "@/models";
import { runPlanFitForTenant } from "@/server/services/billing.orchestrator";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Superadmin-triggered backfill — runs the plan-fit evaluator across every
 * ACTIVE tenant. For each tenant:
 *   - no plan yet → assigns the matching tier (most existing tenants will
 *     land in Select / 0–50)
 *   - smaller / same tier → applies immediately
 *   - larger tier → queues a PENDING upgrade request and emails admins
 *
 * Safe to re-run: same-tier moves are no-ops, and upgrade requests are
 * deduped by (tenantId, status=PENDING).
 */
export const POST = withRoute(
  async () => {
    const tenants = await Tenant.find({ status: "ACTIVE" }).select("_id").lean();
    let upgradedAuto = 0;
    let upgradeQueued = 0;
    const errors: Array<{ tenantId: string; message: string }> = [];

    for (const t of tenants) {
      const tenantId = String((t as { _id: unknown })._id);
      try {
        const r = await runPlanFitForTenant(tenantId);
        if (r.upgradedAuto) upgradedAuto += 1;
        if (r.upgradeQueued) upgradeQueued += 1;
      } catch (err) {
        errors.push({
          tenantId,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return success(
      {
        tenantCount: tenants.length,
        upgradedAuto,
        upgradeQueued,
        errors,
      },
      `Backfilled ${tenants.length} tenants (${upgradedAuto} auto-applied, ${upgradeQueued} pending confirmation)`,
    );
  },
  { auth: true, roles: ["SUPERADMIN"] },
);
