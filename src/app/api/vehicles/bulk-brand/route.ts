import { withRoute, parseJson } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { z } from "zod";
import { tenantOf } from "@/lib/auth/tenant-context";
import { requirePermission } from "@/lib/auth/guard";
import { bulkAssignBrand } from "@/server/services/vehicle.service";
import { logFromRequest } from "@/server/services/activityLog.service";

export const runtime = "nodejs";

/**
 * Bulk-assign a brand to many vehicles in one shot. Power-user shortcut for
 * the "Unbranded" filter on the Vehicles list.
 *
 * Race-safe: only updates rows that are still unbranded at write time. Any
 * row that another operator branded in the meantime is silently skipped
 * (the response surfaces `modified` and `skipped` so the UI can label the
 * toast accurately).
 *
 * Permission: `vehicles:update` — same gate as the single-vehicle PATCH.
 */
const bodySchema = z.object({
  vehicleIds: z.array(z.string().min(1)).min(1).max(10_000),
  brand: z.string().trim().min(1).max(80),
});

export const PATCH = withRoute(
  async ({ req, session }) => {
    const ctx = tenantOf(session);
    await requirePermission(session, "vehicles:update");
    const input = await parseJson(req, bodySchema);

    const result = await bulkAssignBrand(ctx, input.vehicleIds, input.brand);

    // Single aggregate activity entry — keeps the audit log readable.
    // Per-vehicle entries would dump hundreds of rows into the feed on a
    // big bulk operation. We capture the affected IDs in metadata so a
    // forensic query can still find them.
    if (result.modified > 0) {
      await logFromRequest(req, ctx, session, {
        action: "vehicle.bulk_brand",
        entityType: "vehicle",
        entityId: "bulk",
        entityLabel: `${result.modified} vehicle${result.modified === 1 ? "" : "s"} → ${input.brand}`,
        summary:
          result.skipped > 0
            ? `Bulk-assigned brand "${input.brand}" to ${result.modified} vehicle${result.modified === 1 ? "" : "s"} (${result.skipped} skipped — already branded)`
            : `Bulk-assigned brand "${input.brand}" to ${result.modified} vehicle${result.modified === 1 ? "" : "s"}`,
        metadata: {
          brand: input.brand,
          requested: input.vehicleIds.length,
          matched: result.matched,
          modified: result.modified,
          skipped: result.skipped,
          vehicleIds: input.vehicleIds,
        },
      });
    }

    return success(result, "Bulk brand assignment complete");
  },
  { auth: true },
);
