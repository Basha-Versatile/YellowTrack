import { withRoute, parseJson } from "@/lib/api-handler";
import { created } from "@/lib/http";
import { z } from "zod";
import { tenantOf } from "@/lib/auth/tenant-context";
import { requirePermission } from "@/lib/auth/guard";
import { UnauthorizedError } from "@/lib/errors";
import { createShareLink } from "@/server/services/documentShare.service";
import { getRequestOrigin } from "@/lib/request-origin";
import { logFromRequest } from "@/server/services/activityLog.service";

export const runtime = "nodejs";

const bodySchema = z.object({
  vehicleId: z.string().min(1, "vehicleId is required"),
  complianceDocIds: z
    .array(z.string().min(1))
    .min(1, "Select at least one document"),
});

/**
 * Mints a 24h share link for a curated set of compliance documents on a
 * vehicle. The returned URL can be sent to anyone — the token is the auth.
 */
export const POST = withRoute(
  async ({ req, session }) => {
    if (!session) throw new UnauthorizedError();
    const ctx = tenantOf(session);
    await requirePermission(session, "compliance:read");
    const { vehicleId, complianceDocIds } = await parseJson(req, bodySchema);
    const result = await createShareLink(ctx, {
      vehicleId,
      complianceDocIds,
      userId: session.id ?? null,
    });
    const origin = getRequestOrigin(req).replace(/\/$/, "");
    const url = `${origin}/public/share/${result.token}`;

    await logFromRequest(req, ctx, session, {
      action: "compliance.share",
      entityType: "vehicle",
      entityId: vehicleId,
      entityLabel: `Vehicle ${vehicleId}`,
      summary: `Generated 24h share link for ${complianceDocIds.length} document${complianceDocIds.length === 1 ? "" : "s"}`,
      metadata: {
        complianceDocIds,
        expiresAt: result.expiresAt,
      },
    });

    return created(
      {
        token: result.token,
        url,
        expiresAt: result.expiresAt.toISOString(),
      },
      "Share link created",
    );
  },
  { auth: true },
);
