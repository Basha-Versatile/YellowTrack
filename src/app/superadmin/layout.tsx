import React from "react";
import { redirect } from "next/navigation";
import { getSessionFromCookie } from "@/lib/auth/session";
import SuperadminLayoutClient from "./SuperadminLayoutClient";

export default async function SuperadminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionFromCookie();
  if (!session) redirect("/signin");
  if (session.role !== "SUPERADMIN") redirect("/");

  return <SuperadminLayoutClient>{children}</SuperadminLayoutClient>;
}
