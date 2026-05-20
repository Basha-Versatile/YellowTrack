import { withRoute, parseJson } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { UnauthorizedError } from "@/lib/errors";
import { z } from "zod";
import { tenantOf } from "@/lib/auth/tenant-context";
import { confirmVehicleDeletion, getVehicleById } from "@/server/services/vehicle.service";
import { logFromRequest } from "@/server/services/activityLog.service";

export const runtime = "nodejs";

const bodySchema = z.object({
  otp: z.string().min(4).max(10),
});

export const POST = withRoute<{ id: string }>(
  async ({ req, params, session }) => {
    if (!session) throw new UnauthorizedError();
    const ctx = tenantOf(session);
    const { otp } = await parseJson(req, bodySchema);
    // Snapshot the reg no BEFORE deletion so the log has a readable label
    // even after the vehicle row is gone.
    let label = params.id;
    try {
      const v = await getVehicleById(ctx, params.id);
      label = (v as { registrationNumber?: string }).registrationNumber ?? params.id;
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
    });
    return success(result, "Vehicle deleted");
  },
  { auth: true },
);
