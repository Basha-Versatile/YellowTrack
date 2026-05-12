"use client";

import React from "react";
import { useSidebar } from "@/context/SidebarContext";
import Backdrop from "@/layout/Backdrop";
import SuperadminSidebar from "./SuperadminSidebar";
import SuperadminHeader from "./SuperadminHeader";

export default function SuperadminLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();

  const mainContentMargin = isMobileOpen
    ? "ml-0"
    : isExpanded || isHovered
      ? "xl:ml-[280px]"
      : "xl:ml-[80px]";

  return (
    <div className="min-h-screen xl:flex">
      <SuperadminSidebar />
      <Backdrop />
      <div
        className={`flex-1 min-w-0 overflow-x-clip transition-all duration-300 ease-in-out ${mainContentMargin}`}
      >
        <SuperadminHeader />
        <div className="p-4 mx-auto max-w-(--breakpoint-2xl) md:p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
