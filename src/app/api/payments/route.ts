import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { tenantOf } from "@/lib/auth/tenant-context";
import { getAllPayments } from "@/server/services/payment.service";

export const runtime = "nodejs";

export const GET = withRoute(
  async ({ req, session }) => {
    const ctx = tenantOf(session);
    const sp = req.nextUrl.searchParams;
    const query = {
      page: sp.get("page") ? Number(sp.get("page")) : undefined,
      limit: sp.get("limit") ? Number(sp.get("limit")) : undefined,
    };
    return success(await getAllPayments(ctx, query), "Success");
  },
  { auth: true },
);
