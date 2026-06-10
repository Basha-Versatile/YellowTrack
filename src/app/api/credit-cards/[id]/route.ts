import { withRoute, parseJson } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { tenantOf } from "@/lib/auth/tenant-context";
import { updateCreditCardSchema } from "@/validations/credit-card.schema";
import * as service from "@/server/services/credit-card.service";

export const runtime = "nodejs";

export const PATCH = withRoute<{ id: string }>(
  async ({ req, params, session }) => {
    const ctx = tenantOf(session);
    const input = await parseJson(req, updateCreditCardSchema);
    return success(
      await service.updateCard(ctx, params.id, input),
      "Credit card updated",
    );
  },
  { auth: true },
);

export const DELETE = withRoute<{ id: string }>(
  async ({ params, session }) => {
    const ctx = tenantOf(session);
    return success(
      await service.deleteCard(ctx, params.id),
      "Credit card removed",
    );
  },
  { auth: true },
);
