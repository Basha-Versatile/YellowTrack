import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { assertCronAuthorized } from "@/lib/cron/guard";
import { AppError } from "@/lib/errors";
import { checkExpiring } from "@/server/services/insurance.service";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    assertCronAuthorized(req);
    await dbConnect();
    console.log("\n⏰ [CRON] Running insurance expiry check...");
    const result = await checkExpiring();
    console.log(
      `   ✅ Insurance: ${result.updated} status updates, ${result.alerts} alerts`,
    );
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(
        { success: false, message: err.message },
        { status: err.statusCode },
      );
    }
    console.error("[CRON_INSURANCE_ERROR]", err);
    return NextResponse.json(
      { success: false, message: "Cron failed" },
      { status: 500 },
    );
  }
}
