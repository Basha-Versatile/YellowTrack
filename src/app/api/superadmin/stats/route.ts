import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { getDashboardStats } from "@/server/services/tenant.service";

export const runtime = "nodejs";

export const GET = withRoute(
  async () => {
    const stats = await getDashboardStats();
    return success(stats, "Superadmin stats");
  },
  { auth: true, roles: ["SUPERADMIN"] },
);
