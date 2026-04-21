import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { getDashboardStats } from "@/server/services/vehicle.service";

export const runtime = "nodejs";

export const GET = withRoute(
  async () => {
    const stats = await getDashboardStats();
    return success(stats, "Dashboard stats fetched successfully");
  },
  { auth: true },
);
