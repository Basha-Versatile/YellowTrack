import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { tenantOf } from "@/lib/auth/tenant-context";
import { UnauthorizedError } from "@/lib/errors";
import { requestResetOtp } from "@/server/services/customComplianceLock.service";
import { logFromRequest } from "@/server/services/activityLog.service";
import { CustomComplianceGroup } from "@/models";

export const runtime = "nodejs";

/**
 * Step 1 of forgot-password: issue an OTP to the folder's stored recovery
 * email. 60-second cooldown enforced server-side.
 */
export const POST = withRoute<{ id: string }>(
  async ({ req, params, session }) => {
    if (!session) throw new UnauthorizedError();
    const ctx = tenantOf(session);
    await requestResetOtp(ctx, params.id, session.id);
    const group = await CustomComplianceGroup.findById(params.id)
      .select("name lock.recoveryEmail")
      .lean();
    const name = (group as { name?: string } | null)?.name ?? "Folder";
    await logFromRequest(req, ctx, session, {
      action: "customCompliance.group.lock.reset_requested",
      entityType: "customComplianceGroup",
      entityId: params.id,
      entityLabel: name,
      summary: `Requested folder-lock password reset for "${name}"`,
    });
    return success(
      { ok: true, sent: true },
      "Verification code sent to the recovery email",
    );
  },
  { auth: true },
);
