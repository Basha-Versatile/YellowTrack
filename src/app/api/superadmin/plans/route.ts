import { withRoute, parseJson } from "@/lib/api-handler";
import { success, created } from "@/lib/http";
import { createPlanSchema } from "@/validations/plan.schema";
import {
  createPlan,
  listPlans,
} from "@/server/services/plan.service";

export const runtime = "nodejs";

export const GET = withRoute(
  async ({ req }) => {
    const includeInactive =
      req.nextUrl.searchParams.get("includeInactive") === "true";
    const plans = await listPlans({ includeInactive });
    return success(plans, "Plans");
  },
  { auth: true, roles: ["SUPERADMIN"] },
);

export const POST = withRoute(
  async ({ req }) => {
    const input = await parseJson(req, createPlanSchema);
    const plan = await createPlan(input);
    return created(plan, "Plan created");
  },
  { auth: true, roles: ["SUPERADMIN"] },
);
