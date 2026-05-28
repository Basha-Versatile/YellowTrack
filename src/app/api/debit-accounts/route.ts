import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { tenantOf } from "@/lib/auth/tenant-context";
import { listDebitAccounts } from "@/server/services/debitAccount.service";

export const runtime = "nodejs";

/**
 * Tenant-scoped catalog of saved debit accounts (read-only here — entries
 * are created/updated automatically when an EMI plan is saved that
 * references them).
 */
export const GET = withRoute(
  async ({ session }) => {
    const ctx = tenantOf(session);
    const rows = await listDebitAccounts(ctx);
    return success(rows, "Debit accounts");
  },
  { auth: true },
);
