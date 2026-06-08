import { withRoute, parseJson } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { z } from "zod";
import { BadRequestError, NotFoundError, UnauthorizedError } from "@/lib/errors";
import { debitWallet, getWalletBalance } from "@/server/services/wallet.service";
import { Tenant } from "@/models";

export const runtime = "nodejs";

/**
 * Superadmin → debit a tenant's wallet. Same chokepoint as the credit
 * route — `debitWallet` writes the DEBIT audit row and atomically
 * decrements `Tenant.walletBalance`.
 *
 * Reason is restricted to `adjustment` (operator-initiated correction).
 * `monthly_bill` is reserved for the cron; `refund` doesn't apply to a
 * debit.
 *
 * Guard rail: by default we refuse a debit that would push the balance
 * negative. Pass `allowNegative: true` to override — useful for
 * intentional clawbacks (e.g. reversing a wrongful credit that's
 * already been partly spent).
 */
const bodySchema = z.object({
  amount: z.coerce.number().positive().max(10_000_000),
  reason: z.literal("adjustment"),
  notes: z.string().max(500).optional(),
  allowNegative: z.boolean().optional().default(false),
});

export const POST = withRoute<{ id: string }>(
  async ({ req, params, session }) => {
    if (!session) throw new UnauthorizedError();
    const input = await parseJson(req, bodySchema);

    // Existence check — keeps the error message clean (without it the user
    // would just see "Tenant not found" from debitWallet's internal lookup).
    const exists = await Tenant.exists({ _id: params.id });
    if (!exists) throw new NotFoundError("Tenant not found");

    if (!input.allowNegative) {
      const current = await getWalletBalance(params.id);
      if (input.amount > current) {
        throw new BadRequestError(
          `Debit would push the balance negative (current ₹${current.toLocaleString("en-IN")}, debit ₹${input.amount.toLocaleString("en-IN")}). Re-submit with allowNegative: true if this is intentional.`,
        );
      }
    }

    const result = await debitWallet({
      tenantId: params.id,
      amount: input.amount,
      reason: input.reason,
      createdBy: session.id,
      metadata: {
        actor: "superadmin",
        superadminUserId: session.id,
        note: input.notes ?? null,
        allowNegative: input.allowNegative,
      },
    });
    return success(
      { balance: result.balance, txnId: result.txnId },
      "Wallet debited",
    );
  },
  { auth: true, roles: ["SUPERADMIN"] },
);
