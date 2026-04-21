import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { getUnreadCount } from "@/server/services/notification.service";

export const runtime = "nodejs";

export const GET = withRoute(
  async ({ session }) => {
    const count = await getUnreadCount(session!.id);
    return success({ count }, "Success");
  },
  { auth: true },
);
