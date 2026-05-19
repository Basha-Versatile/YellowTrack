"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { superadminAPI } from "@/lib/api";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { TenantDetailSkeleton } from "../../skeletons";
import {
  ArrowLeft,
  Building2,
  Mail,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Pause,
  Play,
  Trash2,
  Shield,
  Sparkles,
  RefreshCw,
  Clock,
  Ban,
  Edit3,
  AlertCircle,
  X,
  Truck,
  IdCard,
  Users,
  ShieldCheck,
  Infinity as InfinityIcon,
  UserCheck,
  KeyRound,
} from "lucide-react";

type Tenant = {
  id: string;
  name: string;
  slug: string;
  status: "ACTIVE" | "SUSPENDED" | "DELETED";
  planId?: string | null;
  subscriptionStart?: string | null;
  subscriptionEnd?: string | null;
  subscriptionStatus: "TRIAL" | "ACTIVE" | "EXPIRED" | "CANCELLED";
  billingEmail?: string | null;
  ownerUserId?: string | null;
  createdAt: string;
  suspendedAt?: string | null;
};

type Plan = {
  id: string;
  _id?: string;
  name: string;
  description?: string | null;
  price: number;
  currency: string;
  durationDays: number;
  isActive: boolean;
  maxVehicles?: number | null;
  maxDrivers?: number | null;
  maxUsers?: number | null;
  maxRoles?: number | null;
};

type QuotaResource = "vehicle" | "driver" | "user" | "role";
type QuotaUsage = {
  resource: QuotaResource;
  used: number;
  limit: number | null;
};

type TenantUser = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "OPERATOR" | "SUPERADMIN";
  roleId: string | null;
  status: "ACTIVE" | "SUSPENDED";
  mustResetPassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  isOwner: boolean;
};

type TenantRole = {
  id: string;
  name: string;
  description?: string | null;
  permissions: string[];
  isSystem: boolean;
  memberCount?: number;
};

function formatPrice(amount: number, currency: string): string {
  if (currency === "INR") return `₹${amount.toLocaleString("en-IN")}`;
  if (currency === "USD") return `$${amount.toLocaleString("en-US")}`;
  return `${currency} ${amount.toLocaleString()}`;
}

function daysBetween(future: Date | string): number {
  return Math.ceil(
    (new Date(future).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
}

const SUB_STATUS_TINT: Record<Tenant["subscriptionStatus"], string> = {
  TRIAL: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
  ACTIVE: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  EXPIRED: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400",
  CANCELLED: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

export default function TenantDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [quota, setQuota] = useState<QuotaUsage[]>([]);
  const [tenantUsers, setTenantUsers] = useState<TenantUser[]>([]);
  const [tenantRoles, setTenantRoles] = useState<TenantRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [changePlanOpen, setChangePlanOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<"delete" | "cancel" | null>(null);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [tRes, pRes, qRes, uRes, rRes] = await Promise.all([
        superadminAPI.getTenant(params.id),
        superadminAPI.listPlans(),
        superadminAPI.getTenantQuota(params.id),
        superadminAPI.getTenantUsers(params.id),
        superadminAPI.getTenantRoles(params.id),
      ]);
      setTenant(tRes.data.data as Tenant);
      const list = (pRes.data.data as Array<Plan & { _id?: string }>).map(
        (p) => ({ ...p, id: String(p.id ?? p._id) }),
      );
      setPlans(list.filter((p) => p.isActive));
      setQuota((qRes.data.data as QuotaUsage[]) ?? []);
      setTenantUsers((uRes.data.data as TenantUser[]) ?? []);
      setTenantRoles((rRes.data.data as TenantRole[]) ?? []);
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

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const currentPlan = useMemo(
    () => (tenant?.planId ? plans.find((p) => p.id === String(tenant.planId)) : null),
    [tenant, plans],
  );

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

  const runDelete = async () => {
    if (!tenant) return;
    setPendingAction(null);
    setBusy(true);
    try {
      await superadminAPI.deleteTenant(tenant.id);
      router.push("/superadmin/tenants");
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Failed to delete tenant";
      setToast({ type: "error", message: msg });
    } finally {
      setBusy(false);
    }
  };

  const onRenew = async () => {
    if (!tenant) return;
    setBusy(true);
    try {
      await superadminAPI.renewTenantSubscription(tenant.id);
      setToast({ type: "success", message: "Subscription renewed" });
      await load();
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Renewal failed";
      setToast({ type: "error", message: msg });
    } finally {
      setBusy(false);
    }
  };

  const runCancel = async () => {
    if (!tenant) return;
    setPendingAction(null);
    setBusy(true);
    try {
      await superadminAPI.cancelTenantSubscription(tenant.id);
      setToast({ type: "success", message: "Subscription cancelled" });
      await load();
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Cancellation failed";
      setToast({ type: "error", message: msg });
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

  const subEnd = tenant.subscriptionEnd
    ? new Date(tenant.subscriptionEnd)
    : null;
  const daysLeft = subEnd ? daysBetween(subEnd) : null;
  const expired =
    tenant.subscriptionStatus === "EXPIRED" ||
    (subEnd ? subEnd.getTime() < Date.now() : false);

  return (
    <div className="space-y-6">
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
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-yellow-700/70 dark:text-yellow-400">
                  Tenant detail
                </span>
                <span className="hidden sm:inline-block h-1 w-1 rounded-full bg-yellow-500/50" />
                <StatusBadge status={tenant.status} />
                <SubscriptionBadge status={tenant.subscriptionStatus} />
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
                onClick={() => setPendingAction("delete")}
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

      {/* Banners */}
      {isSuspended && (
        <Banner
          icon={<AlertTriangle className="w-5 h-5" />}
          tone="amber"
          title="This tenant is currently suspended"
          body={
            tenant.suspendedAt
              ? `Suspended ${new Date(tenant.suspendedAt).toLocaleString("en-IN")}. Users can't access the app until resumed.`
              : "Users can't access the app until resumed."
          }
        />
      )}
      {expired && !isDeleted && !isSuspended && (
        <Banner
          icon={<XCircle className="w-5 h-5" />}
          tone="red"
          title="Subscription expired"
          body={`Subscription ended ${subEnd ? new Date(subEnd).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : ""}. Renew or change the plan to restore access.`}
        />
      )}
      {!expired &&
        !isDeleted &&
        !isSuspended &&
        tenant.subscriptionStatus === "TRIAL" &&
        currentPlan && (
          <Banner
            icon={<Sparkles className="w-5 h-5" />}
            tone="amber"
            title={`${currentPlan.name} is queued for this tenant`}
            body={`Trial runs until ${subEnd ? new Date(subEnd).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : ""}. On that day the plan auto-activates for ${currentPlan.durationDays} days (${formatPrice(currentPlan.price, currentPlan.currency)}).`}
          />
        )}

      {/* Subscription + General + Danger */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Subscription */}
        <div className="lg:col-span-2 rounded-2xl border border-gray-200/80 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.02]">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-yellow-500" />
              <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                Subscription
              </h2>
            </div>
            {!isDeleted && (
              <div className="flex gap-2">
                {tenant.planId && tenant.subscriptionStatus !== "CANCELLED" && (
                  <button
                    onClick={onRenew}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/15 disabled:opacity-50"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Renew
                  </button>
                )}
                <button
                  onClick={() => setChangePlanOpen(true)}
                  disabled={busy || plans.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-yellow-50 hover:bg-yellow-100 px-3 py-1.5 text-xs font-semibold text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400 dark:hover:bg-yellow-500/15 disabled:opacity-50"
                  title={plans.length === 0 ? "No plans available" : undefined}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  {tenant.planId ? "Change plan" : "Assign plan"}
                </button>
                {tenant.planId && tenant.subscriptionStatus !== "CANCELLED" && (
                  <button
                    onClick={() => setPendingAction("cancel")}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 hover:bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/15 disabled:opacity-50"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    Cancel
                  </button>
                )}
              </div>
            )}
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
            <Row
              label="Current plan"
              valueNode={
                currentPlan ? (
                  <span className="text-sm font-bold text-gray-900 dark:text-white inline-flex items-center gap-2">
                    {currentPlan.name}{" "}
                    <span className="text-gray-500 font-normal">
                      · {formatPrice(currentPlan.price, currentPlan.currency)} / {currentPlan.durationDays}d
                    </span>
                    {tenant.subscriptionStatus === "TRIAL" && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
                        Queued
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="text-sm text-blue-700 dark:text-blue-400 font-semibold">
                    Free trial
                  </span>
                )
              }
            />
            <Row
              label="Status"
              valueNode={<SubscriptionBadge status={tenant.subscriptionStatus} />}
            />
            <Row
              label="Start date"
              value={
                tenant.subscriptionStart
                  ? new Date(tenant.subscriptionStart).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : "—"
              }
              icon={<Calendar className="w-3.5 h-3.5" />}
            />
            <Row
              label="End date"
              value={
                subEnd
                  ? subEnd.toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : "—"
              }
              icon={<Calendar className="w-3.5 h-3.5" />}
            />
            <Row
              label="Days remaining"
              valueNode={
                daysLeft === null ? (
                  <span className="text-sm text-gray-400">—</span>
                ) : daysLeft <= 0 ? (
                  <span className="text-sm font-bold text-red-600 dark:text-red-400">
                    Expired
                  </span>
                ) : (
                  <span
                    className={`text-sm font-bold ${
                      daysLeft <= 7
                        ? "text-amber-700 dark:text-amber-400"
                        : "text-gray-900 dark:text-white"
                    }`}
                  >
                    {daysLeft} day{daysLeft !== 1 ? "s" : ""}
                  </span>
                )
              }
              icon={<Clock className="w-3.5 h-3.5" />}
            />
            <Row
              label="Billing email"
              value={tenant.billingEmail ?? "—"}
              icon={
                tenant.billingEmail ? <Mail className="w-3.5 h-3.5" /> : undefined
              }
            />
          </dl>

          <div className="mt-6 pt-5 border-t border-gray-100 dark:border-gray-800">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Resource usage
              </h3>
              {!tenant.planId && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  All unlimited (no plan)
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {quota.map((q) => (
                <QuotaUsageCard key={q.resource} usage={q} />
              ))}
            </div>
          </div>
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
            Suspending blocks all users immediately. Deletion is a soft-delete
            — data is retained but the tenant becomes inaccessible.
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
                onClick={() => setPendingAction("delete")}
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

      {/* General info */}
      <div className="rounded-2xl border border-gray-200/80 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.02]">
        <div className="flex items-center gap-2 mb-5">
          <Building2 className="w-4 h-4 text-yellow-500" />
          <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
            General
          </h2>
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-5">
          <Row label="Name" value={tenant.name} />
          <Row label="Slug" value={tenant.slug} mono />
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

      {/* Members (users + roles) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TenantUsersCard users={tenantUsers} />
        <TenantRolesCard roles={tenantRoles} />
      </div>

      {/* Change plan modal */}
      {changePlanOpen && tenant && (
        <ChangePlanModal
          tenantName={tenant.name}
          currentPlanId={tenant.planId ?? null}
          plans={plans}
          onClose={() => setChangePlanOpen(false)}
          onChange={async (planId) => {
            setChangePlanOpen(false);
            setBusy(true);
            try {
              await superadminAPI.changeTenantPlan(tenant.id, planId);
              setToast({ type: "success", message: "Plan changed" });
              await load();
            } catch (err) {
              const msg =
                (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
                "Failed to change plan";
              setToast({ type: "error", message: msg });
            } finally {
              setBusy(false);
            }
          }}
        />
      )}

      <ConfirmDialog
        isOpen={pendingAction === "delete"}
        title={`Soft-delete "${tenant.name}"?`}
        message="Records remain in the database but the tenant becomes inaccessible to its users."
        confirmLabel="Delete tenant"
        cancelLabel="Keep"
        variant="danger"
        loading={busy}
        onConfirm={runDelete}
        onCancel={() => setPendingAction(null)}
      />

      <ConfirmDialog
        isOpen={pendingAction === "cancel"}
        title={`Cancel subscription for "${tenant.name}"?`}
        message="Tenant keeps access until the current end date, then gets blocked from logging in."
        confirmLabel="Cancel subscription"
        cancelLabel="Keep"
        variant="warning"
        loading={busy}
        onConfirm={runCancel}
        onCancel={() => setPendingAction(null)}
      />

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  );
}

function ChangePlanModal({
  tenantName,
  currentPlanId,
  plans,
  onClose,
  onChange,
}: {
  tenantName: string;
  currentPlanId: string | null;
  plans: Plan[];
  onClose: () => void;
  onChange: (planId: string) => void;
}) {
  const [selected, setSelected] = useState<string>(currentPlanId ?? "");

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="bg-gradient-to-r from-yellow-400 to-yellow-500 px-6 py-5">
          <h2 className="text-lg font-bold text-white">Change plan</h2>
          <p className="text-white/80 text-xs mt-0.5 truncate">{tenantName}</p>
        </div>
        <div className="p-6 space-y-2 max-h-[60vh] overflow-y-auto">
          {plans.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">
              No active plans available. Create one on the Plans page first.
            </p>
          ) : (
            plans.map((p) => {
              const active = selected === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelected(p.id)}
                  className={`relative w-full text-left rounded-xl border-2 p-3.5 transition-all ${
                    active
                      ? "border-yellow-400 bg-yellow-50/50 dark:border-yellow-400 dark:bg-yellow-500/[0.06]"
                      : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-gray-900 dark:text-white">
                      {p.name}
                    </span>
                    <span className="text-sm font-bold text-yellow-700 dark:text-yellow-400">
                      {formatPrice(p.price, p.currency)} / {p.durationDays}d
                    </span>
                  </div>
                  {p.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {p.description}
                    </p>
                  )}
                </button>
              );
            })
          )}
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
          <button
            type="button"
            onClick={() => selected && onChange(selected)}
            disabled={!selected || plans.length === 0}
            className="flex-1 h-11 rounded-xl bg-gradient-to-r from-yellow-400 to-yellow-500 text-white font-semibold text-sm shadow-lg disabled:opacity-50"
          >
            Apply plan
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-11 px-5 rounded-xl border-2 border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function Banner({
  icon,
  tone,
  title,
  body,
}: {
  icon: React.ReactNode;
  tone: "amber" | "red";
  title: string;
  body: string;
}) {
  const cls =
    tone === "amber"
      ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400"
      : "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400";
  return (
    <div
      className={`rounded-2xl border px-5 py-4 flex items-start gap-3 ${cls}`}
    >
      <span className="flex-shrink-0 mt-0.5">{icon}</span>
      <div>
        <p className="text-sm font-bold">{title}</p>
        <p className="text-xs opacity-80 mt-0.5">{body}</p>
      </div>
    </div>
  );
}

function Toast({
  type,
  message,
  onClose,
}: {
  type: "success" | "error";
  message: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed bottom-6 right-6 z-[100000] max-w-sm">
      <div
        className={`flex items-center gap-3 rounded-xl border px-4 py-3 shadow-2xl ${
          type === "success"
            ? "border-emerald-200 bg-white text-emerald-700 dark:border-emerald-500/30 dark:bg-gray-900 dark:text-emerald-400"
            : "border-red-200 bg-white text-red-700 dark:border-red-500/30 dark:bg-gray-900 dark:text-red-400"
        }`}
      >
        {type === "success" ? (
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
        ) : (
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
        )}
        <p className="text-sm font-medium">{message}</p>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
        >
          <X className="w-3.5 h-3.5" />
        </button>
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

const QUOTA_ICONS: Record<QuotaResource, React.ReactNode> = {
  vehicle: <Truck className="w-3.5 h-3.5" />,
  driver: <IdCard className="w-3.5 h-3.5" />,
  user: <Users className="w-3.5 h-3.5" />,
  role: <ShieldCheck className="w-3.5 h-3.5" />,
};
const QUOTA_LABEL: Record<QuotaResource, string> = {
  vehicle: "Vehicles",
  driver: "Drivers",
  user: "Users",
  role: "Roles",
};

function QuotaUsageCard({ usage }: { usage: QuotaUsage }) {
  const limit = usage.limit;
  const unlimited = limit === null;
  const pct = unlimited
    ? 0
    : limit === 0
      ? 100
      : Math.min(100, Math.round((usage.used / limit) * 100));
  const nearLimit = !unlimited && pct >= 80;
  const atLimit = !unlimited && usage.used >= (limit ?? 0);
  return (
    <div
      className={`rounded-xl border p-3 ${
        atLimit
          ? "border-red-200 bg-red-50/50 dark:border-red-500/30 dark:bg-red-500/[0.05]"
          : nearLimit
            ? "border-amber-200 bg-amber-50/50 dark:border-amber-500/30 dark:bg-amber-500/[0.05]"
            : "border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02]"
      }`}
    >
      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
        {QUOTA_ICONS[usage.resource]}
        {QUOTA_LABEL[usage.resource]}
      </div>
      <div className="flex items-baseline gap-1">
        <span
          className={`text-lg font-black tracking-tight ${
            atLimit
              ? "text-red-700 dark:text-red-400"
              : nearLimit
                ? "text-amber-700 dark:text-amber-400"
                : "text-gray-900 dark:text-white"
          }`}
        >
          {usage.used}
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400">/</span>
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 inline-flex items-center">
          {unlimited ? <InfinityIcon className="w-3.5 h-3.5" /> : usage.limit}
        </span>
      </div>
      {!unlimited && (
        <div className="mt-2 h-1 w-full rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              atLimit
                ? "bg-red-500"
                : nearLimit
                  ? "bg-amber-500"
                  : "bg-emerald-500"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

function formatRelativeDate(d: string | null): string {
  if (!d) return "—";
  const ms = Date.now() - new Date(d).getTime();
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function TenantUsersCard({ users }: { users: TenantUser[] }) {
  return (
    <div className="rounded-2xl border border-gray-200/80 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.02]">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-yellow-500" />
          <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
            Users
          </h2>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
            {users.length}
          </span>
        </div>
      </div>

      {users.length === 0 ? (
        <p className="text-xs text-gray-500 dark:text-gray-400 py-3 text-center">
          No users yet
        </p>
      ) : (
        <ul className="divide-y divide-gray-100/70 dark:divide-gray-800">
          {users.map((u) => (
            <li
              key={u.id}
              className="py-2.5 flex items-center gap-3 first:pt-0 last:pb-0"
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold uppercase ${
                  u.role === "ADMIN"
                    ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400"
                    : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                }`}
                title={u.name}
              >
                {u.name?.slice(0, 2) || "?"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-[13px] font-semibold text-gray-900 dark:text-white truncate">
                    {u.name}
                  </p>
                  {u.isOwner && (
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400">
                      Owner
                    </span>
                  )}
                  {u.role === "ADMIN" ? (
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400">
                      Admin
                    </span>
                  ) : (
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                      Operator
                    </span>
                  )}
                  {u.status === "SUSPENDED" && (
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400">
                      Suspended
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                  {u.email}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold">
                  Last login
                </p>
                <p className="text-[11px] text-gray-700 dark:text-gray-300 mt-0.5">
                  {formatRelativeDate(u.lastLoginAt)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TenantRolesCard({ roles }: { roles: TenantRole[] }) {
  return (
    <div className="rounded-2xl border border-gray-200/80 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.02]">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-yellow-500" />
          <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
            Roles
          </h2>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
            {roles.length}
          </span>
        </div>
      </div>

      {roles.length === 0 ? (
        <p className="text-xs text-gray-500 dark:text-gray-400 py-3 text-center">
          No custom roles defined
        </p>
      ) : (
        <ul className="divide-y divide-gray-100/70 dark:divide-gray-800">
          {roles.map((r) => (
            <li
              key={r.id}
              className="py-2.5 flex items-start gap-3 first:pt-0 last:pb-0"
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-yellow-50 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400 flex-shrink-0">
                <ShieldCheck className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-[13px] font-semibold text-gray-900 dark:text-white">
                    {r.name}
                  </p>
                  {r.isSystem && (
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                      System
                    </span>
                  )}
                </div>
                {r.description && (
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                    {r.description}
                  </p>
                )}
              </div>
              <div className="text-right flex-shrink-0 space-y-0.5">
                <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold">
                  Members
                </p>
                <p className="text-[13px] font-bold text-gray-900 dark:text-white">
                  {r.memberCount ?? 0}
                </p>
              </div>
              <div className="text-right flex-shrink-0 min-w-[60px]">
                <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold">
                  Perms
                </p>
                <p className="text-[13px] font-bold text-gray-700 dark:text-gray-300">
                  {r.permissions?.length ?? 0}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SubscriptionBadge({
  status,
}: {
  status: Tenant["subscriptionStatus"];
}) {
  const label =
    status === "TRIAL"
      ? "Trial"
      : status === "ACTIVE"
        ? "Subscription active"
        : status === "EXPIRED"
          ? "Expired"
          : "Cancelled";
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider ${SUB_STATUS_TINT[status]}`}
    >
      <Sparkles className="w-3 h-3" />
      {label}
    </span>
  );
}
