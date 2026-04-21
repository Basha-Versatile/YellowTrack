import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import * as service from "@/server/services/fastag.service";

export const runtime = "nodejs";

export const GET = withRoute<{ id: string }>(
  async ({ req, params }) => {
    const sp = req.nextUrl.searchParams;
    const query = {
      page: sp.get("page") ? Number(sp.get("page")) : undefined,
      limit: sp.get("limit") ? Number(sp.get("limit")) : undefined,
    };
    return success(
      await service.getTransactions(params.id, query),
      "Transactions fetched",
    );
  },
  { auth: true },
);
