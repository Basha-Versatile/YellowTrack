import { withRoute, parseJson } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { z } from "zod";
import { UnauthorizedError } from "@/lib/errors";
import { creditWallet } from "@/server/services/wallet.service";

export const runtime = "nodejs";

/**
 * Superadmin → credit a tenant's wallet. Routes through the existing
 * wallet.service chokepoint so the WalletTransaction audit row is written
 * automatically and `Tenant.walletBalance` stays consistent with
 * `Σ credits − Σ debits` on the ledger.
 *
 * `reason` is restricted to the three operator-initiated codes
 * (`adjustment` / `refund` / `recharge`) — never `signup_bonus` (cron)
 * or `monthly_bill` (orchestrator).
 *
 * The superadmin's userId lands in `createdBy` so the transaction log
 * shows exactly who issued the credit, and `metadata.actor: "superadmin"`
 * gives the tenant admin a visible distinction when they review their
 * own ledger.
 */
const bodySchema = z.object({
  amount: z.coerce.number().positive().max(10_000_000),
  reason: z.enum(["adjustment", "refund", "recharge"]),
  notes: z.string().max(500).optional(),
});

export const POST = withRoute<{ id: string }>(
  async ({ req, params, session }) => {
    if (!session) throw new UnauthorizedError();
    const input = await parseJson(req, bodySchema);
    const result = await creditWallet({
      tenantId: params.id,
      amount: input.amount,
      reason: input.reason,
      createdBy: session.id,
      metadata: {
        actor: "superadmin",
        superadminUserId: session.id,
        note: input.notes ?? null,
      },
    });
    return success(
      { balance: result.balance, txnId: result.txnId },
      "Wallet credited",
    );
  },
  { auth: true, roles: ["SUPERADMIN"] },
);
