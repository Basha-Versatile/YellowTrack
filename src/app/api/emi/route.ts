import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { tenantOf } from "@/lib/auth/tenant-context";
import { requirePermission } from "@/lib/auth/guard";
import { getEmiHub } from "@/server/services/emi.service";

export const runtime = "nodejs";

export const GET = withRoute(
  async ({ req, session }) => {
    const ctx = tenantOf(session);
    await requirePermission(session, "emi:read");

    const sp = req.nextUrl.searchParams;
    const statusParam = sp.get("status");
    const dueWithin = sp.get("dueWithin");

    const statuses = statusParam
      ? statusParam.split(",").filter(Boolean)
      : undefined;
    const dueWithinDays = dueWithin ? Number(dueWithin) : null;

    const hub = await getEmiHub(ctx, {
      statuses,
      dueWithinDays: Number.isFinite(dueWithinDays as number)
        ? (dueWithinDays as number)
        : null,
    });
    return success(hub, "EMI hub");
  },
  { auth: true },
);
