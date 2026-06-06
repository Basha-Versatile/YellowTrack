import { NextResponse } from "next/server";
import { withRoute } from "@/lib/api-handler";
import { tenantOf } from "@/lib/auth/tenant-context";
import { UnauthorizedError } from "@/lib/errors";
import { getInvoiceDetail } from "@/server/services/invoice.service";
import { renderInvoicePdf } from "@/server/services/invoice.pdf";

export const runtime = "nodejs";

export const GET = withRoute<{ id: string }>(
  async ({ session, params }) => {
    if (!session) throw new UnauthorizedError();
    const ctx = tenantOf(session);
    const invoice = await getInvoiceDetail(ctx.tenantId, params.id);
    const pdfBytes = await renderInvoicePdf(invoice);

    const safeNumber = invoice.invoiceNumber.replace(/[^A-Za-z0-9_-]/g, "_");
    return new NextResponse(new Uint8Array(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeNumber}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  },
  { auth: true },
);
