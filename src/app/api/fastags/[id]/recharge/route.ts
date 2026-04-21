import { withRoute, parseJson } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { rechargeFastagSchema } from "@/validations/fastag.schema";
import * as service from "@/server/services/fastag.service";

export const runtime = "nodejs";

export const POST = withRoute<{ id: string }>(
  async ({ req, params }) => {
    const { amount } = await parseJson(req, rechargeFastagSchema);
    const fastag = await service.rechargeFastag(params.id, amount);
    return success(fastag, "FASTag recharged successfully");
  },
  { auth: true },
);
