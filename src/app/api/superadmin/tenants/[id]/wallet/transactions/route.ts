import { withRoute, parseQuery } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { z } from "zod";
import { NotFoundError } from "@/lib/errors";
import { Tenant } from "@/models";
import { listTransactions } from "@/server/services/wallet.service";

export const runtime = "nodejs";

/**
 * Superadmin → paginated wallet transactions for a single tenant. Filters
 * compose: `from`/`to` constrain `createdAt`, `reason` and `type` narrow
 * the slice, `limit` caps the page, `before` is the cursor for older
 * pages (sorted desc by createdAt).
 */
const querySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).default(50),
  before: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  reason: z
    .enum(["signup_bonus", "monthly_bill", "recharge", "refund", "adjustment"])
    .optional(),
  type: z.enum(["CREDIT", "DEBIT"]).optional(),
});

export const GET = withRoute<{ id: string }>(
  async ({ req, params }) => {
    const exists = await Tenant.exists({ _id: params.id });
    if (!exists) throw new NotFoundError("Tenant not found");

    const q = parseQuery(req, querySchema);
    const txns = await listTransactions(params.id, {
      limit: q.limit,
      before: q.before ? new Date(q.before) : undefined,
      from: q.from ? new Date(q.from) : undefined,
      to: q.to ? new Date(q.to) : undefined,
      reason: q.reason,
      type: q.type,
    });
    return success(txns, "Wallet transactions");
  },
  { auth: true, roles: ["SUPERADMIN"] },
);
