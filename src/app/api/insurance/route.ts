import { withRoute, parseQuery } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { getInsuranceQuerySchema } from "@/validations/insurance.schema";
import * as service from "@/server/services/insurance.service";

export const runtime = "nodejs";

export const GET = withRoute(
  async ({ req }) => {
    const query = parseQuery(req, getInsuranceQuerySchema);
    return success(await service.getAll(query), "Policies fetched");
  },
  { auth: true },
);
