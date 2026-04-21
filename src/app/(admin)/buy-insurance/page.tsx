"use client";
import React, { useEffect, useState } from "react";
import { insuranceAPI, vehicleAPI } from "@/lib/api";
import Badge from "@/components/ui/badge/Badge";
import { useToast } from "@/context/ToastContext";
import Pagination from "@/components/ui/Pagination";
import { Plus, Search, ChevronLeft, Check, ShieldCheck, Eye, Star, FileText } from "lucide-react";

interface Policy {
  id: string; vehicleId: string; policyNumber: string | null; insurer: string | null; planName: string | null;
  startDate: string | null; expiryDate: string | null; premium: number | null; coverageType: string | null;
  coverageDetails: string[]; addOns: string[]; status: string; paidAmount: number | null; documentUrl: string | null;
  vehicle: { id: string; registrationNumber: string; make: string; model: string };
}

interface Plan {
  id: string; provider: string; planName: string; premium: number; coverage: string[]; addOns: string[];
  claimSettlementRatio: string; rating: number; isRenewal: boolean; features: string[];
}

interface Vehicle { id: string; registrationNumber: string; make: string; model: string; }

export default function InsurancePage() {
  const toast = useToast();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [stats, setStats] = useState({ total: 0, active: 0, expiring: 0, expired: 0, totalPremium: 0 });
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  const [step, setStep] = useState<"list" | "upload" | "extract" | "plans" | "payment" | "success">("list");
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [extractedData, setExtractedData] = useState<Record<string, string | number | null>>({});
  const [saving, setSaving] = useState(false);

  const [plans, setPlans] = useState<Plan[]>([]);
  const [plansVehicle, setPlansVehicle] = useState<Vehicle | null>(null);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);

  const [paymentMethod, setPaymentMethod] = useState("UPI");
  const [paying, setPaying] = useState(false);
  const [paymentResult, setPaymentResult] = useState<{ policy: Policy; payment: { id: string; amount: number } } | null>(null);

  const fetchData = async (page = 1) => {
    try {
      const [pRes, sRes] = await Promise.all([
        insuranceAPI.getAll({ page, limit: 10, status: statusFilter !== "ALL" ? statusFilter : undefined, search: search || undefined }),
        insuranceAPI.getStats(),
      ]);
      setPolicies(pRes.data.data.policies); setPagination({ page: pRes.data.data.page, totalPages: pRes.data.data.totalPages, total: pRes.data.data.total }); setStats(sRes.data.data);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []); // eslint-disable-line

  const openUpload = async () => {
    try { setVehicles((await vehicleAPI.getAll({ limit: 100 })).data.data.vehicles); } catch { /* */ }
    setStep("upload"); setSelectedVehicleId(""); setUploadFile(null); setExtractedData({});
  };

  const handleUpload = async () => {
    if (!selectedVehicleId || !uploadFile) return;
    setUploading(true);
    try { setExtractedData((await insuranceAPI.upload(selectedVehicleId, uploadFile)).data.data.extracted || {}); setStep("extract"); }
    catch (err: unknown) { const e = err as { response?: { data?: { message?: string } } }; toast.error("Upload Failed", e.response?.data?.message || "Could not parse PDF"); }
    finally { setUploading(false); }
  };

  const handleSaveExtracted = async () => {
    setSaving(true);
    try { await insuranceAPI.save({ vehicleId: selectedVehicleId, ...extractedData }); toast.success("Policy Saved"); setStep("list"); fetchData(); }
    catch { toast.error("Save Failed"); } finally { setSaving(false); }
  };

  const openPlans = async (vehicleId: string) => {
    setLoadingPlans(true); setStep("plans"); setSelectedPlan(null);
    try { const res = await insuranceAPI.getPlans(vehicleId); setPlans(res.data.data.plans); setPlansVehicle(res.data.data.vehicle); }
    catch { toast.error("Failed to fetch plans"); setStep("list"); } finally { setLoadingPlans(false); }
  };

  const handlePurchase = async () => {
    if (!selectedPlan || !plansVehicle) return;
    setPaying(true);
    try {
      const res = await insuranceAPI.purchase({ vehicleId: plansVehicle.id, provider: selectedPlan.provider, planName: selectedPlan.planName, premium: selectedPlan.premium, coverage: selectedPlan.coverage, addOns: selectedPlan.addOns, paymentMethod });
      setPaymentResult(res.data.data); setStep("success"); toast.success("Payment Successful!");
    } catch (err: unknown) { const e = err as { response?: { data?: { message?: string } } }; toast.error("Payment Failed", e.response?.data?.message || "Try again"); }
    finally { setPaying(false); }
  };

  const sColor = (s: string): "success" | "warning" | "error" => s === "ACTIVE" ? "success" : s === "EXPIRING" ? "warning" : "error";
  const inputCls = "w-full h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 focus:border-yellow-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white";

  if (loading && step === "list") return (
    <div className="space-y-6"><div className="h-8 w-48 rounded-lg bg-gray-200 dark:bg-gray-800 animate-pulse" />
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">{[1,2,3,4,5].map(i => <div key={i} className="h-24 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" />)}</div>
      <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />)}</div></div>
  );

  // ── SUCCESS ──
  if (step === "success" && paymentResult) return (
    <div className="max-w-lg mx-auto py-16 text-center">
      <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6">
        <Check className="w-10 h-10 text-emerald-500" strokeWidth={2} />
      </div>
      <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-2">Insurance Purchased!</h2>
      <p className="text-sm text-gray-500 mb-6">Your policy is now active</p>
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.02] p-6 text-left space-y-3 mb-6">
        <div className="flex justify-between"><span className="text-sm text-gray-500">Policy Number</span><span className="text-sm font-bold font-mono">{paymentResult.policy.policyNumber}</span></div>
        <div className="flex justify-between"><span className="text-sm text-gray-500">Insurer</span><span className="text-sm font-semibold">{paymentResult.policy.insurer}</span></div>
        <div className="flex justify-between"><span className="text-sm text-gray-500">Amount Paid</span><span className="text-sm font-black text-emerald-600">&#8377;{paymentResult.payment.amount.toLocaleString("en-IN")}</span></div>
        <div className="flex justify-between"><span className="text-sm text-gray-500">Payment ID</span><span className="text-xs font-mono text-gray-500">{paymentResult.payment.id}</span></div>
      </div>
      <button onClick={() => { setStep("list"); fetchData(); }} className="px-8 py-3 rounded-xl bg-gradient-to-r from-brand-500 to-brand-400 text-white font-semibold text-sm shadow-lg">Back to Insurance</button>
    </div>
  );

  // ── PAYMENT ──
  if (step === "payment" && selectedPlan && plansVehicle) return (
    <div className="max-w-md mx-auto space-y-6">
      <button onClick={() => setStep("plans")} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"><ChevronLeft className="w-4 h-4" />Back to Plans</button>
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.02] overflow-hidden">
        <div className="bg-gradient-to-r from-brand-500 to-brand-400 px-6 py-5 text-center">
          <h3 className="text-lg font-bold text-white">Payment</h3>
          <p className="text-white/70 text-sm">{plansVehicle.registrationNumber} &mdash; {selectedPlan.provider}</p>
        </div>
        <div className="p-6 space-y-5">
          <div className="text-center py-4 rounded-xl bg-gray-50 dark:bg-gray-800/50">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Total Amount</p>
            <p className="text-4xl font-black text-gray-900 dark:text-white">&#8377;{selectedPlan.premium.toLocaleString("en-IN")}</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Payment Method</label>
            <div className="grid grid-cols-3 gap-2">
              {["UPI", "CARD", "NETBANKING"].map((m) => (
                <button key={m} onClick={() => setPaymentMethod(m)} className={`py-2.5 rounded-xl text-xs font-bold border-2 transition-all ${paymentMethod === m ? "border-brand-400 bg-brand-50 text-brand-600" : "border-gray-200 text-gray-600"}`}>{m}</button>
              ))}
            </div>
          </div>
          <button onClick={handlePurchase} disabled={paying} className="w-full h-12 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 text-white font-bold text-sm shadow-lg disabled:opacity-50 flex items-center justify-center gap-2">
            {paying ? (<><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Processing...</>) : `Pay ₹${selectedPlan.premium.toLocaleString("en-IN")}`}
          </button>
        </div>
      </div>
    </div>
  );

  // ── PLANS ──
  if (step === "plans") return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => setStep("list")} className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-gray-700"><ChevronLeft className="w-4 h-4" /></button>
        <div><h2 className="text-xl font-bold text-gray-900 dark:text-white">Compare Plans</h2>{plansVehicle && <p className="text-sm text-gray-500">{plansVehicle.registrationNumber} — {plansVehicle.make} {plansVehicle.model}</p>}</div>
      </div>
      {loadingPlans ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{[1,2,3,4,5,6].map(i => <div key={i} className="h-64 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" />)}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <div key={plan.id} className="rounded-2xl border-2 border-gray-200 dark:border-gray-800 bg-white dark:bg-white/[0.02] overflow-hidden hover:shadow-lg transition-all">
              {plan.isRenewal && <div className="bg-emerald-500 text-white text-[10px] font-bold text-center py-1 uppercase tracking-wider">Renewal Discount</div>}
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div><h3 className="text-sm font-bold text-gray-900 dark:text-white">{plan.provider}</h3><p className="text-xs text-gray-500">{plan.planName}</p></div>
                  <div className="flex items-center gap-1"><Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" /><span className="text-xs font-bold">{plan.rating}</span></div>
                </div>
                <p className="text-3xl font-black text-gray-900 dark:text-white mb-1">&#8377;{plan.premium.toLocaleString("en-IN")}<span className="text-xs font-normal text-gray-400">/yr</span></p>
                <p className="text-[10px] text-gray-400 mb-4">Claim ratio: {plan.claimSettlementRatio}</p>
                <div className="space-y-1.5 mb-4">
                  {plan.coverage.map((c, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                      <Check className="w-3 h-3 text-emerald-500 flex-shrink-0" strokeWidth={3} />{c}
                    </div>
                  ))}
                </div>
                {plan.addOns.length > 0 && <div className="flex flex-wrap gap-1 mb-4">{plan.addOns.slice(0, 3).map((a, i) => <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500">{a}</span>)}{plan.addOns.length > 3 && <span className="text-[9px] text-gray-400">+{plan.addOns.length - 3}</span>}</div>}
                <button onClick={() => { setSelectedPlan(plan); setStep("payment"); }} className="w-full h-10 rounded-xl bg-gradient-to-r from-brand-500 to-brand-400 text-white text-sm font-semibold shadow-lg shadow-brand-500/20 hover:shadow-brand-500/40 transition-all">Select Plan</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ── EXTRACT ──
  if (step === "extract") return (
    <div className="max-w-lg mx-auto space-y-6">
      <button onClick={() => setStep("upload")} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"><ChevronLeft className="w-4 h-4" />Back</button>
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.02] overflow-hidden">
        <div className="bg-gradient-to-r from-yellow-500 to-yellow-400 px-6 py-5"><h3 className="text-lg font-bold text-white">Extracted Policy Details</h3><p className="text-white/70 text-sm">Review and correct</p></div>
        <div className="p-6 space-y-4">
          {[{ key: "policyNumber", label: "Policy Number" }, { key: "insurer", label: "Insurer" }, { key: "coverageType", label: "Coverage Type" }, { key: "premium", label: "Premium (₹)", type: "number" }, { key: "startDate", label: "Start Date", type: "date" }, { key: "expiryDate", label: "Expiry Date", type: "date" }].map(({ key, label, type }) => (
            <div key={key}><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{label}</label>
              <input type={type || "text"} value={extractedData[key] != null ? String(extractedData[key]).split("T")[0] : ""} onChange={(e) => setExtractedData({ ...extractedData, [key]: e.target.value })} className={inputCls} /></div>
          ))}
          <div className="flex gap-3 pt-2">
            <button onClick={handleSaveExtracted} disabled={saving} className="flex-1 h-11 rounded-xl bg-gradient-to-r from-yellow-500 to-yellow-400 text-white font-semibold text-sm shadow-lg disabled:opacity-50 flex items-center justify-center">{saving ? "Saving..." : "Save Policy"}</button>
            <button onClick={() => setStep("list")} className="h-11 px-6 rounded-xl border-2 border-gray-200 text-sm font-medium text-gray-700 dark:border-gray-700 dark:text-gray-300">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );

  // ── UPLOAD ──
  if (step === "upload") return (
    <div className="max-w-lg mx-auto space-y-6">
      <button onClick={() => setStep("list")} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"><ChevronLeft className="w-4 h-4" />Back</button>
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.02] overflow-hidden">
        <div className="bg-gradient-to-r from-yellow-500 to-yellow-400 px-6 py-5"><h3 className="text-lg font-bold text-white">Upload Insurance Policy</h3><p className="text-white/70 text-sm">Upload a PDF and we&apos;ll extract the details</p></div>
        <div className="p-6 space-y-5">
          <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Vehicle</label>
            <select value={selectedVehicleId} onChange={(e) => setSelectedVehicleId(e.target.value)} className={inputCls}><option value="">Select vehicle</option>{vehicles.map((v) => <option key={v.id} value={v.id}>{v.registrationNumber} — {v.make} {v.model}</option>)}</select></div>
          <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Insurance PDF</label>
            <label className={`flex flex-col items-center justify-center py-8 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${uploadFile ? "border-yellow-300 bg-yellow-50" : "border-gray-200 hover:border-yellow-400"}`}>
              {uploadFile ? <div className="flex items-center gap-2 text-sm text-yellow-700"><Check className="w-5 h-5" /><span className="font-medium truncate max-w-[250px]">{uploadFile.name}</span></div>
                : <><FileText className="w-8 h-8 text-gray-300 mb-2" strokeWidth={1.5} /><span className="text-sm text-gray-400">Click to upload PDF</span></>}
              <input type="file" accept=".pdf" className="hidden" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} /></label></div>
          <button onClick={handleUpload} disabled={uploading || !selectedVehicleId || !uploadFile} className="w-full h-12 rounded-xl bg-gradient-to-r from-yellow-500 to-yellow-400 text-white font-bold text-sm shadow-lg disabled:opacity-50 flex items-center justify-center gap-2">
            {uploading ? (<><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Extracting...</>) : "Upload & Extract"}</button>
        </div>
      </div>
    </div>
  );

  // ── MAIN DASHBOARD ──
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white">Insurance</h1><p className="text-sm text-gray-500 mt-1">Manage vehicle insurance policies</p></div>
        <button onClick={openUpload} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-brand-400 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 hover:shadow-brand-500/40 transition-all">
          <Plus className="w-4 h-4" />Add Policy</button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="rounded-2xl border border-gray-200/80 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.02]"><p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Total</p><p className="text-2xl font-black text-gray-900 dark:text-white mt-1">{stats.total}</p></div>
        <div className="rounded-2xl border border-emerald-200/60 bg-emerald-50/50 p-5 dark:border-emerald-500/20"><p className="text-[10px] font-semibold text-emerald-500/60 uppercase tracking-wider">Active</p><p className="text-2xl font-black text-emerald-600 mt-1">{stats.active}</p></div>
        <div className="rounded-2xl border border-amber-200/60 bg-amber-50/50 p-5 dark:border-amber-500/20"><p className="text-[10px] font-semibold text-amber-500/60 uppercase tracking-wider">Expiring</p><p className="text-2xl font-black text-amber-600 mt-1">{stats.expiring}</p></div>
        <div className="rounded-2xl border border-red-200/60 bg-red-50/50 p-5 dark:border-red-500/20"><p className="text-[10px] font-semibold text-red-500/60 uppercase tracking-wider">Expired</p><p className="text-2xl font-black text-red-600 mt-1">{stats.expired}</p></div>
        <div className="rounded-2xl border border-brand-200/60 bg-brand-25 p-5 dark:border-brand-500/20 col-span-2 sm:col-span-1"><p className="text-[10px] font-semibold text-brand-500/60 uppercase tracking-wider">Total Premium</p><p className="text-2xl font-black text-brand-600 mt-1">&#8377;{stats.totalPremium.toLocaleString("en-IN")}</p></div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <form onSubmit={(e) => { e.preventDefault(); fetchData(1); }} className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search by vehicle or policy..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full h-10 rounded-xl border border-gray-200 bg-white pl-10 pr-4 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-400 focus:outline-none focus:ring-3 focus:ring-brand-400/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
        </form>
        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800/50 rounded-xl h-10">
          {["ALL", "ACTIVE", "EXPIRING", "EXPIRED"].map((s) => (
            <button key={s} onClick={() => { setStatusFilter(s); setTimeout(() => fetchData(1), 0); }} className={`rounded-lg px-3 text-xs font-semibold transition-all ${statusFilter === s ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white" : "text-gray-500"}`}>{s === "ALL" ? "All" : s}</button>
          ))}
        </div>
      </div>

      {policies.length === 0 ? (
        <div className="rounded-2xl border border-gray-200/80 bg-white p-12 text-center dark:border-gray-800 dark:bg-white/[0.02]">
          <div className="w-14 h-14 rounded-2xl bg-yellow-100 flex items-center justify-center mx-auto mb-4"><ShieldCheck className="w-7 h-7 text-yellow-600" /></div>
          <p className="text-sm text-gray-500">No insurance policies found</p>
          <button onClick={openUpload} className="mt-3 text-sm font-medium text-brand-500 hover:text-brand-600">Upload your first policy</button>
        </div>
      ) : (
        <div className="space-y-3">
          {policies.map((p) => (
            <div key={p.id} className="rounded-xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02] p-4 flex items-center gap-4 hover:shadow-lg transition-all">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md ${p.status === "ACTIVE" ? "bg-gradient-to-br from-emerald-400 to-green-600" : p.status === "EXPIRING" ? "bg-gradient-to-br from-amber-400 to-amber-600" : "bg-gradient-to-br from-red-400 to-red-600"}`}>
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-gray-900 dark:text-white font-mono">{p.vehicle.registrationNumber}</span>
                  <Badge color={sColor(p.status)} variant="light" size="sm">{p.status}</Badge>
                  {p.insurer && <span className="text-[10px] px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-500 font-semibold">{p.insurer}</span>}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                  {p.policyNumber && <span className="font-mono">{p.policyNumber}</span>}
                  {p.expiryDate && <><span className="text-gray-300">&bull;</span><span>Exp: {new Date(p.expiryDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span></>}
                  {p.coverageType && <><span className="text-gray-300">&bull;</span><span>{p.coverageType}</span></>}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                {p.premium && <p className="text-lg font-black text-gray-900 dark:text-white">&#8377;{p.premium.toLocaleString("en-IN")}</p>}
                <p className="text-[10px] text-gray-400">{p.vehicle.make} {p.vehicle.model}</p>
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                {(p.status === "EXPIRING" || p.status === "EXPIRED") && (
                  <button onClick={() => openPlans(p.vehicleId)} className="rounded-lg bg-yellow-50 hover:bg-yellow-100 px-3 py-1.5 text-xs font-semibold text-yellow-600 transition-colors">Renew</button>
                )}
                <button onClick={() => openPlans(p.vehicleId)} className="rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 p-1.5 text-gray-500 transition-colors" title="View Plans">
                  <Eye className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <Pagination currentPage={pagination.page} totalPages={pagination.totalPages} totalItems={pagination.total} itemsPerPage={10} onPageChange={(p) => fetchData(p)} onItemsPerPageChange={() => {}} itemLabel="policies" />
    </div>
  );
}
