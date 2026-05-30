import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { bundleSharePdf } from "@/server/services/documentShare.service";
import { getRequestOrigin } from "@/lib/request-origin";
import { AppError } from "@/lib/errors";

export const runtime = "nodejs";

/**
 * Public PDF download — no auth, gated only by the share token. Streams a
 * single merged PDF of every selected document in the share.
 *
 * Uses raw NextResponse (rather than withRoute) because the body is a binary
 * stream, not the standard JSON wrapper.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ token: string }> },
) {
  try {
    await dbConnect();
    const { token } = await ctx.params;
    const origin = getRequestOrigin(req);
    const { bytes, filename } = await bundleSharePdf(token, origin);
    return new NextResponse(bytes as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(
        { success: false, message: err.message },
        { status: err.statusCode },
      );
    }
    console.error("[share/pdf]", err);
    return NextResponse.json(
      { success: false, message: "Could not build PDF" },
      { status: 500 },
    );
  }
}
