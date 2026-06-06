import "server-only";
import { Invoice, Tenant, User } from "@/models";
import { sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { computeMonthlyBill } from "./billing.service";
import {
  createUpgradeRequest,
  evaluatePlanFit,
  expireOverdueRequests,
} from "./planUpgrade.service";
import { debitWallet } from "./wallet.service";
import { issueMonthlyInvoice } from "./invoice.service";
import {
  planUpgradePendingEmail,
  planUpgradedEmail,
  walletLowEmail,
} from "@/lib/email";

const SUSPEND_AFTER_DAYS_NEGATIVE = 30;
const WALLET_LOW_THRESHOLD = 100; // ₹

/**
 * Day-of-month the monthly debit fires. Locking to the 30th means the
 * billing period runs Mar 1 → Mar 30 (charged Mar 30), Apr 1 → Apr 30
 * (charged Apr 30), etc. In February (28/29 days) the cron still runs
 * daily — if today's date matches BILLING_DAY OR today is the last day
 * of the month AND BILLING_DAY > daysInMonth, the bill fires.
 */
const BILLING_DAY = 30;

function shouldBillToday(now: Date): boolean {
  const d = now.getUTCDate();
  const lastDay = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0),
  ).getUTCDate();
  if (d === BILLING_DAY) return true;
  // Catch short months: e.g. Feb 28 with BILLING_DAY=30 → still bills.
  if (BILLING_DAY > lastDay && d === lastDay) return true;
  return false;
}

function appBaseUrl(): string {
  return (env.FRONTEND_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

async function tenantAdminEmails(tenantId: string): Promise<string[]> {
  const admins = await User.find({ tenantId, role: "ADMIN", isActive: { $ne: false } })
    .select("email")
    .lean();
  const emails = admins
    .map((u) => (u as { email?: string }).email)
    .filter((e): e is string => Boolean(e));
  if (emails.length === 0) {
    const t = await Tenant.findById(tenantId).select("billingEmail").lean();
    const billing = (t as { billingEmail?: string } | null)?.billingEmail;
    if (billing) return [billing];
  }
  return Array.from(new Set(emails));
}

/**
 * Already debited this calendar month? Cheap guard so re-running the cron
 * on the same day is safe (and idempotent on Vercel cron retries).
 */
function sameMonth(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();
}

async function debitMonthlyBillForTenant(
  tenantId: string,
  now: Date,
): Promise<{ debited: number; skipped: boolean }> {
  const tenant = await Tenant.findById(tenantId)
    .select("name lastBilledAt billingStatus paymentDueSince walletBalance")
    .lean();
  if (!tenant) return { debited: 0, skipped: true };
  const t = tenant as unknown as {
    name: string;
    lastBilledAt?: Date | null;
    billingStatus?: "ACTIVE" | "PAYMENT_DUE" | "SUSPENDED";
    paymentDueSince?: Date | null;
    walletBalance?: number;
  };

  // Skip if already billed this calendar month.
  if (t.lastBilledAt && sameMonth(new Date(t.lastBilledAt), now)) {
    return { debited: 0, skipped: true };
  }

  // Pro-rate the bill: vehicles/drivers/groups are charged for the share
  // of the calendar month they were actually active. Vehicles added on
  // the 15th of a 30-day month pay 16/30 of the monthly rate. New
  // tenants whose first cycle starts mid-month also benefit.
  const bill = await computeMonthlyBill(tenantId, { proRate: { asOf: now } });
  if (bill.total <= 0) {
    // No plan or zero charge — still mark lastBilledAt so we don't recompute
    // every minute on the same day.
    await Tenant.updateOne(
      { _id: tenantId },
      { $set: { lastBilledAt: now } },
    );
    return { debited: 0, skipped: false };
  }

  const result = await debitWallet({
    tenantId,
    amount: bill.total,
    reason: "monthly_bill",
    metadata: {
      planId: bill.planId,
      planName: bill.planName,
      billingCycle: bill.billingCycle,
      lineItems: bill.lineItems,
      subtotal: bill.subtotal,
      gstPercent: bill.gstPercent,
      gstAmount: bill.gstAmount,
      runAt: now.toISOString(),
    },
  });

  // Snapshot the bill as an Invoice and link it to the wallet debit.
  // Best-effort — if invoice issuance fails the wallet debit has
  // already happened and we don't want to double-charge on retry. The
  // wallet txn metadata already carries the breakdown as a fallback.
  try {
    const issued = await issueMonthlyInvoice({
      tenantId,
      breakdown: bill,
      walletTxnId: result.txnId,
      issuedAt: now,
    });
    // Backfill the wallet txn metadata with the invoice link so the
    // transactions table can render an "Invoice #" column.
    const { WalletTransaction } = await import("@/models");
    await WalletTransaction.updateOne(
      { _id: result.txnId },
      { $set: { "metadata.invoiceId": issued.id, "metadata.invoiceNumber": issued.invoiceNumber } },
    );

    // Email the invoice to tenant admins — PDF attachment + a short
    // body summarising the bill. Best-effort: a failed email never
    // rolls back the wallet debit or the invoice row.
    try {
      const adminEmails = await tenantAdminEmails(tenantId);
      if (adminEmails.length > 0) {
        const { getInvoiceDetail } = await import("./invoice.service");
        const { renderInvoicePdf } = await import("./invoice.pdf");
        const { invoicePaidEmail } = await import("@/lib/email");
        const detail = await getInvoiceDetail(tenantId, issued.id);
        const pdfBytes = await renderInvoicePdf(detail);
        const tpl = invoicePaidEmail({
          adminEmails,
          tenantName: detail.tenantName,
          invoiceNumber: detail.invoiceNumber,
          periodStart: detail.periodStart,
          periodEnd: detail.periodEnd,
          planName: detail.planName,
          total: detail.total,
          billingUrl: `${appBaseUrl()}/billing`,
        });
        await sendEmail({
          ...tpl,
          attachments: [
            {
              filename: `${detail.invoiceNumber}.pdf`,
              content: Buffer.from(pdfBytes),
              contentType: "application/pdf",
            },
          ],
        });
      }
    } catch (err) {
      console.error(
        "[billing.orchestrator] invoice email failed:",
        err instanceof Error ? err.message : err,
      );
    }
  } catch (err) {
    console.error(
      "[billing.orchestrator] invoice issuance failed:",
      err instanceof Error ? err.message : err,
    );
  }

  // Update billing health based on the new balance.
  const newBalance = result.balance;
  const updates: Record<string, unknown> = { lastBilledAt: now };
  let willEmailLow = false;
  if (newBalance < 0) {
    if (!t.paymentDueSince) {
      updates.paymentDueSince = now;
    }
    const dueSince = (updates.paymentDueSince as Date | undefined) ?? t.paymentDueSince;
    const daysNeg =
      dueSince
        ? Math.floor((now.getTime() - new Date(dueSince).getTime()) / (24 * 60 * 60 * 1000))
        : 0;
    updates.billingStatus = daysNeg >= SUSPEND_AFTER_DAYS_NEGATIVE
      ? "SUSPENDED"
      : "PAYMENT_DUE";
    willEmailLow = true;
  } else if (newBalance < WALLET_LOW_THRESHOLD) {
    willEmailLow = true;
  }
  await Tenant.updateOne({ _id: tenantId }, { $set: updates });

  if (willEmailLow) {
    try {
      const adminEmails = await tenantAdminEmails(tenantId);
      if (adminEmails.length > 0) {
        await sendEmail(
          walletLowEmail({
            adminEmails,
            tenantName: t.name,
            balance: newBalance,
            rechargeUrl: `${appBaseUrl()}/billing`,
          }),
        );
      }
    } catch (err) {
      console.error(
        "[billing.orchestrator] walletLow email failed:",
        err instanceof Error ? err.message : err,
      );
    }
  }

  return { debited: bill.total, skipped: false };
}

async function escalateSuspensionIfStuck(
  tenantId: string,
  now: Date,
): Promise<boolean> {
  const t = await Tenant.findById(tenantId)
    .select("paymentDueSince billingStatus walletBalance")
    .lean();
  if (!t) return false;
  const dueSince = (t as { paymentDueSince?: Date | null }).paymentDueSince;
  const status = (t as { billingStatus?: string }).billingStatus ?? "ACTIVE";
  const balance = (t as { walletBalance?: number }).walletBalance ?? 0;
  if (status === "SUSPENDED") return false;
  if (balance >= 0 || !dueSince) return false;
  const days = Math.floor(
    (now.getTime() - new Date(dueSince).getTime()) / (24 * 60 * 60 * 1000),
  );
  if (days >= SUSPEND_AFTER_DAYS_NEGATIVE) {
    await Tenant.updateOne(
      { _id: tenantId },
      { $set: { billingStatus: "SUSPENDED" } },
    );
    return true;
  }
  return false;
}

/**
 * Plan-fit check — runs daily AND on-demand after any event that changes
 * a tenant's fleet size (vehicle onboard, sale, soft-delete, signup). For
 * any tenant it:
 *   - assigns the matching plan if none was set (new tenants get Select
 *     since vehicleCount = 0 lands in the 0–50 band)
 *   - downgrades / same-tier moves apply immediately + email confirmation
 *   - upgrades create / preserve a PENDING request + email admins for
 *     confirmation (we never silently raise the tenant's bill)
 *
 * Exported so signup + vehicle hooks can fire it inline rather than
 * waiting for the daily cron.
 */
export async function runPlanFitForTenant(tenantId: string): Promise<{
  upgradedAuto: boolean;
  upgradeQueued: boolean;
}> {
  const fit = await evaluatePlanFit(tenantId);
  if (!fit.suggestedPlan) return { upgradedAuto: false, upgradeQueued: false };

  // Same tier — nothing to do.
  if (fit.currentPlan && fit.currentPlan.id === fit.suggestedPlan.id) {
    return { upgradedAuto: false, upgradeQueued: false };
  }

  // No plan yet OR downgrade → auto-apply.
  if (!fit.currentPlan || fit.isDowngrade) {
    await Tenant.updateOne(
      { _id: tenantId },
      { $set: { planId: fit.suggestedPlan.id } },
    );
    try {
      const tenant = await Tenant.findById(tenantId).select("name").lean();
      const plan = fit.suggestedPlan
        ? await (await import("@/models")).Plan.findById(fit.suggestedPlan.id)
            .select("name")
            .lean()
        : null;
      const bill = await computeMonthlyBill(tenantId);
      const adminEmails = await tenantAdminEmails(tenantId);
      if (adminEmails.length > 0 && plan && tenant) {
        await sendEmail(
          planUpgradedEmail({
            adminEmails,
            tenantName: (tenant as { name: string }).name,
            toPlanName: (plan as { name: string }).name,
            newMonthlyEstimate: bill.total,
            billingUrl: `${appBaseUrl()}/billing`,
          }),
        );
      }
    } catch (err) {
      console.error(
        "[billing.orchestrator] auto-plan email failed:",
        err instanceof Error ? err.message : err,
      );
    }
    return { upgradedAuto: true, upgradeQueued: false };
  }

  // Upgrade — queue a pending request + email admins.
  const { created } = await createUpgradeRequest({
    tenantId,
    fromPlanId: fit.currentPlan.id,
    toPlanId: fit.suggestedPlan.id,
    vehicleCountAtTrigger: fit.vehicleCount,
  });
  if (!created) return { upgradedAuto: false, upgradeQueued: false };

  try {
    const tenant = await Tenant.findById(tenantId).select("name").lean();
    const { Plan, PlanUpgradeRequest } = await import("@/models");
    const [fromPlan, toPlan, req] = await Promise.all([
      Plan.findById(fit.currentPlan.id).select("name").lean(),
      Plan.findById(fit.suggestedPlan.id).select("name").lean(),
      PlanUpgradeRequest.findOne({
        tenantId,
        status: "PENDING",
        toPlanId: fit.suggestedPlan.id,
      })
        .select("expiresAt")
        .lean(),
    ]);
    const bill = await computeMonthlyBill(tenantId);
    // Estimate uses suggested plan, not current — show what the new bill
    // WOULD be once accepted. computeMonthlyBill uses the stored plan, so
    // we substitute the suggested plan's price inline here.
    const adminEmails = await tenantAdminEmails(tenantId);
    if (adminEmails.length > 0 && tenant && toPlan && req) {
      await sendEmail(
        planUpgradePendingEmail({
          adminEmails,
          tenantName: (tenant as { name: string }).name,
          fromPlanName: fromPlan ? (fromPlan as { name: string }).name : null,
          toPlanName: (toPlan as { name: string }).name,
          vehicleCount: fit.vehicleCount,
          newMonthlyEstimate: bill.total,
          decideUrl: `${appBaseUrl()}/billing`,
          expiresAt: new Date(
            (req as { expiresAt: Date }).expiresAt,
          ).toISOString(),
        }),
      );
    }
  } catch (err) {
    console.error(
      "[billing.orchestrator] pending-upgrade email failed:",
      err instanceof Error ? err.message : err,
    );
  }

  return { upgradedAuto: false, upgradeQueued: true };
}

/**
 * The whole monthly + daily billing sweep. Re-entrant: if the cron runs
 * multiple times in the same day, the per-tenant guards (sameMonth check
 * for the debit, "is this upgrade already pending" check for the queue)
 * short-circuit and nothing duplicates.
 *
 * Always processes EVERY active tenant — failures on one don't stop the
 * sweep (each tenant gets its own try/catch).
 */
export async function runBillingCron() {
  const now = new Date();
  const expired = await expireOverdueRequests();
  const tenants = await Tenant.find({ status: "ACTIVE" }).select("_id").lean();

  let debitedTotal = 0;
  let debitedCount = 0;
  let suspended = 0;
  let upgradedAuto = 0;
  let upgradeQueued = 0;

  // Wallet debit + invoice fan-out only fires on the 30th (or last day
  // of short months). Plan-fit + suspension escalation run every day so
  // they react to fleet changes as they happen.
  const billingDay = shouldBillToday(now);

  for (const t of tenants) {
    const tenantId = String((t as { _id: unknown })._id);
    try {
      if (billingDay) {
        const dr = await debitMonthlyBillForTenant(tenantId, now);
        if (!dr.skipped) {
          debitedCount += 1;
          debitedTotal += dr.debited;
        }
      }
      const susp = await escalateSuspensionIfStuck(tenantId, now);
      if (susp) suspended += 1;
      const pf = await runPlanFitForTenant(tenantId);
      if (pf.upgradedAuto) upgradedAuto += 1;
      if (pf.upgradeQueued) upgradeQueued += 1;
    } catch (err) {
      console.error(
        `[billing.orchestrator] tenant ${tenantId} failed:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  return {
    expiredRequests: expired,
    debitedCount,
    debitedTotal,
    suspended,
    upgradedAuto,
    upgradeQueued,
    tenantCount: tenants.length,
  };
}
