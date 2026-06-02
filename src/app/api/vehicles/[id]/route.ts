import { withRoute, parseJson } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { tenantOf, tenantFilter } from "@/lib/auth/tenant-context";
import { requirePermission } from "@/lib/auth/guard";
import {
  getVehicleById,
  updateVehicleDetails,
} from "@/server/services/vehicle.service";
import { updateVehicleSchema } from "@/validations/vehicle.schema";
import { logFromRequest } from "@/server/services/activityLog.service";
import { Vehicle } from "@/models";

export const runtime = "nodejs";

export const GET = withRoute<{ id: string }>(
  async ({ params, session }) => {
    const ctx = tenantOf(session);
    const vehicle = await getVehicleById(ctx, params.id);
    return success(vehicle, "Vehicle fetched successfully");
  },
  { auth: true },
);

/**
 * Edit vehicle details. Every field is optional — the service applies the
 * delta, validates registration-number uniqueness, and returns the freshly
 * enriched record. Logs a revertable `vehicle.update` activity so a bad
 * edit can be rolled back from the activity log.
 */
export const PATCH = withRoute<{ id: string }>(
  async ({ req, params, session }) => {
    const ctx = tenantOf(session);
    await requirePermission(session, "vehicles:update");
    // The schema's preprocessors make Zod's inferred input wider than its
    // output (string | string[] | null | undefined for groupIds, etc.),
    // which trips parseJson's generic. The runtime parse still validates
    // every field — the cast just satisfies the typing.
    const input = (await parseJson(
      req,
      updateVehicleSchema as never,
    )) as Record<string, unknown>;

    // Snapshot the editable fields before the write so the activity-log
    // revert engine can restore them. Only the keys the user touched are
    // captured, keeping the snapshot focused.
    const touchedKeys = Object.keys(input).filter(
      (k) => (input as Record<string, unknown>)[k] !== undefined,
    );
    const before = touchedKeys.length
      ? await Vehicle.findOne(tenantFilter(ctx, { _id: params.id }))
          .select(touchedKeys.join(" "))
          .lean()
      : null;

    const vehicle = await updateVehicleDetails(
      ctx,
      params.id,
      input as Record<string, unknown>,
    );

    if (touchedKeys.length > 0) {
      const beforeSnapshot: Record<string, unknown> = {};
      for (const k of touchedKeys) {
        beforeSnapshot[k] =
          (before as Record<string, unknown> | null)?.[k] ?? null;
      }
      await logFromRequest(req, ctx, session, {
        action: "vehicle.update",
        entityType: "vehicle",
        entityId: params.id,
        entityLabel:
          (vehicle as { registrationNumber?: string }).registrationNumber ??
          "Vehicle",
        summary: `Edited vehicle details (${touchedKeys.length} field${touchedKeys.length === 1 ? "" : "s"})`,
        metadata: { fields: touchedKeys },
        revertable: true,
        beforeSnapshot,
      });
    }

    return success(vehicle, "Vehicle updated");
  },
  { auth: true },
);
