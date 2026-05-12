import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { tenantOf } from "@/lib/auth/tenant-context";
import * as service from "@/server/services/fastag.service";

export const runtime = "nodejs";

export const GET = withRoute<{ vehicleId: string }>(
  async ({ params, session }) => {
    const ctx = tenantOf(session);
    return success(
      await service.getByVehicle(ctx, params.vehicleId),
      "FASTag fetched",
    );
  },
  { auth: true },
);
