import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { getTenantQuotaSummary } from "@/server/services/quota.service";

export const runtime = "nodejs";

export const GET = withRoute<{ id: string }>(
  async ({ params }) => {
    const usage = await getTenantQuotaSummary(params.id);
    return success(usage, "Tenant quota");
  },
  { auth: true, roles: ["SUPERADMIN"] },
);
