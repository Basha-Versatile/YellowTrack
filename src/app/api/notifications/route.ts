import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { getByUserId } from "@/server/services/notification.service";

export const runtime = "nodejs";

export const GET = withRoute(
  async ({ req, session }) => {
    const sp = req.nextUrl.searchParams;
    const query = {
      page: sp.get("page") ? Number(sp.get("page")) : undefined,
      limit: sp.get("limit") ? Number(sp.get("limit")) : undefined,
      unreadOnly: sp.get("unreadOnly") === "true",
    };
    return success(await getByUserId(session!.id, query), "Success");
  },
  { auth: true },
);
