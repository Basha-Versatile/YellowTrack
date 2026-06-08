import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { NotFoundError } from "@/lib/errors";
import { Tenant } from "@/models";
import { getWalletTotals } from "@/server/services/wallet.service";

export const runtime = "nodejs";

/**
 * Superadmin wallet overview for a single tenant. Bundles the cached
 * balance + billing health from the Tenant doc with all-time credit/debit
 * totals from the WalletTransaction ledger.
 *
 * Refuses non-SUPERADMIN sessions via `roles` on withRoute.
 */
export const GET = withRoute<{ id: string }>(
  async ({ params }) => {
    const tenant = await Tenant.findById(params.id)
      .select(
        "name slug walletBalance billingStatus paymentDueSince lastBilledAt",
      )
      .lean();
    if (!tenant) throw new NotFoundError("Tenant not found");
    const t = tenant as unknown as {
      name: string;
      slug: string;
      walletBalance?: number;
      billingStatus?: "ACTIVE" | "PAYMENT_DUE" | "SUSPENDED";
      paymentDueSince?: Date | null;
      lastBilledAt?: Date | null;
    };

    const totals = await getWalletTotals(params.id);

    return success(
      {
        tenant: {
          id: params.id,
          name: t.name,
          slug: t.slug,
        },
        wallet: {
          balance: t.walletBalance ?? 0,
          billingStatus: t.billingStatus ?? "ACTIVE",
          paymentDueSince: t.paymentDueSince
            ? new Date(t.paymentDueSince).toISOString()
            : null,
          lastBilledAt: t.lastBilledAt
            ? new Date(t.lastBilledAt).toISOString()
            : null,
          totalCredits: totals.credits,
          totalDebits: totals.debits,
          totalTransactions: totals.txnCount,
        },
      },
      "Wallet overview",
    );
  },
  { auth: true, roles: ["SUPERADMIN"] },
);
