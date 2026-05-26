import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { assertCronAuthorized } from "@/lib/cron/guard";
import { AppError } from "@/lib/errors";
import { Tenant, User } from "@/models";
import { dispatchSubscriptionExpiring } from "@/server/services/alertDispatcher.service";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Daily reminder: emails tenants whose subscription expires in the next
 * 30 days (currently fires at 30 / 7 / 1 day milestones, plus the final
 * 24-hr window). The separate `subscription-expiry` cron handles actually
 * flipping expired ones to EXPIRED — this cron is purely a reminder.
 */
export async function GET(req: NextRequest) {
  try {
    assertCronAuthorized(req);
    await dbConnect();

    const now = new Date();
    const cutoff30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const tenants = await Tenant.find({
      status: "ACTIVE",
      subscriptionStatus: "ACTIVE",
      subscriptionEnd: { $gte: now, $lte: cutoff30 },
    }).lean();

    const baseUrl = process.env.FRONTEND_URL ?? "http://localhost:3000";
    let reminded = 0;

    for (const t of tenants) {
      const end = t.subscriptionEnd as Date | undefined;
      if (!end) continue;
      const days = Math.ceil((new Date(end).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      // Send a reminder only on the milestone days — avoids spamming admins daily.
      if (![30, 14, 7, 3, 1, 0].includes(days)) continue;

      // Resolve owner email: prefer User.ownerUserId, fall back to billingEmail
      let ownerEmail: string | undefined;
      if (t.ownerUserId) {
        const owner = await User.findById(t.ownerUserId).select("email").lean();
        ownerEmail = (owner as { email?: string } | null)?.email;
      }
      ownerEmail = ownerEmail ?? (t.billingEmail as string | undefined);
      if (!ownerEmail) continue;

      try {
        await dispatchSubscriptionExpiring({
          tenantId: String(t._id),
          ownerEmail,
          tenantName: t.name as string,
          daysRemaining: days,
          expiryDate: end,
          appBaseUrl: baseUrl,
        });
        reminded++;
      } catch (err) {
        console.error(
          `[CRON_SUBSCRIPTION_REMINDER] tenant ${String(t._id)} failed:`,
          err instanceof Error ? err.message : err,
        );
      }
    }

    console.log(`   ✅ Sent ${reminded} subscription-expiring reminder(s)`);
    return NextResponse.json({ success: true, data: { reminded } });
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(
        { success: false, message: err.message },
        { status: err.statusCode },
      );
    }
    console.error("[CRON_SUBSCRIPTION_REMINDER_ERROR]", err);
    return NextResponse.json(
      { success: false, message: "Cron failed" },
      { status: 500 },
    );
  }
}
