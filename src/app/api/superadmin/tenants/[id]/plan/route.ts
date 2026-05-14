import { withRoute, parseJson } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { changePlanSchema } from "@/validations/tenant.schema";
import { changeTenantPlan } from "@/server/services/tenant.service";

export const runtime = "nodejs";

export const PATCH = withRoute<{ id: string }>(
  async ({ req, params }) => {
    const { planId } = await parseJson(req, changePlanSchema);
    const tenant = await changeTenantPlan(params.id, planId);
    return success(tenant, "Plan changed");
  },
  { auth: true, roles: ["SUPERADMIN"] },
);
