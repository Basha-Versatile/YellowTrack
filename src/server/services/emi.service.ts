import "server-only";
import crypto from "crypto";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from "@/lib/errors";
import { EmiPlanCloseOtp, Expense, User, Vehicle } from "@/models";
import {
  type ScopedContext,
  tenantFilter,
  tenantStamp,
} from "@/lib/auth/tenant-context";
import { emiPlanCloseOtpEmail, sendEmail } from "@/lib/email";
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

/**
 * Self-heal `nextDueDate` on read for ACTIVE plans where it ended up null —
 * usually because the plan was created or modified before the persist path
 * was wired up, or because a partial write skipped the refresh. Recomputes
 * from the live payments and patches the row so the dashboard / vehicle
 * panel show the correct "Next due".
 *
 * Safe to call on every read: it short-circuits when the field is already
 * set or when the plan isn't ACTIVE.
 */
async function ensureNextDueDate<T extends Record<string, unknown>>(
  ctx: ScopedContext,
  plan: T,
): Promise<T> {
  const status = (plan as { status?: string }).status;
  const nextDueDate = (plan as { nextDueDate?: unknown }).nextDueDate;
  if (status !== "ACTIVE" || nextDueDate) return plan;
  const planId = String((plan as { _id?: unknown })._id ?? "");
  if (!planId) return plan;
  const next = await emiRepo.findNextScheduledPayment(ctx, planId);
  if (!next) return plan;
  await emiRepo.updatePlan(ctx, planId, {
    nextDueDate: next.scheduledDate,
  });
  return { ...plan, nextDueDate: next.scheduledDate } as T;
}

// ── Plan input ──────────────────────────────────────────────────────────────

export type CreateEmiPlanInput = {
  vehicleId: string;
  lenderName: string;
  lenderType?: "BANK" | "NBFC" | "PARTNER";
  lenderContactPhone?: string | null;
  lenderBranch?: string | null;
  loanAccountNumber?: string | null;
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
  // Uploaded EMI schedule (PDF / image) URLs — set by the route handler
  // after the multipart files are persisted via the storage driver. The
  // singular field is kept as a fallback pointer to the first file.
  scheduleDocumentUrl?: string | null;
  scheduleDocumentUrls?: string[] | null;
  // Optional downpayment for tracking-only purposes. Does NOT alter EMI
  // math. If amount > 0, date becomes required and the service auto-creates
  // an EMIPayment with installmentNumber 0 — PAID if the date is in the
  // past, SCHEDULED if future.
  downpaymentAmount?: number | null;
  downpaymentDate?: string | Date | null;
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

  // Downpayment policy: blank/0 → skip. Positive → date is mandatory and
  // must be a valid date. Past, current, and future dates are all
  // acceptable (the service decides PAID vs SCHEDULED based on this).
  const dp = Number(input.downpaymentAmount ?? 0) || 0;
  if (dp < 0) {
    throw new BadRequestError("Downpayment amount cannot be negative");
  }
  if (dp > 0) {
    if (!input.downpaymentDate) {
      throw new BadRequestError(
        "Downpayment date is required when a downpayment amount is provided",
      );
    }
    const dpd = new Date(input.downpaymentDate);
    if (Number.isNaN(dpd.getTime())) {
      throw new BadRequestError("Invalid downpayment date");
    }
  }
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
    loanAccountNumber: input.loanAccountNumber ?? null,
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
    scheduleDocumentUrl:
      input.scheduleDocumentUrl ??
      (input.scheduleDocumentUrls && input.scheduleDocumentUrls[0]) ??
      null,
    scheduleDocumentUrls: input.scheduleDocumentUrls ?? [],
    downpaymentAmount: Number(input.downpaymentAmount ?? 0) || 0,
    downpaymentDate: input.downpaymentDate
      ? new Date(input.downpaymentDate)
      : null,
    createdBy,
  });

  // Catalog the debit account so the next "New EMI plan" form can offer it
  // as a saved choice. Idempotent on (tenantId, bankName, accountMasked).
  if (input.debitBankName && input.debitAccountMasked) {
    try {
      const { upsertDebitAccount } = await import("./debitAccount.service");
      await upsertDebitAccount(ctx, {
        bankName: input.debitBankName,
        accountMasked: input.debitAccountMasked,
        accountHolder: input.debitAccountHolder ?? null,
      });
    } catch (err) {
      console.warn(
        "[emi] debit-account catalog upsert failed:",
        err instanceof Error ? err.message : err,
      );
    }
  }

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

  // Auto-create EMIPayment#0 for the downpayment. Installment number 0 is
  // reserved for the downpayment so the regular schedule stays intact
  // (installments 1..N for the actual EMI payments). The row mirrors
  // markPaymentPaid's shape so the existing read paths (dashboard donut,
  // Vehicles Expenses page, EMI hub timeline) all pick it up without
  // special-casing.
  const dpAmount = Number(input.downpaymentAmount ?? 0) || 0;
  if (dpAmount > 0 && input.downpaymentDate) {
    const dpDate = new Date(input.downpaymentDate);
    const isFuture = dpDate.getTime() > Date.now();
    await emiRepo.insertManyPayments(ctx, [
      {
        emiPlanId: plan._id,
        vehicleId: input.vehicleId,
        installmentNumber: 0,
        scheduledDate: dpDate,
        amount: dpAmount,
        status: isFuture ? "SCHEDULED" : "PAID",
        paidDate: isFuture ? null : dpDate,
        paidAmount: isFuture ? null : dpAmount,
      },
    ]);
    // NOTE on `paidInstallments`: we DON'T bump it for the downpayment.
    // `paidInstallments` tracks regular EMI installments (1..N) so that
    // `paidInstallments >= totalInstallments` correctly triggers auto-close
    // when the LAST installment is paid. The downpayment is a separate
    // concept — it shows in spend reports + the EMI calendar but doesn't
    // shorten the schedule.
  }

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
  return ensureNextDueDate(ctx, plan as Record<string, unknown>);
}

export async function getEmiPlansForVehicle(
  ctx: ScopedContext,
  vehicleId: string,
) {
  const plans = await emiRepo.findPlansByVehicleId(ctx, vehicleId);
  return Promise.all(
    plans.map((p) => ensureNextDueDate(ctx, p as Record<string, unknown>)),
  );
}

export async function getEmiSchedule(ctx: ScopedContext, planId: string) {
  const plan = await emiRepo.findPlanById(ctx, planId);
  if (!plan) throw new NotFoundError("EMI plan not found");
  const payments = await emiRepo.findPaymentsByPlan(ctx, planId);
  const fixed = await ensureNextDueDate(ctx, plan as Record<string, unknown>);
  return { plan: fixed, payments };
}

export async function updateEmiPlan(
  ctx: ScopedContext,
  id: string,
  patch: Partial<{
    lenderName: string;
    lenderType: "BANK" | "NBFC" | "PARTNER";
    lenderContactPhone: string | null;
    lenderBranch: string | null;
    loanAccountNumber: string | null;
    debitBankName: string | null;
    debitAccountMasked: string | null;
    debitAccountHolder: string | null;
    reminderChannels: Array<"EMAIL" | "WHATSAPP" | "IN_APP">;
    reminderLeadDays: number[];
    notes: string | null;
    // Schedule-affecting fields — paid installments stay frozen; the unpaid
    // tail is deleted and regenerated from the new values.
    principalAmount: number | null;
    emiAmount: number;
    totalInstallments: number;
    startDate: string | Date;
    dueDayOfMonth: number;
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

  // Identify whether the patch touches the schedule. principalAmount is just
  // metadata — it does NOT trigger a schedule rebuild.
  const scheduleKeys = ["emiAmount", "totalInstallments", "startDate", "dueDayOfMonth"] as const;
  const touchesSchedule = scheduleKeys.some((k) => k in cleaned);

  if (touchesSchedule) {
    const p = plan as unknown as {
      emiAmount: number;
      totalInstallments: number;
      startDate: Date;
      dueDayOfMonth: number;
      paidInstallments: number;
    };
    const newEmiAmount = (cleaned.emiAmount as number | undefined) ?? p.emiAmount;
    const newTotal = (cleaned.totalInstallments as number | undefined) ?? p.totalInstallments;
    const newStartDate = cleaned.startDate
      ? new Date(cleaned.startDate as string | Date)
      : new Date(p.startDate);
    const newDueDay = (cleaned.dueDayOfMonth as number | undefined) ?? p.dueDayOfMonth;
    const paidCount = p.paidInstallments ?? 0;

    if (newTotal < paidCount) {
      throw new BadRequestError(
        `Total installments (${newTotal}) cannot be less than the number already paid (${paidCount}). Mark installments unpaid first if you need to shrink the plan.`,
      );
    }
    if (!newEmiAmount || newEmiAmount <= 0) {
      throw new BadRequestError("EMI amount must be greater than zero");
    }
    if (!Number.isInteger(newDueDay) || newDueDay < 1 || newDueDay > 31) {
      throw new BadRequestError("Due day of month must be between 1 and 31");
    }
    if (Number.isNaN(newStartDate.getTime())) {
      throw new BadRequestError("Invalid start date");
    }

    // Drop unpaid future installments. Paid (and otherwise locked) rows stay.
    await emiRepo.deletePaymentsAfter(ctx, id, paidCount);

    // Rebuild only the tail (installmentNumber > paidCount) using the new
    // schedule parameters. Insert with explicit installmentNumber so they
    // pick up where the paid rows left off.
    if (paidCount < newTotal) {
      const tail = buildSchedule(newStartDate, newTotal, newDueDay, newEmiAmount)
        .filter((row) => row.installmentNumber > paidCount);
      await emiRepo.insertManyPayments(
        ctx,
        tail.map((row) => ({
          emiPlanId: id,
          vehicleId: String((plan as unknown as { vehicleId: unknown }).vehicleId),
          ...row,
        })),
      );
    }

    cleaned.endDate = computeEndDate(newStartDate, newTotal);
    if (cleaned.startDate) cleaned.startDate = newStartDate;
  }

  const updated = await emiRepo.updatePlan(ctx, id, cleaned);
  if (touchesSchedule) {
    await refreshNextDueDate(ctx, id);
  }
  return updated;
}

/**
 * Append amortization-sheet files (PDFs / images) to an existing plan and
 * keep the singular `scheduleDocumentUrl` pointed at the first file so older
 * readers don't break.
 */
export async function appendScheduleFiles(
  ctx: ScopedContext,
  id: string,
  urls: string[],
) {
  const plan = await emiRepo.findPlanById(ctx, id);
  if (!plan) throw new NotFoundError("EMI plan not found");
  if (urls.length === 0) return plan;
  const existing = (plan as unknown as { scheduleDocumentUrls?: string[] })
    .scheduleDocumentUrls ?? [];
  const merged = [...existing, ...urls];
  return emiRepo.updatePlan(ctx, id, {
    scheduleDocumentUrls: merged,
    scheduleDocumentUrl: merged[0] ?? null,
  });
}

/**
 * Drop one schedule-document URL from a plan. The singular pointer follows
 * the surviving first URL.
 */
export async function removeScheduleFile(
  ctx: ScopedContext,
  id: string,
  url: string,
) {
  const plan = await emiRepo.findPlanById(ctx, id);
  if (!plan) throw new NotFoundError("EMI plan not found");
  const existing = (plan as unknown as { scheduleDocumentUrls?: string[] })
    .scheduleDocumentUrls ?? [];
  const remaining = existing.filter((u) => u !== url);
  return emiRepo.updatePlan(ctx, id, {
    scheduleDocumentUrls: remaining,
    scheduleDocumentUrl: remaining[0] ?? null,
  });
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

// ── Close-plan OTP gate ────────────────────────────────────────────────────
// Closing a plan is reversible from the activity log, but it stops reminders
// and locks the schedule — easy to do by mistake on a touchscreen. The OTP
// gate matches the vehicle-deletion / doc-type-deletion patterns: warning →
// request code → enter code → close.

const PLAN_CLOSE_OTP_TTL_MIN = 10;

export async function requestPlanCloseOtp(
  ctx: ScopedContext,
  planId: string,
  userId: string,
): Promise<{ expiresAt: Date }> {
  const plan = await emiRepo.findPlanById(ctx, planId);
  if (!plan) throw new NotFoundError("EMI plan not found");
  if (plan.status === "CLOSED") {
    throw new ConflictError("This EMI plan is already closed");
  }

  // Fresh request invalidates any prior code for the same user + plan.
  await EmiPlanCloseOtp.deleteMany(
    tenantFilter(ctx, { emiPlanId: planId, userId }),
  );
  const otp = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  const expiresAt = new Date(Date.now() + PLAN_CLOSE_OTP_TTL_MIN * 60 * 1000);
  await EmiPlanCloseOtp.create({
    ...tenantStamp(ctx),
    emiPlanId: planId,
    userId,
    otp,
    expiresAt,
  });

  // Best-effort email — log failures, don't surface to the caller.
  try {
    const [user, vehicle] = await Promise.all([
      User.findById(userId).select("email name").lean(),
      Vehicle.findById((plan as { vehicleId: unknown }).vehicleId)
        .select("registrationNumber")
        .lean(),
    ]);
    const email = (user as { email?: string } | null)?.email;
    if (email) {
      await sendEmail(
        emiPlanCloseOtpEmail({
          to: email,
          recipientName: (user as { name?: string } | null)?.name ?? "there",
          lenderName: (plan as { lenderName: string }).lenderName,
          registrationNumber:
            (vehicle as { registrationNumber?: string } | null)
              ?.registrationNumber ?? "—",
          otp,
          expiresInMinutes: PLAN_CLOSE_OTP_TTL_MIN,
        }),
      );
    }
  } catch (err) {
    console.error(
      "[emi.requestPlanCloseOtp] email failed:",
      err instanceof Error ? err.message : err,
    );
  }

  return { expiresAt };
}

export async function confirmPlanClose(
  ctx: ScopedContext,
  planId: string,
  userId: string,
  otp: string,
) {
  const cleanOtp = otp.trim();
  if (!/^\d{6}$/.test(cleanOtp)) {
    throw new BadRequestError("Enter the 6-digit code from the email");
  }
  const row = await EmiPlanCloseOtp.findOne(
    tenantFilter(ctx, { emiPlanId: planId, userId }),
  ).sort({ createdAt: -1 });
  if (!row) {
    throw new UnauthorizedError(
      "Code expired or not found. Request a new one.",
    );
  }
  const r = row as unknown as { otp: string; expiresAt: Date };
  if (r.expiresAt.getTime() < Date.now()) {
    await EmiPlanCloseOtp.deleteOne({ _id: (row as { _id: unknown })._id });
    throw new UnauthorizedError("Code expired. Request a new one.");
  }
  if (r.otp !== cleanOtp) {
    throw new UnauthorizedError("Incorrect code");
  }
  // Burn the OTP first so a second click can't replay it.
  await EmiPlanCloseOtp.deleteOne({ _id: (row as { _id: unknown })._id });
  return setPlanStatus(ctx, planId, "CLOSED");
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

  // Default to the installment's own scheduled date when the caller doesn't
  // specify, so the auto-created Expense lands in the month it actually
  // belonged to — both for single Mark Paid clicks and the bulk sweep.
  const paidDate = input.paidDate
    ? new Date(input.paidDate)
    : new Date(payment.scheduledDate as unknown as string | Date);
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
      // Use the installment's own scheduledDate as the paid date so the
      // auto-created Expense lands in the month it actually belonged to.
      // Without this, every historic installment in a bulk-paid sweep would
      // stack on TODAY, distorting the monthly trend chart.
      const scheduled = new Date(p.scheduledDate as unknown as string | Date);
      await markPaymentPaid(
        ctx,
        String(p._id),
        { paidDate: scheduled },
        markedBy,
      );
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
  const [rawRows, byStatus, monthlyOutflow] = await Promise.all([
    emiRepo.findHubRows(ctx, filters),
    emiRepo.countByStatus(ctx),
    emiRepo.sumMonthlyOutflow(ctx),
  ]);

  // Self-heal nextDueDate for any ACTIVE rows where it leaked through as
  // null. Walks the list serially to keep DB pressure low; on a fresh
  // dataset this is a no-op because the field is already populated.
  const rows = await Promise.all(
    rawRows.map((r) => ensureNextDueDate(ctx, r as Record<string, unknown>)),
  );

  const today = new Date();
  const week = new Date();
  week.setDate(week.getDate() + 7);

  let duesThisWeek = 0;
  let defaulters = 0;
  for (const r of rows) {
    const row = r as { status?: string; nextDueDate?: Date | string | null };
    if (row.status === "DEFAULTED") defaulters += 1;
    if (
      row.status === "ACTIVE" &&
      row.nextDueDate &&
      new Date(row.nextDueDate) >= today &&
      new Date(row.nextDueDate) <= week
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
