"use client";
import React, { useEffect, useMemo, useState } from "react";
import { activityLogAPI } from "@/lib/api";
import { SearchInput } from "@/components/ui/SearchInput";
import {
  Activity,
  ChevronDown,
  ChevronRight,
  Clock,
  User,
  Filter,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
} from "lucide-react";

type FieldDiff = { field: string; before: unknown; after: unknown };

type LogRow = {
  // Response normaliser converts Mongoose `_id` to `id`, so the row identifier
  // is `id`. Keep `_id` typed as a fallback for safety in case the shape ever
  // shifts.
  id: string;
  _id?: string;
  createdAt: string;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  userRole: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  entityLabel: string | null;
  summary: string;
  fields: FieldDiff[];
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
};

type Actor = { userId: string; userName: string | null; userEmail: string | null };

const ENTITY_TYPES: Array<{ value: string; label: string }> = [
  { value: "", label: "All entities" },
  { value: "auth", label: "Auth" },
  { value: "vehicle", label: "Vehicle" },
  { value: "vehicle_sale", label: "Vehicle Sale" },
  { value: "driver", label: "Driver" },
  { value: "compliance", label: "Compliance" },
  { value: "user", label: "User" },
  { value: "role", label: "Role" },
  { value: "emi", label: "EMI" },
  { value: "expense", label: "Expense" },
  { value: "document_type", label: "Document Type" },
  { value: "vehicle_group", label: "Vehicle Group" },
];

const ENTITY_TINT: Record<string, string> = {
  auth: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
  vehicle: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  vehicle_sale: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  driver: "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400",
  compliance: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  user: "bg-cyan-50 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-400",
  role: "bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400",
  emi: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400",
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export default function ActivityLogPage() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [actors, setActors] = useState<Actor[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [userId, setUserId] = useState("");
  const [entityType, setEntityType] = useState("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    activityLogAPI
      .list({
        page,
        limit,
        userId: userId || undefined,
        entityType: entityType || undefined,
        search: search || undefined,
        from: from || undefined,
        to: to || undefined,
      })
      .then((res) => {
        if (cancelled) return;
        const data = (res.data as { data?: { rows?: LogRow[]; total?: number; actors?: Actor[] } })?.data;
        setRows(data?.rows ?? []);
        setActors(data?.actors ?? []);
        setTotal(data?.total ?? 0);
      })
      .catch((err) => {
        if (cancelled) return;
        const status = (err as { response?: { status?: number } })?.response?.status;
        setError(
          status === 403
            ? "You don't have permission to view the activity log."
            : "Failed to load activity log.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, limit, userId, entityType, search, from, to]);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const hasActiveFilter = useMemo(
    () => Boolean(userId || entityType || search || from || to),
    [userId, entityType, search, from, to],
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-yellow-500/10 text-yellow-600 dark:text-yellow-400">
              <Activity className="w-4 h-4" />
            </span>
            Activity Log
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Every action by users in this workspace — newest first.
          </p>
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {loading ? "Loading…" : `${total.toLocaleString("en-IN")} event${total === 1 ? "" : "s"}`}
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02] p-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex-1 min-w-[200px]">
            <SearchInput
              value={search}
              onChange={(v) => { setPage(1); setSearch(v); }}
              placeholder="Search summary, entity, user…"
              size="sm"
            />
          </div>
          <select
            value={userId}
            onChange={(e) => { setPage(1); setUserId(e.target.value); }}
            className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 focus:border-brand-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 min-w-[160px]"
          >
            <option value="">All users</option>
            {actors.map((a) => (
              <option key={a.userId} value={a.userId}>
                {a.userName ?? a.userEmail ?? a.userId}
              </option>
            ))}
          </select>
          <select
            value={entityType}
            onChange={(e) => { setPage(1); setEntityType(e.target.value); }}
            className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 focus:border-brand-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 min-w-[150px]"
          >
            {ENTITY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <input
            type="date"
            value={from}
            onChange={(e) => { setPage(1); setFrom(e.target.value); }}
            className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 focus:border-brand-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            title="From date"
          />
          <input
            type="date"
            value={to}
            onChange={(e) => { setPage(1); setTo(e.target.value); }}
            className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 focus:border-brand-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            title="To date"
          />
          {hasActiveFilter && (
            <button
              type="button"
              onClick={() => {
                setSearch(""); setUserId(""); setEntityType(""); setFrom(""); setTo(""); setPage(1);
              }}
              className="h-9 px-3 rounded-lg text-[11px] font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 inline-flex items-center gap-1"
            >
              <Filter className="w-3 h-3" /> Clear
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="rounded-2xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02] overflow-hidden">
        {error ? (
          <div className="p-12 text-center">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        ) : loading ? (
          <div className="p-12 text-center">
            <span className="inline-block w-5 h-5 rounded-full border-2 border-gray-300 border-t-yellow-500 animate-spin" />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">Loading activity…</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center">
            <Activity className="w-10 h-10 text-gray-200 dark:text-gray-700 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {hasActiveFilter ? "No matching activity" : "No activity yet"}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {hasActiveFilter
                ? "Try clearing some filters."
                : "User actions will start appearing here as soon as someone uses the workspace."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100/70 dark:divide-gray-800/70">
            {rows.map((r) => {
              const rowId = r.id ?? r._id ?? "";
              const isOpen = expandedId === rowId;
              const hasDetail = (r.fields?.length ?? 0) > 0 || !!r.metadata;
              const tint = ENTITY_TINT[r.entityType] ?? "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
              return (
                <li key={rowId} className="px-4 py-3 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                  <button
                    type="button"
                    onClick={() => hasDetail && setExpandedId(isOpen ? null : rowId)}
                    className="w-full text-left flex items-start gap-3"
                    disabled={!hasDetail}
                  >
                    <span className={`mt-0.5 inline-flex items-center justify-center w-6 h-6 rounded-lg flex-shrink-0 ${tint}`}>
                      {hasDetail ? (isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />) : <Clock className="w-3 h-3" />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center flex-wrap gap-x-2 gap-y-1">
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${tint}`}>
                          {r.entityType.replace(/_/g, " ")}
                        </span>
                        <span className="text-[10px] font-mono text-gray-400">{r.action}</span>
                        <span className="text-[10px] text-gray-400" title={formatDateTime(r.createdAt)}>
                          {relativeTime(r.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">
                        {r.summary}
                      </p>
                      <div className="mt-1 flex items-center gap-3 text-[11px] text-gray-500 dark:text-gray-400 flex-wrap">
                        <span className="inline-flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {r.userName ?? r.userEmail ?? "System"}
                          {r.userRole && <span className="text-gray-400">· {r.userRole}</span>}
                        </span>
                        {r.entityLabel && (
                          <span className="inline-flex items-center gap-1">
                            <span className="opacity-50">on</span>
                            <span className="font-semibold text-gray-700 dark:text-gray-300 truncate max-w-[260px]">{r.entityLabel}</span>
                          </span>
                        )}
                        <span className="font-mono text-gray-400">{formatDateTime(r.createdAt)}</span>
                      </div>
                    </div>
                  </button>

                  {isOpen && hasDetail && (
                    <div className="mt-3 ml-9 space-y-2">
                      {r.fields?.length > 0 && (
                        <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                          <table className="w-full text-[11px]">
                            <thead className="bg-gray-50 dark:bg-gray-800/50">
                              <tr>
                                <th className="text-left px-3 py-1.5 font-semibold text-gray-500 uppercase tracking-wider text-[9px]">Field</th>
                                <th className="text-left px-3 py-1.5 font-semibold text-gray-500 uppercase tracking-wider text-[9px]">Before</th>
                                <th className="text-left px-3 py-1.5 font-semibold text-gray-500 uppercase tracking-wider text-[9px]">After</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                              {r.fields.map((f, i) => (
                                <tr key={i}>
                                  <td className="px-3 py-1.5 font-mono text-gray-700 dark:text-gray-300">{f.field}</td>
                                  <td className="px-3 py-1.5 text-gray-500 dark:text-gray-400 break-all">{JSON.stringify(f.before)}</td>
                                  <td className="px-3 py-1.5 text-gray-900 dark:text-white break-all">{JSON.stringify(f.after)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      {r.metadata && (
                        <details className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/20 px-3 py-2 text-[11px]">
                          <summary className="cursor-pointer font-semibold text-gray-600 dark:text-gray-300">Metadata</summary>
                          <pre className="mt-2 overflow-x-auto text-gray-500 dark:text-gray-400">
                            {JSON.stringify(r.metadata, null, 2)}
                          </pre>
                        </details>
                      )}
                      {r.ipAddress && (
                        <p className="text-[10px] text-gray-400">IP: {r.ipAddress}</p>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {/* Pagination */}
        {!loading && rows.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50/40 dark:bg-gray-800/20">
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Page {page} of {totalPages} · {total.toLocaleString("en-IN")} total
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-gray-200 dark:border-gray-700 text-[11px] font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-3 h-3" /> Prev
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-gray-200 dark:border-gray-700 text-[11px] font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next <ChevronRightIcon className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
