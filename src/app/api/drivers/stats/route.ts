import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { getDriverComplianceStats } from "@/server/services/driver.service";

export const runtime = "nodejs";

export const GET = withRoute(
  async () => {
    const stats = await getDriverComplianceStats();
    return success(stats, "Driver compliance stats fetched");
  },
  { auth: true },
);
