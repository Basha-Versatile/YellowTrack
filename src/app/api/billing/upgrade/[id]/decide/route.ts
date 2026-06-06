import { withRoute, parseJson } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { z } from "zod";
import { tenantOf } from "@/lib/auth/tenant-context";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
import { decideUpgradeRequest } from "@/server/services/planUpgrade.service";

export const runtime = "nodejs";

const bodySchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
});

/**
 * Tenant admin confirms / rejects a pending plan upgrade. On APPROVED the
 * tenant's planId flips to the new plan and next month's bill picks up the
 * new rate. On REJECTED the request is closed but the tenant keeps the
 * current (cheaper) plan — the UI will warn about being over-cap until
 * they either reduce the fleet or accept a future request.
 */
export const POST = withRoute<{ id: string }>(
  async ({ req, params, session }) => {
    if (!session) throw new UnauthorizedError();
    const ctx = tenantOf(session);
    if (session.role !== "ADMIN") {
      throw new ForbiddenError(
        "Only workspace admins can decide plan upgrades",
      );
    }
    const { decision } = await parseJson(req, bodySchema);
    const result = await decideUpgradeRequest({
      requestId: params.id,
      tenantId: ctx.tenantId,
      decidedBy: session.id ?? "",
      decision,
    });
    return success(result, `Upgrade ${decision.toLowerCase()}`);
  },
  { auth: true },
);
