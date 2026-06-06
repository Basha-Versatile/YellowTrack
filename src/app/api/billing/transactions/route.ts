import { withRoute, parseQuery } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { z } from "zod";
import { tenantOf } from "@/lib/auth/tenant-context";
import { UnauthorizedError } from "@/lib/errors";
import { listTransactions } from "@/server/services/wallet.service";

export const runtime = "nodejs";

const querySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).default(30),
  before: z.string().optional(),
});

export const GET = withRoute(
  async ({ req, session }) => {
    if (!session) throw new UnauthorizedError();
    const ctx = tenantOf(session);
    const q = parseQuery(req, querySchema);
    const before = q.before ? new Date(q.before) : undefined;
    const txns = await listTransactions(ctx.tenantId, {
      limit: q.limit,
      before,
    });
    return success(txns, "Wallet transactions");
  },
  { auth: true },
);
