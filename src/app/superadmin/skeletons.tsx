import React from "react";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Shared shimmers for every superadmin screen. Layouts mirror each rendered
 * page exactly so there's no content shift on hand-off.
 */

// ── Hero header shimmer (re-used across pages) ──────────────────────────────
function HeroSkeleton({ accent = "yellow" }: { accent?: "yellow" | "blue" | "emerald" }) {
  const tone =
    accent === "blue"
      ? "from-blue-50 via-white to-blue-50 dark:from-blue-500/[0.04] dark:via-gray-900 dark:to-blue-500/[0.04]"
      : accent === "emerald"
        ? "from-emerald-50 via-white to-emerald-50 dark:from-emerald-500/[0.04] dark:via-gray-900 dark:to-emerald-500/[0.04]"
        : "from-yellow-50 via-white to-amber-50 dark:from-yellow-500/[0.04] dark:via-gray-900 dark:to-amber-500/[0.04]";
  return (
    <div
      className={`rounded-3xl border border-gray-200/80 bg-gradient-to-br ${tone} dark:border-gray-800 p-6 sm:p-8`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2.5">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-11 w-32 rounded-xl" />
          <Skeleton className="h-11 w-36 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

// ── Dashboard ───────────────────────────────────────────────────────────────
export function SuperadminDashboardSkeleton() {
  return (
    <div className="space-y-6">
      <HeroSkeleton />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-gray-200/80 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.02]"
          >
            <div className="flex items-start justify-between">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <Skeleton className="h-4 w-4 rounded" />
            </div>
            <Skeleton className="mt-4 h-9 w-20" />
            <Skeleton className="mt-1.5 h-4 w-24" />
            <Skeleton className="mt-3 h-4 w-32" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 rounded-2xl border border-gray-200/80 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.02]">
          <div className="flex items-center justify-between mb-5">
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-3 w-36" />
            </div>
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                <Skeleton className="h-7 w-7 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-52" />
                  <Skeleton className="h-1.5 w-full rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-gray-200/80 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.02]">
          <Skeleton className="h-4 w-12 mb-1" />
          <Skeleton className="h-3 w-36 mb-5" />
          <div className="flex items-center justify-center mb-5">
            <Skeleton className="h-40 w-40 rounded-full" />
          </div>
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-14" />
              </div>
            ))}
          </div>
          <div className="mt-5 pt-5 border-t border-gray-100 dark:border-gray-800 grid grid-cols-2 gap-3">
            <Skeleton className="h-14 rounded-xl" />
            <Skeleton className="h-14 rounded-xl" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 rounded-2xl border border-gray-200/80 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.02]">
          <div className="flex items-center justify-between mb-5">
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-3 w-36" />
            </div>
            <Skeleton className="h-4 w-12" />
          </div>
          <ul className="space-y-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="flex items-center gap-3 px-3 py-2.5">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-28" />
                </div>
                <Skeleton className="h-4 w-4 rounded" />
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-gray-200/80 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.02]">
          <Skeleton className="h-4 w-28 mb-1" />
          <Skeleton className="h-3 w-36 mb-5" />
          <ul className="space-y-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <li key={i} className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-xl" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-24" />
                </div>
                <Skeleton className="h-2 w-2 rounded-full" />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

// ── Tenants list (card grid) ────────────────────────────────────────────────
export function TenantsListSkeleton() {
  return (
    <div className="space-y-6">
      <HeroSkeleton />
      <div className="rounded-2xl border border-gray-200/80 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.02]">
        <div className="flex flex-col lg:flex-row gap-3">
          <Skeleton className="flex-1 h-11 rounded-xl" />
          <Skeleton className="h-11 w-56 rounded-xl" />
          <Skeleton className="h-11 w-72 rounded-xl" />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-gray-200/80 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.02]"
          >
            <div className="flex items-start gap-3 mb-4">
              <Skeleton className="h-12 w-12 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-16 rounded-md" />
                <Skeleton className="h-4 w-16 rounded-md" />
              </div>
            </div>
            <div className="flex items-center justify-between mb-4">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-24" />
            </div>
            <div className="flex gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
              <Skeleton className="flex-1 h-8 rounded-lg" />
              <Skeleton className="h-8 w-20 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Tenant detail ───────────────────────────────────────────────────────────
export function TenantDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-24" />
      <HeroSkeleton />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-gray-200/80 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.02]"
          >
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-5 w-12" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl border border-gray-200/80 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.02]">
          <Skeleton className="h-4 w-20 mb-5" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-36" />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-red-200/80 bg-gradient-to-br from-red-50/60 to-white p-6 dark:border-red-500/20 dark:from-red-500/[0.06] dark:to-gray-900">
          <Skeleton className="h-4 w-28 mb-3" />
          <Skeleton className="h-3 w-full mb-5" />
          <div className="space-y-2">
            <Skeleton className="h-10 rounded-xl" />
            <Skeleton className="h-10 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Vehicles list (table) ───────────────────────────────────────────────────
export function SuperadminVehiclesSkeleton() {
  return (
    <div className="space-y-6">
      <HeroSkeleton accent="blue" />
      <div className="rounded-2xl border border-gray-200/80 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.02]">
        <div className="flex flex-col lg:flex-row gap-3">
          <Skeleton className="h-11 w-56 rounded-xl" />
          <Skeleton className="flex-1 h-11 rounded-xl" />
          <Skeleton className="h-11 w-72 rounded-xl" />
        </div>
      </div>
      <div className="rounded-2xl border border-gray-200/80 bg-white overflow-hidden dark:border-gray-800 dark:bg-white/[0.02]">
        <div className="bg-gray-50/80 dark:bg-gray-800/40 px-5 py-3 flex gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className={`h-3 ${i === 0 ? "w-20" : "w-14"}`} />
          ))}
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-6 px-5 py-4 border-t border-gray-100 dark:border-gray-800"
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-36" />
              </div>
            </div>
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 w-16 rounded-md" />
            <Skeleton className="h-4 w-20 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Drivers list (card grid) ────────────────────────────────────────────────
export function SuperadminDriversSkeleton() {
  return (
    <div className="space-y-6">
      <HeroSkeleton accent="emerald" />
      <div className="rounded-2xl border border-gray-200/80 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.02]">
        <div className="flex flex-col lg:flex-row gap-3">
          <Skeleton className="h-11 w-56 rounded-xl" />
          <Skeleton className="flex-1 h-11 rounded-xl" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-gray-200/80 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.02]"
          >
            <div className="flex items-start gap-3 mb-4">
              <Skeleton className="h-12 w-12 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-5 w-16 rounded-md" />
            </div>
            <div className="space-y-2 mb-4">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3 w-24" />
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-5 w-20 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Notification dropdown skeleton (placeholder) ────────────────────────────
export function NotificationDropdownSkeleton() {
  return (
    <div className="p-4 space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
          <div className="flex-1">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="mt-1.5 h-3 w-40" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Legacy export retained for old callers (tenant page imported it indirectly).
export function TableRowsSkeleton({
  rows = 6,
  cols = 5,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <tbody>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="border-t border-gray-100 dark:border-gray-800">
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} className="px-4 py-3.5">
              <Skeleton
                className={`h-3.5 ${
                  c === 0 ? "w-32" : c === cols - 1 ? "w-16 ml-auto" : "w-24"
                }`}
              />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}
