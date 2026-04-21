import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { getPaymentById } from "@/server/services/payment.service";

export const runtime = "nodejs";

export const GET = withRoute<{ id: string }>(
  async ({ params }) => {
    return success(await getPaymentById(params.id), "Success");
  },
  { auth: true },
);
