import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { UnauthorizedError } from "@/lib/errors";
import { tenantOf } from "@/lib/auth/tenant-context";
import { requestVehicleDeletion } from "@/server/services/vehicle.service";

export const runtime = "nodejs";

export const POST = withRoute<{ id: string }>(
  async ({ params, session }) => {
    if (!session) throw new UnauthorizedError();
    const ctx = tenantOf(session);
    const result = await requestVehicleDeletion(ctx, params.id, session.id);
    return success(result, "OTP generated");
  },
  { auth: true },
);
