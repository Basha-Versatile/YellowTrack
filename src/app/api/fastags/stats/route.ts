import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { tenantOf } from "@/lib/auth/tenant-context";
import * as service from "@/server/services/fastag.service";

export const runtime = "nodejs";

export const GET = withRoute(
  async ({ session }) => {
    const ctx = tenantOf(session);
    return success(await service.getStats(ctx), "FASTag stats fetched");
  },
  { auth: true },
);
