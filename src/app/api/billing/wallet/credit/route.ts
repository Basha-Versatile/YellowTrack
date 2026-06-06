import { withRoute, parseJson } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { z } from "zod";
import { tenantOf } from "@/lib/auth/tenant-context";
import {
  BadRequestError,
  ForbiddenError,
  UnauthorizedError,
} from "@/lib/errors";
import { creditWallet } from "@/server/services/wallet.service";

export const runtime = "nodejs";

const bodySchema = z.object({
  amount: z.coerce.number().positive().max(1_000_000),
  // Marker so the audit trail captures that this came from the test path
  // and not a real payment gateway. Will become required when real payment
  // routes ship — for now the test button just sets mode="test".
  mode: z.enum(["test", "gateway"]).default("test"),
  paymentRef: z.string().max(120).optional(),
});

/**
 * Top up the wallet. In the v1 build there's no payment gateway, so this
 * route only honours `mode: "test"` credits initiated by an ADMIN. When
 * Razorpay / Stripe lands, the `gateway` branch will verify the payment
 * ref against the provider before crediting.
 */
export const POST = withRoute(async ({ req, session }) => {
  if (!session) throw new UnauthorizedError();
  const ctx = tenantOf(session);
  if (session.role !== "ADMIN") {
    throw new ForbiddenError("Only workspace admins can recharge the wallet");
  }
  const input = await parseJson(req, bodySchema);
  if (input.mode === "gateway") {
    // Payment gateway path lands here once provider integration ships.
    throw new BadRequestError(
      "Payment gateway integration is not enabled yet. Use the test credit button for now.",
    );
  }
  // The WalletTransaction row itself is the audit trail (tenantId +
  // createdBy + amount + reason + balanceAfter). No separate activity-log
  // entry needed for v1 — when the activity-log entity-type enum gains a
  // "wallet" member we can add a cross-reference there too.
  const result = await creditWallet({
    tenantId: ctx.tenantId,
    amount: input.amount,
    reason: "recharge",
    createdBy: session.id ?? null,
    metadata: { mode: input.mode, paymentRef: input.paymentRef ?? null },
  });
  return success({ balance: result.balance, txnId: result.txnId }, "Wallet credited");
}, { auth: true });
