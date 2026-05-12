import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { tenantOf } from "@/lib/auth/tenant-context";
import { getDriverComplianceStats } from "@/server/services/driver.service";

export const runtime = "nodejs";

export const GET = withRoute(
  async ({ session }) => {
    const ctx = tenantOf(session);
    const stats = await getDriverComplianceStats(ctx);
    return success(stats, "Driver compliance stats fetched");
  },
  { auth: true },
);
