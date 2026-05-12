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

  // Block access if tenant is suspended/deleted.
  if (session.tenantId) {
    const tenant = await Tenant.findById(session.tenantId).select("status").lean();
    if (!tenant || tenant.status === "DELETED") redirect("/signin");
    if (tenant.status === "SUSPENDED") redirect("/account-suspended");
  }

  return <AdminLayoutClient>{children}</AdminLayoutClient>;
}
