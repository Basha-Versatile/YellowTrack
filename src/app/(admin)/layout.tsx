import React from "react";
import { redirect } from "next/navigation";
import { getSessionFromCookie } from "@/lib/auth/session";
import { dbConnect } from "@/lib/db";
import { Tenant, User } from "@/models";
import AdminLayoutClient from "./AdminLayoutClient";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionFromCookie();

  if (!session) redirect("/signin");
  if (session.role === "SUPERADMIN") redirect("/superadmin");
  if (session.role !== "ADMIN" && session.role !== "OPERATOR") {
    redirect("/signin");
  }

  await dbConnect();

  // Read user state — block suspended accounts and force password reset.
  const user = await User.findById(session.id)
    .select("mustResetPassword status")
    .lean();
  if (!user || user.status === "SUSPENDED") redirect("/account-suspended");
  if (user.mustResetPassword) redirect("/reset-password");

  // Block access if tenant is suspended/deleted or subscription expired.
  if (session.tenantId) {
    let tenant = await Tenant.findById(session.tenantId)
      .select("status subscriptionStatus subscriptionEnd planId")
      .lean();
    if (!tenant || tenant.status === "DELETED") redirect("/signin");
    if (tenant.status === "SUSPENDED") redirect("/account-suspended");

    // On-demand subscription reconciliation. If the tenant's subscriptionEnd
    // has just passed and they have a queued plan, auto-activate it here so
    // users don't have to wait for the daily cron. If no queued plan, mark
    // EXPIRED and bounce to the expiry page.
    const subEnd = tenant.subscriptionEnd as Date | string | undefined;
    const subStatus = tenant.subscriptionStatus as string | undefined;
    const overdue =
      subEnd && new Date(subEnd).getTime() < Date.now() &&
      (subStatus === "ACTIVE" || subStatus === "TRIAL");
    if (overdue) {
      const { reconcileTenantSubscription } = await import(
        "@/server/services/tenant.service"
      );
      const reconciled = await reconcileTenantSubscription(
        String(session.tenantId),
      );
      tenant = reconciled as typeof tenant;
    }

    const finalStatus = (tenant as { subscriptionStatus?: string } | null)
      ?.subscriptionStatus;
    if (finalStatus === "EXPIRED" || finalStatus === "CANCELLED") {
      redirect("/subscription-expired");
    }
  }

  return <AdminLayoutClient>{children}</AdminLayoutClient>;
}
