"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useState, useEffect, useCallback } from "react";
import { notificationAPI } from "@/lib/api";
import { Dropdown } from "../ui/dropdown/Dropdown";
import { getNotificationHref } from "@/lib/notification-link";

interface NotifItem {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  entityId: string | null;
}

export default function NotificationDropdown() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotifItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchCount = useCallback(async () => {
    try {
      const res = await notificationAPI.getUnreadCount();
      setUnreadCount(res.data.data.count || 0);
    } catch { }
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await notificationAPI.getAll({ limit: 5 });
      setNotifications(res.data.data.notifications || []);
    } catch { }
  }, []);

  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 30000); // poll every 30s
    return () => clearInterval(interval);
  }, [fetchCount]);

  const handleOpen = () => {
    setIsOpen(!isOpen);
    if (!isOpen) fetchNotifications();
  };

  const handleMarkRead = async (id: string) => {
    try {
      await notificationAPI.markAsRead(id);
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch { }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationAPI.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch { }
  };

  const handleNavigate = async (n: NotifItem) => {
    const href = getNotificationHref(n);
    setIsOpen(false);
    if (!n.isRead) {
      // fire-and-forget — don't block navigation on the read write
      notificationAPI.markAsRead(n.id).catch(() => undefined);
      setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, isRead: true } : x));
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    if (href) router.push(href);
  };

  return (
    <div className="relative">
      <button
        onClick={handleOpen}
        className="relative flex items-center justify-center text-gray-500 transition-colors bg-white border border-gray-200 rounded-full hover:text-gray-700 h-11 w-11 hover:bg-gray-100 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800"
      >
        <svg className="fill-current" width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path fillRule="evenodd" clipRule="evenodd" d="M10.75 2.29175C10.75 1.87753 10.4142 1.54175 10 1.54175C9.58579 1.54175 9.25 1.87753 9.25 2.29175V2.83412C6.08803 3.20733 3.625 5.91424 3.625 9.16675V11.2776C3.625 12.3977 3.20345 13.4783 2.44365 14.3074L1.88497 14.9194C1.58547 15.2472 1.56628 15.7419 1.8396 16.0917C2.11292 16.4414 2.58597 16.5237 2.95846 16.2897L4.12453 15.5579C5.54888 14.6643 7.15992 14.1255 8.8225 13.9852C9.21242 13.9523 9.60379 13.9359 9.99597 13.9359C10.3918 13.9359 10.7868 13.9528 11.1804 13.9866C12.8393 14.1273 14.447 14.6641 15.869 15.5538L17.0374 16.2873C17.4099 16.5218 17.8834 16.4399 18.157 16.0901C18.4307 15.7404 18.4118 15.2454 18.1123 14.9174L17.5528 14.304C16.7942 13.4758 16.3733 12.397 16.3733 11.279V9.16675C16.3733 5.91424 13.9103 3.20733 10.75 2.83412V2.29175ZM10 15.4359C8.44229 15.4359 6.90445 15.7368 5.46667 16.3204C5.89148 17.4609 6.98866 18.2917 8.27297 18.2917H11.727C13.0113 18.2917 14.1085 17.4609 14.5333 16.3204C13.0955 15.7368 11.5577 15.4359 10 15.4359Z" fill="" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-[9px] font-bold shadow-sm">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      <Dropdown
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        className="absolute -right-[100px] mt-[17px] flex w-[340px] flex-col rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900 sm:w-[380px] sm:-right-4"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-800">
          <h5 className="text-sm font-semibold text-gray-900 dark:text-white">Notifications</h5>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button onClick={handleMarkAllRead} className="text-[11px] font-medium text-brand-500 hover:text-brand-600">
                Mark all read
              </button>
            )}
          </div>
        </div>

        {/* List */}
        <div className="max-h-[360px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-8 text-center">
              <svg className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" /></svg>
              <p className="text-xs text-gray-400">No notifications</p>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                role="button"
                tabIndex={0}
                onClick={() => handleNavigate(n)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleNavigate(n);
                  }
                }}
                className={`flex items-start gap-3 px-5 py-3 border-b border-gray-50 dark:border-gray-800/50 last:border-0 cursor-pointer transition-colors ${!n.isRead ? "bg-yellow-50/50 dark:bg-yellow-500/5 hover:bg-yellow-50 dark:hover:bg-yellow-500/10" : "hover:bg-gray-50 dark:hover:bg-white/5"}`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${getNotifStyle(n.type).bg}`}>
                  <svg className={`w-4 h-4 ${getNotifStyle(n.type).icon}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d={getNotifStyle(n.type).path} /></svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs ${!n.isRead ? "font-semibold text-gray-900 dark:text-white" : "text-gray-700 dark:text-gray-300"} line-clamp-1`}>{n.title}</p>
                  <p className="text-[10px] text-gray-400 line-clamp-1 mt-0.5">{n.message}</p>
                  <p className="text-[9px] text-gray-300 dark:text-gray-600 mt-1">{getTimeAgo(n.createdAt)}</p>
                </div>
                {!n.isRead && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleMarkRead(n.id); }}
                    title="Mark as read"
                    className="w-6 h-6 rounded-full bg-yellow-500 hover:bg-yellow-600 flex items-center justify-center flex-shrink-0 mt-1 transition-colors"
                  >
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800">
          <Link href="/fleet-alerts" onClick={() => setIsOpen(false)}
            className="flex items-center justify-center text-xs font-semibold text-brand-500 hover:text-brand-600 transition-colors">
            View All Notifications
          </Link>
        </div>
      </Dropdown>
    </div>
  );
}

function getNotifStyle(type: string) {
  if (type === "SERVICE_DUE") {
    return {
      bg: "bg-yellow-100 dark:bg-yellow-500/20",
      icon: "text-yellow-600 dark:text-yellow-400",
      path: "M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.049.58.025 1.194-.14 1.743",
    };
  }
  if (type === "FASTAG_LOW_BALANCE") {
    return {
      bg: "bg-orange-100 dark:bg-orange-500/20",
      icon: "text-orange-600 dark:text-orange-400",
      path: "M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z",
    };
  }
  if (type === "CHALLAN_PAID") {
    return {
      bg: "bg-emerald-100 dark:bg-emerald-500/20",
      icon: "text-emerald-600 dark:text-emerald-400",
      path: "M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
    };
  }
  if (type.includes("EXPIRY")) {
    return {
      bg: "bg-red-100 dark:bg-red-500/20",
      icon: "text-red-600 dark:text-red-400",
      path: "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z",
    };
  }
  return {
    bg: "bg-gray-100 dark:bg-gray-800",
    icon: "text-gray-500",
    path: "M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z",
  };
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
