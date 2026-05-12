import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { tenantOf } from "@/lib/auth/tenant-context";
import * as challanRepo from "@/server/repositories/challan.repository";

export const runtime = "nodejs";

export const GET = withRoute(
  async ({ session }) => {
    const ctx = tenantOf(session);
    const stats = await challanRepo.getStats(ctx);
    return success(stats, "Success");
  },
  { auth: true },
);
