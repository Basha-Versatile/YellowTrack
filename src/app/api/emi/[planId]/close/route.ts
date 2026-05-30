import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { tenantOf } from "@/lib/auth/tenant-context";
import { requirePermission } from "@/lib/auth/guard";
import { UnauthorizedError } from "@/lib/errors";
import { requestPlanCloseOtp } from "@/server/services/emi.service";

export const runtime = "nodejs";

/**
 * Step 1 of OTP-gated EMI plan closure — emails a 6-digit code to the
 * calling user. Step 2 is /api/emi/[planId]/close/confirm. This pairs with
 * the warning step in the UI so accidental clicks can't close a plan.
 */
export const POST = withRoute<{ planId: string }>(
  async ({ params, session }) => {
    if (!session) throw new UnauthorizedError();
    const ctx = tenantOf(session);
    await requirePermission(session, "emi:update");
    const result = await requestPlanCloseOtp(ctx, params.planId, session.id);
    return success(result, "Closure code sent to your email");
  },
  { auth: true },
);
