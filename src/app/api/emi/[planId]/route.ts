import { withRoute, parseJson } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { tenantOf, tenantFilter } from "@/lib/auth/tenant-context";
import { requirePermission } from "@/lib/auth/guard";
import { z } from "zod";
import {
  getEmiSchedule,
  markPaymentsPaidUntil,
  setPlanStatus,
  updateEmiPlan,
} from "@/server/services/emi.service";
import { logFromRequest } from "@/server/services/activityLog.service";
import { EMIPlan } from "@/models";

export const runtime = "nodejs";

const updateSchema = z.object({
  lenderName: z.string().min(1).max(120).optional(),
  lenderType: z.enum(["BANK", "NBFC", "PARTNER"]).optional(),
  lenderContactPhone: z.string().nullable().optional(),
  lenderBranch: z.string().nullable().optional(),
  loanAccountNumber: z.string().max(60).nullable().optional(),
  debitBankName: z.string().nullable().optional(),
  debitAccountMasked: z.string().nullable().optional(),
  debitAccountHolder: z.string().nullable().optional(),
  reminderChannels: z
    .array(z.enum(["EMAIL", "WHATSAPP", "IN_APP"]))
    .optional(),
  reminderLeadDays: z.array(z.coerce.number().int().min(0).max(60)).optional(),
  notes: z.string().max(500).nullable().optional(),
  status: z.enum(["ACTIVE", "PAUSED", "DEFAULTED", "CLOSED"]).optional(),
  // Schedule-affecting fields — service regenerates the unpaid tail when any
  // of these change. principalAmount is just metadata.
  principalAmount: z.coerce.number().min(0).nullable().optional(),
  emiAmount: z.coerce.number().min(0).optional(),
  totalInstallments: z.coerce.number().int().min(1).max(600).optional(),
  startDate: z.string().min(1).optional(),
  dueDayOfMonth: z.coerce.number().int().min(1).max(31).optional(),
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
      const before = await EMIPlan.findOne(
        tenantFilter(ctx, { _id: params.planId }),
      ).lean();
      await setPlanStatus(ctx, params.planId, status);
      await logFromRequest(req, ctx, session, {
        action: "emi.status",
        entityType: "emi",
        entityId: params.planId,
        entityLabel: `EMI plan ${params.planId}`,
        summary: `Changed EMI plan status to ${status}`,
        metadata: { status },
        revertable: Boolean(before),
        beforeSnapshot: before
          ? { status: (before as { status?: string }).status ?? null }
          : null,
      });
    }
    if (Object.keys(patch).length > 0) {
      await requirePermission(session, "emi:update");
      const before = await EMIPlan.findOne(
        tenantFilter(ctx, { _id: params.planId }),
      ).lean();
      await updateEmiPlan(ctx, params.planId, patch);
      const beforeSnapshot = before
        ? Object.fromEntries(
            Object.keys(patch as Record<string, unknown>).map((k) => [
              k,
              (before as unknown as Record<string, unknown>)[k] ?? null,
            ]),
          )
        : null;
      await logFromRequest(req, ctx, session, {
        action: "emi.update",
        entityType: "emi",
        entityId: params.planId,
        entityLabel: `EMI plan ${params.planId}`,
        summary: `Updated EMI plan details`,
        metadata: patch as Record<string, unknown>,
        revertable: Boolean(beforeSnapshot),
        beforeSnapshot,
      });
    }
    const data = await getEmiSchedule(ctx, params.planId);
    return success(data, "EMI plan updated");
  },
  { auth: true },
);
