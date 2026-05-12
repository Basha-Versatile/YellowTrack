import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { tenantOf } from "@/lib/auth/tenant-context";
import { getPaymentById } from "@/server/services/payment.service";

export const runtime = "nodejs";

export const GET = withRoute<{ id: string }>(
  async ({ params, session }) => {
    const ctx = tenantOf(session);
    return success(await getPaymentById(ctx, params.id), "Success");
  },
  { auth: true },
);
