import { withRoute, parseJson } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { UnauthorizedError } from "@/lib/errors";
import { z } from "zod";
import { tenantOf } from "@/lib/auth/tenant-context";
import { confirmVehicleDeletion } from "@/server/services/vehicle.service";

export const runtime = "nodejs";

const bodySchema = z.object({
  otp: z.string().min(4).max(10),
});

export const POST = withRoute<{ id: string }>(
  async ({ req, params, session }) => {
    if (!session) throw new UnauthorizedError();
    const ctx = tenantOf(session);
    const { otp } = await parseJson(req, bodySchema);
    const result = await confirmVehicleDeletion(ctx, params.id, session.id, otp);
    return success(result, "Vehicle deleted");
  },
  { auth: true },
);
