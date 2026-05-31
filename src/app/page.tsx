"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  ShieldCheck,
  Truck,
  Bell,
  Users,
  FileBadge,
  Gauge,
  Wrench,
  Wallet,
  Sparkles,
  Check,
  Plus,
  Minus,
  Star,
  Smartphone,
  Mail,
  MapPin,
  Crown,
  Building2,
  Lock,
  Zap,
  ChartBar,
  IndianRupee,
} from "lucide-react";

export default function LandingPage() {
  return (
    <main className="overflow-x-hidden">
      <TopNav />
      <Hero />
      <TrustStrip />
      <Features />
      <HowItWorks />
      <Pricing />
      <Testimonials />
      <FAQ />
      <FinalCTA />
      <Footer />
    </main>
  );
}

// ── Top navigation ──────────────────────────────────────────────────────────
function TopNav() {
  const [open, setOpen] = useState(false);
  return (
    <nav className="sticky top-0 z-50 backdrop-blur-md bg-white/80 dark:bg-gray-950/80 border-b border-gray-100 dark:border-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <span className="relative w-35 h-35">
            <Image
              src="/images/logo/yellow-track-logo.svg"
              alt="Yellow Track"
              fill
              sizes="140px"
              className="object-contain"
              priority
            />
          </span>
          {/* <span className="text-lg font-black tracking-tight">
            <span className="text-yellow-500">Yellow</span>
            <span className="text-gray-900 dark:text-white"> Track</span>
          </span> */}
        </Link>

        <div className="hidden md:flex items-center gap-7 text-sm font-semibold text-gray-600 dark:text-gray-300">
          <a href="#features" className="hover:text-gray-900 dark:hover:text-white transition-colors">
            Features
          </a>
          <a href="#pricing" className="hover:text-gray-900 dark:hover:text-white transition-colors">
            Pricing
          </a>
          <a href="#how" className="hover:text-gray-900 dark:hover:text-white transition-colors">
            How it works
          </a>
          <a href="#faq" className="hover:text-gray-900 dark:hover:text-white transition-colors">
            FAQ
          </a>
        </div>

        <div className="hidden md:flex items-center gap-2.5">
          <Link
            href="/auth"
            className="text-sm font-semibold text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-2"
          >
            Sign in
          </Link>
          <Link
            href="/auth?mode=signup"
            className="inline-flex items-center gap-1.5 rounded-xl bg-gray-900 dark:bg-white text-yellow-400 dark:text-yellow-600 px-4 py-2.5 text-sm font-bold shadow-lg shadow-gray-900/15 hover:shadow-gray-900/25 transition-all"
          >
            Get started
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          className="md:hidden w-10 h-10 flex items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
          aria-label="Open menu"
        >
          {open ? <Minus className="w-5 h-5" /> : <Plus className="w-5 h-5 rotate-45" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-gray-100 dark:border-gray-900 bg-white dark:bg-gray-950 px-4 py-4 space-y-3">
          <a onClick={() => setOpen(false)} href="#features" className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Features</a>
          <a onClick={() => setOpen(false)} href="#pricing" className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Pricing</a>
          <a onClick={() => setOpen(false)} href="#how" className="block text-sm font-semibold text-gray-700 dark:text-gray-300">How it works</a>
          <a onClick={() => setOpen(false)} href="#faq" className="block text-sm font-semibold text-gray-700 dark:text-gray-300">FAQ</a>
          <div className="pt-3 border-t border-gray-100 dark:border-gray-900 flex gap-2">
            <Link href="/auth" className="flex-1 text-center text-sm font-semibold text-gray-700 dark:text-gray-300 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800">
              Sign in
            </Link>
            <Link href="/auth?mode=signup" className="flex-1 text-center text-sm font-bold text-yellow-400 dark:text-yellow-600 bg-gray-900 dark:bg-white py-2.5 rounded-xl">
              Get started
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}

// ── Hero ────────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Background — yellow glow + grid */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-yellow-50 via-white to-amber-50 dark:from-yellow-500/[0.04] dark:via-gray-950 dark:to-amber-500/[0.04]" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full bg-yellow-300/20 dark:bg-yellow-500/10 blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full bg-amber-200/30 dark:bg-amber-500/5 blur-[100px]" />
        <div
          className="absolute inset-0 opacity-[0.04] dark:opacity-[0.06]"
          style={{
            backgroundImage: `linear-gradient(rgba(0,0,0,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.6) 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-24 pb-20 sm:pb-28 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-gray-900 dark:bg-white text-yellow-400 dark:text-yellow-600 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.18em] shadow-md">
            <Sparkles className="w-3 h-3" />
            Built for India&apos;s roads
          </span>

          <h1 className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.05]">
            Fleet management
            <br />
            <span className="bg-gradient-to-r from-yellow-500 via-yellow-400 to-amber-500 bg-clip-text text-transparent">
              that doesn&apos;t miss a beat.
            </span>
          </h1>

          <p className="mt-5 text-base sm:text-lg text-gray-600 dark:text-gray-400 max-w-xl leading-relaxed">
            RC, Insurance, PUC, Permit, Fitness, FASTag, Challans, Drivers, EMIs — all of it tracked, alerted, and reported from one yellow dashboard.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/auth?mode=signup"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-yellow-400 to-yellow-500 px-6 py-3.5 text-sm font-bold text-white shadow-xl shadow-yellow-500/30 hover:shadow-yellow-500/50 hover:from-yellow-500 hover:to-yellow-600 transition-all active:scale-[0.98]"
            >
              Start free 15-day trial
              <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="#pricing"
              className="inline-flex items-center gap-2 rounded-xl border-2 border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-6 py-3.5 text-sm font-bold text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-700 transition-all"
            >
              See pricing
            </a>
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] text-gray-500 dark:text-gray-400">
            <span className="inline-flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-500" />
              No credit card required
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-500" />
              GST-compliant invoicing
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-500" />
              Cancel any time
            </span>
          </div>
        </div>

        {/* Dashboard mockup card */}
        <HeroMockup />
      </div>
    </section>
  );
}

function HeroMockup() {
  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute -inset-6 rounded-3xl bg-gradient-to-tr from-yellow-300/40 via-amber-200/30 to-yellow-400/20 dark:from-yellow-500/20 dark:via-amber-500/10 dark:to-yellow-400/10 blur-2xl"
      />
      <div className="relative rounded-3xl bg-gray-900 dark:bg-gray-900 p-2 shadow-2xl shadow-gray-900/30 dark:shadow-black/60 ring-1 ring-gray-200/30 dark:ring-gray-800">
        {/* macOS chrome */}
        <div className="flex items-center gap-1.5 px-3 pb-2">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
        </div>
        <div className="rounded-2xl bg-white dark:bg-gray-950 p-5 space-y-4">
          {/* Header strip */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Fleet overview</p>
              <p className="text-xl font-black text-gray-900 dark:text-white">Dashboard</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-2.5 py-1 text-[10px] font-bold uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </span>
          </div>

          {/* KPI tiles */}
          <div className="grid grid-cols-3 gap-2">
            <KPITile label="Vehicles" value="1000+" tone="gray" />
            <KPITile label="Compliant" value="942" tone="emerald" />
            <KPITile label="Expiring" value="58" tone="amber" />
          </div>

          {/* Compliance row */}
          <div className="rounded-xl border border-gray-100 dark:border-gray-800 p-3">
            <div className="flex items-center justify-between text-[11px] font-bold mb-2">
              <span className="text-gray-700 dark:text-gray-300">TG09AB9999 · Hilux</span>
              <span className="text-emerald-600 dark:text-emerald-400">OK</span>
            </div>
            <div className="flex gap-1.5">
              {["FIT", "INS", "PMT", "PUC", "RC", "TAX"].map((tag) => (
                <span
                  key={tag}
                  className="flex-1 text-[9px] font-extrabold uppercase tracking-wider text-center rounded-md bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 py-1.5"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Mini chart */}
          <div className="rounded-xl border border-gray-100 dark:border-gray-800 p-3">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300">
                Tyre brand performance
              </span>
              <ChartBar className="w-3.5 h-3.5 text-yellow-500" />
            </div>
            <div className="flex items-end gap-1.5 h-16">
              {[60, 80, 45, 95, 55, 70].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t bg-gradient-to-t from-yellow-400 to-yellow-300 dark:from-yellow-500 dark:to-yellow-400"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Floating notification badge */}
      <div className="absolute -bottom-6 -left-4 sm:-left-8 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-2xl px-4 py-3 flex items-center gap-3 max-w-[260px]">
        <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 flex-shrink-0">
          <Bell className="w-4 h-4" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-bold text-gray-900 dark:text-white truncate">Insurance expiring</p>
          <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">TG09AB9999 · 7 days left</p>
        </div>
      </div>

      {/* Floating brand chip */}
      <div className="hidden sm:flex absolute -top-4 -right-4 rounded-2xl bg-gray-900 dark:bg-white px-4 py-3 items-center gap-2.5 shadow-2xl">
        <Truck className="w-5 h-5 text-yellow-400 dark:text-yellow-600" />
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-yellow-400 dark:text-yellow-600">Fleet size</p>
          <p className="text-sm font-black text-white dark:text-gray-900">1000+ vehicles</p>
        </div>
      </div>
    </div>
  );
}

function KPITile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "gray" | "emerald" | "amber";
}) {
  const ring =
    tone === "emerald"
      ? "border-emerald-200/60 bg-emerald-50/50 dark:border-emerald-500/20 dark:bg-emerald-500/5"
      : tone === "amber"
        ? "border-amber-200/60 bg-amber-50/50 dark:border-amber-500/20 dark:bg-amber-500/5"
        : "border-gray-200/80 bg-white dark:border-gray-800 dark:bg-gray-900/50";
  const numColor =
    tone === "emerald"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "amber"
        ? "text-amber-600 dark:text-amber-400"
        : "text-gray-900 dark:text-white";
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${ring}`}>
      <p className="text-[9px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
        {label}
      </p>
      <p className={`text-xl font-black leading-tight mt-0.5 ${numColor}`}>{value}</p>
    </div>
  );
}

// ── Trust strip ─────────────────────────────────────────────────────────────
function TrustStrip() {
  const stats = [
    { value: "₹0", label: "to start" },
    { value: "15 days", label: "free trial" },
    { value: "6+", label: "compliance docs tracked" },
    { value: "100%", label: "tenant-isolated data" },
  ];
  return (
    <section className="border-y border-gray-100 dark:border-gray-900 bg-gray-50/50 dark:bg-gray-900/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-2 sm:grid-cols-4 gap-6">
        {stats.map((s) => (
          <div key={s.label} className="text-center">
            <p className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight">
              {s.value}
            </p>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mt-1">
              {s.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Features grid ───────────────────────────────────────────────────────────
function Features() {
  const features = [
    {
      icon: Truck,
      title: "Vehicle onboarding",
      desc: "Auto-fill from RC number, upload photos, group by Trucks / Cars / Bikes, tag private vs commercial.",
      accent: "from-blue-400 to-blue-500",
    },
    {
      icon: ShieldCheck,
      title: "Compliance tracking",
      desc: "RC, Insurance, Permit, PUC, Fitness, Tax — each with issue + expiry dates and color-coded status.",
      accent: "from-emerald-400 to-emerald-500",
    },
    {
      icon: Bell,
      title: "Smart alerts",
      desc: "Email + WhatsApp reminders 30, 14, 7, 3, 1 days before any document expires. Never miss a renewal.",
      accent: "from-amber-400 to-amber-500",
    },
    {
      icon: Users,
      title: "Driver management",
      desc: "License tracking, document expiry alerts, self-verification link by email, vehicle-to-driver mapping.",
      accent: "from-purple-400 to-purple-500",
    },
    {
      icon: Gauge,
      title: "Tyre analytics",
      desc: "Track replacements per vehicle, compute km-per-stint, and rank tyre brands by real-world lifetime.",
      accent: "from-yellow-400 to-yellow-500",
    },
    {
      icon: Wallet,
      title: "EMI tracker",
      desc: "Vehicle loans with lender details, payment schedules, and reminder dispatch via email or WhatsApp.",
      accent: "from-rose-400 to-rose-500",
    },
    {
      icon: Wrench,
      title: "Expense reports",
      desc: "Service, fuel, parts, tyres — itemized per vehicle with PDF export and brand-wise breakdowns.",
      accent: "from-teal-400 to-teal-500",
    },
    {
      icon: FileBadge,
      title: "GST-ready invoices",
      desc: "Capture GST, PAN, and registered address per tenant. Every report carries the right tax metadata.",
      accent: "from-indigo-400 to-indigo-500",
    },
    {
      icon: Lock,
      title: "Roles & permissions",
      desc: "Admin + custom Operator roles, fine-grained permissions, audit trail for every sensitive action.",
      accent: "from-slate-400 to-slate-500",
    },
  ];
  return (
    <section id="features" className="relative py-20 sm:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow="What you get"
          title="Everything your fleet needs."
          subtitle="One yellow dashboard for the dozens of compliance, financial, and operational threads your fleet runs on every day."
        />

        <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f) => (
            <FeatureCard key={f.title} {...f} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  desc,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  accent: string;
}) {
  return (
    <div className="group relative rounded-2xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02] p-6 hover:shadow-xl hover:shadow-gray-200/40 dark:hover:shadow-black/40 hover:-translate-y-0.5 transition-all">
      <div
        className={`inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br ${accent} text-white shadow-lg mb-4 group-hover:scale-110 transition-transform`}
      >
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-base font-extrabold text-gray-900 dark:text-white tracking-tight">
        {title}
      </h3>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
        {desc}
      </p>
    </div>
  );
}

// ── How it works ────────────────────────────────────────────────────────────
function HowItWorks() {
  const steps = [
    {
      num: "01",
      icon: Sparkles,
      title: "Sign up free",
      desc: "Create your workspace in under a minute. 15-day trial — no card, no commitment.",
    },
    {
      num: "02",
      icon: Truck,
      title: "Onboard your fleet",
      desc: "Punch in RC numbers, upload documents, assign drivers. Bulk import on request.",
    },
    {
      num: "03",
      icon: Zap,
      title: "Stay in control",
      desc: "Get alerts, run reports, share access with your team. Roll over to a paid tier when you're ready.",
    },
  ];
  return (
    <section id="how" className="relative py-20 sm:py-28 bg-gray-50/60 dark:bg-gray-900/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow="3 steps"
          title="From sign-up to first alert in 10 minutes."
          subtitle="No setup calls, no training PDFs. The UI explains itself."
        />

        <div className="mt-14 grid lg:grid-cols-3 gap-6 lg:gap-8 relative">
          {/* Connector line */}
          <div
            aria-hidden
            className="hidden lg:block absolute top-12 left-[16.66%] right-[16.66%] h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent dark:via-gray-700"
          />
          {steps.map((s) => (
            <div
              key={s.num}
              className="relative bg-white dark:bg-gray-950 rounded-3xl border border-gray-200/80 dark:border-gray-800 p-6 sm:p-7"
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl font-black text-yellow-500/30 dark:text-yellow-400/40 tracking-tight">
                  {s.num}
                </span>
                <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-400 to-yellow-500 text-white shadow-md">
                  <s.icon className="w-5 h-5" />
                </span>
              </div>
              <h3 className="text-lg font-extrabold text-gray-900 dark:text-white tracking-tight">
                {s.title}
              </h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Pricing ─────────────────────────────────────────────────────────────────
type PublicPlan = {
  id?: string;
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

function formatPlanPrice(amount: number, currency: string): string {
  if (currency === "INR") return `₹${amount.toLocaleString("en-IN")}`;
  if (currency === "USD") return `$${amount.toLocaleString("en-US")}`;
  return `${currency} ${amount.toLocaleString()}`;
}

function planBandLabel(min: number, max: number | null): string {
  if (max === null || max === undefined) return `${min}+`;
  return `${min} – ${max}`;
}

function planBandTitle(_min: number, max: number | null): string {
  if (max === null) return "Enterprise";
  if (max <= 20) return "Small fleet";
  if (max <= 50) return "Growing fleet";
  if (max <= 100) return "Established";
  return "Large fleet";
}

function Pricing() {
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/public/plans")
      .then((r) => r.json())
      .then((body) => {
        if (cancelled) return;
        const list = (body?.data ?? []) as PublicPlan[];
        setPlans(list);
      })
      .catch(() => {
        if (!cancelled) setPlans([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Highlight the second tier (typical "growing fleet" sweet spot) as Most Popular.
  // If only one or two plans exist, the second one (if any) still gets the badge.
  const popularIndex = plans.length >= 2 ? 1 : -1;

  // Footnote values — show the most common driver rate + GST. If plans disagree,
  // we still surface the first plan's numbers but hint that it varies.
  const footnote = useMemo(() => {
    if (plans.length === 0) return null;
    const driver = plans[0].perDriverPerMonth ?? 0;
    const gst = plans[0].gstPercent ?? 18;
    const currency = plans[0].currency ?? "INR";
    const allSameDriver = plans.every((p) => p.perDriverPerMonth === driver);
    const allSameGst = plans.every((p) => p.gstPercent === gst);
    return {
      driver,
      gst,
      currency,
      varies: !allSameDriver || !allSameGst,
    };
  }, [plans]);

  return (
    <section id="pricing" className="relative py-20 sm:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow="Honest pricing"
          title="Pay per vehicle. The bigger you grow, the less you pay."
          subtitle="No platform fees. No setup costs. Drivers and GST stack on transparently."
        />

        {/* Cycle toggle */}
        <div className="mt-10 flex justify-center">
          <div className="inline-flex p-1 rounded-2xl bg-gray-100 dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800">
            <button
              onClick={() => setCycle("monthly")}
              className={`px-5 py-2 text-sm font-bold rounded-xl transition-all ${
                cycle === "monthly"
                  ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow"
                  : "text-gray-500 dark:text-gray-400"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setCycle("yearly")}
              className={`px-5 py-2 text-sm font-bold rounded-xl transition-all inline-flex items-center gap-2 ${
                cycle === "yearly"
                  ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow"
                  : "text-gray-500 dark:text-gray-400"
              }`}
            >
              Yearly
              <span className="text-[9px] font-extrabold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded">
                Save more
              </span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-3xl border-2 border-gray-200/80 dark:border-gray-800 bg-white dark:bg-white/[0.02] p-6 h-[420px] animate-pulse"
              >
                <div className="h-5 w-24 bg-gray-200 dark:bg-gray-800 rounded mb-3" />
                <div className="h-3 w-32 bg-gray-100 dark:bg-gray-800/70 rounded mb-6" />
                <div className="h-10 w-28 bg-gray-200 dark:bg-gray-800 rounded mb-6" />
                <div className="h-10 w-full bg-gray-100 dark:bg-gray-800/70 rounded mb-6" />
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((__, j) => (
                    <div
                      key={j}
                      className="h-3 w-full bg-gray-100 dark:bg-gray-800/70 rounded"
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : plans.length === 0 ? (
          <div className="mt-12 max-w-xl mx-auto rounded-3xl border-2 border-dashed border-gray-300 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/30 p-10 text-center">
            <p className="text-sm font-bold text-gray-900 dark:text-white">
              Pricing is being finalised.
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Sign up for the free trial — we&apos;ll email you the moment plans
              go live.
            </p>
            <Link
              href="/auth?mode=signup"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-yellow-400 to-yellow-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg"
            >
              Start free trial
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div
            className={`mt-12 grid grid-cols-1 sm:grid-cols-2 gap-5 ${
              plans.length >= 4 ? "lg:grid-cols-4" : plans.length === 3 ? "lg:grid-cols-3" : ""
            }`}
          >
            {plans.map((p, i) => (
              <PricingCard
                key={String(p.id ?? p._id ?? p.name)}
                plan={p}
                cycle={cycle}
                popular={i === popularIndex}
              />
            ))}
          </div>
        )}

        {/* Driver + GST footnote (from live plan data) */}
        {footnote && (
          <div className="mt-8 max-w-3xl mx-auto rounded-2xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-white/[0.02] p-5">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              <span className="font-bold text-gray-900 dark:text-white">
                + {formatPlanPrice(footnote.driver, footnote.currency)} per driver / month
              </span>
              {" · "}
              <span className="font-bold text-gray-900 dark:text-white">
                + {footnote.gst}% GST
              </span>{" "}
              on the subtotal
              {footnote.varies ? " (varies slightly by tier)" : ""}. Every plan
              includes unlimited team members, document storage, email + WhatsApp
              alerts, and audit logs.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function PricingCard({
  plan,
  popular,
  cycle,
}: {
  plan: PublicPlan;
  popular: boolean;
  cycle: "monthly" | "yearly";
}) {
  const value =
    cycle === "monthly" ? plan.perVehiclePerMonth : plan.perVehiclePerYear;
  const unit = cycle === "monthly" ? "/ vehicle / month" : "/ vehicle / year";
  const features = [
    "Unlimited team members",
    "Document storage",
    "Email + WhatsApp alerts",
    "Compliance dashboard",
    "GST-ready invoices",
    "Audit trail",
  ];
  const band = planBandLabel(plan.fleetSizeMin, plan.fleetSizeMax);
  const bandTitle = planBandTitle(plan.fleetSizeMin, plan.fleetSizeMax);
  return (
    <div
      className={`relative rounded-3xl border-2 p-6 transition-all hover:-translate-y-1 hover:shadow-xl ${
        popular
          ? "border-yellow-400 bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-500/[0.08] dark:to-amber-500/[0.08] dark:border-yellow-500/40 shadow-lg shadow-yellow-200/40"
          : "border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02]"
      }`}
    >
      {popular && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-yellow-400 to-yellow-500 text-white px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider shadow-md">
          <Crown className="w-3 h-3" />
          Most popular
        </span>
      )}

      <div className="flex items-start justify-between mb-1">
        <h3 className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight">
          {plan.name}
        </h3>
        <span className="text-[10px] font-bold uppercase tracking-wider text-yellow-700 dark:text-yellow-400">
          {bandTitle}
        </span>
      </div>
      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-4">
        Fleet size {band}
      </p>

      <div className="flex items-baseline gap-1 mb-1">
        <span className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
          ₹{value}
        </span>
      </div>
      <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">{unit}</p>

      <Link
        href="/auth?mode=signup"
        className={`mt-5 inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
          popular
            ? "bg-gradient-to-r from-yellow-400 to-yellow-500 text-white shadow-md shadow-yellow-500/30 hover:shadow-yellow-500/50"
            : "border-2 border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-700"
        }`}
      >
        Choose {plan.name}
        <ArrowRight className="w-3.5 h-3.5" />
      </Link>

      <ul className="mt-6 space-y-2.5">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-[12px] text-gray-700 dark:text-gray-300">
            <Check className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Testimonials ────────────────────────────────────────────────────────────
function Testimonials() {
  const quotes = [
    {
      name: "Rohit S.",
      role: "Fleet manager, Bengaluru",
      quote:
        "We were missing PUC renewals every other month. Yellow Track flags them three weeks out — we haven't paid a single fine since switching.",
      initials: "RS",
      color: "from-blue-400 to-blue-500",
    },
    {
      name: "Anjali P.",
      role: "Operations head, Mumbai",
      quote:
        "Per-vehicle pricing is honest. Our fleet is 60 trucks and the Platinum tier costs less than what one of those trucks earns in a week.",
      initials: "AP",
      color: "from-yellow-400 to-amber-500",
    },
    {
      name: "Karthik N.",
      role: "Owner, Hyderabad logistics",
      quote:
        "Set it up on a Sunday afternoon. By Monday morning my admin was getting WhatsApp alerts. The simplest fleet software I've used.",
      initials: "KN",
      color: "from-emerald-400 to-emerald-500",
    },
  ];
  return (
    <section className="relative py-20 sm:py-28 bg-gray-50/60 dark:bg-gray-900/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow="From the field"
          title="Operators across India trust Yellow Track."
          subtitle="From 5-vehicle outfits to 150-truck fleets — same dashboard, same dependability."
        />
        <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-5">
          {quotes.map((q) => (
            <figure
              key={q.name}
              className="rounded-3xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-white/[0.02] p-7 hover:-translate-y-0.5 hover:shadow-xl transition-all"
            >
              <div className="flex gap-1 mb-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className="w-4 h-4 fill-yellow-400 text-yellow-400"
                  />
                ))}
              </div>
              <blockquote className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                &ldquo;{q.quote}&rdquo;
              </blockquote>
              <figcaption className="mt-5 flex items-center gap-3">
                <span
                  className={`flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br ${q.color} text-white text-xs font-black shadow-md`}
                >
                  {q.initials}
                </span>
                <div>
                  <p className="text-xs font-bold text-gray-900 dark:text-white">{q.name}</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">{q.role}</p>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── FAQ ─────────────────────────────────────────────────────────────────────
function FAQ() {
  const items = [
    {
      q: "Is there really a free trial?",
      a: "Yes — 15 days, no card required. You get the full feature set; only the per-vehicle billing kicks in after the trial unless you choose to extend.",
    },
    {
      q: "Can I add unlimited vehicles?",
      a: "There's no hard cap. The tier you're on is determined by fleet size — Silver (0–20), Gold (21–50), Platinum (51–100), Diamond (100+). You move up automatically as you grow.",
    },
    {
      q: "How do WhatsApp alerts work?",
      a: "We integrate with ChatBox.biz as the WhatsApp BSP. Your admin's number receives compliance reminders, EMI alerts, and driver-document expiry notifications.",
    },
    {
      q: "Is my fleet data secure?",
      a: "Every tenant's data is logically isolated. Database queries are tenant-scoped at the repository layer, not just the API — there's no path to cross-tenant reads. Backups are encrypted; SMTP uses TLS.",
    },
    {
      q: "Can multiple users access the workspace?",
      a: "Yes. Every plan includes unlimited team members. You define custom roles (Operator, Service Manager, etc.) with fine-grained permissions and a full audit trail.",
    },
    {
      q: "What payment methods do you accept?",
      a: "Net banking, UPI, cards, and bank transfer. All invoices are GST-compliant and include your tenant's GSTIN, PAN, and registered address on the line items.",
    },
  ];
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  return (
    <section id="faq" className="relative py-20 sm:py-28">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow="Questions, answered"
          title="Frequently asked."
          subtitle="Can't find what you're looking for? Drop us a note — we reply same-day."
          align="center"
        />

        <div className="mt-10 space-y-3">
          {items.map((it, i) => (
            <button
              key={it.q}
              onClick={() => setOpenIdx(openIdx === i ? null : i)}
              className="w-full text-left rounded-2xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-white/[0.02] p-5 hover:border-yellow-300 dark:hover:border-yellow-500/30 transition-colors"
            >
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-sm sm:text-base font-extrabold text-gray-900 dark:text-white tracking-tight">
                  {it.q}
                </h3>
                <span
                  className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                    openIdx === i
                      ? "bg-yellow-400 text-white rotate-180"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                  }`}
                >
                  {openIdx === i ? <Minus className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                </span>
              </div>
              {openIdx === i && (
                <p className="mt-3 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  {it.a}
                </p>
              )}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Final CTA ───────────────────────────────────────────────────────────────
function FinalCTA() {
  return (
    <section className="relative py-20 sm:py-28 overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-yellow-400 via-yellow-500 to-amber-500" />
        <div
          aria-hidden
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `radial-gradient(circle at 20% 20%, white 1px, transparent 1px), radial-gradient(circle at 80% 80%, white 1px, transparent 1px)`,
            backgroundSize: "40px 40px",
          }}
        />
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-white/20 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-amber-300/40 blur-3xl" />
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-gray-900 text-yellow-400 px-4 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.18em] shadow-lg">
          <Sparkles className="w-3 h-3" />
          Start today
        </span>
        <h2 className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-black text-gray-900 tracking-tight leading-[1.05]">
          Ready to take control
          <br />
          of your fleet?
        </h2>
        <p className="mt-5 text-base sm:text-lg text-gray-900/70 max-w-xl mx-auto">
          15-day free trial. No credit card. Cancel any time. Onboard your first vehicle in under 5 minutes.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/auth?mode=signup"
            className="inline-flex items-center gap-2 rounded-xl bg-gray-900 text-yellow-400 px-7 py-4 text-sm font-bold shadow-2xl shadow-gray-900/30 hover:bg-gray-800 transition-all active:scale-[0.98]"
          >
            Start free trial
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/auth"
            className="inline-flex items-center gap-2 rounded-xl bg-white text-gray-900 px-7 py-4 text-sm font-bold hover:bg-gray-50 transition-all"
          >
            Sign in
          </Link>
        </div>
      </div>
    </section>
  );
}

// ── Footer ──────────────────────────────────────────────────────────────────
function Footer() {
  const groups: Array<{
    title: string;
    links: Array<{ label: string; href: string }>;
  }> = [
    {
      title: "Product",
      links: [
        { label: "Features", href: "#features" },
        { label: "Pricing", href: "#pricing" },
        { label: "How it works", href: "#how" },
      ],
    },
    {
      title: "Company",
      links: [
        { label: "About", href: "#" },
        { label: "Contact", href: "mailto:hello@theyellowtrack.com" },
        { label: "Sign in", href: "/auth" },
      ],
    },
    {
      title: "Resources",
      links: [
        { label: "FAQ", href: "#faq" },
        { label: "Support", href: "mailto:hello@theyellowtrack.com" },
      ],
    },
    {
      title: "Legal",
      links: [
        { label: "Terms & Conditions", href: "/legal/terms" },
        { label: "Privacy Policy", href: "/legal/privacy" },
        { label: "Refund Policy", href: "/legal/refund" },
        { label: "Cancellation & Returns", href: "/legal/cancellation" },
      ],
    },
  ];
  return (
    <footer className="border-t border-gray-100 dark:border-gray-900 bg-gray-50/50 dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-6 gap-8">
          <div className="col-span-2">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <span className="relative w-35 h-35">
                <Image
                  src="/images/logo/yellow-track-logo.svg"
                  alt="Yellow Track"
                  fill
                  sizes="140px"
                  className="object-contain"
                />
              </span>
              {/* <span className="text-lg font-black tracking-tight">
                <span className="text-yellow-500">Yellow</span>
                <span className="text-gray-900 dark:text-white"> Track</span>
              </span> */}
            </Link>
            <p className="mt-4 text-sm text-gray-500 dark:text-gray-400 max-w-xs leading-relaxed">
              Fleet compliance, drivers, expenses, EMIs — managed end-to-end. Built in India for India&apos;s roads.
            </p>
            <div className="mt-4 space-y-1.5 text-xs text-gray-500 dark:text-gray-400">
              <p className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" />
                hello@theyellowtrack.com
              </p>
              <p className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                Hyderabad, India
              </p>
            </div>
          </div>

          {groups.map((g) => (
            <div key={g.title}>
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-3">
                {g.title}
              </p>
              <ul className="space-y-2">
                {g.links.map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 pt-6 border-t border-gray-100 dark:border-gray-900 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-gray-400 dark:text-gray-500">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-center sm:text-left">
            <p>© {new Date().getFullYear()} Yellow Track. All rights reserved.</p>
            <span className="hidden sm:inline text-gray-300 dark:text-gray-700">·</span>
            <p className="text-gray-500 dark:text-gray-400">
              From the house of{" "}
              <span className="font-semibold text-gray-700 dark:text-gray-300">
                Versatile Commerce
              </span>
            </p>
          </div>
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              GST-compliant
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5" />
              WhatsApp alerts
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" />
              Tenant-isolated
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ── Shared section header ───────────────────────────────────────────────────
function SectionHeader({
  eyebrow,
  title,
  subtitle,
  align = "left",
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  align?: "left" | "center";
}) {
  return (
    <div className={`max-w-3xl ${align === "center" ? "mx-auto text-center" : ""}`}>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-100 dark:bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.18em]">
        <IndianRupee className="w-3 h-3" />
        {eyebrow}
      </span>
      <h2 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-black text-gray-900 dark:text-white tracking-tight leading-[1.05]">
        {title}
      </h2>
      <p className="mt-4 text-base text-gray-600 dark:text-gray-400 leading-relaxed">
        {subtitle}
      </p>
    </div>
  );
}
