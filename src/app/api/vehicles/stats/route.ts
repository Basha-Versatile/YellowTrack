import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { tenantOf } from "@/lib/auth/tenant-context";
import { getDashboardStats } from "@/server/services/vehicle.service";

export const runtime = "nodejs";

export const GET = withRoute(
  async ({ session }) => {
    const ctx = tenantOf(session);
    const stats = await getDashboardStats(ctx);
    return success(stats, "Dashboard stats fetched successfully");
  },
  { auth: true },
);
