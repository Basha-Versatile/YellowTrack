import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { bundleCustomSharePdf } from "@/server/services/customComplianceShare.service";
import { getRequestOrigin } from "@/lib/request-origin";
import { AppError } from "@/lib/errors";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ token: string }> },
) {
  try {
    await dbConnect();
    const { token } = await ctx.params;
    const origin = getRequestOrigin(req);
    const { bytes, filename } = await bundleCustomSharePdf(token, origin);
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
    console.error("[custom-share/pdf]", err);
    return NextResponse.json(
      { success: false, message: "Could not build PDF" },
      { status: 500 },
    );
  }
}
