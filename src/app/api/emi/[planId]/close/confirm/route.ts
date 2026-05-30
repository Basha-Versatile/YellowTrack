import { withRoute, parseJson } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { z } from "zod";
import { tenantOf } from "@/lib/auth/tenant-context";
import { requirePermission } from "@/lib/auth/guard";
import { UnauthorizedError } from "@/lib/errors";
import { confirmPlanClose } from "@/server/services/emi.service";
import { logFromRequest } from "@/server/services/activityLog.service";
import { EMIPlan } from "@/models";

export const runtime = "nodejs";

const bodySchema = z.object({
  otp: z.string().regex(/^\d{6}$/, "Enter the 6-digit code"),
});

export const POST = withRoute<{ planId: string }>(
  async ({ req, params, session }) => {
    if (!session) throw new UnauthorizedError();
    const ctx = tenantOf(session);
    await requirePermission(session, "emi:update");
    const { otp } = await parseJson(req, bodySchema);

    // Snapshot the pre-close state so the activity revert can flip it back.
    const before = await EMIPlan.findById(params.planId).lean();
    const plan = await confirmPlanClose(ctx, params.planId, session.id, otp);

    if (before) {
      const b = before as { status?: string; closedAt?: Date | null; nextDueDate?: Date | null; lenderName?: string };
      // `emi.update` is already wired in the revert registry as an "update"
      // shape — restoring the snapshot fields re-activates the plan.
      await logFromRequest(req, ctx, session, {
        action: "emi.update",
        entityType: "emi",
        entityId: params.planId,
        entityLabel: b.lenderName ?? "EMI plan",
        summary: `Closed EMI plan with ${b.lenderName ?? "lender"}`,
        revertable: true,
        beforeSnapshot: {
          status: b.status ?? null,
          closedAt: b.closedAt ?? null,
          nextDueDate: b.nextDueDate ?? null,
        },
      });
    }

    return success(plan, "EMI plan closed");
  },
  { auth: true },
);
