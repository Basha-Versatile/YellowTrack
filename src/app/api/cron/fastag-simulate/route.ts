import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { assertCronAuthorized } from "@/lib/cron/guard";
import { AppError } from "@/lib/errors";
import { simulateTollDeductions } from "@/server/services/fastag.service";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    assertCronAuthorized(req);
    await dbConnect();
    console.log("\n⏰ [CRON] Running FASTag toll simulation...");
    const result = await simulateTollDeductions();
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(
        { success: false, message: err.message },
        { status: err.statusCode },
      );
    }
    console.error("[CRON_FASTAG_ERROR]", err);
    return NextResponse.json(
      { success: false, message: "Cron failed" },
      { status: 500 },
    );
  }
}
