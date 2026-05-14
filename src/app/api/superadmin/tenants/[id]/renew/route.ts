import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import {
  cancelTenantSubscription,
  renewTenantSubscription,
} from "@/server/services/tenant.service";

export const runtime = "nodejs";

export const POST = withRoute<{ id: string }>(
  async ({ params }) => {
    const tenant = await renewTenantSubscription(params.id);
    return success(tenant, "Subscription renewed");
  },
  { auth: true, roles: ["SUPERADMIN"] },
);

export const DELETE = withRoute<{ id: string }>(
  async ({ params }) => {
    const tenant = await cancelTenantSubscription(params.id);
    return success(tenant, "Subscription cancelled");
  },
  { auth: true, roles: ["SUPERADMIN"] },
);
