import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { tenantOf } from "@/lib/auth/tenant-context";
import { getByUserId } from "@/server/services/notification.service";

export const runtime = "nodejs";

export const GET = withRoute(
  async ({ req, session }) => {
    const ctx = tenantOf(session);
    const sp = req.nextUrl.searchParams;
    const query = {
      page: sp.get("page") ? Number(sp.get("page")) : undefined,
      limit: sp.get("limit") ? Number(sp.get("limit")) : undefined,
      unreadOnly: sp.get("unreadOnly") === "true",
    };
    return success(await getByUserId(ctx, session!.id, query), "Success");
  },
  { auth: true },
);
