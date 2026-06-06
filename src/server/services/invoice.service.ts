import "server-only";
import { Invoice, Tenant } from "@/models";
import type { BillBreakdown } from "./billing.service";
import { NotFoundError } from "@/lib/errors";

/**
 * Generates the next per-tenant invoice number in the form
 * "INV-YYYY-NNNNNN". Counts the number of existing invoices for the
 * tenant in the current calendar year and increments by one — keeps
 * the sequence human-readable and self-contained per tenant.
 */
async function nextInvoiceNumber(tenantId: string, issuedAt: Date): Promise<string> {
  const year = issuedAt.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1));
  const count = await Invoice.countDocuments({
    tenantId,
    issuedAt: { $gte: yearStart, $lt: yearEnd },
  });
  const seq = String(count + 1).padStart(6, "0");
  return `INV-${year}-${seq}`;
}

function periodForMonth(now: Date): { periodStart: Date; periodEnd: Date } {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  return {
    periodStart: new Date(Date.UTC(y, m, 1)),
    periodEnd: new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999)),
  };
}

export type IssuedInvoice = {
  id: string;
  invoiceNumber: string;
};

/**
 * Snapshots the breakdown into a permanent Invoice row. Caller is the
 * billing orchestrator — pass the BillBreakdown straight from
 * computeMonthlyBill and the WalletTransaction id from debitWallet so
 * the bill and the payment are linked.
 *
 * The Invoice is the source of truth for "what was billed"; the wallet
 * transaction is the source of truth for "how it was paid". They share
 * the same total at issuance and never diverge after.
 */
export async function issueMonthlyInvoice(input: {
  tenantId: string;
  breakdown: BillBreakdown;
  walletTxnId: string;
  issuedAt: Date;
}): Promise<IssuedInvoice> {
  const { tenantId, breakdown, walletTxnId, issuedAt } = input;
  const number = await nextInvoiceNumber(tenantId, issuedAt);
  const { periodStart, periodEnd } = periodForMonth(issuedAt);

  const doc = await Invoice.create({
    tenantId,
    invoiceNumber: number,
    planId: breakdown.planId ?? null,
    planName: breakdown.planName ?? null,
    billingCycle: breakdown.billingCycle,
    periodStart,
    periodEnd,
    issuedAt,
    lineItems: breakdown.lineItems,
    subtotal: breakdown.subtotal,
    gstPercent: breakdown.gstPercent,
    gstAmount: breakdown.gstAmount,
    total: breakdown.total,
    status: "PAID",
    paidAt: issuedAt,
    paidFromWalletTxnId: walletTxnId,
  });

  return {
    id: String((doc as { _id: unknown })._id),
    invoiceNumber: number,
  };
}

export type InvoiceListRow = {
  id: string;
  invoiceNumber: string;
  planName: string | null;
  periodStart: string;
  periodEnd: string;
  issuedAt: string;
  total: number;
  status: "PAID" | "UNPAID" | "VOID";
};

export async function listInvoices(
  tenantId: string,
  opts: { limit?: number } = {},
): Promise<InvoiceListRow[]> {
  const limit = Math.min(Math.max(opts.limit ?? 30, 1), 200);
  const rows = await Invoice.find({ tenantId })
    .sort({ issuedAt: -1 })
    .limit(limit)
    .lean();
  return rows.map((r) => {
    const row = r as unknown as {
      _id: { toString(): string };
      invoiceNumber: string;
      planName: string | null;
      periodStart: Date;
      periodEnd: Date;
      issuedAt: Date;
      total: number;
      status: "PAID" | "UNPAID" | "VOID";
    };
    return {
      id: String(row._id),
      invoiceNumber: row.invoiceNumber,
      planName: row.planName,
      periodStart: row.periodStart.toISOString(),
      periodEnd: row.periodEnd.toISOString(),
      issuedAt: row.issuedAt.toISOString(),
      total: row.total,
      status: row.status,
    };
  });
}

export type InvoiceDetail = {
  id: string;
  invoiceNumber: string;
  tenantId: string;
  tenantName: string;
  tenantAddress: string | null;
  tenantGstin: string | null;
  tenantPan: string | null;
  planName: string | null;
  billingCycle: "MONTHLY" | "YEARLY";
  periodStart: string;
  periodEnd: string;
  issuedAt: string;
  lineItems: Array<{
    label: string;
    unitCount: number;
    unitPrice: number;
    amount: number;
  }>;
  subtotal: number;
  gstPercent: number;
  gstAmount: number;
  total: number;
  status: "PAID" | "UNPAID" | "VOID";
  paidAt: string | null;
  paidFromWalletTxnId: string | null;
};

export async function getInvoiceDetail(
  tenantId: string,
  invoiceId: string,
): Promise<InvoiceDetail> {
  const inv = await Invoice.findOne({ _id: invoiceId, tenantId }).lean();
  if (!inv) throw new NotFoundError("Invoice not found");
  const tenant = await Tenant.findById(tenantId)
    .select("name addressLine city state pinCode gstNumber panNumber")
    .lean();
  const t = (tenant ?? {}) as {
    name?: string;
    addressLine?: string | null;
    city?: string | null;
    state?: string | null;
    pinCode?: string | null;
    gstNumber?: string | null;
    panNumber?: string | null;
  };
  const addressParts = [t.addressLine, t.city, t.state, t.pinCode].filter(
    (x): x is string => Boolean(x && x.trim()),
  );
  const address = addressParts.length > 0 ? addressParts.join(", ") : null;
  const i = inv as unknown as {
    _id: { toString(): string };
    invoiceNumber: string;
    planName: string | null;
    billingCycle: "MONTHLY" | "YEARLY";
    periodStart: Date;
    periodEnd: Date;
    issuedAt: Date;
    lineItems: Array<{
      label: string;
      unitCount: number;
      unitPrice: number;
      amount: number;
    }>;
    subtotal: number;
    gstPercent: number;
    gstAmount: number;
    total: number;
    status: "PAID" | "UNPAID" | "VOID";
    paidAt: Date | null;
    paidFromWalletTxnId: { toString(): string } | null;
  };
  return {
    id: String(i._id),
    invoiceNumber: i.invoiceNumber,
    tenantId,
    tenantName: t.name ?? "—",
    tenantAddress: address,
    tenantGstin: t.gstNumber ?? null,
    tenantPan: t.panNumber ?? null,
    planName: i.planName,
    billingCycle: i.billingCycle,
    periodStart: i.periodStart.toISOString(),
    periodEnd: i.periodEnd.toISOString(),
    issuedAt: i.issuedAt.toISOString(),
    lineItems: i.lineItems,
    subtotal: i.subtotal,
    gstPercent: i.gstPercent,
    gstAmount: i.gstAmount,
    total: i.total,
    status: i.status,
    paidAt: i.paidAt ? i.paidAt.toISOString() : null,
    paidFromWalletTxnId: i.paidFromWalletTxnId ? String(i.paidFromWalletTxnId) : null,
  };
}
