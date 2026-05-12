import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { tenantOf } from "@/lib/auth/tenant-context";
import { getUnreadCount } from "@/server/services/notification.service";

export const runtime = "nodejs";

export const GET = withRoute(
  async ({ session }) => {
    const ctx = tenantOf(session);
    const count = await getUnreadCount(ctx, session!.id);
    return success({ count }, "Success");
  },
  { auth: true },
);
