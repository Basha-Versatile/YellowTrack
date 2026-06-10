import "server-only";
import { NotFoundError } from "@/lib/errors";
import {
  type ScopedContext,
  tokenScopedTenantOf,
} from "@/lib/auth/tenant-context";
import { AlertLog, Tenant } from "@/models";
import { sendWhatsApp } from "@/lib/whatsapp";
import {
  ALERT_LEAD_DAYS,
  currentCycleKey,
  daysUntilDue,
  nextDueDate,
  ordinal,
} from "@/lib/credit-card";
import * as repo from "../repositories/credit-card.repository";
import type {
  CreateCreditCardInput,
  UpdateCreditCardInput,
} from "@/validations/credit-card.schema";

type RawCard = Awaited<ReturnType<typeof repo.findAllActive>>[number];

/** Attach the derived, date-relative fields the UI sorts and labels on. */
function enrichCard(card: RawCard, today: Date) {
  const billDay = card.billDayOfMonth as number;
  const dueDay = card.dueDayOfMonth as number;
  const cycleKey = currentCycleKey(today, billDay);
  const isPaidThisCycle =
    Boolean(card.paid) && card.currentBillMonth === cycleKey;
  // The operator hasn't entered this statement's amount yet.
  const isStale = card.currentBillMonth !== cycleKey;
  return {
    ...card,
    nextDueDate: nextDueDate(today, dueDay).toISOString(),
    daysUntilDue: daysUntilDue(today, dueDay),
    cycleKey,
    isPaidThisCycle,
    isStale,
  };
}

/** List + stats + the tenant's reminder number — everything the page needs. */
export async function getOverview(ctx: ScopedContext) {
  const today = new Date();
  const [cards, tenant] = await Promise.all([
    repo.findAllActive(ctx),
    Tenant.findById((ctx as { tenantId: string }).tenantId)
      .select("creditCardAlertWhatsapp")
      .lean(),
  ]);

  const enriched = cards
    .map((c) => enrichCard(c, today))
    // Sort by next due date — the most urgent card first, bill date ignored.
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue);

  const totalBillAmount = enriched.reduce(
    (sum, c) => sum + (Number(c.currentBillAmount) || 0),
    0,
  );
  const unpaidCount = enriched.filter((c) => !c.isPaidThisCycle).length;

  return {
    cards: enriched,
    stats: {
      totalCards: enriched.length,
      totalBillAmount,
      unpaidCount,
    },
    settings: {
      alertWhatsapp:
        (tenant as { creditCardAlertWhatsapp?: string | null } | null)
          ?.creditCardAlertWhatsapp ?? null,
    },
  };
}

export async function createCard(
  ctx: ScopedContext,
  input: CreateCreditCardInput,
) {
  const today = new Date();
  const hasAmount =
    input.currentBillAmount != null && input.currentBillAmount > 0;
  const created = await repo.create(ctx, {
    bankName: input.bankName,
    last4: input.last4,
    cardholderName: input.cardholderName,
    billDayOfMonth: input.billDayOfMonth,
    dueDayOfMonth: input.dueDayOfMonth,
    currentBillAmount: input.currentBillAmount ?? 0,
    // If an opening amount was given, stamp it to the current statement.
    currentBillMonth: hasAmount
      ? currentCycleKey(today, input.billDayOfMonth)
      : null,
    paid: false,
  });
  return enrichCard(created.toObject() as RawCard, today);
}

export async function updateCard(
  ctx: ScopedContext,
  id: string,
  input: UpdateCreditCardInput,
) {
  const existing = await repo.findById(ctx, id);
  if (!existing) throw new NotFoundError("Credit card not found");

  const today = new Date();
  const patch: Record<string, unknown> = { ...input };

  // Entering / changing the amount means a new statement was read — stamp it
  // to the current cycle and reset the paid flag so reminders resume.
  if (input.currentBillAmount !== undefined) {
    const billDay = input.billDayOfMonth ?? (existing.billDayOfMonth as number);
    patch.currentBillMonth = currentCycleKey(today, billDay);
    patch.paid = false;
    patch.paidAt = null;
  }

  const updated = await repo.update(ctx, id, patch);
  if (!updated) throw new NotFoundError("Credit card not found");
  return enrichCard(updated as RawCard, today);
}

export async function deleteCard(ctx: ScopedContext, id: string) {
  const removed = await repo.softDelete(ctx, id);
  if (!removed) throw new NotFoundError("Credit card not found");
  return { id };
}

/** Mark the current statement paid and append a history row. */
export async function payCard(ctx: ScopedContext, id: string) {
  const card = await repo.findById(ctx, id);
  if (!card) throw new NotFoundError("Credit card not found");

  const today = new Date();
  const cycleKey = currentCycleKey(today, card.billDayOfMonth as number);
  const amount = Number(card.currentBillAmount) || 0;

  const updated = await repo.update(ctx, id, {
    paid: true,
    paidAt: today,
    currentBillMonth: cycleKey,
  });

  // Only record a history row when there's a real amount to log.
  if (amount > 0) {
    await repo.appendBillHistory(ctx, {
      cardId: id,
      billMonth: cycleKey,
      amount,
      paidAt: today,
    });
  }

  return enrichCard(updated as RawCard, today);
}

export async function getBillHistory(ctx: ScopedContext, id: string) {
  const card = await repo.findById(ctx, id);
  if (!card) throw new NotFoundError("Credit card not found");
  return repo.listBillHistory(ctx, id);
}

export async function updateAlertNumber(
  ctx: ScopedContext,
  alertWhatsapp: string | null,
) {
  const value = alertWhatsapp && alertWhatsapp.trim() ? alertWhatsapp.trim() : null;
  await Tenant.findByIdAndUpdate((ctx as { tenantId: string }).tenantId, {
    creditCardAlertWhatsapp: value,
  });
  return { alertWhatsapp: value };
}

// ─────────────────────────── Cron / alerts ───────────────────────────

/** Normalize a stored number to E.164-ish for the WhatsApp provider. */
function toE164(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("+")) return trimmed;
  const digits = trimmed.replace(/\D/g, "");
  // Bare 10-digit Indian mobile → prefix +91; otherwise assume country code present.
  return digits.length === 10 ? `+91${digits}` : `+${digits}`;
}

function buildMessage(card: {
  bankName: string;
  last4: string;
  currentBillAmount: number;
  dueDayOfMonth: number;
  days: number;
}): string {
  const amount = card.currentBillAmount > 0
    ? `₹${card.currentBillAmount.toLocaleString("en-IN")}`
    : "your bill";
  const due =
    card.days === 0
      ? "today"
      : card.days === 1
        ? "tomorrow"
        : `in ${card.days} days`;
  return (
    `💳 ${card.bankName} card ****${card.last4} — ${amount} is due ${due} ` +
    `(${ordinal(card.dueDayOfMonth)}). Pay before the due date to avoid late fees. — Yellow Track`
  );
}

async function runAlertsForTenant(
  ctx: ScopedContext,
  rawNumber: string,
  today: Date,
): Promise<number> {
  const cards = await repo.findAllActive(ctx);
  const to = toE164(rawNumber);
  let sent = 0;

  for (const card of cards) {
    const enriched = enrichCard(card, today);
    if (enriched.isPaidThisCycle) continue;
    if (!ALERT_LEAD_DAYS.includes(enriched.daysUntilDue as 7 | 1)) continue;

    const body = buildMessage({
      bankName: card.bankName as string,
      last4: card.last4 as string,
      currentBillAmount: Number(card.currentBillAmount) || 0,
      dueDayOfMonth: card.dueDayOfMonth as number,
      days: enriched.daysUntilDue,
    });

    let result: { sent: boolean; error?: string };
    try {
      result = await sendWhatsApp({ to, bodyPreview: body });
    } catch (err) {
      result = {
        sent: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }

    try {
      await AlertLog.create({
        tenantId: (ctx as { tenantId: string }).tenantId,
        type: "credit_card_due_reminder",
        channel: "whatsapp",
        to,
        status: result.sent ? "sent" : result.error ? "failed" : "skipped",
        error: result.error,
        metadata: {
          cardId: String(card._id),
          last4: card.last4,
          daysUntilDue: enriched.daysUntilDue,
        },
      });
    } catch (err) {
      console.error("[creditCard] failed to write AlertLog:", err);
    }
    sent++;
  }

  return sent;
}

/**
 * Cross-tenant cron entrypoint. Walks every ACTIVE tenant that has the
 * feature flag on AND a reminder number set, and fires WhatsApp reminders for
 * cards due in exactly 7 or 1 days that aren't paid yet.
 */
export async function runCreditCardAlerts() {
  const today = new Date();
  const tenants = await Tenant.find({
    status: "ACTIVE",
    "features.creditCardTracking": true,
  })
    .select("_id creditCardAlertWhatsapp")
    .lean();

  let alerts = 0;
  for (const tenant of tenants) {
    const number = (tenant as { creditCardAlertWhatsapp?: string | null })
      .creditCardAlertWhatsapp;
    if (!number) continue;
    const ctx = tokenScopedTenantOf(String(tenant._id));
    try {
      alerts += await runAlertsForTenant(ctx, number, today);
    } catch (err) {
      console.error(
        `[CRON_CREDIT_CARD] tenant ${String(tenant._id)} failed:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  return { alerts };
}
