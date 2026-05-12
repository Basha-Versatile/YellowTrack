"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { superadminAPI } from "@/lib/api";
import { TenantDetailSkeleton } from "../../skeletons";
import {
  ArrowLeft,
  Truck,
  UserCircle,
  Building2,
  Mail,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Pause,
  Play,
  Trash2,
  Users,
  Shield,
  Gauge,
} from "lucide-react";

type Tenant = {
  id: string;
  name: string;
  slug: string;
  status: "ACTIVE" | "SUSPENDED" | "DELETED";
  plan: "FREE" | "PRO" | "ENTERPRISE";
  billingEmail?: string | null;
  limits?: { maxVehicles?: number; maxDrivers?: number; maxUsers?: number };
  ownerUserId?: string | null;
  createdAt: string;
  suspendedAt?: string | null;
};

const PLAN_TINT: Record<Tenant["plan"], string> = {
  FREE: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  PRO: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
  ENTERPRISE: "bg-gradient-to-r from-yellow-400 to-yellow-500 text-white",
};

export default function TenantDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await superadminAPI.getTenant(params.id);
      setTenant(res.data.data as Tenant);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const onSuspendToggle = async () => {
    if (!tenant) return;
    setBusy(true);
    try {
      if (tenant.status === "ACTIVE") {
        await superadminAPI.suspendTenant(tenant.id);
      } else {
        await superadminAPI.resumeTenant(tenant.id);
      }
      await load();
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    if (!tenant) return;
    if (
      !confirm(
        `Soft-delete "${tenant.name}"? Records remain in the database but the tenant becomes inaccessible. This cannot be undone from the UI.`,
      )
    )
      return;
    setBusy(true);
    try {
      await superadminAPI.deleteTenant(tenant.id);
      router.push("/superadmin/tenants");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <TenantDetailSkeleton />;
  if (!tenant)
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center dark:border-gray-800 dark:bg-white/[0.02]">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
          Tenant not found.
        </p>
        <Link
          href="/superadmin/tenants"
          className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-yellow-600 hover:text-yellow-700"
        >
          ← Back to all tenants
        </Link>
      </div>
    );

  const initial = tenant.name.charAt(0).toUpperCase();
  const isActive = tenant.status === "ACTIVE";
  const isSuspended = tenant.status === "SUSPENDED";
  const isDeleted = tenant.status === "DELETED";

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Link
        href="/superadmin/tenants"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        All tenants
      </Link>

      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-gray-200/80 bg-gradient-to-br from-yellow-50 via-white to-amber-50 dark:border-gray-800 dark:from-yellow-500/[0.04] dark:via-gray-900 dark:to-amber-500/[0.04] p-6 sm:p-8">
        <div
          aria-hidden
          className={`absolute top-0 left-0 right-0 h-1.5 ${
            isActive
              ? "bg-gradient-to-r from-emerald-400 to-emerald-500"
              : isSuspended
                ? "bg-gradient-to-r from-amber-400 to-amber-500"
                : "bg-gradient-to-r from-red-400 to-red-500"
          }`}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full bg-yellow-300/20 blur-3xl dark:bg-yellow-400/10"
        />
        <div className="relative flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-yellow-400 to-yellow-500 text-white font-black text-2xl shadow-lg shadow-yellow-500/30">
              {initial}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-yellow-700/70 dark:text-yellow-400">
                  Tenant detail
                </span>
                <span className="hidden sm:inline-block h-1 w-1 rounded-full bg-yellow-500/50" />
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider ${PLAN_TINT[tenant.plan]}`}
                >
                  {tenant.plan}
                </span>
                <StatusBadge status={tenant.status} />
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                {tenant.name}
              </h1>
              <p className="font-mono text-xs text-gray-500 dark:text-gray-400 mt-1">
                {tenant.slug}
              </p>
            </div>
          </div>
          {!isDeleted && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={onSuspendToggle}
                disabled={busy}
                className={`inline-flex items-center gap-2 rounded-xl border-2 px-4 py-2.5 text-sm font-semibold transition-all disabled:opacity-50 ${
                  isActive
                    ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400 dark:hover:bg-amber-500/15"
                    : "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/15"
                }`}
              >
                {isActive ? (
                  <>
                    <Pause className="w-4 h-4" />
                    Suspend
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Resume
                  </>
                )}
              </button>
              <button
                onClick={onDelete}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-xl border-2 border-red-300 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/15 transition-all disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Suspended banner */}
      {isSuspended && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 flex items-start gap-3 dark:border-amber-500/30 dark:bg-amber-500/10">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-900 dark:text-amber-300">
              This tenant is currently suspended
            </p>
            <p className="text-xs text-amber-800 dark:text-amber-400/80 mt-0.5">
              {tenant.suspendedAt
                ? `Suspended ${new Date(tenant.suspendedAt).toLocaleString("en-IN")}.`
                : "Suspended."} Users in this tenant can&apos;t access the app until resumed.
            </p>
          </div>
        </div>
      )}

      {/* Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile
          Icon={Truck}
          label="Vehicles cap"
          value={tenant.limits?.maxVehicles ?? "—"}
          tint="text-blue-600 bg-blue-100 dark:bg-blue-500/15 dark:text-blue-400"
        />
        <StatTile
          Icon={UserCircle}
          label="Drivers cap"
          value={tenant.limits?.maxDrivers ?? "—"}
          tint="text-emerald-600 bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-400"
        />
        <StatTile
          Icon={Users}
          label="Users cap"
          value={tenant.limits?.maxUsers ?? "—"}
          tint="text-purple-600 bg-purple-100 dark:bg-purple-500/15 dark:text-purple-400"
        />
        <StatTile
          Icon={Gauge}
          label="Plan"
          value={tenant.plan}
          tint="text-yellow-600 bg-yellow-100 dark:bg-yellow-500/15 dark:text-yellow-400"
        />
      </div>

      {/* Detail panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* General */}
        <div className="lg:col-span-2 rounded-2xl border border-gray-200/80 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.02]">
          <div className="flex items-center gap-2 mb-5">
            <Building2 className="w-4 h-4 text-yellow-500" />
            <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
              General
            </h2>
          </div>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
            <Row label="Name" value={tenant.name} />
            <Row label="Slug" value={tenant.slug} mono />
            <Row label="Status" valueNode={<StatusBadge status={tenant.status} />} />
            <Row label="Plan" valueNode={
              <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider ${PLAN_TINT[tenant.plan]}`}>
                {tenant.plan}
              </span>
            } />
            <Row
              label="Billing email"
              value={tenant.billingEmail ?? "—"}
              icon={tenant.billingEmail ? <Mail className="w-3.5 h-3.5" /> : undefined}
            />
            <Row
              label="Created"
              value={new Date(tenant.createdAt).toLocaleString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
              icon={<Calendar className="w-3.5 h-3.5" />}
            />
          </dl>
        </div>

        {/* Danger zone */}
        <div className="rounded-2xl border border-red-200/80 bg-gradient-to-br from-red-50/60 to-white p-6 dark:border-red-500/20 dark:from-red-500/[0.06] dark:to-gray-900">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-red-500" />
            <h2 className="text-sm font-bold text-red-900 dark:text-red-300 uppercase tracking-wider">
              Danger zone
            </h2>
          </div>
          <p className="text-xs text-red-800/80 dark:text-red-400/70 mb-5">
            Suspending blocks all users in this tenant immediately. Deletion is a
            soft-delete — data is retained but the tenant becomes inaccessible.
          </p>
          {isDeleted ? (
            <div className="rounded-xl bg-red-100 dark:bg-red-500/15 px-4 py-3 flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
              <span className="text-xs font-semibold text-red-700 dark:text-red-300">
                This tenant has been deleted.
              </span>
            </div>
          ) : (
            <div className="space-y-2">
              <button
                onClick={onSuspendToggle}
                disabled={busy}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-white border-2 border-amber-300 hover:bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-700 disabled:opacity-50 transition-colors dark:bg-gray-900 dark:border-amber-500/30 dark:text-amber-400 dark:hover:bg-amber-500/10"
              >
                {isActive ? (
                  <>
                    <Pause className="w-3.5 h-3.5" />
                    Suspend tenant
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    Resume tenant
                  </>
                )}
              </button>
              <button
                onClick={onDelete}
                disabled={busy}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 hover:bg-red-700 px-3 py-2.5 text-xs font-semibold text-white disabled:opacity-50 transition-colors shadow-md shadow-red-500/20"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Soft-delete tenant
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatTile({
  Icon,
  label,
  value,
  tint,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  tint: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200/80 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.02]">
      <div className="flex items-center gap-3">
        <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${tint}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            {label}
          </p>
          <p className="text-lg font-black text-gray-900 dark:text-white truncate">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  valueNode,
  icon,
  mono,
}: {
  label: string;
  value?: string;
  valueNode?: React.ReactNode;
  icon?: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
        {label}
      </dt>
      <dd className="text-sm text-gray-900 dark:text-white flex items-center gap-1.5">
        {icon}
        {valueNode ?? (
          <span className={mono ? "font-mono text-xs" : ""}>{value}</span>
        )}
      </dd>
    </div>
  );
}

function StatusBadge({ status }: { status: Tenant["status"] }) {
  if (status === "ACTIVE")
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
        <CheckCircle2 className="w-3 h-3" />
        Active
      </span>
    );
  if (status === "SUSPENDED")
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
        <AlertTriangle className="w-3 h-3" />
        Suspended
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400">
      <XCircle className="w-3 h-3" />
      Deleted
    </span>
  );
}
