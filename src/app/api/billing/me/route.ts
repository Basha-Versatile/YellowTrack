import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { tenantOf } from "@/lib/auth/tenant-context";
import { UnauthorizedError } from "@/lib/errors";
import { getBillingOverview } from "@/server/services/billing.service";
import { Tenant } from "@/models";
import { runPlanFitForTenant } from "@/server/services/billing.orchestrator";

export const runtime = "nodejs";

/**
 * One-shot overview used by the header badge AND the /billing page. Returns
 * tenant (with wallet balance + health), current plan, projected next bill,
 * and any open upgrade request. `tenantOf` already throws ForbiddenError
 * for sessions without a tenantId, so SUPERADMIN callers fail cleanly
 * before we hit the service layer.
 *
 * Self-healing: if the tenant has no plan assigned, run the plan-fit
 * evaluator first. This catches tenants that pre-date the auto-assign
 * hooks so the popup never shows "No plan" stale-state.
 */
export const GET = withRoute(
  async ({ session }) => {
    if (!session) throw new UnauthorizedError();
    const ctx = tenantOf(session);

    const t = await Tenant.findById(ctx.tenantId).select("planId").lean();
    const hasPlan = Boolean((t as { planId?: unknown } | null)?.planId);
    if (!hasPlan) {
      try {
        await runPlanFitForTenant(ctx.tenantId);
      } catch (err) {
        console.error(
          "[billing.me] lazy plan-fit failed:",
          err instanceof Error ? err.message : err,
        );
      }
    }

    const overview = await getBillingOverview(ctx.tenantId);
    return success(overview, "Billing overview");
  },
  { auth: true },
);
