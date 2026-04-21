import { withRoute, parseJson } from "@/lib/api-handler";
import { created } from "@/lib/http";
import { z } from "zod";
import { payBulk } from "@/server/services/payment.service";

export const runtime = "nodejs";

const schema = z.object({
  challanIds: z.array(z.string().min(1)).min(1),
  method: z.string().optional(),
  transactionId: z.string().optional().nullable(),
});

export const POST = withRoute(
  async ({ req, session }) => {
    const input = await parseJson(req, schema);
    const result = await payBulk({
      challanIds: input.challanIds,
      method: input.method ?? "CASH",
      transactionId: input.transactionId ?? null,
      paidBy: session!.id,
    });
    return created(result, "Bulk payment successful");
  },
  { auth: true },
);
