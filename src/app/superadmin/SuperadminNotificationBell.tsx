"use client";

import React, { useState, useRef, useEffect } from "react";

/**
 * Placeholder superadmin notification bell. Visual-only for now — the actual
 * platform-level alerts (new tenant signups, suspended-tenant access attempts,
 * usage-limit breaches, …) will be wired here once the alert types are
 * confirmed. Keep the markup matching the fleet-admin NotificationDropdown so
 * the look-and-feel is consistent.
 */
export default function SuperadminNotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  // Close on outside click.
  useEffect(() => {
    if (!isOpen) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [isOpen]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="relative flex items-center justify-center text-gray-500 transition-colors bg-white border border-gray-200 rounded-full hover:text-gray-700 h-11 w-11 hover:bg-gray-100 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800"
        aria-label="Notifications"
      >
        <svg className="fill-current" width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M10.75 2.29175C10.75 1.87753 10.4142 1.54175 10 1.54175C9.58579 1.54175 9.25 1.87753 9.25 2.29175V2.83412C6.08803 3.20733 3.625 5.91424 3.625 9.16675V11.2776C3.625 12.3977 3.20345 13.4783 2.44365 14.3074L1.88497 14.9194C1.58547 15.2472 1.56628 15.7419 1.8396 16.0917C2.11292 16.4414 2.58597 16.5237 2.95846 16.2897L4.12453 15.5579C5.54888 14.6643 7.15992 14.1255 8.8225 13.9852C9.21242 13.9523 9.60379 13.9359 9.99597 13.9359C10.3918 13.9359 10.7868 13.9528 11.1804 13.9866C12.8393 14.1273 14.447 14.6641 15.869 15.5538L17.0374 16.2873C17.4099 16.5218 17.8834 16.4399 18.157 16.0901C18.4307 15.7404 18.4118 15.2454 18.1123 14.9174L17.5528 14.304C16.7942 13.4758 16.3733 12.397 16.3733 11.279V9.16675C16.3733 5.91424 13.9103 3.20733 10.75 2.83412V2.29175ZM10 15.4359C8.44229 15.4359 6.90445 15.7368 5.46667 16.3204C5.89148 17.4609 6.98866 18.2917 8.27297 18.2917H11.727C13.0113 18.2917 14.1085 17.4609 14.5333 16.3204C13.0955 15.7368 11.5577 15.4359 10 15.4359Z"
            fill=""
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900 z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              Platform alerts
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Setup pending
            </span>
          </div>
          <div className="p-6 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
              <svg
                className="w-5 h-5 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.8}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
                />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              No notifications yet
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Platform-level alerts haven&apos;t been configured. Decide which
              events (new signups, limit breaches, suspended tenants, …) should
              ping superadmin and we&apos;ll wire them in.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
