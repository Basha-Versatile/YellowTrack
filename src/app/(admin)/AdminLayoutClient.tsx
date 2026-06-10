"use client";

import { useSidebar } from "@/context/SidebarContext";
import AppHeader from "@/layout/AppHeader";
import AppSidebar from "@/layout/AppSidebar";
import Backdrop from "@/layout/Backdrop";
import { UpgradeConfirmationModal } from "@/components/billing/UpgradeConfirmationModal";
import React from "react";
import { usePathname } from "next/navigation";

export default function AdminLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();
  const pathname = usePathname();

  const getRouteSpecificStyles = () => {
    switch (pathname) {
      case "/text-generator":
      case "/code-generator":
      case "/image-generator":
      case "/video-generator":
        return "";
      default:
        return "p-3 sm:p-4 md:p-6 mx-auto max-w-screen-2xl w-full";
    }
  };

  const mainContentMargin = isMobileOpen
    ? "ml-0"
    : isExpanded || isHovered
    ? "lg:ml-[320px]"
    : "lg:ml-[80px]";

  return (
    <div className="min-h-screen lg:flex">
      <AppSidebar />
      <Backdrop />
      <div
        className={`flex-1 min-w-0 overflow-x-clip transition-all duration-300 ease-in-out ${mainContentMargin}`}
      >
        <AppHeader />
        <div className={getRouteSpecificStyles()}>{children}</div>
      </div>
      {/* Auto-pops when an open plan-upgrade request is in BillingContext.
          Admins get the confirm/reject dialog; non-admin users see the
          persistent header banner instead. */}
      <UpgradeConfirmationModal />
    </div>
  );
}
