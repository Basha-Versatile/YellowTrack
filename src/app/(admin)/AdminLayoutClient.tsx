"use client";

import { useSidebar } from "@/context/SidebarContext";
import AppHeader from "@/layout/AppHeader";
import AppSidebar from "@/layout/AppSidebar";
import Backdrop from "@/layout/Backdrop";
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
        return "p-4 mx-auto max-w-(--breakpoint-2xl) md:p-6";
    }
  };

  const mainContentMargin = isMobileOpen
    ? "ml-0"
    : isExpanded || isHovered
    ? "xl:ml-[280px]"
    : "xl:ml-[80px]";

  return (
    <div className="min-h-screen xl:flex">
      <AppSidebar />
      <Backdrop />
      <div
        className={`flex-1 min-w-0 overflow-x-clip transition-all duration-300 ease-in-out ${mainContentMargin}`}
      >
        <AppHeader />
        <div className={getRouteSpecificStyles()}>{children}</div>
      </div>
    </div>
  );
}
