import { withRoute, parseJson } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { tenantOf, tenantFilter } from "@/lib/auth/tenant-context";
import { requirePermission } from "@/lib/auth/guard";
import { z } from "zod";
import {
  markPaymentPaid,
  markPaymentStatus,
  markPaymentUnpaid,
  updatePaidPayment,
} from "@/server/services/emi.service";
import { logFromRequest } from "@/server/services/activityLog.service";
import { EMIPayment } from "@/models";

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

// Edit an installment that's already PAID — every field optional so a
// partial edit (e.g. just the paid date) is valid.
const updatePaidSchema = z.object({
  action: z.literal("update-paid"),
  paidDate: z.string().optional(),
  paidAmount: z.coerce.number().min(0).optional(),
  lateFee: z.coerce.number().min(0).optional(),
  transactionRef: z.string().nullable().optional(),
  proofUrl: z.string().nullable().optional(),
  notes: z.string().max(300).nullable().optional(),
});

const bodySchema = z.discriminatedUnion("action", [
  markPaidSchema,
  markStatusSchema,
  markUnpaidSchema,
  updatePaidSchema,
]);

export const POST = withRoute<{ planId: string; paymentId: string }>(
  async ({ req, params, session }) => {
    const ctx = tenantOf(session);
    const body = await parseJson(req, bodySchema);

    if (body.action === "mark-paid") {
      await requirePermission(session, "emi:update");
      const before = await EMIPayment.findOne(
        tenantFilter(ctx, { _id: params.paymentId }),
      ).lean();
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
        revertable: Boolean(before),
        beforeSnapshot: before
          ? { status: (before as { status?: string }).status ?? "SCHEDULED" }
          : null,
      });
      return success(updated, "Installment marked paid");
    }

    if (body.action === "update-paid") {
      await requirePermission(session, "emi:update");
      const updated = await updatePaidPayment(ctx, params.paymentId, body);
      const p = updated as { installmentNumber?: number; paidAmount?: number };
      await logFromRequest(req, ctx, session, {
        action: "emi.payment.updated",
        entityType: "emi",
        entityId: params.paymentId,
        entityLabel: `EMI #${p.installmentNumber ?? params.paymentId}`,
        summary: `Edited paid installment #${p.installmentNumber ?? "?"}${p.paidAmount ? ` (₹${p.paidAmount.toLocaleString("en-IN")})` : ""}`,
        metadata: { planId: params.planId, paidAmount: p.paidAmount },
      });
      return success(updated, "Paid installment updated");
    }

    if (body.action === "mark-unpaid") {
      await requirePermission(session, "emi:update");
      const before = await EMIPayment.findOne(
        tenantFilter(ctx, { _id: params.paymentId }),
      ).lean();
      const updated = await markPaymentUnpaid(ctx, params.paymentId);
      const p = updated as { installmentNumber?: number };
      await logFromRequest(req, ctx, session, {
        action: "emi.payment.unpaid",
        entityType: "emi",
        entityId: params.paymentId,
        entityLabel: `EMI #${p.installmentNumber ?? params.paymentId}`,
        summary: `Reverted installment #${p.installmentNumber ?? "?"} to unpaid`,
        metadata: { planId: params.planId },
        revertable: Boolean(before),
        beforeSnapshot: before
          ? { status: (before as { status?: string }).status ?? "PAID" }
          : null,
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
