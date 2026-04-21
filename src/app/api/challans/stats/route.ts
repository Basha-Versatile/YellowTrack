import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import * as challanRepo from "@/server/repositories/challan.repository";

export const runtime = "nodejs";

export const GET = withRoute(
  async () => {
    const stats = await challanRepo.getStats();
    return success(stats, "Success");
  },
  { auth: true },
);
