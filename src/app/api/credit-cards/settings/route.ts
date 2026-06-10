import { withRoute, parseJson } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { tenantOf } from "@/lib/auth/tenant-context";
import { updateCreditCardSettingsSchema } from "@/validations/credit-card.schema";
import * as service from "@/server/services/credit-card.service";

export const runtime = "nodejs";

export const PATCH = withRoute(
  async ({ req, session }) => {
    const ctx = tenantOf(session);
    const { alertWhatsapp } = await parseJson(
      req,
      updateCreditCardSettingsSchema,
    );
    return success(
      await service.updateAlertNumber(ctx, alertWhatsapp),
      "Reminder number updated",
    );
  },
  { auth: true },
);
