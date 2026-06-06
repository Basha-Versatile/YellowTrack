import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { assertCronAuthorized } from "@/lib/cron/guard";
import { AppError } from "@/lib/errors";
import { runBillingCron } from "@/server/services/billing.orchestrator";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Daily billing tick:
 *   - First day of each month: every tenant's wallet gets debited the
 *     computed monthly bill.
 *   - Every day: expire stale upgrade requests, re-evaluate plan fit per
 *     tenant, escalate PAYMENT_DUE → SUSPENDED after 30 days.
 *
 * Idempotent: re-running on the same day is safe — sameMonth check on
 * lastBilledAt short-circuits the debit, and upgrade requests are
 * deduped by (tenantId, status=PENDING).
 *
 * Schedule via vercel.json:
 *   { "crons": [{ "path": "/api/cron/billing", "schedule": "0 2 * * *" }] }
 */
export async function GET(req: NextRequest) {
  try {
    assertCronAuthorized(req);
    await dbConnect();
    console.log("\n⏰ [CRON] Running billing tick…");
    const result = await runBillingCron();
    console.log(
      `   ✅ debited ${result.debitedCount}/${result.tenantCount} tenants (₹${result.debitedTotal}), suspended ${result.suspended}, auto-upgraded ${result.upgradedAuto}, queued ${result.upgradeQueued} upgrade(s)`,
    );
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(
        { success: false, message: err.message },
        { status: err.statusCode },
      );
    }
    console.error("[CRON_BILLING_ERROR]", err);
    return NextResponse.json(
      { success: false, message: "Cron failed" },
      { status: 500 },
    );
  }
}
