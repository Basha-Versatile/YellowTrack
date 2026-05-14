import { withRoute, parseJson } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { updatePlanSchema } from "@/validations/plan.schema";
import {
  deactivatePlan,
  getPlanById,
  reactivatePlan,
  updatePlan,
} from "@/server/services/plan.service";

export const runtime = "nodejs";

export const GET = withRoute<{ id: string }>(
  async ({ params }) => {
    const plan = await getPlanById(params.id);
    return success(plan, "Plan");
  },
  { auth: true, roles: ["SUPERADMIN"] },
);

export const PATCH = withRoute<{ id: string }>(
  async ({ req, params }) => {
    const input = await parseJson(req, updatePlanSchema);
    const plan = await updatePlan(params.id, input);
    return success(plan, "Plan updated");
  },
  { auth: true, roles: ["SUPERADMIN"] },
);

export const DELETE = withRoute<{ id: string }>(
  async ({ params }) => {
    const plan = await deactivatePlan(params.id);
    return success(plan, "Plan deactivated");
  },
  { auth: true, roles: ["SUPERADMIN"] },
);

// "Reactivate" — POST flips isActive back to true.
export const POST = withRoute<{ id: string }>(
  async ({ params }) => {
    const plan = await reactivatePlan(params.id);
    return success(plan, "Plan reactivated");
  },
  { auth: true, roles: ["SUPERADMIN"] },
);
