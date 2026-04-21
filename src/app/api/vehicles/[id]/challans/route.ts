import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import * as challanRepo from "@/server/repositories/challan.repository";

export const runtime = "nodejs";

export const GET = withRoute<{ id: string }>(
  async ({ params }) => {
    const challans = await challanRepo.findByVehicleId(params.id);
    return success(challans, "Challans fetched");
  },
  { auth: true },
);
