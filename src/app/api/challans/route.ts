import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import * as challanRepo from "@/server/repositories/challan.repository";

export const runtime = "nodejs";

export const GET = withRoute(
  async ({ req }) => {
    const sp = req.nextUrl.searchParams;
    const query = {
      page: sp.get("page") ? Number(sp.get("page")) : undefined,
      limit: sp.get("limit") ? Number(sp.get("limit")) : undefined,
      status: sp.get("status") ?? undefined,
      vehicleId: sp.get("vehicleId") ?? undefined,
      search: sp.get("search") ?? undefined,
    };
    const result = await challanRepo.findAll(query);
    return success(result, "Success");
  },
  { auth: true },
);
