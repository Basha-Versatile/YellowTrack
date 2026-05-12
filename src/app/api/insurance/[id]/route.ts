import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { tenantOf } from "@/lib/auth/tenant-context";
import * as service from "@/server/services/insurance.service";

export const runtime = "nodejs";

export const GET = withRoute<{ id: string }>(
  async ({ params, session }) => {
    const ctx = tenantOf(session);
    return success(await service.getById(ctx, params.id), "Policy fetched");
  },
  { auth: true },
);
