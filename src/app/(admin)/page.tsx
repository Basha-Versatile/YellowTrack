"use client";
import React, { useEffect, useState } from "react";
import { vehicleAPI, driverAPI, notificationAPI } from "@/lib/api";
import Link from "next/link";
import { DashboardSkeleton } from "@/components/ui/Skeleton";
import { Plus, UserPlus, Truck, Users, AlertTriangle, CheckCircle2, ChevronRight, ShieldCheck, CreditCard, Bell, FileText, type LucideIcon } from "lucide-react";

interface DashboardStats {
  totalVehicles: number;
  compliance: { green: number; yellow: number; orange: number; red: number };
  challans: {
    total: number;
    pending: { count: number; amount: number };
    paid: { count: number; amount: number };
  };
}

interface DriverStats {
  totalDrivers: number;
  license: { green: number; yellow: number; orange: number; red: number };
  documents: { green: number; yellow: number; orange: number; red: number };
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [driverStats, setDriverStats] = useState<DriverStats | null>(null);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      vehicleAPI.getStats().then((r) => r.data.data),
      driverAPI.getStats().then((r) => r.data.data).catch(() => null),
      notificationAPI.getUnreadCount().then((r) => r.data.data.count).catch(() => 0),
    ])
      .then(([s, ds, n]) => { setStats(s); setDriverStats(ds); setUnreadNotifs(n); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <DashboardSkeleton />;

  const vc = stats?.compliance || { green: 0, yellow: 0, orange: 0, red: 0 };
  const totalVDocs = vc.green + vc.yellow + vc.orange + vc.red;
  const vcPct = totalVDocs > 0 ? Math.round((vc.green / totalVDocs) * 100) : 0;

  const dl = driverStats?.license || { green: 0, yellow: 0, orange: 0, red: 0 };
  const dd = driverStats?.documents || { green: 0, yellow: 0, orange: 0, red: 0 };
  const totalLic = dl.green + dl.yellow + dl.orange + dl.red;
  const totalDDocs = dd.green + dd.yellow + dd.orange + dd.red;
  const dlPct = totalLic > 0 ? Math.round((dl.green / totalLic) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* ── HERO BANNER ── */}
      <div className="relative rounded-2xl overflow-hidden border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02]">
        {/* decorative accents — very subtle, theme-agnostic */}
        <div className="pointer-events-none absolute top-0 right-0 w-96 h-96 rounded-full bg-yellow-500/5 dark:bg-yellow-500/10 blur-[100px]" />
        <div className="pointer-events-none absolute bottom-0 left-1/4 w-72 h-72 rounded-full bg-yellow-400/5 blur-[80px]" />
        <div className="pointer-events-none absolute top-10 right-16 w-48 h-48 rounded-full border border-yellow-500/10" />
        <div className="pointer-events-none absolute top-6 right-12 w-48 h-48 rounded-full border border-yellow-500/5" />

        <div className="relative z-10 px-6 sm:px-8 py-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Dashboard</h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Fleet compliance overview at a glance</p>
            </div>
            <div className="flex gap-3">
              <Link href="/vehicles/onboard"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-yellow-400 to-yellow-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-yellow-500/25 hover:shadow-yellow-500/40 transition-all">
                <Plus className="w-4 h-4" />
                Onboard Vehicle
              </Link>
              <Link href="/drivers/add"
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10 transition-all">
                <UserPlus className="w-4 h-4" />
                Add Driver
              </Link>
            </div>
          </div>

          {/* Stat Cards inside hero */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard Icon={Truck} label="Vehicles" value={`${stats?.totalVehicles || 0}`} href="/vehicles" />
            <StatCard Icon={Users} label="Drivers" value={`${driverStats?.totalDrivers || 0}`} href="/drivers" />
            <StatCard Icon={AlertTriangle} label="Pending Challans" value={`₹${(stats?.challans?.pending?.amount || 0).toLocaleString("en-IN")}`} sub={`${stats?.challans?.pending?.count || 0} challans`} href="/challans" accent />
            <StatCard Icon={CheckCircle2} label="Paid Challans" value={`₹${(stats?.challans?.paid?.amount || 0).toLocaleString("en-IN")}`} sub={`${stats?.challans?.paid?.count || 0} of ${stats?.challans?.total || 0}`} success />
          </div>
        </div>
      </div>

      {/* ── COMPLIANCE SECTIONS ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Vehicle Compliance */}
        <div className="rounded-2xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02] overflow-hidden">
          <div className="relative bg-gradient-to-r from-yellow-500 via-yellow-400 to-amber-400 px-6 py-5 overflow-hidden">
            <div className="absolute top-3 right-6 w-24 h-24 rounded-full border border-white/10" />
            <div className="absolute -bottom-4 right-20 w-20 h-20 rounded-full border border-white/5" />
            <div className="relative z-10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/20">
                  <Truck className="w-5.5 h-5.5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Vehicle Compliance</h3>
                  <p className="text-white/70 text-xs">{totalVDocs} documents across {stats?.totalVehicles || 0} vehicles</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-3xl font-black text-white">{vcPct}%</p>
                <p className="text-[10px] text-white/60 uppercase tracking-wider font-medium">Compliant</p>
              </div>
            </div>
          </div>

          <div className="p-6">
            {/* Stacked bar */}
            <div className="h-3 rounded-full bg-gray-100 dark:bg-gray-800 flex overflow-hidden mb-6">
              {totalVDocs > 0 && (
                <>
                  {vc.green > 0 && <div className="bg-emerald-500 transition-all duration-700" style={{ width: `${(vc.green / totalVDocs) * 100}%` }} />}
                  {vc.yellow > 0 && <div className="bg-amber-400 transition-all duration-700" style={{ width: `${(vc.yellow / totalVDocs) * 100}%` }} />}
                  {vc.orange > 0 && <div className="bg-orange-500 transition-all duration-700" style={{ width: `${(vc.orange / totalVDocs) * 100}%` }} />}
                  {vc.red > 0 && <div className="bg-red-500 transition-all duration-700" style={{ width: `${(vc.red / totalVDocs) * 100}%` }} />}
                </>
              )}
            </div>

            {/* Status grid */}
            <div className="grid grid-cols-2 gap-3">
              <StatusTile label="Valid" sublabel="> 30 days" count={vc.green} dotColor="bg-emerald-500" bgColor="bg-emerald-50 dark:bg-emerald-500/10" textColor="text-emerald-700 dark:text-emerald-400" />
              <StatusTile label="Expiring" sublabel="≤ 30 days" count={vc.yellow} dotColor="bg-amber-400" bgColor="bg-amber-50 dark:bg-amber-500/10" textColor="text-amber-700 dark:text-amber-400" />
              <StatusTile label="Critical" sublabel="≤ 7 days" count={vc.orange} dotColor="bg-orange-500" bgColor="bg-orange-50 dark:bg-orange-500/10" textColor="text-orange-700 dark:text-orange-400" />
              <StatusTile label="Expired" sublabel="≤ 0 days" count={vc.red} dotColor="bg-red-500" bgColor="bg-red-50 dark:bg-red-500/10" textColor="text-red-700 dark:text-red-400" />
            </div>

            <Link href="/compliance" className="mt-5 flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
              View Vehicle Compliance
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Driver Compliance */}
        <div className="rounded-2xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02] overflow-hidden">
          <div className="relative bg-gradient-to-r from-gray-900 via-gray-800 to-gray-950 px-6 py-5 overflow-hidden">
            <div className="absolute top-3 right-6 w-24 h-24 rounded-full border border-yellow-500/10" />
            <div className="absolute -bottom-4 right-20 w-20 h-20 rounded-full border border-yellow-500/5" />
            <div className="relative z-10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-yellow-500/20 backdrop-blur-sm flex items-center justify-center border border-yellow-500/20">
                  <Users className="w-5.5 h-5.5 text-yellow-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Driver Compliance</h3>
                  <p className="text-white/50 text-xs">{totalLic} licenses &middot; {totalDDocs} documents</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-3xl font-black text-yellow-400">{dlPct}%</p>
                <p className="text-[10px] text-white/40 uppercase tracking-wider font-medium">License OK</p>
              </div>
            </div>
          </div>

          <div className="p-6">
            {/* License Section */}
            <div className="mb-6">
              <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <CreditCard className="w-3.5 h-3.5" />
                License Status
              </h4>
              <div className="h-2.5 rounded-full bg-gray-100 dark:bg-gray-800 flex overflow-hidden mb-4">
                {totalLic > 0 && (
                  <>
                    {dl.green > 0 && <div className="bg-emerald-500 transition-all duration-700" style={{ width: `${(dl.green / totalLic) * 100}%` }} />}
                    {dl.yellow > 0 && <div className="bg-amber-400 transition-all duration-700" style={{ width: `${(dl.yellow / totalLic) * 100}%` }} />}
                    {dl.orange > 0 && <div className="bg-orange-500 transition-all duration-700" style={{ width: `${(dl.orange / totalLic) * 100}%` }} />}
                    {dl.red > 0 && <div className="bg-red-500 transition-all duration-700" style={{ width: `${(dl.red / totalLic) * 100}%` }} />}
                  </>
                )}
              </div>
              <div className="grid grid-cols-4 gap-2">
                <MiniStat count={dl.green} label="Valid" dotColor="bg-emerald-500" />
                <MiniStat count={dl.yellow} label="Expiring" dotColor="bg-amber-400" />
                <MiniStat count={dl.orange} label="Critical" dotColor="bg-orange-500" />
                <MiniStat count={dl.red} label="Expired" dotColor="bg-red-500" />
              </div>
            </div>

            {/* Document Section */}
            {totalDDocs > 0 && (
              <div className="pt-5 border-t border-gray-100 dark:border-gray-800 mb-5">
                <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5" />
                  Document Status
                </h4>
                <div className="h-2.5 rounded-full bg-gray-100 dark:bg-gray-800 flex overflow-hidden mb-4">
                  {dd.green > 0 && <div className="bg-emerald-500 transition-all duration-700" style={{ width: `${(dd.green / totalDDocs) * 100}%` }} />}
                  {dd.yellow > 0 && <div className="bg-amber-400 transition-all duration-700" style={{ width: `${(dd.yellow / totalDDocs) * 100}%` }} />}
                  {dd.orange > 0 && <div className="bg-orange-500 transition-all duration-700" style={{ width: `${(dd.orange / totalDDocs) * 100}%` }} />}
                  {dd.red > 0 && <div className="bg-red-500 transition-all duration-700" style={{ width: `${(dd.red / totalDDocs) * 100}%` }} />}
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <MiniStat count={dd.green} label="Valid" dotColor="bg-emerald-500" />
                  <MiniStat count={dd.yellow} label="Expiring" dotColor="bg-amber-400" />
                  <MiniStat count={dd.orange} label="Critical" dotColor="bg-orange-500" />
                  <MiniStat count={dd.red} label="Expired" dotColor="bg-red-500" />
                </div>
              </div>
            )}

            <Link href="/drivers/compliance" className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
              View Driver Compliance
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* ── QUICK ACTIONS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {([
          { href: "/vehicles", Icon: Truck, label: "All Vehicles", color: "from-yellow-400 to-yellow-500", shadow: "shadow-yellow-500/20" },
          { href: "/drivers", Icon: Users, label: "All Drivers", color: "from-blue-400 to-blue-500", shadow: "shadow-blue-500/20" },
          { href: "/compliance", Icon: ShieldCheck, label: "Vehicle Docs", color: "from-emerald-400 to-emerald-500", shadow: "shadow-emerald-500/20" },
          { href: "/drivers/compliance", Icon: CreditCard, label: "Driver Docs", color: "from-purple-400 to-purple-500", shadow: "shadow-purple-500/20" },
          { href: "/challans", Icon: AlertTriangle, label: "Challans", color: "from-red-400 to-red-500", shadow: "shadow-red-500/20" },
          { href: "/fleet-alerts", Icon: Bell, label: "Alerts", color: "from-orange-400 to-orange-500", shadow: "shadow-orange-500/20", badge: unreadNotifs > 0 ? unreadNotifs : undefined },
        ] as Array<{ href: string; Icon: React.ComponentType<React.SVGProps<SVGSVGElement> & { strokeWidth?: number }>; label: string; color: string; shadow: string; badge?: number }>).map((item) => (
          <Link key={item.href} href={item.href}
            className="group relative flex flex-col items-center gap-3 p-5 rounded-2xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02] hover:shadow-lg hover:shadow-gray-200/50 dark:hover:shadow-none hover:-translate-y-0.5 transition-all duration-300">
            <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${item.color} flex items-center justify-center shadow-lg ${item.shadow} group-hover:scale-110 transition-transform duration-300`}>
              <item.Icon className="w-5.5 h-5.5 text-white" strokeWidth={1.5} />
            </div>
            <span className="text-xs font-bold text-gray-700 dark:text-gray-300 text-center">{item.label}</span>
            {item.badge && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shadow-md shadow-red-500/30">{item.badge}</span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function StatCard({ Icon, label, value, sub, href, accent, success }: { Icon: LucideIcon; label: string; value: string; sub?: string; href?: string; accent?: boolean; success?: boolean }) {
  const wrapperCls = accent
    ? "bg-red-50 border border-red-200 dark:bg-red-500/10 dark:border-red-500/20"
    : success
      ? "bg-emerald-50 border border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20"
      : "bg-gray-50 border border-gray-200 dark:bg-white/5 dark:border-white/10";

  const iconCls = accent
    ? "text-red-500 dark:text-red-400"
    : success
      ? "text-emerald-500 dark:text-emerald-400"
      : "text-gray-400 dark:text-white/40";

  const labelCls = "text-gray-500 dark:text-white/40";

  const valueCls = accent
    ? "text-red-600 dark:text-red-400"
    : success
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-gray-900 dark:text-white";

  const subCls = "text-gray-400 dark:text-white/30";

  const content = (
    <div className={`rounded-xl px-4 py-4 h-full flex flex-col ${wrapperCls}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${iconCls}`} strokeWidth={1.5} />
        <span className={`text-[11px] uppercase tracking-wider font-medium ${labelCls}`}>{label}</span>
      </div>
      <p className={`text-2xl font-black ${valueCls}`}>{value}</p>
      <p className={`text-[11px] mt-0.5 ${subCls} ${sub ? "" : "invisible"}`} aria-hidden={!sub}>
        {sub ?? "—"}
      </p>
    </div>
  );
  return href ? (
    <Link href={href} className="block h-full hover:opacity-80 transition-opacity">{content}</Link>
  ) : (
    content
  );
}

function StatusTile({ label, sublabel, count, dotColor, bgColor, textColor }: { label: string; sublabel: string; count: number; dotColor: string; bgColor: string; textColor: string }) {
  return (
    <div className={`rounded-xl px-4 py-3.5 ${bgColor} transition-all hover:scale-[1.02]`}>
      <div className="flex items-center gap-2 mb-1">
        <span className={`w-2.5 h-2.5 rounded-full ${dotColor}`} />
        <span className={`text-xs font-bold ${textColor}`}>{label}</span>
      </div>
      <p className={`text-2xl font-black ${textColor}`}>{count}</p>
      <p className="text-[10px] text-gray-400 mt-0.5">{sublabel}</p>
    </div>
  );
}

function MiniStat({ count, label, dotColor }: { count: number; label: string; dotColor: string }) {
  return (
    <div className="text-center py-2 rounded-lg bg-gray-50 dark:bg-gray-800/50">
      <div className="flex items-center justify-center gap-1 mb-1">
        <span className={`w-2 h-2 rounded-full ${dotColor}`} />
        <span className="text-[10px] text-gray-400 font-medium">{label}</span>
      </div>
      <p className="text-lg font-black text-gray-800 dark:text-gray-200">{count}</p>
    </div>
  );
}
