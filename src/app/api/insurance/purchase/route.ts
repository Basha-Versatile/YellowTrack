import { withRoute, parseJson } from "@/lib/api-handler";
import { created } from "@/lib/http";
import { purchaseSchema } from "@/validations/insurance.schema";
import { purchase } from "@/server/services/insurance.service";

export const runtime = "nodejs";

export const POST = withRoute(
  async ({ req }) => {
    const input = await parseJson(req, purchaseSchema);
    const result = await purchase(input.vehicleId, input);
    return created(result, "Insurance purchased successfully");
  },
  { auth: true },
);
