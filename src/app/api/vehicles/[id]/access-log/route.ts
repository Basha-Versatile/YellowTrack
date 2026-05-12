import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { tenantOf } from "@/lib/auth/tenant-context";
import * as logRepo from "@/server/repositories/vehiclePublicAccessLog.repository";

export const runtime = "nodejs";

export const GET = withRoute<{ id: string }>(
  async ({ params, session }) => {
    const ctx = tenantOf(session);
    const entries = await logRepo.findByVehicle(ctx, params.id);
    return success(entries, "Vehicle public access log fetched");
  },
  { auth: true },
);
