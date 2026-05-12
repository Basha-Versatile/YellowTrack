"use client";

import { useState } from "react";
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
} from "lucide-react";

type Plan = "FREE" | "PRO" | "ENTERPRISE";

const PLAN_DESCRIPTORS: Record<
  Plan,
  { name: string; tagline: string; limits: string; recommended?: boolean }
> = {
  FREE: {
    name: "Free",
    tagline: "Pilot and small fleets",
    limits: "Up to 50 vehicles · 50 drivers",
  },
  PRO: {
    name: "Pro",
    tagline: "Growing operators",
    limits: "Up to 500 vehicles · unlimited drivers",
    recommended: true,
  },
  ENTERPRISE: {
    name: "Enterprise",
    tagline: "Large-scale logistics",
    limits: "Unlimited usage, priority support",
  },
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export default function NewTenantPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [plan, setPlan] = useState<Plan>("PRO");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [billingEmail, setBillingEmail] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    tenant: { id: string; name: string };
    admin: { email: string };
    tempPassword: string;
  } | null>(null);
  const [copied, setCopied] = useState<"email" | "password" | null>(null);

  const handleNameChange = (v: string) => {
    setName(v);
    if (!slugTouched) setSlug(slugify(v));
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
    setSubmitting(true);
    try {
      const res = await superadminAPI.createTenant({
        name,
        slug,
        plan,
        billingEmail: billingEmail || null,
        admin: { name: adminName, email: adminEmail },
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
        {/* Main panel */}
        <div className="lg:col-span-2 space-y-6">
          {/* Organization */}
          <SectionCard Icon={Building2} title="Organization" subtitle="Public details and identifier">
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
              hint={`Used internally and in API paths · /${slug || "your-slug"}`}
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
            <Field label="Billing email" hint="Optional · defaults to the admin email">
              <input
                type="email"
                value={billingEmail}
                onChange={(e) => setBillingEmail(e.target.value)}
                placeholder="billing@acme.com"
                className="input"
              />
            </Field>
          </SectionCard>

          {/* First admin user */}
          <SectionCard Icon={UserPlus} title="First admin user" subtitle="The tenant owner who'll receive the welcome email">
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
            <Field
              label="Email"
              required
              hint="A temporary password will be generated and emailed here"
            >
              <input
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                required
                placeholder="admin@acme.com"
                className="input"
              />
            </Field>
          </SectionCard>

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
                Plan
              </h2>
            </div>
            <div className="space-y-2.5">
              {(Object.keys(PLAN_DESCRIPTORS) as Plan[]).map((p) => {
                const d = PLAN_DESCRIPTORS[p];
                const active = plan === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPlan(p)}
                    className={`relative w-full text-left rounded-xl border-2 p-3.5 transition-all ${
                      active
                        ? "border-yellow-400 bg-yellow-50/50 shadow-md shadow-yellow-500/10 dark:border-yellow-400 dark:bg-yellow-500/[0.06]"
                        : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800/50"
                    }`}
                  >
                    {d.recommended && (
                      <span className="absolute -top-2 right-3 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider bg-gradient-to-r from-yellow-400 to-yellow-500 text-white shadow-sm">
                        Popular
                      </span>
                    )}
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-bold text-gray-900 dark:text-white">
                        {d.name}
                      </span>
                      <span
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          active
                            ? "border-yellow-500 bg-yellow-500"
                            : "border-gray-300 dark:border-gray-600"
                        }`}
                      >
                        {active && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                      {d.tagline}
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-500">
                      {d.limits}
                    </p>
                  </button>
                );
              })}
            </div>
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

function SectionCard({
  Icon,
  title,
  subtitle,
  children,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-200/80 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.02]">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4 text-yellow-500" />
        <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
          {title}
        </h2>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">{subtitle}</p>
      <div className="space-y-4">{children}</div>
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
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
          {label} {required && <span className="text-red-500">*</span>}
        </span>
      </div>
      {children}
      {hint && (
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1.5">{hint}</p>
      )}
    </label>
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
