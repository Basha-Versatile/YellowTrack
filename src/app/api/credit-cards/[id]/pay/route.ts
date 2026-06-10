import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { tenantOf } from "@/lib/auth/tenant-context";
import * as service from "@/server/services/credit-card.service";

export const runtime = "nodejs";

export const POST = withRoute<{ id: string }>(
  async ({ params, session }) => {
    const ctx = tenantOf(session);
    return success(
      await service.payCard(ctx, params.id),
      "Bill marked paid",
    );
  },
  { auth: true },
);
