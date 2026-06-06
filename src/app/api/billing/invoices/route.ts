import { withRoute, parseQuery } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { z } from "zod";
import { tenantOf } from "@/lib/auth/tenant-context";
import { UnauthorizedError } from "@/lib/errors";
import { listInvoices } from "@/server/services/invoice.service";

export const runtime = "nodejs";

const querySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).default(30),
});

export const GET = withRoute(
  async ({ req, session }) => {
    if (!session) throw new UnauthorizedError();
    const ctx = tenantOf(session);
    const q = parseQuery(req, querySchema);
    const rows = await listInvoices(ctx.tenantId, { limit: q.limit });
    return success(rows, "Invoices");
  },
  { auth: true },
);
