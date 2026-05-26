"use client";
import React, { useEffect, useState } from "react";
import { notificationAPI } from "@/lib/api";
import { Mail, MessageCircle, Send, CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";
import { useToast } from "@/context/ToastContext";

type LogRow = {
  _id?: string | { $oid?: string };
  type: string;
  channel: "email" | "whatsapp";
  to: string;
  subject?: string;
  status: "sent" | "failed" | "skipped";
  providerMessageId?: string;
  error?: string;
  createdAt: string;
};

function rowKey(row: LogRow, idx: number): string {
  // Mongoose ObjectIds can come through as either "abc..." or { $oid: "abc..." }
  // depending on the serializer in play. Be lenient.
  if (typeof row._id === "string") return row._id;
  if (row._id && typeof row._id === "object" && "$oid" in row._id && row._id.$oid) {
    return row._id.$oid;
  }
  return `log-${idx}-${row.createdAt ?? ""}`;
}

export default function NotificationsSettingsPage() {
  const toast = useToast();
  const [emailRecipient, setEmailRecipient] = useState("");
  const [whatsappRecipient, setWhatsappRecipient] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  const fetchLogs = async () => {
    try {
      setLoadingLogs(true);
      const r = await notificationAPI.getDeliveryLog(50);
      setLogs(r.data.data ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const sendTestEmail = async () => {
    setSendingEmail(true);
    try {
      const r = await notificationAPI.sendTest("email", emailRecipient || undefined);
      const data = r.data.data;
      if (data?.sent) {
        toast.success("Test email sent", `Delivered to ${data.to}. Check your inbox.`);
      } else {
        toast.error("Test failed", data?.error ?? "Could not send test email");
      }
      fetchLogs();
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error("Test failed", e.response?.data?.message ?? "Could not send test email");
    } finally {
      setSendingEmail(false);
    }
  };

  const sendTestWhatsApp = async () => {
    setSendingWhatsApp(true);
    try {
      const r = await notificationAPI.sendTest("whatsapp", whatsappRecipient || undefined);
      const data = r.data.data;
      if (data?.sent) {
        toast.success("Test WhatsApp sent", `Delivered to ${data.to}.`);
      } else {
        toast.info("WhatsApp not configured", data?.error ?? "ChatBox API credentials not wired yet.");
      }
      fetchLogs();
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error("Test failed", e.response?.data?.message ?? "Could not send test WhatsApp");
    } finally {
      setSendingWhatsApp(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Notifications</h1>
        <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">
          Email + WhatsApp delivery for compliance, EMI, sale invoices, and more
        </p>
      </div>

      {/* Send-test cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Email card */}
        <div className="rounded-xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
                <Mail className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white leading-tight">Email (Gmail SMTP)</h3>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">Sends from hello@theyellowtrack.com</p>
              </div>
            </div>
            <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-600 dark:text-emerald-400">Active</span>
          </div>
          <div className="p-4 space-y-3">
            <label className="block">
              <span className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                Send test to
              </span>
              <input
                type="email"
                value={emailRecipient}
                onChange={(e) => setEmailRecipient(e.target.value)}
                placeholder="leave blank to use NOTIFICATION_TEST_EMAIL env"
                className="w-full h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-400 focus:outline-none focus:ring-3 focus:ring-brand-400/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </label>
            <button
              onClick={sendTestEmail}
              disabled={sendingEmail}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-4 py-2 text-xs font-bold text-white transition-colors"
            >
              {sendingEmail ? "Sending…" : <><Send className="w-3.5 h-3.5" /> Send test email</>}
            </button>
          </div>
        </div>

        {/* WhatsApp card */}
        <div className="rounded-xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
                <MessageCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white leading-tight">WhatsApp (ChatBox.biz)</h3>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">Waiting on provider credentials</p>
              </div>
            </div>
            <span className="text-[10px] uppercase tracking-wider font-bold text-amber-600 dark:text-amber-400">Pending</span>
          </div>
          <div className="p-4 space-y-3">
            <label className="block">
              <span className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                Send test to
              </span>
              <input
                type="tel"
                value={whatsappRecipient}
                onChange={(e) => setWhatsappRecipient(e.target.value)}
                placeholder="+91xxxxxxxxxx"
                className="w-full h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-400 focus:outline-none focus:ring-3 focus:ring-brand-400/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </label>
            <button
              onClick={sendTestWhatsApp}
              disabled={sendingWhatsApp}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 px-4 py-2 text-xs font-bold text-white transition-colors"
            >
              {sendingWhatsApp ? "Sending…" : <><Send className="w-3.5 h-3.5" /> Send test WhatsApp</>}
            </button>
            <p className="text-[10px] text-gray-400">
              WhatsApp adapter goes live as soon as ChatBox API key is added.
            </p>
          </div>
        </div>
      </div>

      {/* Delivery log */}
      <div className="rounded-xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">Recent deliveries</h3>
          <button
            onClick={fetchLogs}
            disabled={loadingLogs}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${loadingLogs ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
        {logs.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {loadingLogs ? "Loading…" : "No deliveries yet — send a test to populate this log."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50/50 dark:bg-gray-800/30 text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="text-left font-semibold px-4 py-2.5">When</th>
                  <th className="text-left font-semibold px-4 py-2.5">Channel</th>
                  <th className="text-left font-semibold px-4 py-2.5">Type</th>
                  <th className="text-left font-semibold px-4 py-2.5">To</th>
                  <th className="text-left font-semibold px-4 py-2.5">Subject</th>
                  <th className="text-left font-semibold px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {logs.map((row, idx) => (
                  <tr key={rowKey(row, idx)} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                    <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {new Date(row.createdAt).toLocaleString("en-IN", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-2.5">
                      {row.channel === "email" ? (
                        <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-semibold">
                          <Mail className="w-3 h-3" /> Email
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                          <MessageCircle className="w-3 h-3" /> WhatsApp
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[10px] text-gray-600 dark:text-gray-300">{row.type}</td>
                    <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300 truncate max-w-[200px]" title={row.to}>{row.to}</td>
                    <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300 truncate max-w-[260px]" title={row.subject}>{row.subject ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      {row.status === "sent" ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                          <CheckCircle2 className="w-3 h-3" /> Sent
                        </span>
                      ) : row.status === "failed" ? (
                        <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 font-bold" title={row.error}>
                          <AlertTriangle className="w-3 h-3" /> Failed
                        </span>
                      ) : (
                        <span className="text-gray-400 font-bold">Skipped</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
