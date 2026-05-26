import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { tenantOf, tenantFilter } from "@/lib/auth/tenant-context";
import { AlertLog } from "@/models";

export const runtime = "nodejs";

/**
 * Recent delivery attempts for the current tenant. Used by
 * /settings/notifications to show admins what was sent / failed.
 */
export const GET = withRoute(
  async ({ req, session }) => {
    const ctx = tenantOf(session);
    const url = new URL(req.url);
    const limit = Math.min(
      200,
      Math.max(10, Number(url.searchParams.get("limit") ?? 50)),
    );

    const rows = await AlertLog.find(tenantFilter(ctx))
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return success(rows, "Notification delivery log fetched");
  },
  { auth: true },
);
