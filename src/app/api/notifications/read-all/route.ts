import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { tenantOf } from "@/lib/auth/tenant-context";
import { markAllAsRead } from "@/server/services/notification.service";

export const runtime = "nodejs";

export const PUT = withRoute(
  async ({ session }) => {
    const ctx = tenantOf(session);
    await markAllAsRead(ctx, session!.id);
    return success(null, "All notifications marked as read");
  },
  { auth: true },
);
