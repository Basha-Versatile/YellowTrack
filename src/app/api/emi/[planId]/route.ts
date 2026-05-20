import { withRoute, parseJson } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { tenantOf } from "@/lib/auth/tenant-context";
import { requirePermission } from "@/lib/auth/guard";
import { z } from "zod";
import {
  getEmiSchedule,
  markPaymentsPaidUntil,
  setPlanStatus,
  updateEmiPlan,
} from "@/server/services/emi.service";
import { logFromRequest } from "@/server/services/activityLog.service";

export const runtime = "nodejs";

const updateSchema = z.object({
  lenderName: z.string().min(1).max(120).optional(),
  lenderType: z.enum(["BANK", "NBFC", "PARTNER"]).optional(),
  lenderContactPhone: z.string().nullable().optional(),
  lenderBranch: z.string().nullable().optional(),
  debitBankName: z.string().nullable().optional(),
  debitAccountMasked: z.string().nullable().optional(),
  debitAccountHolder: z.string().nullable().optional(),
  reminderChannels: z
    .array(z.enum(["EMAIL", "WHATSAPP", "IN_APP"]))
    .optional(),
  reminderLeadDays: z.array(z.coerce.number().int().min(0).max(60)).optional(),
  notes: z.string().max(500).nullable().optional(),
  status: z.enum(["ACTIVE", "PAUSED", "DEFAULTED", "CLOSED"]).optional(),
});

export const GET = withRoute<{ planId: string }>(
  async ({ params, session }) => {
    const ctx = tenantOf(session);
    await requirePermission(session, "emi:read");
    const data = await getEmiSchedule(ctx, params.planId);
    return success(data, "EMI plan + schedule");
  },
  { auth: true },
);

const bulkBodySchema = z.object({
  action: z.literal("mark-paid-until"),
  untilDate: z.string().optional(),
});

export const POST = withRoute<{ planId: string }>(
  async ({ req, params, session }) => {
    const ctx = tenantOf(session);
    const body = await parseJson(req, bulkBodySchema);
    await requirePermission(session, "emi:update");
    const result = await markPaymentsPaidUntil(
      ctx,
      params.planId,
      body.untilDate,
      session?.id ?? null,
    );
    if (result.updated > 0) {
      await logFromRequest(req, ctx, session, {
        action: "emi.payment.bulk_paid",
        entityType: "emi",
        entityId: params.planId,
        entityLabel: `EMI plan ${params.planId}`,
        summary: `Bulk-marked ${result.updated} installment${result.updated === 1 ? "" : "s"} as paid (till date)`,
        metadata: { planId: params.planId, untilDate: body.untilDate ?? null },
      });
    }
    return success(result, `${result.updated} installment${result.updated === 1 ? "" : "s"} marked paid`);
  },
  { auth: true },
);

export const PATCH = withRoute<{ planId: string }>(
  async ({ req, params, session }) => {
    const ctx = tenantOf(session);
    const input = await parseJson(req, updateSchema);
    const { status, ...patch } = input;
    if (status) {
      await requirePermission(session, "emi:close");
      await setPlanStatus(ctx, params.planId, status);
      await logFromRequest(req, ctx, session, {
        action: "emi.status",
        entityType: "emi",
        entityId: params.planId,
        entityLabel: `EMI plan ${params.planId}`,
        summary: `Changed EMI plan status to ${status}`,
        metadata: { status },
      });
    }
    if (Object.keys(patch).length > 0) {
      await requirePermission(session, "emi:update");
      await updateEmiPlan(ctx, params.planId, patch);
      await logFromRequest(req, ctx, session, {
        action: "emi.update",
        entityType: "emi",
        entityId: params.planId,
        entityLabel: `EMI plan ${params.planId}`,
        summary: `Updated EMI plan details`,
        metadata: patch as Record<string, unknown>,
      });
    }
    const data = await getEmiSchedule(ctx, params.planId);
    return success(data, "EMI plan updated");
  },
  { auth: true },
);
