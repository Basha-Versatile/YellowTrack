import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { tenantOf } from "@/lib/auth/tenant-context";
import { markAsRead } from "@/server/services/notification.service";

export const runtime = "nodejs";

export const PUT = withRoute<{ id: string }>(
  async ({ params, session }) => {
    const ctx = tenantOf(session);
    await markAsRead(ctx, params.id, session!.id);
    return success(null, "Notification marked as read");
  },
  { auth: true },
);
