import { withRoute, parseJson } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { tenantOf } from "@/lib/auth/tenant-context";
import { requirePermission } from "@/lib/auth/guard";
import { z } from "zod";
import {
  markPaymentPaid,
  markPaymentStatus,
  markPaymentUnpaid,
} from "@/server/services/emi.service";
import { logFromRequest } from "@/server/services/activityLog.service";

export const runtime = "nodejs";

const markPaidSchema = z.object({
  action: z.literal("mark-paid"),
  paidDate: z.string().optional(),
  paidAmount: z.coerce.number().min(0).optional(),
  lateFee: z.coerce.number().min(0).optional(),
  transactionRef: z.string().nullable().optional(),
  proofUrl: z.string().nullable().optional(),
  notes: z.string().max(300).nullable().optional(),
});

const markStatusSchema = z.object({
  action: z.literal("mark-status"),
  status: z.enum(["BOUNCED", "SKIPPED", "OVERDUE"]),
  notes: z.string().max(300).nullable().optional(),
});

const markUnpaidSchema = z.object({
  action: z.literal("mark-unpaid"),
});

const bodySchema = z.discriminatedUnion("action", [
  markPaidSchema,
  markStatusSchema,
  markUnpaidSchema,
]);

export const POST = withRoute<{ planId: string; paymentId: string }>(
  async ({ req, params, session }) => {
    const ctx = tenantOf(session);
    const body = await parseJson(req, bodySchema);

    if (body.action === "mark-paid") {
      await requirePermission(session, "emi:update");
      const updated = await markPaymentPaid(
        ctx,
        params.paymentId,
        body,
        session?.id ?? null,
      );
      const p = updated as { installmentNumber?: number; paidAmount?: number };
      await logFromRequest(req, ctx, session, {
        action: "emi.payment.paid",
        entityType: "emi",
        entityId: params.paymentId,
        entityLabel: `EMI #${p.installmentNumber ?? params.paymentId}`,
        summary: `Marked installment #${p.installmentNumber ?? "?"} as paid${p.paidAmount ? ` (₹${p.paidAmount.toLocaleString("en-IN")})` : ""}`,
        metadata: { planId: params.planId, paidAmount: p.paidAmount },
      });
      return success(updated, "Installment marked paid");
    }

    if (body.action === "mark-unpaid") {
      await requirePermission(session, "emi:update");
      const updated = await markPaymentUnpaid(ctx, params.paymentId);
      const p = updated as { installmentNumber?: number };
      await logFromRequest(req, ctx, session, {
        action: "emi.payment.unpaid",
        entityType: "emi",
        entityId: params.paymentId,
        entityLabel: `EMI #${p.installmentNumber ?? params.paymentId}`,
        summary: `Reverted installment #${p.installmentNumber ?? "?"} to unpaid`,
        metadata: { planId: params.planId },
      });
      return success(updated, "Installment reverted to scheduled");
    }

    await requirePermission(session, "emi:update");
    const updated = await markPaymentStatus(
      ctx,
      params.paymentId,
      body.status,
      body.notes ?? null,
    );
    const p = updated as { installmentNumber?: number };
    await logFromRequest(req, ctx, session, {
      action: `emi.payment.${body.status.toLowerCase()}`,
      entityType: "emi",
      entityId: params.paymentId,
      entityLabel: `EMI #${p.installmentNumber ?? params.paymentId}`,
      summary: `Marked installment #${p.installmentNumber ?? "?"} as ${body.status}`,
      metadata: { planId: params.planId, status: body.status },
    });
    return success(updated, `Installment marked ${body.status}`);
  },
  { auth: true },
);
