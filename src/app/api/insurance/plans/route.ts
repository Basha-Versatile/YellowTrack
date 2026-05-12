import { withRoute, parseJson } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { z } from "zod";
import { tenantOf } from "@/lib/auth/tenant-context";
import { getPlans } from "@/server/services/insurance.service";

export const runtime = "nodejs";

const schema = z.object({
  vehicleId: z.string().min(1, "Vehicle ID is required"),
});

export const POST = withRoute(
  async ({ req, session }) => {
    const ctx = tenantOf(session);
    const { vehicleId } = await parseJson(req, schema);
    return success(await getPlans(ctx, vehicleId), "Insurance plans fetched");
  },
  { auth: true },
);
