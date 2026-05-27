import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { listActivePlans } from "@/server/services/plan.service";

export const runtime = "nodejs";

/**
 * Public — returns the active subscription plans for the marketing landing
 * page. No auth required. Only plans that have been migrated to the new
 * per-vehicle pricing shape are surfaced; legacy plans missing the new fields
 * stay hidden until the superadmin re-saves them.
 */
export const GET = withRoute(async () => {
  const all = await listActivePlans();
  const ready = all.filter((p) => {
    const plan = p as unknown as {
      perVehiclePerMonth?: unknown;
      perVehiclePerYear?: unknown;
      fleetSizeMin?: unknown;
    };
    return (
      typeof plan.perVehiclePerMonth === "number" &&
      typeof plan.perVehiclePerYear === "number" &&
      typeof plan.fleetSizeMin === "number"
    );
  });
  return success(ready, "Active plans");
});
