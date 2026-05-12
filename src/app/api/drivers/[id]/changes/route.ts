import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { tenantOf } from "@/lib/auth/tenant-context";
import { getDriverChangeLog } from "@/server/services/driver.service";

export const runtime = "nodejs";

export const GET = withRoute<{ id: string }>(
  async ({ params, session }) => {
    const ctx = tenantOf(session);
    const entries = await getDriverChangeLog(ctx, params.id);
    return success(entries, "Driver change log fetched");
  },
  { auth: true },
);
