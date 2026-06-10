import { withRoute, parseJson } from "@/lib/api-handler";
import { success, created } from "@/lib/http";
import { tenantOf } from "@/lib/auth/tenant-context";
import { createCreditCardSchema } from "@/validations/credit-card.schema";
import * as service from "@/server/services/credit-card.service";

export const runtime = "nodejs";

export const GET = withRoute(
  async ({ session }) => {
    const ctx = tenantOf(session);
    return success(await service.getOverview(ctx), "Credit cards fetched");
  },
  { auth: true },
);

export const POST = withRoute(
  async ({ req, session }) => {
    const ctx = tenantOf(session);
    const input = await parseJson(req, createCreditCardSchema);
    return created(await service.createCard(ctx, input), "Credit card added");
  },
  { auth: true },
);
