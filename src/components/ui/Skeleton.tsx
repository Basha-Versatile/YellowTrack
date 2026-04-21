import React from "react";

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-lg bg-gray-200/70 dark:bg-gray-700/40 ${className}`} />
  );
}

// ── Dashboard ──────────────────────────────────────────────
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header: title left, 2 buttons right */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Skeleton className="h-7 w-32" />
          <Skeleton className="mt-2 h-4 w-52" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-10 w-40 rounded-xl" />
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
      </div>

      {/* 4 stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 md:gap-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-gray-200/80 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.02]">
            <div className="flex items-center justify-between">
              <Skeleton className="h-11 w-11 rounded-xl" />
              <Skeleton className="h-6 w-12 rounded-lg" />
            </div>
            <Skeleton className="mt-4 h-9 w-16" />
            <Skeleton className="mt-2 h-4 w-28" />
            <div className="mt-3 flex gap-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-18 rounded-full" />
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
          </div>
        ))}
      </div>

      {/* Bottom row: compliance bars left, quick nav right */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 rounded-2xl border border-gray-200/80 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.02]">
          <Skeleton className="h-5 w-44 mb-5" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="mb-5">
              <div className="flex justify-between mb-2"><Skeleton className="h-3.5 w-32" /><Skeleton className="h-3.5 w-10" /></div>
              <Skeleton className="h-2.5 w-full rounded-full" />
            </div>
          ))}
          <Skeleton className="mt-4 h-4 w-40" />
        </div>
        <div className="rounded-2xl border border-gray-200/80 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.02]">
          <Skeleton className="h-5 w-36 mb-5" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 mb-1">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="flex-1"><Skeleton className="h-3.5 w-20" /><Skeleton className="mt-1.5 h-3 w-16" /></div>
              <Skeleton className="h-4 w-4 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Vehicles List ──────────────────────────────────────────
export function VehiclesListSkeleton({ view = "list" }: { view?: "list" | "cards" }) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div><Skeleton className="h-7 w-28" /><Skeleton className="mt-2 h-4 w-44" /></div>
        <Skeleton className="h-10 w-40 rounded-xl" />
      </div>
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-200/80 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.02]">
            <Skeleton className="h-3 w-16 mb-2" /><Skeleton className="h-6 w-12" />
          </div>
        ))}
      </div>
      {/* Group filter row */}
      <div className="flex gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-24 rounded-xl flex-shrink-0" />
        ))}
      </div>
      {/* Search + filters + toggle */}
      <div className="flex gap-3">
        <Skeleton className="h-10 flex-1 rounded-xl" />
        <Skeleton className="h-10 w-48 rounded-xl" />
        <Skeleton className="h-10 w-20 rounded-xl" />
      </div>

      {/* List or Grid */}
      {view === "list" ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4 rounded-xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02]">
              <Skeleton className="w-1 h-12 rounded-full" />
              <Skeleton className="h-10 w-10 rounded-xl" />
              <div className="flex-1"><Skeleton className="h-4 w-28" /><Skeleton className="mt-1.5 h-3 w-48" /></div>
              <div className="hidden lg:flex items-center gap-1">{Array.from({ length: 6 }).map((_, j) => <Skeleton key={j} className="w-2 h-2 rounded-full" />)}</div>
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-4 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02] overflow-hidden">
              <Skeleton className="h-1.5 w-full rounded-none" />
              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3"><Skeleton className="h-11 w-11 rounded-xl" /><div><Skeleton className="h-4 w-24" /><Skeleton className="mt-1.5 h-3 w-32" /></div></div>
                  <Skeleton className="h-10 w-10 rounded-full" />
                </div>
                <div className="flex gap-2 mb-4"><Skeleton className="h-5 w-14 rounded-md" /><Skeleton className="h-5 w-16 rounded-md" /></div>
                <div className="grid grid-cols-6 gap-1">{Array.from({ length: 6 }).map((_, j) => <Skeleton key={j} className="h-6 rounded-md" />)}</div>
                <div className="mt-3 flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800"><Skeleton className="h-3 w-24" /><Skeleton className="h-3 w-16" /></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Vehicle Detail ─────────────────────────────────────────
export function VehicleDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-40 w-full rounded-2xl" />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <div className="rounded-2xl border border-gray-200/80 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.02]">
            <Skeleton className="h-4 w-28 mb-4" />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50"><Skeleton className="h-2.5 w-16 mb-2" /><Skeleton className="h-4 w-24" /></div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-gray-200/80 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.02]">
            <Skeleton className="h-4 w-20 mb-4" />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="aspect-video rounded-xl" />)}</div>
          </div>
          <div className="rounded-2xl border border-gray-200/80 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.02]">
            <div className="flex justify-between mb-4"><Skeleton className="h-4 w-36" /><Skeleton className="h-4 w-20" /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}</div>
          </div>
          <div className="rounded-2xl border border-gray-200/80 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.02]">
            <Skeleton className="h-4 w-28 mb-4" />
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl mb-2" />)}
          </div>
        </div>
        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-200/80 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.02] flex flex-col items-center">
            <Skeleton className="h-4 w-16 mb-4" />
            <Skeleton className="h-36 w-36 rounded-2xl" />
            <Skeleton className="mt-3 h-3 w-28" />
            <div className="mt-4 grid grid-cols-2 gap-2 w-full"><Skeleton className="h-9 rounded-xl" /><Skeleton className="h-9 rounded-xl" /></div>
          </div>
          <div className="rounded-2xl border border-gray-200/80 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.02]">
            <Skeleton className="h-4 w-28 mb-4" /><Skeleton className="h-14 w-full rounded-xl" />
          </div>
          <div className="rounded-2xl border border-gray-200/80 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.02]">
            <Skeleton className="h-4 w-16 mb-4" /><Skeleton className="h-16 w-full rounded-xl" />
          </div>
          <div className="rounded-2xl border border-gray-200/80 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.02]">
            <Skeleton className="h-4 w-32 mb-4" />
            <div className="flex flex-wrap gap-1.5 mb-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-7 w-10 rounded-lg" />)}</div>
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Drivers List ───────────────────────────────────────────
export function DriversListSkeleton({ view = "list" }: { view?: "list" | "cards" }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div><Skeleton className="h-7 w-24" /><Skeleton className="mt-2 h-4 w-40" /></div>
        <div className="flex gap-2"><Skeleton className="h-10 w-24 rounded-xl" /><Skeleton className="h-10 w-28 rounded-xl" /></div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-gray-200/80 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.02]">
            <div className="flex items-center gap-3"><Skeleton className="h-10 w-10 rounded-xl" /><div><Skeleton className="h-3 w-12 mb-1.5" /><Skeleton className="h-6 w-8" /></div></div>
          </div>
        ))}
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-10 flex-1 rounded-xl" />
        <Skeleton className="h-10 w-48 rounded-xl" />
        <Skeleton className="h-10 w-20 rounded-xl" />
      </div>
      {view === "cards" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02] overflow-hidden">
              <Skeleton className="h-1.5 w-full rounded-none" />
              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3"><Skeleton className="h-12 w-12 rounded-xl" /><div><Skeleton className="h-4 w-24" /><Skeleton className="mt-1 h-3 w-32" /></div></div>
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
                <div className="flex gap-2 mb-4"><Skeleton className="h-5 w-12 rounded-md" /><Skeleton className="h-5 w-20 rounded-md" /></div>
                <div className="flex justify-between pt-3 border-t border-gray-100 dark:border-gray-800"><Skeleton className="h-3 w-20" /><Skeleton className="h-3 w-16" /></div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02] overflow-hidden">
              <Skeleton className="h-0.5 w-full rounded-none" />
              <div className="p-4 flex items-center gap-4">
                <Skeleton className="h-12 w-12 rounded-xl flex-shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center gap-2"><Skeleton className="h-4 w-28" /><Skeleton className="h-5 w-14 rounded-full" /><Skeleton className="h-5 w-10 rounded-md" /></div>
                  <div className="flex items-center gap-3 mt-2"><Skeleton className="h-3 w-32" /><Skeleton className="h-3 w-20" /><Skeleton className="h-3 w-16" /></div>
                </div>
                <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Driver Detail ──────────────────────────────────────────
export function DriverDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div><Skeleton className="h-7 w-40" /><Skeleton className="mt-1.5 h-4 w-28" /></div>
        </div>
        <Skeleton className="h-10 w-40 rounded-xl" />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div>
          <div className="rounded-2xl border border-gray-200/80 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.02]">
            <div className="flex items-center gap-4 mb-5"><Skeleton className="h-14 w-14 rounded-2xl" /><div><Skeleton className="h-5 w-32" /><Skeleton className="mt-2 h-5 w-16 rounded-full" /></div></div>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex justify-between py-2 border-b border-gray-50 dark:border-gray-800/50 last:border-0"><Skeleton className="h-3 w-20" /><Skeleton className="h-3.5 w-24" /></div>
            ))}
          </div>
        </div>
        <div className="xl:col-span-2">
          <div className="rounded-2xl border border-gray-200/80 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.02]">
            <div className="flex justify-between mb-4"><Skeleton className="h-5 w-28" /><Skeleton className="h-4 w-16" /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="p-4 rounded-xl border border-gray-100 dark:border-gray-800">
                  <div className="flex items-start justify-between mb-2"><div className="flex items-center gap-2"><Skeleton className="h-4 w-4" /><Skeleton className="h-4 w-28" /></div><Skeleton className="h-5 w-14 rounded-full" /></div>
                  <Skeleton className="h-3 w-44 mt-2" />
                  <div className="flex items-center gap-2 mt-2"><Skeleton className="h-3 w-16" /><Skeleton className="h-3 w-14" /></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Challans ───────────────────────────────────────────────
export function ChallansSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div><Skeleton className="h-7 w-28" /><Skeleton className="mt-2 h-4 w-52" /></div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-gray-200/80 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.02]">
            <div className="flex items-center gap-3"><Skeleton className="h-10 w-10 rounded-xl" /><div><Skeleton className="h-3 w-14 mb-1.5" /><Skeleton className="h-6 w-20" /></div></div>
          </div>
        ))}
      </div>
      <div className="flex gap-3"><Skeleton className="h-10 w-56 rounded-xl" /><Skeleton className="h-4 w-32 rounded-lg ml-auto" /></div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02]">
          <div className="flex items-center gap-4 p-4">
            <Skeleton className="h-5 w-5 rounded-md flex-shrink-0" />
            <div className="flex-1"><div className="flex items-center gap-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-5 w-16 rounded-full" /></div><Skeleton className="h-3 w-48 mt-1.5" /></div>
            <Skeleton className="h-6 w-20 flex-shrink-0" />
            <Skeleton className="h-8 w-16 rounded-lg flex-shrink-0" />
            <Skeleton className="h-7 w-7 rounded-lg flex-shrink-0" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Compliance ─────────────────────────────────────────────
// ── Vehicle Groups ────────────────────────────────────────
export function VehicleGroupsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div><Skeleton className="h-7 w-40" /><Skeleton className="mt-2 h-4 w-56" /></div>
        </div>
        <Skeleton className="h-10 w-32 rounded-xl" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02] p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="w-12 h-12 rounded-xl" />
                <div><Skeleton className="h-4 w-16" /><Skeleton className="mt-1.5 h-3 w-20" /></div>
              </div>
              <div className="flex gap-1"><Skeleton className="w-7 h-7 rounded-lg" /><Skeleton className="w-7 h-7 rounded-lg" /></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Driver Compliance ─────────────────────────────────────
export function DriverComplianceSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div><Skeleton className="h-7 w-40" /><Skeleton className="mt-2 h-4 w-56" /></div>
      </div>
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-gray-200/80 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.02]">
          <Skeleton className="h-3 w-24 mb-2" /><Skeleton className="h-8 w-14" /><Skeleton className="mt-3 h-1.5 w-full rounded-full" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-gray-200/80 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.02]">
            <Skeleton className="h-3 w-16 mb-2" /><Skeleton className="h-8 w-10" /><Skeleton className="h-3 w-24 mt-2" />
          </div>
        ))}
      </div>
      {/* Filter + view */}
      <div className="flex justify-between gap-3">
        <Skeleton className="h-10 w-72 rounded-xl" />
        <Skeleton className="h-10 w-20 rounded-xl" />
      </div>
      {/* List */}
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4 rounded-xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02]">
            <Skeleton className="w-1 h-14 rounded-full" />
            <Skeleton className="h-10 w-10 rounded-xl" />
            <div className="flex-1">
              <div className="flex items-center gap-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-5 w-14 rounded-full" /></div>
              <div className="flex items-center gap-3 mt-1.5"><Skeleton className="h-3 w-32" /><Skeleton className="h-3 w-12" /></div>
            </div>
            <div className="hidden sm:flex gap-2">{Array.from({ length: 4 }).map((_, j) => <Skeleton key={j} className="h-6 w-8 rounded-md" />)}</div>
            <Skeleton className="h-4 w-4 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── FASTag ────────────────────────────────────────────────
export function FASTagSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div><Skeleton className="h-7 w-24" /><Skeleton className="mt-2 h-4 w-64" /></div>
        <Skeleton className="h-10 w-36 rounded-xl" />
      </div>
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-gray-200/80 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.02]">
            <Skeleton className="h-3 w-20 mb-2" /><Skeleton className="h-7 w-14 mt-1" />
          </div>
        ))}
      </div>
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Skeleton className="h-10 flex-1 rounded-xl" />
        <Skeleton className="h-10 w-48 rounded-xl" />
      </div>
      {/* List */}
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02] p-4 flex items-center gap-4">
            <Skeleton className="w-11 h-11 rounded-xl flex-shrink-0" />
            <div className="flex-1">
              <div className="flex items-center gap-2"><Skeleton className="h-4 w-28" /><Skeleton className="h-5 w-16 rounded-full" /><Skeleton className="h-5 w-14 rounded-md" /></div>
              <div className="flex items-center gap-3 mt-2"><Skeleton className="h-3 w-24" /><Skeleton className="h-3 w-32" /><Skeleton className="h-3 w-20" /></div>
            </div>
            <div className="text-right flex-shrink-0"><Skeleton className="h-6 w-16" /><Skeleton className="mt-1 h-3 w-12" /></div>
            <div className="flex gap-1.5 flex-shrink-0"><Skeleton className="h-8 w-20 rounded-lg" /><Skeleton className="h-8 w-8 rounded-lg" /></div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Notifications / Fleet Alerts ──────────────────────────
export function NotificationsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div><Skeleton className="h-7 w-32" /><Skeleton className="mt-2 h-4 w-48" /></div>
        <Skeleton className="h-10 w-36 rounded-xl" />
      </div>
      <Skeleton className="h-10 w-56 rounded-xl" />
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-start gap-4 p-4 rounded-xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02]">
            <Skeleton className="w-10 h-10 rounded-xl flex-shrink-0" />
            <div className="flex-1">
              <div className="flex items-center gap-2"><Skeleton className="h-4 w-48" /><Skeleton className="h-5 w-16 rounded-full" /></div>
              <Skeleton className="mt-2 h-3 w-full max-w-[400px]" />
              <Skeleton className="mt-1.5 h-3 w-24" />
            </div>
            <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Vehicle Compliance ────────────────────────────────────
export function ComplianceSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div><Skeleton className="h-7 w-32" /><Skeleton className="mt-2 h-4 w-56" /></div>
        <Skeleton className="h-10 w-32 rounded-xl" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-gray-200/80 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.02]">
          <Skeleton className="h-3 w-24 mb-2" /><Skeleton className="h-8 w-14" /><Skeleton className="mt-3 h-1.5 w-full rounded-full" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-gray-200/80 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.02]">
            <Skeleton className="h-3 w-16 mb-2" /><Skeleton className="h-8 w-10" /><Skeleton className="h-3 w-24 mt-2" />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-24 rounded-xl flex-shrink-0" />
        ))}
      </div>
      <div className="flex justify-between"><Skeleton className="h-10 w-64 rounded-xl" /><Skeleton className="h-10 w-20 rounded-xl" /></div>
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4 rounded-xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02]">
            <Skeleton className="w-1 h-14 rounded-full" />
            <Skeleton className="h-10 w-10 rounded-xl" />
            <div className="flex-1"><Skeleton className="h-4 w-24" /><Skeleton className="mt-1.5 h-3 w-36" /></div>
            <div className="hidden sm:flex items-center gap-3">{Array.from({ length: 6 }).map((_, j) => <div key={j} className="text-center"><Skeleton className="h-2 w-6 mb-1" /><Skeleton className="w-2 h-2 rounded-full mx-auto" /></div>)}</div>
            <Skeleton className="h-4 w-4 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ServicesPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div><Skeleton className="h-7 w-44" /><Skeleton className="mt-2 h-4 w-64" /></div>
        <Skeleton className="h-10 w-36 rounded-xl" />
      </div>
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800/50 rounded-xl w-fit">
        <Skeleton className="h-9 w-28 rounded-lg" /><Skeleton className="h-9 w-36 rounded-lg" />
      </div>
      <div className="flex gap-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-9 w-24 rounded-lg" />)}</div>
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02] p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4"><Skeleton className="w-12 h-12 rounded-xl" /><div><Skeleton className="h-4 w-28" /><Skeleton className="mt-1.5 h-3 w-36" /></div></div>
              <div className="flex items-center gap-5"><div className="flex gap-4">{Array.from({ length: 3 }).map((_, j) => <div key={j} className="text-center"><Skeleton className="h-6 w-8 mx-auto" /><Skeleton className="mt-1 h-2 w-12" /></div>)}</div><Skeleton className="h-5 w-5 rounded" /></div>
            </div>
            <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">{Array.from({ length: 3 }).map((_, j) => <Skeleton key={j} className="h-6 w-28 rounded-lg" />)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ServiceDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3"><Skeleton className="h-9 w-9 rounded-lg" /><Skeleton className="w-11 h-11 rounded-xl" /><div><Skeleton className="h-6 w-36" /><Skeleton className="mt-1 h-3 w-48" /></div></div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02] p-4"><Skeleton className="h-2.5 w-20 mb-2" /><Skeleton className="h-7 w-16" /></div>
        ))}
      </div>
      <div className="flex gap-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-9 w-24 rounded-lg" />)}</div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02] p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4"><Skeleton className="w-10 h-10 rounded-xl" /><div><Skeleton className="h-4 w-32" /><Skeleton className="mt-1.5 h-3 w-40" /></div></div>
              <div className="flex items-center gap-3"><Skeleton className="h-5 w-16" /><Skeleton className="h-4 w-4" /></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ExpensesDashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div><Skeleton className="h-7 w-44" /><Skeleton className="mt-2 h-4 w-64" /></div>
        <div className="flex gap-2"><Skeleton className="h-10 w-32 rounded-xl" /><Skeleton className="h-10 w-28 rounded-xl" /></div>
      </div>
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02] p-4">
        <Skeleton className="h-9 w-44 rounded-lg" /><Skeleton className="h-9 w-36 rounded-lg" />
        <div className="flex gap-1">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-20 rounded-md" />)}</div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="rounded-2xl bg-gray-100 dark:bg-gray-800 p-6 col-span-2 sm:col-span-1"><Skeleton className="h-3 w-24" /><Skeleton className="mt-3 h-9 w-32" /><Skeleton className="mt-3 h-3 w-20" /></div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02] p-5">
            <div className="flex items-center gap-2 mb-3"><Skeleton className="w-9 h-9 rounded-xl" /><Skeleton className="h-3 w-16" /></div>
            <Skeleton className="h-7 w-20" /><Skeleton className="mt-3 h-1.5 w-full rounded-full" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-2xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02] p-6"><Skeleton className="h-5 w-44 mb-6" /><Skeleton className="h-72 w-full rounded-xl" /></div>
        <div className="rounded-2xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02] p-6"><Skeleton className="h-5 w-32 mb-6" /><Skeleton className="h-56 w-56 rounded-full mx-auto" /></div>
      </div>
      <div className="rounded-2xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02] overflow-hidden">
        <div className="p-5 border-b border-gray-100 dark:border-gray-800"><Skeleton className="h-5 w-36" /></div>
        <div className="p-4 space-y-3">{Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4"><Skeleton className="h-4 w-20" /><Skeleton className="h-4 w-24" /><Skeleton className="h-5 w-16 rounded-lg" /><Skeleton className="h-4 w-40 flex-1" /><Skeleton className="h-4 w-16 ml-auto" /></div>
        ))}</div>
      </div>
    </div>
  );
}
