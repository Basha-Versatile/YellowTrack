import { withRoute, parseQuery } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { z } from "zod";
import { tenantOf } from "@/lib/auth/tenant-context";
import { getFleetSummary } from "@/server/services/vehicle.service";

export const runtime = "nodejs";

const querySchema = z.object({
  lifecycle: z.enum(["ACTIVE", "SOLD"]).optional(),
});

/**
 * Fleet-wide counters for the Vehicles page stat cards (Total / Compliant
 * / Upcoming / Critical / Pending Fines). Server-side aggregation avoids
 * pulling every vehicle over the wire just to count rows — and side-steps
 * the list endpoint's `limit` ceiling, which used to silently zero the
 * stat cards when the page tried to fetch the whole fleet at once.
 *
 * /api/vehicles/stats is left alone — that one feeds the Dashboard and
 * returns a different shape.
 */
export const GET = withRoute(
  async ({ req, session }) => {
    const ctx = tenantOf(session);
    const { lifecycle } = parseQuery(req, querySchema);
    const summary = await getFleetSummary(ctx, { lifecycle });
    return success(summary, "Fleet summary");
  },
  { auth: true },
);
