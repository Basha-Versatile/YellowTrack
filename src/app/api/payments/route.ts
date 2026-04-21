import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { getAllPayments } from "@/server/services/payment.service";

export const runtime = "nodejs";

export const GET = withRoute(
  async ({ req }) => {
    const sp = req.nextUrl.searchParams;
    const query = {
      page: sp.get("page") ? Number(sp.get("page")) : undefined,
      limit: sp.get("limit") ? Number(sp.get("limit")) : undefined,
    };
    return success(await getAllPayments(query), "Success");
  },
  { auth: true },
);
