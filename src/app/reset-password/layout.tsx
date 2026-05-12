import React from "react";
import { redirect } from "next/navigation";
import { getSessionFromCookie } from "@/lib/auth/session";

export default async function ResetPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionFromCookie();
  if (!session) redirect("/signin");

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-6">
      {children}
    </div>
  );
}
