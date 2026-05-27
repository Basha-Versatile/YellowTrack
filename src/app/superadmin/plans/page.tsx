"use client";

import { useEffect, useMemo, useState } from "react";
import { superadminAPI } from "@/lib/api";
import {
  Sparkles,
  Plus,
  Pencil,
  Pause,
  Play,
  Users,
  Clock,
  CheckCircle2,
  AlertCircle,
  X,
  IndianRupee,
  Truck,
  Percent,
} from "lucide-react";

type Plan = {
  id: string;
  _id?: string;
  name: string;
  description?: string | null;
  currency: string;
  isActive: boolean;
  tenantCount: number;
  createdAt?: string;
  fleetSizeMin: number;
  fleetSizeMax: number | null;
  perVehiclePerMonth: number;
  perVehiclePerYear: number;
  perDriverPerMonth: number;
  gstPercent: number;
};

function formatPrice(amount: number, currency: string): string {
  if (currency === "INR") return `₹${amount.toLocaleString("en-IN")}`;
  if (currency === "USD") return `$${amount.toLocaleString("en-US")}`;
  return `${currency} ${amount.toLocaleString()}`;
}

function fleetBandLabel(min: number, max: number | null): string {
  if (max === null) return `${min}+`;
  return `${min} – ${max}`;
}

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await superadminAPI.listPlans({ includeInactive });
      const list = (res.data.data as Array<Plan & { _id?: string }>).map(
        (p) => ({ ...p, id: String(p.id ?? p._id) }),
      );
      setPlans(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeInactive]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleToggleActive = async (p: Plan) => {
    setBusy(p.id);
    try {
      if (p.isActive) {
        await superadminAPI.deactivatePlan(p.id);
        setToast({ type: "success", message: `${p.name} deactivated` });
      } else {
        await superadminAPI.reactivatePlan(p.id);
        setToast({ type: "success", message: `${p.name} reactivated` });
      }
      await load();
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Action failed";
      setToast({ type: "error", message: msg });
    } finally {
      setBusy(null);
    }
  };

  const summary = useMemo(() => {
    const active = plans.filter((p) => p.isActive).length;
    const inactive = plans.length - active;
    const subscribers = plans.reduce((s, p) => s + p.tenantCount, 0);
    return { active, inactive, subscribers };
  }, [plans]);

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-gray-200/80 bg-gradient-to-br from-yellow-50 via-white to-amber-50 dark:border-gray-800 dark:from-yellow-500/[0.04] dark:via-gray-900 dark:to-amber-500/[0.04] p-6 sm:p-8">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full bg-yellow-300/20 blur-3xl dark:bg-yellow-400/10"
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-yellow-700/70 dark:text-yellow-400">
              Platform · Subscription tiers
            </span>
            <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              Plans
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {summary.active} active · {summary.inactive} inactive · {summary.subscribers} subscriber{summary.subscribers !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-yellow-400 to-yellow-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-yellow-500/30 hover:from-yellow-500 hover:to-yellow-600 transition-all"
          >
            <Plus className="w-4 h-4" />
            New plan
          </button>
        </div>
      </div>

      <TrialDaysCard onSaved={(msg) => setToast({ type: "success", message: msg })} />

      <div className="flex items-center gap-2">
        <label className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-yellow-500 focus:ring-yellow-400"
          />
          Show inactive plans
        </label>
      </div>

      {loading ? (
        <PlansSkeleton />
      ) : plans.length === 0 ? (
        <EmptyPlans onCreate={() => setCreating(true)} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {plans.map((p) => (
            <PlanCard
              key={p.id}
              plan={p}
              busy={busy === p.id}
              onEdit={() => setEditing(p)}
              onToggleActive={() => handleToggleActive(p)}
            />
          ))}
        </div>
      )}

      {(creating || editing) && (
        <PlanEditor
          plan={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={async (msg) => {
            setCreating(false);
            setEditing(null);
            setToast({ type: "success", message: msg });
            await load();
          }}
        />
      )}

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  );
}

// ── Trial-days configuration card (unchanged) ─────────────────────────────
function TrialDaysCard({ onSaved }: { onSaved: (msg: string) => void }) {
  const [trialDays, setTrialDays] = useState<number | "">("");
  const [original, setOriginal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    superadminAPI
      .getSettings()
      .then((r) => {
        const v = (r.data.data?.trialDays as number) ?? 15;
        setTrialDays(v);
        setOriginal(v);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const dirty = original !== null && trialDays !== original && trialDays !== "";

  const save = async () => {
    if (typeof trialDays !== "number" || trialDays < 0 || trialDays > 365) return;
    setSaving(true);
    try {
      await superadminAPI.updateSettings({ trialDays });
      setOriginal(trialDays);
      onSaved(`Trial duration set to ${trialDays} day${trialDays !== 1 ? "s" : ""}`);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-gray-200/80 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.02]">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900 dark:text-white">
              Default free trial
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Applies when a tenant is provisioned without selecting a plan.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            max={365}
            value={trialDays}
            disabled={loading}
            onChange={(e) =>
              setTrialDays(e.target.value === "" ? "" : Number(e.target.value))
            }
            className="w-24 h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-800 focus:border-yellow-400 focus:outline-none focus:ring-3 focus:ring-yellow-400/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white text-center font-mono"
          />
          <span className="text-xs text-gray-500 dark:text-gray-400">days</span>
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving}
            className="ml-1 inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-yellow-400 to-yellow-500 px-4 h-10 text-xs font-semibold text-white shadow-md disabled:opacity-40 disabled:shadow-none transition-all"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PlanCard({
  plan: p,
  busy,
  onEdit,
  onToggleActive,
}: {
  plan: Plan;
  busy: boolean;
  onEdit: () => void;
  onToggleActive: () => void;
}) {
  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border bg-white p-5 transition-all hover:shadow-xl hover:shadow-gray-200/40 dark:bg-white/[0.02] ${
        p.isActive
          ? "border-gray-200/80 dark:border-gray-800"
          : "border-gray-200/60 dark:border-gray-800/60 opacity-75"
      }`}
    >
      <div
        className={`absolute top-0 left-0 right-0 h-1 ${
          p.isActive
            ? "bg-gradient-to-r from-yellow-400 to-yellow-500"
            : "bg-gray-300 dark:bg-gray-700"
        }`}
      />

      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-yellow-400/20 to-yellow-500/10 text-yellow-700 dark:text-yellow-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              {p.name}
            </h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Truck className="w-3 h-3 text-gray-400" />
              <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                Fleet {fleetBandLabel(p.fleetSizeMin, p.fleetSizeMax)}
              </span>
              {!p.isActive && (
                <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                  Inactive
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <RateTile
          label="Per vehicle / month"
          value={formatPrice(p.perVehiclePerMonth, p.currency)}
        />
        <RateTile
          label="Per vehicle / year"
          value={formatPrice(p.perVehiclePerYear, p.currency)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500 dark:text-gray-400 mb-3">
        <span className="inline-flex items-center gap-1">
          <Users className="w-3 h-3" />
          {formatPrice(p.perDriverPerMonth, p.currency)} / driver / month
        </span>
        <span className="inline-flex items-center gap-1">
          <Percent className="w-3 h-3" />
          {p.gstPercent}% GST
        </span>
      </div>

      {p.description && (
        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 min-h-[2rem] mb-3">
          {p.description}
        </p>
      )}

      <div className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400 mb-3">
        <Users className="w-3 h-3" />
        {p.tenantCount} tenant{p.tenantCount !== 1 ? "s" : ""}
      </div>

      <div className="flex gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
        <button
          onClick={onEdit}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700 dark:bg-gray-800/50 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" />
          Edit
        </button>
        <button
          onClick={onToggleActive}
          disabled={busy}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-50 ${
            p.isActive
              ? "bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:hover:bg-amber-500/15"
              : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/15"
          }`}
        >
          {p.isActive ? (
            <>
              <Pause className="w-3.5 h-3.5" />
              Deactivate
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5" />
              Reactivate
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function RateTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/60 px-3 py-2.5 dark:border-gray-700 dark:bg-gray-800/40">
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
        {label}
      </p>
      <p className="text-lg font-extrabold text-gray-900 dark:text-white tracking-tight mt-0.5">
        {value}
      </p>
    </div>
  );
}

// ── Plan editor modal ──────────────────────────────────────────────────────
function PlanEditor({
  plan,
  onClose,
  onSaved,
}: {
  plan: Plan | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const isEditing = Boolean(plan);
  const [name, setName] = useState(plan?.name ?? "");
  const [description, setDescription] = useState(plan?.description ?? "");
  const [currency, setCurrency] = useState(plan?.currency ?? "INR");
  const [fleetSizeMin, setFleetSizeMin] = useState(String(plan?.fleetSizeMin ?? 0));
  const [fleetSizeMax, setFleetSizeMax] = useState(
    plan?.fleetSizeMax === null || plan?.fleetSizeMax === undefined
      ? ""
      : String(plan.fleetSizeMax),
  );
  const [perVehiclePerMonth, setPerVehiclePerMonth] = useState(
    String(plan?.perVehiclePerMonth ?? ""),
  );
  const [perVehiclePerYear, setPerVehiclePerYear] = useState(
    String(plan?.perVehiclePerYear ?? ""),
  );
  const [perDriverPerMonth, setPerDriverPerMonth] = useState(
    String(plan?.perDriverPerMonth ?? "0"),
  );
  const [gstPercent, setGstPercent] = useState(String(plan?.gstPercent ?? 18));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const trimmedMax = fleetSizeMax.trim();
      const payload = {
        name,
        description: description?.trim() || null,
        currency,
        fleetSizeMin: Number(fleetSizeMin) || 0,
        fleetSizeMax: trimmedMax === "" ? null : Number(trimmedMax),
        perVehiclePerMonth: Number(perVehiclePerMonth) || 0,
        perVehiclePerYear: Number(perVehiclePerYear) || 0,
        perDriverPerMonth: Number(perDriverPerMonth) || 0,
        gstPercent: Number(gstPercent) || 0,
      };
      if (isEditing && plan) {
        await superadminAPI.updatePlan(plan.id, payload);
        onSaved(`${name} updated`);
      } else {
        await superadminAPI.createPlan(payload);
        onSaved(`${name} created`);
      }
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Failed to save plan";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => !submitting && onClose()}
      />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[92vh]">
        <div className="bg-gradient-to-r from-yellow-400 to-yellow-500 px-5 py-4 flex-shrink-0">
          <h2 className="text-base font-bold text-white">
            {isEditing ? "Edit plan" : "New plan"}
          </h2>
          <p className="text-white/80 text-[11px] mt-0.5">
            Per-vehicle pricing tiered by fleet size. Leave the max blank for an unlimited upper bound.
          </p>
        </div>
        <form onSubmit={submit} className="flex flex-col flex-1 min-h-0">
          <div className="p-5 space-y-3.5 overflow-y-auto flex-1">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Field label="Plan name" required>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="Silver / Gold / Platinum / Diamond"
                    className="input"
                    maxLength={80}
                  />
                </Field>
              </div>
              <Field label="Currency">
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="input"
                >
                  <option value="INR">INR</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </select>
              </Field>
            </div>

            <Field
              label="Description"
              hint="Optional — helps you remember what this tier is for."
            >
              <input
                type="text"
                value={description ?? ""}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Best for medium fleets"
                className="input"
                maxLength={240}
              />
            </Field>

            <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                Fleet-size band
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Min" required hint="Smallest fleet that qualifies">
                  <input
                    type="number"
                    min="0"
                    value={fleetSizeMin}
                    onChange={(e) => setFleetSizeMin(e.target.value)}
                    required
                    placeholder="0"
                    className="input font-mono"
                  />
                </Field>
                <Field label="Max" hint="Blank = unlimited (+ tier)">
                  <input
                    type="number"
                    min="0"
                    value={fleetSizeMax}
                    onChange={(e) => setFleetSizeMax(e.target.value)}
                    placeholder="∞"
                    className="input font-mono"
                  />
                </Field>
              </div>
            </div>

            <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                Per-vehicle pricing
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Per month" required>
                  <PriceInput
                    value={perVehiclePerMonth}
                    onChange={setPerVehiclePerMonth}
                    placeholder="100"
                  />
                </Field>
                <Field label="Per year" required>
                  <PriceInput
                    value={perVehiclePerYear}
                    onChange={setPerVehiclePerYear}
                    placeholder="1000"
                  />
                </Field>
              </div>
            </div>

            <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                Driver add-on & tax
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Per driver / month">
                  <PriceInput
                    value={perDriverPerMonth}
                    onChange={setPerDriverPerMonth}
                    placeholder="30"
                  />
                </Field>
                <Field label="GST %" hint="Added on top of subtotal">
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={gstPercent}
                      onChange={(e) => setGstPercent(e.target.value)}
                      placeholder="18"
                      className="input !pr-10 font-mono"
                    />
                    <Percent className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                  </div>
                </Field>
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-2 dark:border-red-500/30 dark:bg-red-500/10">
                <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-800 dark:text-red-400">{error}</p>
              </div>
            )}
          </div>
          <div className="flex gap-2.5 px-5 py-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 flex-shrink-0">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 h-10 rounded-lg bg-gradient-to-r from-yellow-400 to-yellow-500 text-white font-semibold text-sm shadow-lg disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {submitting && (
                <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              )}
              {isEditing ? "Save changes" : "Create plan"}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="h-10 px-4 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
          </div>
        </form>

        <style jsx>{`
          :global(.input) {
            width: 100%;
            height: 2.75rem;
            border-radius: 0.75rem;
            border: 1px solid rgb(229 231 235);
            background-color: white;
            padding: 0 1rem;
            font-size: 0.875rem;
            color: rgb(31 41 55);
          }
          :global(.dark .input) {
            border-color: rgb(55 65 81);
            background-color: rgb(31 41 55);
            color: white;
          }
          :global(.input:focus) {
            outline: none;
            border-color: rgb(234 179 8);
            box-shadow: 0 0 0 3px rgb(234 179 8 / 0.1);
          }
        `}</style>
      </div>
    </div>
  );
}

function PriceInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none z-10" />
      <input
        type="number"
        step="0.01"
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input !pl-10 font-mono"
      />
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1.5 block">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
      {hint && (
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1.5">{hint}</p>
      )}
    </label>
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

function EmptyPlans({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-800/20 p-12 text-center">
      <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-yellow-400/20 to-yellow-500/10 flex items-center justify-center mb-4">
        <Sparkles className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
      </div>
      <h3 className="text-base font-bold text-gray-900 dark:text-white">
        No plans yet
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-6">
        Create plans tiered by fleet size so tenants can be billed per vehicle.
      </p>
      <button
        onClick={onCreate}
        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-yellow-400 to-yellow-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-yellow-500/30"
      >
        <Plus className="w-4 h-4" />
        Create your first plan
      </button>
    </div>
  );
}

function PlansSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-gray-200/80 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.02]"
        >
          <div className="flex items-start gap-3 mb-4">
            <div className="w-11 h-11 rounded-xl bg-gray-200/70 dark:bg-gray-700/40 animate-pulse" />
            <div className="space-y-2 flex-1">
              <div className="h-4 w-24 rounded bg-gray-200/70 dark:bg-gray-700/40 animate-pulse" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="h-16 rounded-lg bg-gray-200/70 dark:bg-gray-700/40 animate-pulse" />
            <div className="h-16 rounded-lg bg-gray-200/70 dark:bg-gray-700/40 animate-pulse" />
          </div>
          <div className="flex gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
            <div className="flex-1 h-8 rounded-lg bg-gray-200/70 dark:bg-gray-700/40 animate-pulse" />
            <div className="w-24 h-8 rounded-lg bg-gray-200/70 dark:bg-gray-700/40 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

