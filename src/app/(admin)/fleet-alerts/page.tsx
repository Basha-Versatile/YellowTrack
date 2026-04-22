"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { notificationAPI } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { NotificationsSkeleton } from "@/components/ui/Skeleton";
import Pagination, { useClientPagination } from "@/components/ui/Pagination";
import { FileText, Truck, Users, CreditCard, AlertTriangle, Check, Info, Bell, Wrench, Wallet, ChevronRight, type LucideIcon } from "lucide-react";
import { getNotificationHref } from "@/lib/notification-link";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  entityId: string | null;
  isRead: boolean;
  createdAt: string;
}

const TYPE_CONFIG: Record<string, { Icon: LucideIcon; color: string; bg: string }> = {
  DOCUMENT_EXPIRY: { Icon: FileText, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-500/10" },
  VEHICLE_DOC_EXPIRY: { Icon: Truck, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-500/10" },
  DRIVER_DOC_EXPIRY: { Icon: Users, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-500/10" },
  LICENSE_EXPIRY: { Icon: CreditCard, color: "text-red-500", bg: "bg-red-50 dark:bg-red-500/10" },
  CHALLAN_NEW: { Icon: AlertTriangle, color: "text-red-500", bg: "bg-red-50 dark:bg-red-500/10" },
  CHALLAN_PAID: { Icon: Check, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-500/10" },
  SERVICE_DUE: { Icon: Wrench, color: "text-yellow-500", bg: "bg-yellow-50 dark:bg-yellow-500/10" },
  FASTAG_LOW_BALANCE: { Icon: Wallet, color: "text-orange-500", bg: "bg-orange-50 dark:bg-orange-500/10" },
  SYSTEM: { Icon: Info, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-500/10" },
};

export default function NotificationsPage() {
  const router = useRouter();
  const toast = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const fetchNotifications = async () => {
    try {
      const res = await notificationAPI.getAll({ limit: 100 });
      setNotifications(res.data.data.notifications || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchNotifications(); }, []);

  const handleMarkRead = async (id: string) => {
    try {
      await notificationAPI.markAsRead(id);
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
    } catch { }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationAPI.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      toast.success("All Marked Read");
    } catch { }
  };

  const handleNavigate = (n: Notification) => {
    const href = getNotificationHref(n);
    if (!n.isRead) {
      notificationAPI.markAsRead(n.id).catch(() => undefined);
      setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, isRead: true } : x));
    }
    if (href) router.push(href);
  };

  const filtered = filter === "unread" ? notifications.filter((n) => !n.isRead) : notifications;
  const { page, setPage, perPage, setPerPage, totalPages, totalItems, paginatedItems } = useClientPagination(filtered, 15);
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  if (loading) return <NotificationsSkeleton />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Notifications</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}` : "All caught up!"}
          </p>
        </div>
        {unreadCount > 0 && (
          <button onClick={handleMarkAllRead}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 transition-all">
            <Check className="w-4 h-4" />
            Mark All Read
          </button>
        )}
      </div>

      {/* Filter */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800/50 rounded-xl w-fit">
        <button onClick={() => setFilter("all")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all ${filter === "all" ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white" : "text-gray-500"}`}>
          All <span className="text-xs text-gray-400 ml-1">{notifications.length}</span>
        </button>
        <button onClick={() => setFilter("unread")}
          className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${filter === "unread" ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white" : "text-gray-500"}`}>
          <span className="w-2 h-2 rounded-full bg-yellow-500" />
          Unread <span className="text-xs text-gray-400 ml-1">{unreadCount}</span>
        </button>
      </div>

      {/* Notifications List */}
      {totalItems === 0 ? (
        <div className="rounded-2xl border border-gray-200/80 bg-white p-12 text-center dark:border-gray-800 dark:bg-white/[0.02]">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
            <Bell className="w-7 h-7 text-gray-400" />
          </div>
          <p className="text-sm text-gray-500">{filter === "unread" ? "No unread notifications" : "No notifications yet"}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {paginatedItems.map((n) => {
            const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.SYSTEM;
            const timeAgo = getTimeAgo(n.createdAt);
            return (
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
                className={`flex items-start gap-4 p-4 rounded-xl border cursor-pointer transition-all ${
                  n.isRead
                    ? "border-gray-100 bg-white hover:bg-gray-50 dark:border-gray-800 dark:bg-white/[0.01] dark:hover:bg-white/[0.04]"
                    : "border-yellow-200 bg-yellow-50/30 hover:bg-yellow-50 dark:border-yellow-500/20 dark:bg-yellow-500/5 dark:hover:bg-yellow-500/10"
                }`}
              >
                {/* Icon */}
                <div className={`w-10 h-10 rounded-xl ${cfg.bg} flex items-center justify-center flex-shrink-0`}>
                  <cfg.Icon className={`w-5 h-5 ${cfg.color}`} strokeWidth={1.5} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm ${n.isRead ? "text-gray-700 dark:text-gray-300" : "font-semibold text-gray-900 dark:text-white"}`}>{n.title}</p>
                    {!n.isRead && <span className="w-2 h-2 rounded-full bg-yellow-500 flex-shrink-0" />}
                  </div>
                  {n.message && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{n.message}</p>}
                  <p className="text-[10px] text-gray-400 mt-1">{timeAgo}</p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {!n.isRead && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleMarkRead(n.id); }}
                      title="Mark as read"
                      className="w-7 h-7 rounded-lg bg-yellow-500 hover:bg-yellow-600 flex items-center justify-center transition-colors"
                    >
                      <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                    </button>
                  )}
                  <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Pagination currentPage={page} totalPages={totalPages} totalItems={totalItems} itemsPerPage={perPage} onPageChange={setPage} onItemsPerPageChange={setPerPage} itemLabel="notifications" />
    </div>
  );
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
