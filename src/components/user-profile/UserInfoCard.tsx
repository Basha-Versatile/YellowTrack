"use client";
import React from "react";
import { useAuth } from "@/context/AuthContext";

function roleLabel(role?: string): string {
  if (!role) return "—";
  if (role === "SUPERADMIN") return "Superadmin";
  if (role === "ADMIN") return "Admin";
  if (role === "OPERATOR") return "Operator";
  return role;
}

export default function UserInfoCard() {
  const { user, tenant } = useAuth();

  const fields: { label: string; value: string | null | undefined }[] = [
    { label: "Full name", value: user?.name },
    { label: "Email address", value: user?.email },
    { label: "Role", value: roleLabel(user?.role) },
    {
      label: user?.role === "SUPERADMIN" ? "Scope" : "Workspace",
      value: tenant?.name ?? (user?.role === "SUPERADMIN" ? "Platform-wide" : "—"),
    },
    {
      label: "Billing email",
      value: tenant?.billingEmail ?? null,
    },
  ];

  return (
    <div className="p-5 border border-gray-200 rounded-2xl dark:border-gray-800 lg:p-6">
      <div className="flex flex-col gap-6">
        <h4 className="text-lg font-semibold text-gray-800 dark:text-white/90">
          Account Information
        </h4>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:gap-7 2xl:gap-x-32">
          {fields.map((f) => (
            <div key={f.label}>
              <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
                {f.label}
              </p>
              <p className="text-sm font-medium text-gray-800 dark:text-white/90 break-words">
                {f.value && String(f.value).trim() ? f.value : "—"}
              </p>
            </div>
          ))}
        </div>

        <p className="text-[11px] text-gray-400 dark:text-gray-500">
          Edit your name and picture from the Profile card above. To change your
          password, use <span className="font-semibold">Forgot password</span> on the sign-in page.
        </p>
      </div>
    </div>
  );
}
