"use client";
import React from "react";
import { AuthProvider } from "@/context/AuthContext";
import { BillingProvider } from "@/context/BillingContext";
import { SidebarProvider } from "@/context/SidebarContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { ToastProvider } from "@/context/ToastContext";
import { ReduxProvider } from "@/store/provider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ReduxProvider>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            {/* Billing context fetches the wallet + plan overview once per
                tenant session and shares it with the header badge, /billing
                page, and the upgrade-confirmation modal. */}
            <BillingProvider>
              <SidebarProvider>{children}</SidebarProvider>
            </BillingProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </ReduxProvider>
  );
}
