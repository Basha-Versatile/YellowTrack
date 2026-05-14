import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { assertCronAuthorized } from "@/lib/cron/guard";
import { AppError } from "@/lib/errors";
import { expireOverdueSubscriptions } from "@/server/services/tenant.service";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    assertCronAuthorized(req);
    await dbConnect();
    console.log("\n⏰ [CRON] Running subscription expiry check...");
    const result = await expireOverdueSubscriptions();
    console.log(`   ✅ Expired ${result.expired} subscription${result.expired !== 1 ? "s" : ""}`);
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(
        { success: false, message: err.message },
        { status: err.statusCode },
      );
    }
    console.error("[CRON_SUBSCRIPTION_EXPIRY_ERROR]", err);
    return NextResponse.json(
      { success: false, message: "Cron failed" },
      { status: 500 },
    );
  }
}
