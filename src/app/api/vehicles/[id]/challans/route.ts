import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { tenantOf } from "@/lib/auth/tenant-context";
import * as challanRepo from "@/server/repositories/challan.repository";

export const runtime = "nodejs";

export const GET = withRoute<{ id: string }>(
  async ({ params, session }) => {
    const ctx = tenantOf(session);
    const challans = await challanRepo.findByVehicleId(ctx, params.id);
    return success(challans, "Challans fetched");
  },
  { auth: true },
);
