import "server-only";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "@/lib/errors";
import { Expense, Vehicle } from "@/models";
import {
  type ScopedContext,
  tenantStamp,
} from "@/lib/auth/tenant-context";
import * as emiRepo from "../repositories/emi.repository";

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build the monthly schedule for an EMI plan. The Nth installment is
 * scheduled for `startDate + (N-1) months`, normalized to the plan's
 * `dueDayOfMonth`. If the target month is short (Feb 30 etc.) we clamp to
 * the last day of that month.
 */
function buildSchedule(
  startDate: Date,
  totalInstallments: number,
  dueDayOfMonth: number,
  emiAmount: number,
): Array<{
  installmentNumber: number;
  scheduledDate: Date;
  amount: number;
  status: "SCHEDULED";
}> {
  const rows: Array<{
    installmentNumber: number;
    scheduledDate: Date;
    amount: number;
    status: "SCHEDULED";
  }> = [];

  for (let i = 0; i < totalInstallments; i++) {
    const target = new Date(
      Date.UTC(
        startDate.getUTCFullYear(),
        startDate.getUTCMonth() + i,
        1,
        0,
        0,
        0,
        0,
      ),
    );
    // last day of target month
    const lastDay = new Date(
      Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
    ).getUTCDate();
    const day = Math.min(dueDayOfMonth, lastDay);
    target.setUTCDate(day);

    rows.push({
      installmentNumber: i + 1,
      scheduledDate: target,
      amount: emiAmount,
      status: "SCHEDULED",
    });
  }
  return rows;
}

function computeEndDate(startDate: Date, totalInstallments: number): Date {
  const d = new Date(startDate);
  d.setUTCMonth(d.getUTCMonth() + (totalInstallments - 1));
  return d;
}

async function refreshNextDueDate(ctx: ScopedContext, planId: string) {
  const next = await emiRepo.findNextScheduledPayment(ctx, planId);
  await emiRepo.updatePlan(ctx, planId, {
    nextDueDate: next?.scheduledDate ?? null,
  });
}

// ── Plan input ──────────────────────────────────────────────────────────────

export type CreateEmiPlanInput = {
  vehicleId: string;
  lenderName: string;
  lenderType?: "BANK" | "NBFC" | "PARTNER";
  lenderContactPhone?: string | null;
  lenderBranch?: string | null;
  debitBankName?: string | null;
  debitAccountMasked?: string | null;
  debitAccountHolder?: string | null;
  principalAmount?: number | null;
  emiAmount: number;
  totalInstallments: number;
  startDate: string | Date;
  dueDayOfMonth: number;
  reminderChannels?: Array<"EMAIL" | "WHATSAPP" | "IN_APP">;
  reminderLeadDays?: number[];
  notes?: string | null;
};

function validateCreateInput(input: CreateEmiPlanInput) {
  if (!input.vehicleId) throw new BadRequestError("vehicleId is required");
  if (!input.lenderName?.trim()) throw new BadRequestError("Lender name is required");
  if (!input.emiAmount || input.emiAmount <= 0)
    throw new BadRequestError("EMI amount must be greater than zero");
  if (!input.totalInstallments || input.totalInstallments < 1)
    throw new BadRequestError("Total installments must be at least 1");
  if (input.totalInstallments > 600)
    throw new BadRequestError("Total installments cannot exceed 600");
  if (!input.startDate) throw new BadRequestError("Start date is required");
  if (
    !Number.isInteger(input.dueDayOfMonth) ||
    input.dueDayOfMonth < 1 ||
    input.dueDayOfMonth > 31
  ) {
    throw new BadRequestError("Due day of month must be between 1 and 31");
  }
  const sd = new Date(input.startDate);
  if (Number.isNaN(sd.getTime()))
    throw new BadRequestError("Invalid start date");
}

// ── Public API ──────────────────────────────────────────────────────────────

export async function createEmiPlan(
  ctx: ScopedContext,
  input: CreateEmiPlanInput,
  createdBy: string | null,
) {
  validateCreateInput(input);

  // vehicle must exist + belong to tenant
  const vehicle = await Vehicle.findOne({
    _id: input.vehicleId,
    tenantId: tenantStamp(ctx).tenantId,
  })
    .select("_id")
    .lean();
  if (!vehicle) throw new NotFoundError("Vehicle not found");

  // one ACTIVE plan per vehicle (close old one first if needed)
  const existing = await emiRepo.findActivePlanByVehicleId(
    ctx,
    input.vehicleId,
  );
  if (existing) {
    throw new ConflictError(
      "This vehicle already has an active EMI plan. Close it before adding a new one.",
    );
  }

  const startDate = new Date(input.startDate);
  const endDate = computeEndDate(startDate, input.totalInstallments);

  const plan = await emiRepo.createPlan(ctx, {
    vehicleId: input.vehicleId,
    lenderName: input.lenderName.trim(),
    lenderType: input.lenderType ?? "BANK",
    lenderContactPhone: input.lenderContactPhone ?? null,
    lenderBranch: input.lenderBranch ?? null,
    debitBankName: input.debitBankName ?? null,
    debitAccountMasked: input.debitAccountMasked ?? null,
    debitAccountHolder: input.debitAccountHolder ?? null,
    principalAmount: input.principalAmount ?? null,
    emiAmount: input.emiAmount,
    totalInstallments: input.totalInstallments,
    paidInstallments: 0,
    startDate,
    endDate,
    dueDayOfMonth: input.dueDayOfMonth,
    status: "ACTIVE",
    reminderChannels: input.reminderChannels ?? ["EMAIL", "IN_APP"],
    reminderLeadDays: input.reminderLeadDays ?? [7, 3, 1],
    notes: input.notes ?? null,
    createdBy,
  });

  // Generate the full installment schedule up-front. Lets the cron + UI
  // operate on concrete rows without recomputing.
  const schedule = buildSchedule(
    startDate,
    input.totalInstallments,
    input.dueDayOfMonth,
    input.emiAmount,
  );
  await emiRepo.insertManyPayments(
    ctx,
    schedule.map((row) => ({
      emiPlanId: plan._id,
      vehicleId: input.vehicleId,
      ...row,
    })),
  );

  await refreshNextDueDate(ctx, String(plan._id));
  return emiRepo.findPlanById(ctx, String(plan._id));
}

export async function listEmiPlans(
  ctx: ScopedContext,
  filters: { status?: string; vehicleId?: string } = {},
) {
  return emiRepo.findAllPlans(ctx, filters);
}

export async function getEmiPlan(ctx: ScopedContext, id: string) {
  const plan = await emiRepo.findPlanById(ctx, id);
  if (!plan) throw new NotFoundError("EMI plan not found");
  return plan;
}

export async function getEmiPlansForVehicle(
  ctx: ScopedContext,
  vehicleId: string,
) {
  return emiRepo.findPlansByVehicleId(ctx, vehicleId);
}

export async function getEmiSchedule(ctx: ScopedContext, planId: string) {
  const plan = await emiRepo.findPlanById(ctx, planId);
  if (!plan) throw new NotFoundError("EMI plan not found");
  const payments = await emiRepo.findPaymentsByPlan(ctx, planId);
  return { plan, payments };
}

export async function updateEmiPlan(
  ctx: ScopedContext,
  id: string,
  patch: Partial<{
    lenderName: string;
    lenderType: "BANK" | "NBFC" | "PARTNER";
    lenderContactPhone: string | null;
    lenderBranch: string | null;
    debitBankName: string | null;
    debitAccountMasked: string | null;
    debitAccountHolder: string | null;
    reminderChannels: Array<"EMAIL" | "WHATSAPP" | "IN_APP">;
    reminderLeadDays: number[];
    notes: string | null;
  }>,
) {
  const plan = await emiRepo.findPlanById(ctx, id);
  if (!plan) throw new NotFoundError("EMI plan not found");
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    cleaned[k] = v;
  }
  if (Object.keys(cleaned).length === 0) return plan;
  return emiRepo.updatePlan(ctx, id, cleaned);
}

export async function setPlanStatus(
  ctx: ScopedContext,
  id: string,
  status: "ACTIVE" | "PAUSED" | "DEFAULTED" | "CLOSED",
) {
  const plan = await emiRepo.findPlanById(ctx, id);
  if (!plan) throw new NotFoundError("EMI plan not found");
  if (plan.status === "CLOSED" && status !== "ACTIVE") {
    throw new ForbiddenError("Closed plan cannot be re-paused or defaulted");
  }
  const patch: Record<string, unknown> = { status };
  if (status === "CLOSED") {
    patch.closedAt = new Date();
    patch.nextDueDate = null;
  }
  return emiRepo.updatePlan(ctx, id, patch);
}

/**
 * Mark an installment paid. Auto-creates an Expense entry under the EMI
 * category so the spend rolls into existing reports. Bumps the plan's
 * paidInstallments counter and recomputes nextDueDate.
 */
export async function markPaymentPaid(
  ctx: ScopedContext,
  paymentId: string,
  input: {
    paidDate?: string | Date;
    paidAmount?: number;
    lateFee?: number;
    transactionRef?: string | null;
    proofUrl?: string | null;
    notes?: string | null;
  },
  markedBy: string | null,
) {
  const payment = await emiRepo.findPaymentById(ctx, paymentId);
  if (!payment) throw new NotFoundError("EMI payment not found");
  if (payment.status === "PAID") {
    throw new ConflictError("Payment is already marked paid");
  }
  if (payment.status === "SKIPPED") {
    throw new ConflictError("Skipped payment cannot be marked paid");
  }

  const plan = await emiRepo.findPlanById(ctx, String(payment.emiPlanId));
  if (!plan) throw new NotFoundError("Parent EMI plan not found");

  const paidDate = input.paidDate ? new Date(input.paidDate) : new Date();
  const paidAmount = input.paidAmount ?? payment.amount;
  if (paidAmount < 0) throw new BadRequestError("paidAmount cannot be negative");
  const lateFee = input.lateFee ?? 0;
  if (lateFee < 0) throw new BadRequestError("lateFee cannot be negative");

  // Auto-link an Expense row (single source of truth for spend reports).
  const expense = await Expense.create({
    ...tenantStamp(ctx),
    vehicleId: payment.vehicleId,
    category: "EMI",
    title: `EMI #${payment.installmentNumber} — ${plan.lenderName}`,
    amount: paidAmount,
    handlingCharges: lateFee,
    expenseDate: paidDate,
    description:
      input.notes ?? `EMI installment ${payment.installmentNumber} of ${plan.totalInstallments}`,
    proofUrl: input.proofUrl ?? null,
    referenceId: input.transactionRef ?? null,
  });

  const updated = await emiRepo.updatePayment(ctx, paymentId, {
    status: "PAID",
    paidDate,
    paidAmount,
    lateFee,
    transactionRef: input.transactionRef ?? null,
    proofUrl: input.proofUrl ?? null,
    notes: input.notes ?? null,
    expenseId: expense._id,
    markedBy,
  });

  await emiRepo.incrementPaidInstallments(ctx, String(payment.emiPlanId), 1);

  // If this was the final installment, auto-close the plan.
  const refreshedPlan = await emiRepo.findPlanById(
    ctx,
    String(payment.emiPlanId),
  );
  if (
    refreshedPlan &&
    refreshedPlan.paidInstallments >= refreshedPlan.totalInstallments
  ) {
    await emiRepo.updatePlan(ctx, String(payment.emiPlanId), {
      status: "CLOSED",
      closedAt: new Date(),
      nextDueDate: null,
    });
  } else {
    await refreshNextDueDate(ctx, String(payment.emiPlanId));
  }

  return updated;
}

export async function markPaymentStatus(
  ctx: ScopedContext,
  paymentId: string,
  status: "BOUNCED" | "SKIPPED" | "OVERDUE",
  notes?: string | null,
) {
  const payment = await emiRepo.findPaymentById(ctx, paymentId);
  if (!payment) throw new NotFoundError("EMI payment not found");
  if (payment.status === "PAID") {
    throw new ConflictError("A paid installment cannot be changed");
  }
  const patch: Record<string, unknown> = { status };
  if (notes !== undefined) patch.notes = notes;
  return emiRepo.updatePayment(ctx, paymentId, patch);
}

/**
 * Bulk-mark every installment whose `scheduledDate <= untilDate` (default
 * = today) as paid for a single plan. Skips installments that are already
 * PAID or SKIPPED. Delegates to {@link markPaymentPaid} per row so the
 * Expense auto-link, paidInstallments counter, and plan auto-close all
 * stay consistent with the single-row flow.
 *
 * Returns the count of installments actually updated.
 */
export async function markPaymentsPaidUntil(
  ctx: ScopedContext,
  planId: string,
  untilDate: Date | string | undefined,
  markedBy: string | null,
): Promise<{ updated: number; total: number }> {
  const plan = await emiRepo.findPlanById(ctx, planId);
  if (!plan) throw new NotFoundError("EMI plan not found");

  const cutoff = untilDate ? new Date(untilDate) : new Date();
  // End-of-day cutoff so an installment scheduled for "today" still qualifies.
  cutoff.setHours(23, 59, 59, 999);

  const payments = await emiRepo.findPaymentsByPlan(ctx, planId);
  const due = payments.filter(
    (p) =>
      p.status !== "PAID" &&
      p.status !== "SKIPPED" &&
      new Date(p.scheduledDate as unknown as string | Date).getTime() <= cutoff.getTime(),
  );

  let updated = 0;
  for (const p of due) {
    try {
      await markPaymentPaid(ctx, String(p._id), {}, markedBy);
      updated += 1;
    } catch {
      // Skip rows that fail (eg. race conditions) — keep going so one bad
      // row doesn't block the rest of the batch.
    }
  }
  return { updated, total: due.length };
}

/**
 * Revert a PAID installment back to SCHEDULED. Mirrors markPaymentPaid in
 * reverse: deletes the linked Expense so spend reports stay in sync,
 * clears the paid-on fields, decrements the plan's paidInstallments
 * counter, and re-opens a plan that had been auto-closed.
 */
export async function markPaymentUnpaid(
  ctx: ScopedContext,
  paymentId: string,
) {
  const payment = await emiRepo.findPaymentById(ctx, paymentId);
  if (!payment) throw new NotFoundError("EMI payment not found");
  if (payment.status !== "PAID") {
    throw new ConflictError("Only a paid installment can be reverted");
  }

  // Wipe the auto-linked Expense row so reports don't double-count once
  // the user marks it paid again.
  if (payment.expenseId) {
    await Expense.deleteOne({ _id: payment.expenseId });
  }

  const updated = await emiRepo.updatePayment(ctx, paymentId, {
    status: "SCHEDULED",
    paidDate: null,
    paidAmount: null,
    lateFee: 0,
    transactionRef: null,
    proofUrl: null,
    expenseId: null,
    markedBy: null,
  });

  await emiRepo.incrementPaidInstallments(ctx, String(payment.emiPlanId), -1);

  // Plan may have auto-closed when this was the final installment — undo
  // that and recompute the next due date.
  const plan = await emiRepo.findPlanById(ctx, String(payment.emiPlanId));
  if (plan && plan.status === "CLOSED") {
    await emiRepo.updatePlan(ctx, String(payment.emiPlanId), {
      status: "ACTIVE",
      closedAt: null,
    });
  }
  await refreshNextDueDate(ctx, String(payment.emiPlanId));

  return updated;
}

// ── Hub / summary ───────────────────────────────────────────────────────────

export async function getEmiHub(
  ctx: ScopedContext,
  filters: {
    statuses?: string[];
    dueWithinDays?: number | null;
  } = {},
) {
  const [rows, byStatus, monthlyOutflow] = await Promise.all([
    emiRepo.findHubRows(ctx, filters),
    emiRepo.countByStatus(ctx),
    emiRepo.sumMonthlyOutflow(ctx),
  ]);

  const today = new Date();
  const week = new Date();
  week.setDate(week.getDate() + 7);

  let duesThisWeek = 0;
  let defaulters = 0;
  for (const r of rows) {
    if (r.status === "DEFAULTED") defaulters += 1;
    if (
      r.status === "ACTIVE" &&
      r.nextDueDate &&
      new Date(r.nextDueDate) >= today &&
      new Date(r.nextDueDate) <= week
    ) {
      duesThisWeek += 1;
    }
  }

  return {
    rows,
    summary: {
      active: byStatus["ACTIVE"] ?? 0,
      paused: byStatus["PAUSED"] ?? 0,
      defaulted: byStatus["DEFAULTED"] ?? 0,
      closed: byStatus["CLOSED"] ?? 0,
      monthlyOutflow,
      duesThisWeek,
      defaulters,
    },
  };
}
