import { withRoute, parseJson } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { UnauthorizedError } from "@/lib/errors";
import { z } from "zod";
import { tenantOf, tenantFilter } from "@/lib/auth/tenant-context";
import { confirmVehicleDeletion, getVehicleById } from "@/server/services/vehicle.service";
import { logFromRequest } from "@/server/services/activityLog.service";
import { ComplianceDocument, Vehicle } from "@/models";

export const runtime = "nodejs";

const bodySchema = z.object({
  otp: z.string().min(4).max(10),
});

export const POST = withRoute<{ id: string }>(
  async ({ req, params, session }) => {
    if (!session) throw new UnauthorizedError();
    const ctx = tenantOf(session);
    const { otp } = await parseJson(req, bodySchema);
    // Snapshot the reg no AND full row + cascade children BEFORE deletion so
    // revert can rebuild the vehicle later.
    let label = params.id;
    let vehicleSnap: Record<string, unknown> | null = null;
    let complianceSnaps: unknown[] = [];
    try {
      const v = await getVehicleById(ctx, params.id);
      label = (v as { registrationNumber?: string }).registrationNumber ?? params.id;
      // Read raw doc (skip soft-delete middleware) to keep deletedAt + all fields.
      vehicleSnap = (await Vehicle.findOne(
        tenantFilter(ctx, { _id: params.id, deletedAt: null }),
      ).lean()) as Record<string, unknown> | null;
      complianceSnaps = await ComplianceDocument.find(
        tenantFilter(ctx, { vehicleId: params.id }),
      ).lean();
    } catch {
      /* ignore — fall back to id */
    }
    const result = await confirmVehicleDeletion(ctx, params.id, session.id, otp);
    await logFromRequest(req, ctx, session, {
      action: "vehicle.delete",
      entityType: "vehicle",
      entityId: params.id,
      entityLabel: label,
      summary: `Deleted vehicle ${label}`,
      revertable: Boolean(vehicleSnap),
      beforeSnapshot: vehicleSnap,
      childSnapshots: complianceSnaps.length
        ? { ComplianceDocument: complianceSnaps as unknown[] }
        : null,
    });
    return success(result, "Vehicle deleted");
  },
  { auth: true },
);
