import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { markAllAsRead } from "@/server/services/notification.service";

export const runtime = "nodejs";

export const PUT = withRoute(
  async ({ session }) => {
    await markAllAsRead(session!.id);
    return success(null, "All notifications marked as read");
  },
  { auth: true },
);
