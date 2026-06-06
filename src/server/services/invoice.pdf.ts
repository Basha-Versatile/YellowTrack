import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { InvoiceDetail } from "./invoice.service";

const BRAND_YELLOW = rgb(0.99, 0.78, 0.13);
const INK = rgb(0.1, 0.1, 0.12);
const MUTED = rgb(0.42, 0.45, 0.5);
const HAIRLINE = rgb(0.86, 0.88, 0.91);
const TABLE_HEAD_BG = rgb(0.97, 0.97, 0.98);

const PAGE_W = 595.28; // A4 in pt
const PAGE_H = 841.89;
const MARGIN_X = 48;

function inr(amount: number): string {
  return `Rs. ${amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = d.toLocaleString("en-GB", { month: "short", timeZone: "UTC" });
  const yy = d.getUTCFullYear();
  return `${dd} ${mm} ${yy}`;
}

function drawWrapped(
  page: PDFPage,
  text: string,
  opts: {
    x: number;
    y: number;
    maxWidth: number;
    font: PDFFont;
    size: number;
    color?: ReturnType<typeof rgb>;
    lineHeight?: number;
  },
): number {
  const { x, y, maxWidth, font, size, color = INK, lineHeight = size * 1.35 } = opts;
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  let cursor = y;
  for (const ln of lines) {
    page.drawText(ln, { x, y: cursor, size, font, color });
    cursor -= lineHeight;
  }
  return cursor;
}

/**
 * Renders the invoice as a single-page A4 PDF. Layout:
 *   - Yellow header bar with brand + invoice number/date
 *   - "Bill to" tenant block on the left, plan + period block on the right
 *   - Line-items table (Description / Qty / Rate / Amount)
 *   - Totals stack (subtotal, GST, grand total)
 *   - Payment footer: wallet txn reference + status badge
 */
export async function renderInvoicePdf(inv: InvoiceDetail): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Invoice ${inv.invoiceNumber}`);
  pdf.setAuthor("Yellow Track");
  pdf.setSubject(`Monthly subscription bill for ${inv.tenantName}`);

  const page = pdf.addPage([PAGE_W, PAGE_H]);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const body = await pdf.embedFont(StandardFonts.Helvetica);

  // ── Yellow header strip ─────────────────────────────────────
  page.drawRectangle({
    x: 0,
    y: PAGE_H - 96,
    width: PAGE_W,
    height: 96,
    color: BRAND_YELLOW,
  });
  page.drawText("YELLOW TRACK", {
    x: MARGIN_X,
    y: PAGE_H - 48,
    size: 22,
    font: bold,
    color: INK,
  });
  page.drawText("Fleet management & compliance", {
    x: MARGIN_X,
    y: PAGE_H - 70,
    size: 10,
    font: body,
    color: INK,
  });
  // Right-aligned invoice meta
  const invLabel = "TAX INVOICE";
  page.drawText(invLabel, {
    x: PAGE_W - MARGIN_X - bold.widthOfTextAtSize(invLabel, 11),
    y: PAGE_H - 40,
    size: 11,
    font: bold,
    color: INK,
  });
  const numText = `# ${inv.invoiceNumber}`;
  page.drawText(numText, {
    x: PAGE_W - MARGIN_X - body.widthOfTextAtSize(numText, 11),
    y: PAGE_H - 58,
    size: 11,
    font: body,
    color: INK,
  });
  const issuedText = `Issued: ${formatDate(inv.issuedAt)}`;
  page.drawText(issuedText, {
    x: PAGE_W - MARGIN_X - body.widthOfTextAtSize(issuedText, 9),
    y: PAGE_H - 74,
    size: 9,
    font: body,
    color: INK,
  });

  // ── Bill-to / billing block ─────────────────────────────────
  const blockTop = PAGE_H - 130;
  page.drawText("BILL TO", {
    x: MARGIN_X,
    y: blockTop,
    size: 9,
    font: bold,
    color: MUTED,
  });
  page.drawText(inv.tenantName, {
    x: MARGIN_X,
    y: blockTop - 18,
    size: 13,
    font: bold,
    color: INK,
  });
  let cursor = blockTop - 36;
  if (inv.tenantAddress) {
    cursor = drawWrapped(page, inv.tenantAddress, {
      x: MARGIN_X,
      y: cursor,
      maxWidth: 240,
      font: body,
      size: 10,
      color: INK,
    });
  }
  if (inv.tenantGstin) {
    page.drawText(`GSTIN: ${inv.tenantGstin}`, {
      x: MARGIN_X,
      y: cursor - 4,
      size: 9,
      font: body,
      color: MUTED,
    });
    cursor -= 18;
  }
  if (inv.tenantPan) {
    page.drawText(`PAN: ${inv.tenantPan}`, {
      x: MARGIN_X,
      y: cursor - 4,
      size: 9,
      font: body,
      color: MUTED,
    });
  }

  // Right column — plan + period
  const rightX = 340;
  page.drawText("PLAN", {
    x: rightX,
    y: blockTop,
    size: 9,
    font: bold,
    color: MUTED,
  });
  page.drawText(inv.planName ?? "No plan assigned", {
    x: rightX,
    y: blockTop - 18,
    size: 13,
    font: bold,
    color: INK,
  });
  page.drawText(`Cycle: ${inv.billingCycle === "YEARLY" ? "Yearly" : "Monthly"}`, {
    x: rightX,
    y: blockTop - 36,
    size: 10,
    font: body,
    color: INK,
  });
  page.drawText(
    `Period: ${formatDate(inv.periodStart)} - ${formatDate(inv.periodEnd)}`,
    {
      x: rightX,
      y: blockTop - 52,
      size: 10,
      font: body,
      color: INK,
    },
  );

  // ── Line-items table ────────────────────────────────────────
  const tableTop = blockTop - 110;
  const colDescX = MARGIN_X;
  const colQtyX = 320;
  const colRateX = 380;
  const colAmtX = 480;
  const tableW = PAGE_W - MARGIN_X * 2;

  // Header row
  page.drawRectangle({
    x: MARGIN_X - 4,
    y: tableTop - 8,
    width: tableW + 8,
    height: 22,
    color: TABLE_HEAD_BG,
  });
  page.drawText("Description", {
    x: colDescX,
    y: tableTop,
    size: 9,
    font: bold,
    color: INK,
  });
  page.drawText("Qty", {
    x: colQtyX,
    y: tableTop,
    size: 9,
    font: bold,
    color: INK,
  });
  page.drawText("Rate", {
    x: colRateX,
    y: tableTop,
    size: 9,
    font: bold,
    color: INK,
  });
  const amtHeader = "Amount";
  page.drawText(amtHeader, {
    x: PAGE_W - MARGIN_X - bold.widthOfTextAtSize(amtHeader, 9),
    y: tableTop,
    size: 9,
    font: bold,
    color: INK,
  });

  // Rows
  let rowY = tableTop - 28;
  if (inv.lineItems.length === 0) {
    page.drawText("No chargeable line items for this period.", {
      x: colDescX,
      y: rowY,
      size: 10,
      font: body,
      color: MUTED,
    });
    rowY -= 18;
  } else {
    for (const li of inv.lineItems) {
      page.drawText(li.label, {
        x: colDescX,
        y: rowY,
        size: 10,
        font: body,
        color: INK,
      });
      page.drawText(String(li.unitCount), {
        x: colQtyX,
        y: rowY,
        size: 10,
        font: body,
        color: INK,
      });
      page.drawText(inr(li.unitPrice), {
        x: colRateX,
        y: rowY,
        size: 10,
        font: body,
        color: INK,
      });
      const amt = inr(li.amount);
      page.drawText(amt, {
        x: PAGE_W - MARGIN_X - body.widthOfTextAtSize(amt, 10),
        y: rowY,
        size: 10,
        font: body,
        color: INK,
      });
      rowY -= 22;
      // Row divider
      page.drawLine({
        start: { x: MARGIN_X - 4, y: rowY + 10 },
        end: { x: PAGE_W - MARGIN_X + 4, y: rowY + 10 },
        thickness: 0.5,
        color: HAIRLINE,
      });
    }
  }

  // ── Totals stack (right-aligned) ────────────────────────────
  const totalsX = 380;
  const totalsRight = PAGE_W - MARGIN_X;
  let ty = rowY - 14;

  const totalRow = (
    label: string,
    value: string,
    opts: { bold?: boolean; size?: number } = {},
  ) => {
    const f = opts.bold ? bold : body;
    const s = opts.size ?? 10;
    page.drawText(label, { x: totalsX, y: ty, size: s, font: f, color: INK });
    page.drawText(value, {
      x: totalsRight - f.widthOfTextAtSize(value, s),
      y: ty,
      size: s,
      font: f,
      color: INK,
    });
    ty -= s * 1.8;
  };

  totalRow("Subtotal", inr(inv.subtotal));
  if (inv.gstPercent > 0 || inv.gstAmount > 0) {
    totalRow(`GST (${inv.gstPercent}%)`, inr(inv.gstAmount));
  }
  // Divider above grand total
  page.drawLine({
    start: { x: totalsX, y: ty + 14 },
    end: { x: totalsRight, y: ty + 14 },
    thickness: 0.8,
    color: HAIRLINE,
  });
  totalRow("Total payable", inr(inv.total), { bold: true, size: 12 });

  // ── Payment footer ──────────────────────────────────────────
  const footerY = 110;
  page.drawLine({
    start: { x: MARGIN_X, y: footerY + 40 },
    end: { x: PAGE_W - MARGIN_X, y: footerY + 40 },
    thickness: 0.6,
    color: HAIRLINE,
  });
  page.drawText("PAYMENT", {
    x: MARGIN_X,
    y: footerY + 22,
    size: 9,
    font: bold,
    color: MUTED,
  });
  const paidLabel = inv.status === "PAID" ? "PAID" : inv.status;
  const badgeW = bold.widthOfTextAtSize(paidLabel, 9) + 16;
  page.drawRectangle({
    x: MARGIN_X + 70,
    y: footerY + 16,
    width: badgeW,
    height: 18,
    color: inv.status === "PAID" ? rgb(0.86, 0.96, 0.86) : rgb(0.99, 0.9, 0.8),
  });
  page.drawText(paidLabel, {
    x: MARGIN_X + 78,
    y: footerY + 21,
    size: 9,
    font: bold,
    color: inv.status === "PAID" ? rgb(0.1, 0.4, 0.15) : rgb(0.55, 0.3, 0.05),
  });

  const paymentMethodLine =
    inv.status === "PAID"
      ? `Paid from Yellow Track wallet${inv.paidAt ? ` on ${formatDate(inv.paidAt)}` : ""}.`
      : "Awaiting wallet top-up.";
  page.drawText(paymentMethodLine, {
    x: MARGIN_X,
    y: footerY,
    size: 9,
    font: body,
    color: INK,
  });
  if (inv.paidFromWalletTxnId) {
    page.drawText(`Wallet transaction ref: ${inv.paidFromWalletTxnId}`, {
      x: MARGIN_X,
      y: footerY - 14,
      size: 8,
      font: body,
      color: MUTED,
    });
  }

  // Disclaimer
  page.drawText(
    "This is a computer-generated invoice and does not require a signature.",
    {
      x: MARGIN_X,
      y: 40,
      size: 8,
      font: body,
      color: MUTED,
    },
  );

  return pdf.save();
}
