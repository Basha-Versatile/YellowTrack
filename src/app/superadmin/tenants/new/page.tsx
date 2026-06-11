"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { superadminAPI } from "@/lib/api";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  UserPlus,
  Copy,
  CheckCircle2,
  Mail,
  Key,
  Sparkles,
  AlertCircle,
  Clock,
  Upload,
  X,
  FileBadge,
  MapPin,
} from "lucide-react";

type Plan = {
  id: string;
  _id?: string;
  name: string;
  description?: string | null;
  currency: string;
  isActive: boolean;
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
  return `${min}–${max}`;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

// GSTIN: 2-digit state code, 5 letters (PAN), 4 digits, 1 letter, 1
// entity/alpha-num, fixed "Z", 1 alpha-num checksum — 15 chars total.
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

// Returns an inline error string for an invalid GST number, or "" when the
// value is empty (optional field) or a well-formed 15-char GSTIN.
function gstinError(raw: string): string {
  const v = raw.trim().toUpperCase();
  if (!v) return "";
  if (v.length !== 15 || !GSTIN_REGEX.test(v)) {
    return "Invalid GST number. Please enter a valid 15-character GSTIN.";
  }
  return "";
}

// PAN: 5 letters, 4 digits, 1 letter — 10 chars total.
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

// Returns an inline error string for an invalid PAN number, or "" when the
// value is empty (optional field) or a well-formed 10-char PAN.
function panError(raw: string): string {
  const v = raw.trim().toUpperCase();
  if (!v) return "";
  if (v.length !== 10 || !PAN_REGEX.test(v)) {
    return "Invalid PAN number. Format should be 10 characters: 5 letters, 4 digits, 1 letter.";
  }
  return "";
}

export default function NewTenantPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [planId, setPlanId] = useState<string>("");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [trialDays, setTrialDays] = useState<number>(15);
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [billingEmail, setBillingEmail] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [adminProfileFile, setAdminProfileFile] = useState<File | null>(null);
  const [adminProfilePreview, setAdminProfilePreview] = useState<string | null>(null);
  const [gstNumber, setGstNumber] = useState("");
  const [gstError, setGstError] = useState("");
  const [panNumber, setPanNumber] = useState("");
  const [panErr, setPanErr] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pinCode, setPinCode] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    tenant: { id: string; name: string };
    admin: { email: string };
    tempPassword: string;
  } | null>(null);
  const [copied, setCopied] = useState<"email" | "password" | null>(null);

  useEffect(() => {
    setPlansLoading(true);
    Promise.all([superadminAPI.listPlans(), superadminAPI.getSettings()])
      .then(([planRes, settingsRes]) => {
        const list = (planRes.data.data as Array<Plan & { _id?: string }>).map(
          (p) => ({ ...p, id: String(p.id ?? p._id) }),
        );
        setPlans(list.filter((p) => p.isActive));
        const days = (settingsRes.data.data?.trialDays as number) ?? 15;
        setTrialDays(days);
      })
      .catch(console.error)
      .finally(() => setPlansLoading(false));
  }, []);

  const selectedPlan = useMemo(
    () => plans.find((p) => p.id === planId),
    [plans, planId],
  );

  const handleNameChange = (v: string) => {
    setName(v);
    if (!slugTouched) setSlug(slugify(v));
  };

  const onLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setLogoFile(f);
    setLogoPreview(f ? URL.createObjectURL(f) : null);
  };

  const onAdminProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setAdminProfileFile(f);
    setAdminProfilePreview(f ? URL.createObjectURL(f) : null);
  };

  const clearLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
  };

  const clearAdminProfile = () => {
    setAdminProfileFile(null);
    setAdminProfilePreview(null);
  };

  const copyToClipboard = async (text: string, which: "email" | "password") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* ignore */
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    // Block provisioning on a malformed GSTIN and pin the error inline by
    // the field (it's optional, so an empty value passes).
    const gstMsg = gstinError(gstNumber);
    const panMsg = panError(panNumber);
    if (gstMsg || panMsg) {
      setGstError(gstMsg);
      setPanErr(panMsg);
      return;
    }
    setSubmitting(true);
    try {
      const res = await superadminAPI.createTenant({
        name,
        slug,
        planId: planId || null,
        billingEmail: billingEmail || null,
        logo: logoFile,
        gstNumber: gstNumber.trim() ? gstNumber.trim().toUpperCase() : null,
        panNumber: panNumber.trim() ? panNumber.trim().toUpperCase() : null,
        addressLine: addressLine.trim() || null,
        city: city.trim() || null,
        state: state.trim() || null,
        pinCode: pinCode.trim() || null,
        admin: {
          name: adminName,
          email: adminEmail,
          profileImage: adminProfileFile,
        },
      });
      setResult(res.data.data);
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Failed to provision tenant";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <Link
          href="/superadmin/tenants"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <ArrowLeft className="w-4 h-4" />
          All tenants
        </Link>

        {/* Success hero */}
        <div className="relative overflow-hidden rounded-3xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-white to-emerald-50 dark:border-emerald-500/20 dark:from-emerald-500/[0.06] dark:via-gray-900 dark:to-emerald-500/[0.06] p-8 text-center">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full bg-emerald-300/20 blur-3xl"
          />
          <div className="relative">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30 mb-4">
              <CheckCircle2 className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              Tenant provisioned
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 max-w-md mx-auto">
              <span className="font-bold text-gray-900 dark:text-white">
                {result.tenant.name}
              </span>{" "}
              is ready. The welcome email has been sent — copy the credentials
              below if you also want to share them through another channel.
            </p>
          </div>
        </div>

        {/* Credentials card */}
        <div className="rounded-2xl border border-gray-200/80 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.02]">
          <div className="flex items-center gap-2 mb-5">
            <Key className="w-4 h-4 text-yellow-500" />
            <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
              Admin credentials
            </h2>
          </div>
          <div className="space-y-3">
            <CopyableField
              label="Email"
              value={result.admin.email}
              Icon={Mail}
              onCopy={() => copyToClipboard(result.admin.email, "email")}
              copied={copied === "email"}
            />
            <CopyableField
              label="Temporary password"
              value={result.tempPassword}
              Icon={Key}
              onCopy={() => copyToClipboard(result.tempPassword, "password")}
              copied={copied === "password"}
              mono
            />
          </div>
          <div className="mt-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 px-4 py-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 dark:text-amber-400">
              The admin will be forced to set a new password on first sign-in.
              This temporary password won&apos;t be shown again — copy it now if
              you need a backup outside email.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <Link
            href={`/superadmin/tenants/${result.tenant.id}`}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-yellow-400 to-yellow-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-yellow-500/30 hover:from-yellow-500 hover:to-yellow-600 transition-all"
          >
            View tenant
            <ArrowRight className="w-4 h-4" />
          </Link>
          <button
            onClick={() => router.push("/superadmin/tenants")}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors"
          >
            Back to list
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Link
        href="/superadmin/tenants"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
      >
        <ArrowLeft className="w-4 h-4" />
        All tenants
      </Link>

      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-gray-200/80 bg-gradient-to-br from-yellow-50 via-white to-amber-50 dark:border-gray-800 dark:from-yellow-500/[0.04] dark:via-gray-900 dark:to-amber-500/[0.04] p-6 sm:p-8">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full bg-yellow-300/20 blur-3xl dark:bg-yellow-400/10"
        />
        <div className="relative">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-yellow-700/70 dark:text-yellow-400">
            Provisioning · New tenant
          </span>
          <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Provision a new tenant
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-2xl">
            Creates the organization, seeds default vehicle groups, and emails a
            temporary password to the first admin user.
          </p>
        </div>
      </div>

      <form onSubmit={submit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main panel — single card, 3-col grid */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl border border-gray-200/80 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.02] space-y-8">
            {/* Organization */}
            <section>
              <SectionHeading Icon={Building2} title="Organization" subtitle="Public details and identifier" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                <Field label="Tenant name" required>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    required
                    placeholder="Acme Logistics"
                    className="input"
                  />
                </Field>
                <Field
                  label="Slug"
                  required
                  hint={`/${slug || "your-slug"}`}
                >
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => {
                      setSlugTouched(true);
                      setSlug(slugify(e.target.value));
                    }}
                    required
                    placeholder="acme-logistics"
                    pattern="^[a-z0-9-]+$"
                    className="input font-mono"
                  />
                </Field>
                <Field label="Billing email" hint="Defaults to admin email">
                  <input
                    type="email"
                    value={billingEmail}
                    onChange={(e) => setBillingEmail(e.target.value)}
                    placeholder="billing@acme.com"
                    className="input"
                  />
                </Field>
                <div className="sm:col-span-2 lg:col-span-3">
                  <Field
                    label="Tenant logo"
                    hint="Optional · shown in the tenant's sidebar. PNG or JPG."
                  >
                    <ImageUpload
                      preview={logoPreview}
                      onChange={onLogoChange}
                      onClear={clearLogo}
                      placeholderLabel="Upload logo"
                      shape="rounded"
                    />
                  </Field>
                </div>
              </div>
            </section>

            {/* Address */}
            <section>
              <SectionHeading Icon={MapPin} title="Registered address" subtitle="Optional · used on invoices" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                <div className="sm:col-span-2 lg:col-span-3">
                  <Field label="Address line">
                    <input
                      type="text"
                      value={addressLine}
                      onChange={(e) => setAddressLine(e.target.value)}
                      placeholder="123 MG Road, Indiranagar"
                      className="input"
                    />
                  </Field>
                </div>
                <Field label="City">
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Bengaluru"
                    className="input"
                  />
                </Field>
                <Field label="State">
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="Karnataka"
                    className="input"
                  />
                </Field>
                <Field label="PIN code" hint="6 digits">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={pinCode}
                    onChange={(e) => setPinCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="560038"
                    maxLength={6}
                    className="input font-mono"
                  />
                </Field>
              </div>
            </section>

            {/* Tax identifiers */}
            <section>
              <SectionHeading Icon={FileBadge} title="Tax identifiers" subtitle="Optional · used on invoices and reports" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                <Field label="GST Number" hint="15 chars, e.g. 27AAPCS9988A1Z5" error={gstError}>
                  <input
                    type="text"
                    value={gstNumber}
                    onChange={(e) => {
                      const next = e.target.value.toUpperCase();
                      setGstNumber(next);
                      // Live-clear the error once it becomes valid; surface it
                      // on blur for partially-typed entries (see onBlur).
                      if (gstError) setGstError(gstinError(next));
                    }}
                    onBlur={() => setGstError(gstinError(gstNumber))}
                    placeholder="27AAPCS9988A1Z5"
                    maxLength={15}
                    aria-invalid={Boolean(gstError)}
                    className={`input font-mono uppercase ${gstError ? "border-red-500 focus:border-red-500 focus:ring-red-500/30" : ""}`}
                  />
                </Field>
                <Field label="PAN Number" hint="10 chars, e.g. AAPCS9988A" error={panErr}>
                  <input
                    type="text"
                    value={panNumber}
                    onChange={(e) => {
                      const next = e.target.value.toUpperCase();
                      setPanNumber(next);
                      if (panErr) setPanErr(panError(next));
                    }}
                    onBlur={() => setPanErr(panError(panNumber))}
                    placeholder="AAPCS9988A"
                    maxLength={10}
                    aria-invalid={Boolean(panErr)}
                    className={`input font-mono uppercase ${panErr ? "border-red-500 focus:border-red-500 focus:ring-red-500/30" : ""}`}
                  />
                </Field>
              </div>
            </section>

            {/* First admin user */}
            <section>
              <SectionHeading Icon={UserPlus} title="First admin user" subtitle="Receives the welcome email" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                <Field label="Full name" required>
                  <input
                    type="text"
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    required
                    placeholder="Alex Patel"
                    className="input"
                  />
                </Field>
                <Field label="Email" required hint="Temp password sent here">
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    required
                    placeholder="admin@acme.com"
                    className="input"
                  />
                </Field>
                <div className="sm:col-span-2 lg:col-span-3">
                  <Field label="Profile picture" hint="Optional · PNG or JPG">
                    <ImageUpload
                      preview={adminProfilePreview}
                      onChange={onAdminProfileChange}
                      onClear={clearAdminProfile}
                      placeholderLabel="Upload profile picture"
                      shape="circle"
                    />
                  </Field>
                </div>
              </div>
            </section>
          </div>

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 flex items-start gap-3 dark:border-red-500/30 dark:bg-red-500/10">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-red-900 dark:text-red-300">
                  Couldn&apos;t provision tenant
                </p>
                <p className="text-xs text-red-800/80 dark:text-red-400 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-yellow-400 to-yellow-500 h-11 px-6 text-sm font-semibold text-white shadow-lg shadow-yellow-500/30 hover:from-yellow-500 hover:to-yellow-600 disabled:opacity-50 transition-all"
            >
              {submitting ? (
                <>
                  <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  Provisioning…
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Provision tenant
                </>
              )}
            </button>
            <Link
              href="/superadmin/tenants"
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 h-11 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </Link>
          </div>
        </div>

        {/* Plan rail */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-200/80 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.02] sticky top-6">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-yellow-500" />
              <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                Subscription
              </h2>
            </div>

            {plansLoading ? (
              <div className="space-y-2">
                <div className="h-10 rounded-lg bg-gray-200/70 dark:bg-gray-700/40 animate-pulse" />
                <div className="h-20 rounded-lg bg-gray-200/70 dark:bg-gray-700/40 animate-pulse" />
              </div>
            ) : plans.length === 0 ? (
              <>
                <div className="rounded-xl border-2 border-dashed border-amber-200 bg-amber-50/40 p-4 mb-3 dark:border-amber-500/20 dark:bg-amber-500/[0.06]">
                  <p className="text-xs font-bold text-amber-800 dark:text-amber-400 mb-1">
                    No plans defined yet
                  </p>
                  <p className="text-[11px] text-amber-700 dark:text-amber-400/80 mb-2">
                    This tenant will get a {trialDays}-day free trial. Create plans on the
                    Plans page to offer paid subscriptions.
                  </p>
                  <Link
                    href="/superadmin/plans"
                    className="text-[11px] font-bold text-amber-700 dark:text-amber-400 hover:underline inline-flex items-center gap-1"
                  >
                    Go to Plans
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
                <PlanSummary
                  isTrial
                  text={`${trialDays}-day free trial`}
                  subText="Tenant can use the app freely. Assign a paid plan later from the tenant detail page."
                />
              </>
            ) : (
              <>
                <label className="block mb-2">
                  <span className="text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1.5 block">
                    Plan
                  </span>
                  <select
                    value={planId}
                    onChange={(e) => setPlanId(e.target.value)}
                    className="w-full h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-800 focus:border-yellow-400 focus:outline-none focus:ring-3 focus:ring-yellow-400/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  >
                    <option value="">— {trialDays}-day free trial —</option>
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · Fleet {fleetBandLabel(p.fleetSizeMin, p.fleetSizeMax)} · {formatPrice(p.perVehiclePerMonth, p.currency)}/veh/mo
                      </option>
                    ))}
                  </select>
                </label>

                {selectedPlan ? (
                  <PlanSummary
                    text={`${formatPrice(selectedPlan.perVehiclePerMonth, selectedPlan.currency)} / vehicle / month`}
                    subText={`Fleet ${fleetBandLabel(selectedPlan.fleetSizeMin, selectedPlan.fleetSizeMax)} · ${formatPrice(selectedPlan.perVehiclePerYear, selectedPlan.currency)}/year · ${formatPrice(selectedPlan.perDriverPerMonth, selectedPlan.currency)}/driver/mo · ${selectedPlan.gstPercent}% GST`}
                  />
                ) : (
                  <PlanSummary
                    isTrial
                    text={`${trialDays}-day free trial`}
                    subText={`No plan selected. Tenant gets free access for ${trialDays} days; assign a paid plan later.`}
                  />
                )}
              </>
            )}
          </div>
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
          transition: all 0.15s;
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
  );
}

function PlanSummary({
  isTrial,
  text,
  subText,
}: {
  isTrial?: boolean;
  text: string;
  subText?: string;
}) {
  return (
    <div
      className={`rounded-xl border-2 p-3.5 ${
        isTrial
          ? "border-blue-200 bg-blue-50/40 dark:border-blue-500/20 dark:bg-blue-500/[0.06]"
          : "border-yellow-300 bg-yellow-50/40 dark:border-yellow-500/30 dark:bg-yellow-500/[0.06]"
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <Clock
          className={`w-3.5 h-3.5 ${isTrial ? "text-blue-600 dark:text-blue-400" : "text-yellow-700 dark:text-yellow-400"}`}
        />
        <p
          className={`text-sm font-bold ${isTrial ? "text-blue-900 dark:text-blue-300" : "text-yellow-900 dark:text-yellow-400"}`}
        >
          {text}
        </p>
      </div>
      {subText && (
        <p
          className={`text-[11px] ${isTrial ? "text-blue-800 dark:text-blue-400/80" : "text-yellow-800 dark:text-yellow-400/80"}`}
        >
          {subText}
        </p>
      )}
    </div>
  );
}

function SectionHeading({
  Icon,
  title,
  subtitle,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="border-b border-gray-100 dark:border-gray-800 pb-3">
      <div className="flex items-center gap-2 mb-0.5">
        <Icon className="w-4 h-4 text-yellow-500" />
        <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
          {title}
        </h2>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
          {label} {required && <span className="text-red-500">*</span>}
        </span>
      </div>
      {children}
      {error ? (
        <p className="text-[11px] font-medium text-red-500 dark:text-red-400 mt-1.5">{error}</p>
      ) : (
        hint && (
          <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1.5">{hint}</p>
        )
      )}
    </label>
  );
}

function ImageUpload({
  preview,
  onChange,
  onClear,
  placeholderLabel,
  shape,
}: {
  preview: string | null;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
  placeholderLabel: string;
  shape: "circle" | "rounded";
}) {
  const shapeClass = shape === "circle" ? "rounded-full" : "rounded-xl";
  return (
    <div className="flex items-center gap-4">
      <div
        className={`relative flex items-center justify-center w-20 h-20 overflow-hidden border-2 border-dashed border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50 ${shapeClass}`}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="w-full h-full object-cover" />
        ) : (
          <Upload className="w-5 h-5 text-gray-400" />
        )}
      </div>
      <div className="flex items-center gap-2">
        <label className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800">
          <Upload className="w-3.5 h-3.5" />
          {preview ? "Replace" : placeholderLabel}
          <input
            type="file"
            accept="image/png,image/jpeg,image/jpg"
            onChange={onChange}
            className="hidden"
          />
        </label>
        {preview && (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <X className="w-3 h-3" />
            Remove
          </button>
        )}
      </div>
    </div>
  );
}

function CopyableField({
  label,
  value,
  Icon,
  onCopy,
  copied,
  mono,
}: {
  label: string;
  value: string;
  Icon: React.ComponentType<{ className?: string }>;
  onCopy: () => void;
  copied: boolean;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/50">
      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white text-yellow-600 dark:bg-gray-900 dark:text-yellow-400">
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
          {label}
        </p>
        <p
          className={`text-sm text-gray-900 dark:text-white truncate ${mono ? "font-mono" : ""}`}
        >
          {value}
        </p>
      </div>
      <button
        type="button"
        onClick={onCopy}
        className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-all ${
          copied
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
            : "bg-white text-gray-600 hover:bg-gray-100 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
        }`}
      >
        {copied ? (
          <>
            <CheckCircle2 className="w-3 h-3" />
            Copied
          </>
        ) : (
          <>
            <Copy className="w-3 h-3" />
            Copy
          </>
        )}
      </button>
    </div>
  );
}
