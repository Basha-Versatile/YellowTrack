import { withRoute, parseJson } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { tenantOf } from "@/lib/auth/tenant-context";
import { requirePermission } from "@/lib/auth/guard";
import { z } from "zod";
import {
  markPaymentPaid,
  markPaymentStatus,
} from "@/server/services/emi.service";

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

const bodySchema = z.discriminatedUnion("action", [
  markPaidSchema,
  markStatusSchema,
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
      return success(updated, "Installment marked paid");
    }

    await requirePermission(session, "emi:update");
    const updated = await markPaymentStatus(
      ctx,
      params.paymentId,
      body.status,
      body.notes ?? null,
    );
    return success(updated, `Installment marked ${body.status}`);
  },
  { auth: true },
);
