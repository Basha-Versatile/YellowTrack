"use client";
import React, { useEffect, useState, useCallback } from "react";
import { vehicleAPI } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ExpensesDashboardSkeleton } from "@/components/ui/Skeleton";
import DatePicker from "@/components/ui/DatePicker";
import { pickValidatedFiles } from "@/lib/file-validation";
import {
  Plus, Download, AlertTriangle, Wrench, Car, CheckCircle2,
  MoreHorizontal, BarChart3, FileText,
  ImageIcon, Upload, Banknote, X, Receipt,
} from "lucide-react";
import { VehicleAutocomplete } from "@/components/vehicles/VehicleAutocomplete";
import { resolveImageUrl } from "@/components/vehicles/VehicleThumb";

interface VehicleBasic { id: string; registrationNumber: string; ownerName?: string | null; make: string; model: string; }
interface ExpenseItem { source: string; date: string; vehicleId: string; vehicle: VehicleBasic | null; title: string; amount: number; handlingCharges?: number; proofUrls: string[]; category: string; }
interface ReportData {
  summary: { totalSpent: number; breakdown: Record<string, number> };
  timeline: Array<{ period: string; [key: string]: string | number }>;
  expenses: ExpenseItem[];
}

const CATEGORY_ICONS: Record<string, React.FC<{ className?: string }>> = {
  challans: AlertTriangle,
  services: Wrench,
  fastag: Car,
  compliance: CheckCircle2,
  emi: Banknote,
  invoices: FileText,
};

const CATEGORY_COLORS: Record<string, { bg: string; text: string; dot: string; gradient: string }> = {
  challans: { bg: "bg-red-500/10", text: "text-red-400", dot: "#ef4444", gradient: "from-red-500 to-rose-600" },
  services: { bg: "bg-blue-500/10", text: "text-blue-400", dot: "#3b82f6", gradient: "from-blue-500 to-blue-600" },
  fastag: { bg: "bg-amber-500/10", text: "text-amber-400", dot: "#f59e0b", gradient: "from-amber-500 to-amber-600" },
  compliance: { bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "#10b981", gradient: "from-emerald-500 to-emerald-600" },
  emi: { bg: "bg-purple-500/10", text: "text-purple-400", dot: "#a855f7", gradient: "from-purple-500 to-fuchsia-600" },
  invoices: { bg: "bg-cyan-500/10", text: "text-cyan-400", dot: "#06b6d4", gradient: "from-cyan-500 to-sky-600" },
};

const CATEGORY_LABELS: Record<string, string> = {
  challans: "Challans",
  services: "Services",
  fastag: "FASTag",
  compliance: "Compliance",
  emi: "EMI",
  invoices: "Invoices",
};

const CATEGORY_COLORS_HEX: Record<string, string> = {
  challans: "#ef4444",
  services: "#3b82f6",
  fastag: "#f59e0b",
  compliance: "#10b981",
  emi: "#a855f7",
  invoices: "#06b6d4",
};

// Placeholder hints by Log-Expense form category. Keeps the user oriented
// to what "Title" should contain for each kind of expense.
const TITLE_PLACEHOLDER: Record<string, string> = {
  COMPLIANCE: "e.g. RC Renewal, Insurance Premium",
  SERVICE: "e.g. Oil Change, Brake Pads",
  TYRE_REPLACEMENT: "e.g. MRF 4 Tyres set, CEAT Rear Tyres",
  FASTAG: "e.g. FASTag Recharge",
  CHALLAN: "e.g. Overspeeding Fine",
  EMI: "e.g. May 2026 EMI",
  INVOICE: "e.g. Vehicle Invoice",
};

export default function VehicleExpensesPage() {
  return (
    <Suspense fallback={<ExpensesDashboardSkeleton />}>
      <VehicleExpensesContent />
    </Suspense>
  );
}

function VehicleExpensesContent() {
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [report, setReport] = useState<ReportData | null>(null);
  const [vehicles, setVehicles] = useState<VehicleBasic[]>([]);
  const [loading, setLoading] = useState(true);

  const [vehicleId, setVehicleId] = useState(searchParams.get("vehicleId") || "");
  const [period, setPeriod] = useState("this_year");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [expVehicleId, setExpVehicleId] = useState("");
  const [expForm, setExpForm] = useState({ category: "COMPLIANCE", title: "", amount: "", handlingCharges: "", expenseDate: new Date().toISOString().split("T")[0], description: "" });
  const [expProofs, setExpProofs] = useState<File[]>([]);
  const [serviceSubType, setServiceSubType] = useState<"GENERAL" | "TYRES">("GENERAL");
  const [tyreOdometerKm, setTyreOdometerKm] = useState("");
  const [tyreBrand, setTyreBrand] = useState("");
  const [lastTyreReplacement, setLastTyreReplacement] = useState<{
    odometerKm: number;
    brand: string;
    date: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [showDownload, setShowDownload] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("");

  const getDateRange = useCallback(() => {
    const now = new Date();
    if (period === "this_month") return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0], to: now.toISOString().split("T")[0] };
    if (period === "last_month") { const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1); return { from: lm.toISOString().split("T")[0], to: new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0] }; }
    if (period === "this_quarter") { const q = Math.floor(now.getMonth() / 3) * 3; return { from: new Date(now.getFullYear(), q, 1).toISOString().split("T")[0], to: now.toISOString().split("T")[0] }; }
    if (period === "this_year") return { from: new Date(now.getFullYear(), 0, 1).toISOString().split("T")[0], to: now.toISOString().split("T")[0] };
    if (period === "custom" && customFrom && customTo) return { from: customFrom, to: customTo };
    return { from: new Date(now.getFullYear(), 0, 1).toISOString().split("T")[0], to: now.toISOString().split("T")[0] };
  }, [period, customFrom, customTo]);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const { from, to } = getDateRange();
      const params: Record<string, string> = { from, to };
      if (vehicleId) params.vehicleId = vehicleId;
      const res = await vehicleAPI.getExpenseReport(params);
      setReport(res.data.data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [vehicleId, getDateRange]);

  useEffect(() => { vehicleAPI.getAll({ page: 1, limit: 100 }).then((res) => setVehicles(res.data.data.vehicles || [])).catch(() => {}); }, []);
  useEffect(() => { fetchReport(); }, [fetchReport]);

  // When the user picks Service → Tyres for a specific vehicle, fetch that
  // vehicle's previous tyre replacement so we can show the "ran X km" hint.
  useEffect(() => {
    // Tyre replacement is now its own top-level category, so the "last
    // replacement" hint loads either when the user picks TYRE_REPLACEMENT
    // directly or the legacy Service + TYRES sub-type combination.
    const isTyreFlow =
      expForm.category === "TYRE_REPLACEMENT" ||
      (expForm.category === "SERVICE" && serviceSubType === "TYRES");
    if (!showModal || !isTyreFlow || !expVehicleId) {
      setLastTyreReplacement(null);
      return;
    }
    let cancelled = false;
    vehicleAPI
      .getTyreReplacements(expVehicleId)
      .then((res) => {
        if (cancelled) return;
        const records: Array<{ odometerKm: number; brand: string; date: string }> =
          res.data.data.records ?? [];
        // Records are returned in date-desc order — first is the latest.
        setLastTyreReplacement(records[0] ?? null);
      })
      .catch(() => {
        if (!cancelled) setLastTyreReplacement(null);
      });
    return () => {
      cancelled = true;
    };
  }, [showModal, expForm.category, serviceSubType, expVehicleId]);

  const handleLogExpense = async () => {
    if (!expVehicleId || !expForm.title || !expForm.amount || !expForm.expenseDate) return;
    // Top-level "Tyre Replacement" pick OR legacy Service → Tyres sub-type
    // both flow through the same backend shape: category=SERVICE +
    // serviceSubType=TYRES.
    const isTyreReplacement =
      expForm.category === "TYRE_REPLACEMENT" ||
      (expForm.category === "SERVICE" && serviceSubType === "TYRES");
    if (isTyreReplacement && (!tyreOdometerKm.trim() || !tyreBrand.trim())) {
      toast.error("Missing fields", "Odometer (km) and brand are required for tyre replacements");
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      const backendCategory = expForm.category === "TYRE_REPLACEMENT" ? "SERVICE" : expForm.category;
      fd.append("category", backendCategory); fd.append("title", expForm.title); fd.append("amount", expForm.amount); fd.append("expenseDate", expForm.expenseDate);
      // Handling charges are only meaningful for Compliance entries (e.g.
      // RTO / agent fees) — guard against stray values being submitted from
      // other categories.
      if (expForm.category === "COMPLIANCE" && expForm.handlingCharges) {
        fd.append("handlingCharges", expForm.handlingCharges);
      }
      if (expForm.description) fd.append("description", expForm.description);
      for (const f of expProofs) fd.append("proof", f);
      if (isTyreReplacement) {
        fd.append("serviceSubType", "TYRES");
        fd.append("odometerKm", tyreOdometerKm.trim());
        fd.append("tyreBrand", tyreBrand.trim());
      }
      await vehicleAPI.createExpense(expVehicleId, fd);
      toast.success("Expense Logged", "Expense recorded successfully");
      setShowModal(false);
      setExpForm({ category: "COMPLIANCE", title: "", amount: "", handlingCharges: "", expenseDate: new Date().toISOString().split("T")[0], description: "" });
      setExpProofs([]);
      setServiceSubType("GENERAL");
      setTyreOdometerKm("");
      setTyreBrand("");
      setLastTyreReplacement(null);
      fetchReport();
    } catch { toast.error("Error", "Failed to log expense"); }
    finally { setSaving(false); }
  };

  // Filtered data based on category selection
  const getFilteredExpenses = () => {
    if (!report) return [];
    return categoryFilter ? report.expenses.filter((e) => e.category === categoryFilter) : report.expenses;
  };

  const getFilteredBreakdown = () => {
    if (!report) return {};
    if (!categoryFilter) return report.summary.breakdown;
    const val = report.summary.breakdown[categoryFilter] || 0;
    return { [categoryFilter]: val };
  };

  const getFilteredTotal = () => {
    const bd = getFilteredBreakdown();
    return Object.values(bd).reduce((s, v) => s + v, 0);
  };

  const getFilterLabel = () => {
    const parts: string[] = [];
    const veh = vehicleId ? vehicles.find((v) => v.id === vehicleId) : null;
    if (veh) parts.push(veh.registrationNumber);
    if (categoryFilter) parts.push(CATEGORY_LABELS[categoryFilter] || categoryFilter);
    return parts.length > 0 ? parts.join(" — ") : "All Vehicles — All Categories";
  };

  const downloadCSV = () => {
    if (!report) return;
    const filtered = getFilteredExpenses();
    const headers = ["Date", "Vehicle", "Category", "Source", "Title", "Amount", "Handling", "Total"];
    const rows = filtered.map((e) => {
      const handling = e.handlingCharges ?? 0;
      return [new Date(e.date).toLocaleDateString("en-IN"), e.vehicle?.registrationNumber || "", CATEGORY_LABELS[e.category] || e.category, e.source, e.title, e.amount.toString(), handling.toString(), (e.amount + handling).toString()];
    });
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const suffix = categoryFilter ? `-${categoryFilter.toLowerCase()}` : "";
    const vehSuffix = vehicleId ? `-${vehicles.find((v) => v.id === vehicleId)?.registrationNumber || vehicleId}` : "";
    const a = document.createElement("a"); a.href = url; a.download = `expense-report${vehSuffix}${suffix}-${getDateRange().from}-to-${getDateRange().to}.csv`; a.click();
    URL.revokeObjectURL(url); setShowDownload(false);
  };

  const downloadPDF = async () => {
    if (!report) return;
    const { from, to } = getDateRange();
    const veh = vehicleId ? vehicles.find((v) => v.id === vehicleId) : null;
    const filtered = getFilteredExpenses();
    const filteredTotal = getFilteredTotal();
    setShowDownload(false);

    // Group filtered expenses by category
    const grouped: Record<string, ExpenseItem[]> = {};
    for (const exp of filtered) { const cat = exp.category; if (!grouped[cat]) grouped[cat] = []; grouped[cat].push(exp); }

    const lineTotal = (e: ExpenseItem) => e.amount + (e.handlingCharges ?? 0);
    const catSectionsHTML = Object.entries(grouped).map(([cat, items]) => {
      const color = CATEGORY_COLORS_HEX[cat] || "#6b7280";
      const label = CATEGORY_LABELS[cat] || cat;
      const catTotal = items.reduce((s, e) => s + lineTotal(e), 0);
      return `<div style="margin-bottom:24px"><div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-left:4px solid ${color};background:${color}10;border-radius:0 10px 10px 0;margin-bottom:8px"><div><span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:6px;background:${color}18;color:${color}">${label}</span><span style="font-size:10px;color:#9ca3af;margin-left:8px">${items.length} txn${items.length > 1 ? "s" : ""}</span></div><div style="font-size:18px;font-weight:800;color:${color}">\u20B9${catTotal.toLocaleString("en-IN")}</div></div><table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr><th style="text-align:left;padding:8px 12px;font-size:9px;text-transform:uppercase;letter-spacing:0.06em;color:#9ca3af;border-bottom:2px solid #e5e7eb">Date</th><th style="text-align:left;padding:8px 12px;font-size:9px;text-transform:uppercase;letter-spacing:0.06em;color:#9ca3af;border-bottom:2px solid #e5e7eb">Vehicle</th><th style="text-align:left;padding:8px 12px;font-size:9px;text-transform:uppercase;letter-spacing:0.06em;color:#9ca3af;border-bottom:2px solid #e5e7eb">Description</th><th style="text-align:right;padding:8px 12px;font-size:9px;text-transform:uppercase;letter-spacing:0.06em;color:#9ca3af;border-bottom:2px solid #e5e7eb">Amount</th></tr></thead><tbody>${items.map((e) => {
        const handling = e.handlingCharges ?? 0;
        const amtCell = handling > 0
          ? `\u20B9${lineTotal(e).toLocaleString("en-IN")}<div style="font-size:9px;font-weight:400;color:#9ca3af;margin-top:2px">incl. \u20B9${handling.toLocaleString("en-IN")} handling</div>`
          : `\u20B9${e.amount.toLocaleString("en-IN")}`;
        return `<tr><td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;color:#374151">${new Date(e.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</td><td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-weight:600;color:#1f2937;font-family:monospace;font-size:11px">${e.vehicle?.registrationNumber || "\u2014"}</td><td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;color:#374151">${e.title}</td><td style="text-align:right;padding:8px 12px;border-bottom:1px solid #f3f4f6;font-weight:700;color:#1f2937">${amtCell}</td></tr>`;
      }).join("")}</tbody></table></div>`;
    }).join("");

    // Build HTML in a hidden container
    const container = document.createElement("div");
    container.style.cssText = "position:fixed;left:-9999px;top:0;width:900px;background:#fff;font-family:Segoe UI,system-ui,sans-serif;color:#1f2937;padding:48px 52px;";
    // Generate report reference ID
    const now = new Date();
    const refId = `YT-EXP-${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}${String(now.getDate()).padStart(2,"0")}-${String(Math.floor(Math.random()*999)+1).padStart(3,"0")}`;

    // Quick stats
    const monthlyAmounts = report.timeline.map((t) => ({ month: new Date(t.period + "-01").toLocaleDateString("en-IN", { month: "short", year: "numeric" }), total: typeof t.total === "number" ? t.total : 0 }));
    const avgMonthly = monthlyAmounts.length > 0 ? Math.round(monthlyAmounts.reduce((s, m) => s + m.total, 0) / monthlyAmounts.length) : 0;
    const highestMonth = monthlyAmounts.length > 0 ? monthlyAmounts.reduce((a, b) => a.total > b.total ? a : b) : null;
    const lowestMonth = monthlyAmounts.length > 0 ? monthlyAmounts.reduce((a, b) => a.total < b.total ? a : b) : null;

    // Top 5 vehicles by spending
    const vehicleSpendMap = new Map<string, { reg: string; make: string; model: string; total: number }>();
    for (const exp of filtered) {
      if (!exp.vehicle) continue;
      const key = exp.vehicle.registrationNumber;
      if (!vehicleSpendMap.has(key)) vehicleSpendMap.set(key, { reg: key, make: exp.vehicle.make, model: exp.vehicle.model, total: 0 });
      vehicleSpendMap.get(key)!.total += lineTotal(exp);
    }
    const topVehicles = [...vehicleSpendMap.values()].sort((a, b) => b.total - a.total).slice(0, 5);

    const sectionTitle = (text: string) => `<div style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#1f2937;margin-bottom:14px;padding:10px 16px;background:linear-gradient(90deg,#fffbeb,#fff);border-left:3px solid #f59e0b;border-radius:0 8px 8px 0">${text}</div>`;

    container.innerHTML = `
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-35deg);font-size:100px;font-weight:900;color:rgba(156,163,175,0.06);letter-spacing:8px;white-space:nowrap;pointer-events:none;text-transform:uppercase">YELLOW TRACK</div>
      <div style="position:relative;z-index:1">
        <!-- Header -->
        <div style="display:flex;align-items:center;justify-content:space-between;padding:0 0 24px 0;border-bottom:3px solid #f59e0b;margin-bottom:24px">
          <div style="display:flex;align-items:center;gap:12px">
            <img src="/images/logo/yellow-track-logo.svg" style="width:40px;height:40px;border-radius:10px" />
            <div><div style="font-size:22px;font-weight:800;letter-spacing:-0.5px"><span style="color:#f59e0b">Yellow</span> <span style="color:#1f2937">Track</span></div><div style="font-size:11px;color:#9ca3af;font-weight:500;letter-spacing:0.05em;text-transform:uppercase">Fleet Expense Report</div></div>
          </div>
          <div style="text-align:right;font-size:12px;color:#6b7280;line-height:1.7">
            <div style="font-size:10px;font-weight:700;color:#f59e0b;letter-spacing:1px;margin-bottom:4px">${refId}</div>
            <strong>${new Date(from).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</strong> \u2014 <strong>${new Date(to).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</strong><br>
            ${veh ? `Vehicle: <strong>${veh.registrationNumber}</strong> (${veh.make} ${veh.model})` : "<strong>All Vehicles</strong>"}${categoryFilter ? ` \u2014 <strong>${CATEGORY_LABELS[categoryFilter] || categoryFilter}</strong>` : ""}<br>
            Generated: ${now.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
          </div>
        </div>

        ${veh ? `<!-- Vehicle Summary -->
        <div style="display:flex;align-items:center;gap:16px;padding:16px 20px;border:1px solid #e5e7eb;border-radius:12px;margin-bottom:24px;background:linear-gradient(135deg,#f9fafb,#fff)">
          <div style="width:48px;height:48px;background:#f3f4f6;border-radius:12px;display:flex;align-items:center;justify-content:center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0H6.375"/></svg></div>
          <div>
            <div style="font-size:16px;font-weight:800;color:#1f2937;font-family:monospace;letter-spacing:1px">${veh.registrationNumber}</div>
            <div style="font-size:12px;color:#6b7280;margin-top:2px">${veh.make} ${veh.model}</div>
          </div>
          <div style="margin-left:auto;text-align:right">
            <div style="font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;font-weight:600">Total Spend</div>
            <div style="font-size:20px;font-weight:800;color:#1f2937">\u20B9${filteredTotal.toLocaleString("en-IN")}</div>
          </div>
        </div>` : ""}

        <!-- Grand Total Banner -->
        <div style="background:linear-gradient(135deg,#1f2937,#111827);color:white;padding:28px 32px;border-radius:14px;margin-bottom:28px;display:flex;align-items:center;justify-content:space-between">
          <div><div style="font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:#9ca3af;margin-bottom:4px">Total Fleet Expenses</div><div style="font-size:18px;font-weight:700">Comprehensive Spending Analysis</div></div>
          <div style="text-align:right"><div style="font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:#9ca3af;margin-bottom:4px">Grand Total</div><div style="font-size:30px;font-weight:800;letter-spacing:-1px">\u20B9${filteredTotal.toLocaleString("en-IN")}</div></div>
        </div>

        <!-- Quick Stats -->
        ${monthlyAmounts.length > 0 ? `
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:28px">
          <div style="border:1px solid #e5e7eb;border-radius:12px;padding:16px;background:#fff">
            <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.08em;color:#9ca3af;font-weight:700">Avg Monthly Spend</div>
            <div style="font-size:20px;font-weight:800;color:#1f2937;margin-top:6px">\u20B9${avgMonthly.toLocaleString("en-IN")}</div>
            <div style="font-size:10px;color:#9ca3af;margin-top:2px">${monthlyAmounts.length} month${monthlyAmounts.length > 1 ? "s" : ""}</div>
          </div>
          <div style="border:1px solid #e5e7eb;border-radius:12px;padding:16px;background:#fff">
            <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.08em;color:#9ca3af;font-weight:700">Highest Month</div>
            <div style="font-size:20px;font-weight:800;color:#ef4444;margin-top:6px">\u20B9${highestMonth ? highestMonth.total.toLocaleString("en-IN") : "0"}</div>
            <div style="font-size:10px;color:#9ca3af;margin-top:2px">${highestMonth?.month || "\u2014"}</div>
          </div>
          <div style="border:1px solid #e5e7eb;border-radius:12px;padding:16px;background:#fff">
            <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.08em;color:#9ca3af;font-weight:700">Lowest Month</div>
            <div style="font-size:20px;font-weight:800;color:#10b981;margin-top:6px">\u20B9${lowestMonth ? lowestMonth.total.toLocaleString("en-IN") : "0"}</div>
            <div style="font-size:10px;color:#9ca3af;margin-top:2px">${lowestMonth?.month || "\u2014"}</div>
          </div>
        </div>` : ""}

        <!-- Top Spending Vehicles (only when showing all vehicles) -->
        ${!veh && topVehicles.length > 1 ? `
        ${sectionTitle("Top Spending Vehicles")}
        <table style="width:100%;border-collapse:collapse;margin-bottom:28px">
          <thead><tr>
            <th style="text-align:left;padding:8px 12px;font-size:9px;text-transform:uppercase;color:#9ca3af;font-weight:700;border-bottom:2px solid #e5e7eb">#</th>
            <th style="text-align:left;padding:8px 12px;font-size:9px;text-transform:uppercase;color:#9ca3af;font-weight:700;border-bottom:2px solid #e5e7eb">Vehicle</th>
            <th style="text-align:left;padding:8px 12px;font-size:9px;text-transform:uppercase;color:#9ca3af;font-weight:700;border-bottom:2px solid #e5e7eb">Make / Model</th>
            <th style="text-align:right;padding:8px 12px;font-size:9px;text-transform:uppercase;color:#9ca3af;font-weight:700;border-bottom:2px solid #e5e7eb">Total Spent</th>
            <th style="text-align:right;padding:8px 12px;font-size:9px;text-transform:uppercase;color:#9ca3af;font-weight:700;border-bottom:2px solid #e5e7eb">% of Total</th>
          </tr></thead>
          <tbody>${topVehicles.map((v, i) => `<tr${i % 2 === 1 ? ' style="background:#fafafa"' : ""}>
            <td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;font-size:12px;font-weight:700;color:#f59e0b">${i + 1}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;font-size:12px;font-weight:700;color:#1f2937;font-family:monospace">${v.reg}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;font-size:12px;color:#6b7280">${v.make} ${v.model}</td>
            <td style="text-align:right;padding:10px 12px;border-bottom:1px solid #f3f4f6;font-size:12px;font-weight:800;color:#1f2937">\u20B9${v.total.toLocaleString("en-IN")}</td>
            <td style="text-align:right;padding:10px 12px;border-bottom:1px solid #f3f4f6;font-size:12px;color:#6b7280">${filteredTotal > 0 ? Math.round((v.total / filteredTotal) * 100) : 0}%</td>
          </tr>`).join("")}</tbody>
        </table>` : ""}

        ${sectionTitle("Expense Breakdown by Category")}
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:14px;margin-bottom:36px">
          ${Object.entries(getFilteredBreakdown()).filter(([, v]) => v > 0).map(([k, v]) => { const c = CATEGORY_COLORS_HEX[k] || "#6b7280"; const p = filteredTotal > 0 ? Math.round((v / filteredTotal) * 100) : 0; return `<div style="border:1px solid #e5e7eb;border-radius:12px;padding:14px;position:relative;overflow:hidden;background:linear-gradient(135deg,#fff,#fafafa)"><div style="position:absolute;top:0;left:0;right:0;height:4px;background:${c}"></div><div style="font-size:9px;text-transform:uppercase;letter-spacing:0.08em;color:#9ca3af;font-weight:700;margin-top:4px">${CATEGORY_LABELS[k] || k}</div><div style="font-size:18px;font-weight:800;margin-top:6px;color:#1f2937">\u20B9${v.toLocaleString("en-IN")}</div><div style="font-size:10px;color:#9ca3af;margin-top:2px">${p}% of total</div></div>`; }).join("")}
        </div>
        ${report.timeline.length > 0 ? `<div style="margin-bottom:28px"><div style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#1f2937;margin-bottom:14px;padding:10px 16px;background:linear-gradient(90deg,#fffbeb,#fff);border-left:3px solid #f59e0b;border-radius:0 8px 8px 0">Monthly Spending Trend</div><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left;padding:8px 12px;font-size:9px;text-transform:uppercase;color:#9ca3af;font-weight:700;border-bottom:2px solid #e5e7eb">Month</th><th style="text-align:right;padding:8px 12px;font-size:9px;text-transform:uppercase;color:#9ca3af;font-weight:700;border-bottom:2px solid #e5e7eb">Amount</th><th style="width:40%;padding:8px 12px;border-bottom:2px solid #e5e7eb"></th></tr></thead><tbody>${report.timeline.map((t) => { const tot = typeof t.total === "number" ? t.total : 0; const mx = Math.max(...report.timeline.map((x) => typeof x.total === "number" ? x.total : 0), 1); return `<tr><td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;font-size:12px"><strong>${new Date(t.period + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</strong></td><td style="text-align:right;padding:10px 12px;border-bottom:1px solid #f3f4f6;font-size:12px"><strong>\u20B9${tot.toLocaleString("en-IN")}</strong></td><td style="padding:10px 12px;border-bottom:1px solid #f3f4f6"><div style="height:6px;border-radius:3px;background:linear-gradient(90deg,#f59e0b,#d97706);width:${Math.round((tot / mx) * 100)}%;margin-top:4px"></div></td></tr>`; }).join("")}</tbody></table></div>` : ""}
        <div style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#1f2937;margin-bottom:14px;padding:10px 16px;background:linear-gradient(90deg,#fffbeb,#fff);border-left:3px solid #f59e0b;border-radius:0 8px 8px 0">Detailed Expenses by Category (${filtered.length} transactions)</div>
        ${catSectionsHTML}

        <!-- Footer with Stamp -->
        <div style="margin-top:40px;border-top:3px solid #f59e0b;padding-top:28px;display:flex;align-items:center;justify-content:space-between">
          <!-- Left: branding -->
          <div>
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px"><img src="/images/logo/yellow-track-logo.svg" style="width:28px;height:28px;border-radius:8px" /><span style="font-size:15px;font-weight:800"><span style="color:#f59e0b">Yellow</span> <span style="color:#1f2937">Track</span></span></div>
            <div style="font-size:11px;color:#9ca3af;line-height:1.7">Fleet Management System<br>Confidential \u2014 Auto-generated report<br>${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</div>
          </div>
          <!-- Right: Approved stamp image + text -->
          <div style="flex-shrink:0;text-align:center">
            <img src="/images/approved-stamp.png" style="width:160px;height:160px" />
            <div style="margin-top:6px;font-size:9px;font-weight:800;letter-spacing:1px;color:#166534;text-transform:uppercase">Verified &amp; Approved by</div>
            <div style="display:flex;align-items:center;justify-content:center;gap:5px;margin-top:3px"><img src="/images/logo/yellow-track-logo.svg" style="width:18px;height:18px;border-radius:4px;vertical-align:middle;position:relative;top:1px" /><span style="font-size:12px;font-weight:900;letter-spacing:0.5px"><span style="color:#f59e0b">Yellow</span> <span style="color:#1f2937">Track</span></span></div>
          </div>
        </div>

        <!-- Disclaimer -->
        <div style="margin-top:28px;padding:16px 20px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px">
          <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;margin-bottom:6px">Disclaimer</div>
          <div style="font-size:9px;color:#9ca3af;line-height:1.7">
            This report is auto-generated by Yellow Track Fleet Management System and is intended for internal use only. All financial figures are based on data recorded in the system and may not reflect final audited amounts. The information contained herein is confidential and proprietary. Unauthorized distribution, reproduction, or use of this report is strictly prohibited. Yellow Track assumes no liability for decisions made based on this report. For discrepancies, please contact your fleet administrator.
          </div>
        </div>

        <!-- Page Number -->
        <div style="margin-top:20px;text-align:center;font-size:9px;color:#d1d5db;letter-spacing:0.5px">
          Report Ref: <span style="color:#9ca3af;font-weight:600">${refId}</span> &nbsp;\u2022&nbsp; Page 1 of 1 &nbsp;\u2022&nbsp; \u00A9 ${now.getFullYear()} Yellow Track
        </div>
      </div>`;
    document.body.appendChild(container);

    // Wait for images to load, then capture and download
    const img = container.querySelector("img");
    const doCapture = async () => {
      const html2canvas = (await import("html2canvas")).default;
      const jsPDF = (await import("jspdf")).default;
      const canvas = await html2canvas(container, { scale: 2, useCORS: true, backgroundColor: "#ffffff", scrollY: 0, windowWidth: 900 });
      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      // Use A4 width but custom height to fit all content — no page breaks
      const a4W = 210; // mm
      const contentH = (canvas.height * a4W) / canvas.width;
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: [a4W, Math.max(contentH, 297)] });
      pdf.addImage(imgData, "JPEG", 0, 0, a4W, contentH);
      const suffix = categoryFilter ? `-${categoryFilter.toLowerCase()}` : "";
      const vehSuffix = veh ? `-${veh.registrationNumber}` : "";
      pdf.save(`Yellow-Track-Expense-Report${vehSuffix}${suffix}-${from}-to-${to}.pdf`);
      document.body.removeChild(container);
    };

    if (img && !img.complete) { img.onload = doCapture; img.onerror = doCapture; } else { await doCapture(); }
  };

  const breakdown = report?.summary?.breakdown || {};
  const activeCategories = Object.entries(breakdown).filter(([, v]) => v > 0);

  // Per-category transaction count, drawn from the same expenses list the
  // table uses — keeps the chip footer ("3 txns · avg ₹X") in sync with the
  // table rows below.
  const categoryStats: Record<string, { count: number }> = (() => {
    const m: Record<string, { count: number }> = {};
    if (!report) return m;
    for (const e of report.expenses) {
      if (!m[e.category]) m[e.category] = { count: 0 };
      m[e.category].count += 1;
    }
    return m;
  })();

  // Trend chart + category donut moved to the main Dashboard.

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Vehicles Expenses</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Track all vehicle-related spending with detailed analytics</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setExpVehicleId(vehicleId || ""); setShowModal(true); }}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-yellow-500 to-yellow-400 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-yellow-500/25 hover:shadow-yellow-500/40 transition-all">
            <Plus className="w-4 h-4" />
            Log Expense
          </button>
          <button
            disabled={!vehicleId}
            onClick={() => {
              if (!vehicleId) return;
              setExpVehicleId(vehicleId);
              setExpForm((prev) => ({ ...prev, category: "INVOICE", title: prev.title || "Vehicle Invoice" }));
              setShowModal(true);
            }}
            title={vehicleId ? "Add an invoice for the selected vehicle" : "Pick a vehicle from the filter to add its invoice"}
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 hover:bg-cyan-600 disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:text-gray-400 dark:disabled:text-gray-500 disabled:cursor-not-allowed px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all"
          >
            <FileText className="w-4 h-4" />
            Add Invoice
          </button>
          <div className="relative">
            <button onClick={() => setShowDownload(!showDownload)}
              className="inline-flex items-center gap-2 rounded-xl border-2 border-gray-200 dark:border-gray-700 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
              <Download className="w-4 h-4" />
              Download Report
            </button>
            {showDownload && (
              <div className="absolute right-0 mt-2 w-48 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl z-50 overflow-hidden">
                <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-800">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Download for</p>
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mt-0.5">{getFilterLabel()}</p>
                </div>
                <button onClick={downloadCSV} className="w-full px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2.5 font-medium">
                  <span className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center"><BarChart3 className="w-4 h-4 text-emerald-600" /></span>
                  CSV Spreadsheet
                </button>
                <button onClick={downloadPDF} className="w-full px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2.5 font-medium border-t border-gray-100 dark:border-gray-800">
                  <span className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-500/20 flex items-center justify-center"><FileText className="w-4 h-4 text-red-600" /></span>
                  PDF Report
                </button>
              </div>
            )}
          </div>
        </div>
      </div>


      {loading ? (
        <ExpensesDashboardSkeleton />
      ) : report && (
        <>
          {/* Summary chips — compact, horizontal scroll */}
          <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-hide" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
            <style>{`.scrollbar-hide::-webkit-scrollbar { display: none; }`}</style>
            {/* Total chip — dark headline */}
            <div className="flex-shrink-0 min-w-[200px] rounded-xl bg-gradient-to-br from-gray-900 to-gray-800 border border-white/10 px-4 py-3 shadow-lg shadow-gray-900/30 relative overflow-hidden">
              <div className="absolute top-2 right-2 w-12 h-12 rounded-full bg-yellow-500/10 blur-xl" />
              <div className="relative">
                <p className="text-[9px] uppercase tracking-widest text-yellow-400/80 font-bold">Total Expenses</p>
                <p className="text-2xl font-black text-white mt-1 tracking-tight leading-none">&#8377;{report.summary.totalSpent.toLocaleString("en-IN")}</p>
                <div className="mt-1.5 flex items-center gap-1 text-[10px] text-gray-400">
                  <span className="font-semibold text-gray-300">{report.expenses.length}</span>
                  <span>txns</span>
                  {report.expenses.length > 0 && (
                    <>
                      <span className="text-gray-600">·</span>
                      <span>avg &#8377;{Math.round(report.summary.totalSpent / report.expenses.length).toLocaleString("en-IN")}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Category chips — compact */}
            {activeCategories.map(([key, val]) => {
              const c = CATEGORY_COLORS[key] || CATEGORY_COLORS.misc;
              const pct = report.summary.totalSpent > 0 ? Math.round((val / report.summary.totalSpent) * 100) : 0;
              const count = categoryStats[key]?.count ?? 0;
              const avg = count > 0 ? Math.round(val / count) : 0;
              return (
                <div
                  key={key}
                  className="flex-shrink-0 min-w-[180px] rounded-xl bg-white dark:bg-gray-800/40 border border-gray-200/80 dark:border-gray-700/60 px-3 py-2.5 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md transition-all"
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className={`w-6 h-6 rounded-md bg-gradient-to-br ${c.gradient} flex items-center justify-center flex-shrink-0`}>
                        {(() => { const Icon = CATEGORY_ICONS[key] || MoreHorizontal; return <Icon className="w-3 h-3 text-white" />; })()}
                      </div>
                      <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-bold truncate">{CATEGORY_LABELS[key]}</p>
                    </div>
                    <span className="text-[9px] font-bold text-gray-400 dark:text-gray-500 flex-shrink-0">{pct}%</span>
                  </div>
                  <p className="text-lg font-black text-gray-900 dark:text-white leading-none">&#8377;{val.toLocaleString("en-IN")}</p>
                  <div className="mt-1.5 h-1 bg-gray-100 dark:bg-gray-700/50 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full bg-gradient-to-r ${c.gradient}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="mt-1.5 flex items-center gap-1 text-[9px] text-gray-500 dark:text-gray-400">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">{count}</span>
                    <span>txn{count === 1 ? "" : "s"}</span>
                    {count > 0 && (
                      <>
                        <span className="text-gray-300 dark:text-gray-600">·</span>
                        <span>avg &#8377;{avg.toLocaleString("en-IN")}</span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Filters — glassy */}
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/20 bg-white/60 dark:bg-gray-800/40 backdrop-blur-xl p-4 shadow-lg shadow-gray-200/30 dark:shadow-none dark:border-gray-700/50">
            <VehicleAutocomplete
              vehicles={vehicles}
              value={vehicleId}
              onChange={setVehicleId}
              className="min-w-[220px]"
              placeholder="All Vehicles"
              size="sm"
            />
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-9 rounded-lg border border-gray-200/80 bg-white/80 dark:bg-gray-800/80 backdrop-blur px-3 text-xs text-gray-900 focus:border-yellow-400 focus:outline-none dark:border-gray-700 dark:text-white min-w-[150px]">
              <option value="">All Categories</option>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <div className="flex gap-1 p-0.5 bg-gray-100/80 dark:bg-gray-800/80 backdrop-blur rounded-lg">
              {[{ key: "this_month", label: "This Month" }, { key: "last_month", label: "Last Month" }, { key: "this_quarter", label: "Quarter" }, { key: "this_year", label: "Year" }].map((p) => (
                <button key={p.key} onClick={() => { setPeriod(p.key); setCustomFrom(""); setCustomTo(""); }}
                  className={`px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all ${period === p.key ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm" : "text-gray-500 hover:text-gray-700 dark:text-gray-400"}`}>
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <DatePicker
                value={customFrom}
                onChange={(v) => { setCustomFrom(v); if (v) setPeriod("custom"); }}
                placeholder="From"
              />
              <span className="text-xs text-gray-400">to</span>
              <DatePicker
                value={customTo}
                onChange={(v) => { setCustomTo(v); if (v) setPeriod("custom"); }}
                placeholder="To"
                minDate={customFrom}
              />
            </div>
          </div>


          {/* Expense Table — 3D Glass */}
          <div className="relative group" style={{ perspective: "1200px" }}>
            <div className="absolute inset-0 bg-gradient-to-br from-gray-500/3 via-transparent to-gray-500/3 rounded-3xl blur-xl" />
          <div className="relative rounded-3xl bg-white/60 dark:bg-gray-800/30 backdrop-blur-2xl border border-white/40 dark:border-gray-600/30 overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent" />
            <div className="p-5 border-b border-white/20 dark:border-gray-700/30 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                All Transactions <span className="text-gray-400 font-normal normal-case ml-1">({getFilteredExpenses().length}{categoryFilter ? ` — ${CATEGORY_LABELS[categoryFilter]}` : ""})</span>
              </h3>
            </div>
            {getFilteredExpenses().length === 0 ? (
              <div className="p-12 text-center"><p className="text-sm text-gray-500">No expenses found for this period{categoryFilter ? ` in ${CATEGORY_LABELS[categoryFilter]}` : ""}</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50/80 dark:bg-gray-800/50">
                    <tr>
                      <th className="text-left px-5 py-3.5 font-bold text-gray-500 uppercase tracking-wider text-[10px]">Date</th>
                      <th className="text-left px-5 py-3.5 font-bold text-gray-500 uppercase tracking-wider text-[10px]">Vehicle</th>
                      <th className="text-left px-5 py-3.5 font-bold text-gray-500 uppercase tracking-wider text-[10px]">Category</th>
                      <th className="text-left px-5 py-3.5 font-bold text-gray-500 uppercase tracking-wider text-[10px]">Title</th>
                      <th className="text-right px-5 py-3.5 font-bold text-gray-500 uppercase tracking-wider text-[10px]">Amount</th>
                      <th className="text-center px-5 py-3.5 font-bold text-gray-500 uppercase tracking-wider text-[10px]">Attachments</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100/50 dark:divide-gray-800/50">
                    {getFilteredExpenses().map((exp, i) => {
                      const c = CATEGORY_COLORS[exp.category] || CATEGORY_COLORS.misc;
                      const drilldownHref = exp.source === "SERVICE" && exp.vehicleId
                        ? `/vehicles/services/${exp.vehicleId}`
                        : null;
                      return (
                        <tr
                          key={i}
                          onClick={drilldownHref ? () => router.push(drilldownHref) : undefined}
                          className={`hover:bg-white/50 dark:hover:bg-gray-800/30 transition-colors ${drilldownHref ? "cursor-pointer" : ""}`}
                          title={drilldownHref ? "Open service history for this vehicle" : undefined}
                        >
                          <td className="px-5 py-3.5 text-gray-600 dark:text-gray-400 whitespace-nowrap">{new Date(exp.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <div className="font-semibold text-gray-900 dark:text-white font-mono text-[11px]">{exp.vehicle?.registrationNumber || "—"}</div>
                            {exp.vehicle?.ownerName && (
                              <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate max-w-[180px]" title={exp.vehicle.ownerName}>{exp.vehicle.ownerName}</div>
                            )}
                          </td>
                          <td className="px-5 py-3.5">
                            <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-lg ${c.bg} ${c.text}`}>
                              {(() => { const Icon = CATEGORY_ICONS[exp.category] || MoreHorizontal; return <Icon className="w-3 h-3" />; })()}
                              {CATEGORY_LABELS[exp.category] || exp.category}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-gray-700 dark:text-gray-300 max-w-[200px] truncate">{exp.title}</td>
                          <td className="px-5 py-3.5 text-right whitespace-nowrap">
                            <div className="font-black text-gray-900 dark:text-white">
                              &#8377;{(exp.amount + (exp.handlingCharges ?? 0)).toLocaleString("en-IN")}
                            </div>
                            {(exp.handlingCharges ?? 0) > 0 && (
                              <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 font-normal">
                                incl. &#8377;{(exp.handlingCharges ?? 0).toLocaleString("en-IN")} handling
                              </div>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            {exp.proofUrls.length > 0 ? (
                              <div className="inline-flex items-center gap-1 justify-center">
                                {exp.proofUrls.slice(0, 3).map((url, idx) => (
                                  <a key={idx} href={resolveImageUrl(url) ?? "#"} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="w-7 h-7 rounded-lg bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center text-brand-500 hover:text-brand-600 transition-colors" title={`Attachment ${idx + 1}`}>
                                    <ImageIcon className="w-3.5 h-3.5" />
                                  </a>
                                ))}
                                {exp.proofUrls.length > 3 && (
                                  <span className="text-[10px] font-semibold text-gray-500 ml-0.5">+{exp.proofUrls.length - 3}</span>
                                )}
                              </div>
                            ) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          </div>
        </>
      )}

      {/* Log Expense Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !saving && setShowModal(false)} />
          <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-gray-200 dark:border-gray-700 flex flex-col max-h-[90vh]">
            {/* Sticky header */}
            <div className="flex items-center justify-between bg-gradient-to-r from-yellow-500 to-amber-500 px-6 py-4 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <Receipt className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Log Expense</h3>
                  <p className="text-[11px] text-yellow-50/90">Record a vehicle expense with attachments</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !saving && setShowModal(false)}
                disabled={saving}
                className="w-8 h-8 rounded-lg bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-colors disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* SECTION: Basic info */}
              <section className="space-y-3">
                <h4 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Basics</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">Vehicle <span className="text-red-500">*</span></label>
                    <select value={expVehicleId} onChange={(e) => setExpVehicleId(e.target.value)} className="w-full h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white">
                      <option value="">Select vehicle</option>
                      {vehicles.map((v) => <option key={v.id} value={v.id}>{v.registrationNumber} — {v.make} {v.model}{v.ownerName ? ` (${v.ownerName})` : ""}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">Category <span className="text-red-500">*</span></label>
                    <select
                      value={expForm.category}
                      onChange={(e) => {
                        const next = e.target.value;
                        // Reset tyre sub-type whenever the user leaves the
                        // service-family categories so the form stays clean.
                        if (next !== "SERVICE") setServiceSubType("GENERAL");
                        setExpForm({ ...expForm, category: next });
                      }}
                      className="w-full h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    >
                      <option value="COMPLIANCE">Compliance</option>
                      <option value="SERVICE">Services</option>
                      <option value="TYRE_REPLACEMENT">Tyre Replacement</option>
                      <option value="FASTAG">FASTag</option>
                      <option value="CHALLAN">Challans</option>
                      <option value="EMI">EMI</option>
                      <option value="INVOICE">Invoice</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">Title <span className="text-red-500">*</span></label>
                  <input type="text" placeholder={TITLE_PLACEHOLDER[expForm.category] || "e.g. RC Renewal, Diesel Fill"} value={expForm.title} onChange={(e) => setExpForm({ ...expForm, title: e.target.value })} className="w-full h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                </div>
              </section>

              {/* SECTION: Tyre Replacement (now a top-level category — show
                  odometer / brand fields without the sub-type select) */}
              {expForm.category === "TYRE_REPLACEMENT" && (
                <section className="space-y-3 rounded-xl border border-blue-100 bg-blue-50/40 dark:border-blue-500/20 dark:bg-blue-500/5 p-4">
                  <h4 className="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Wrench className="w-3 h-3" />
                    Tyre Details
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">Odometer (km) <span className="text-red-500">*</span></label>
                      <input
                        type="number"
                        min="0"
                        placeholder="e.g. 45000"
                        value={tyreOdometerKm}
                        onChange={(e) => setTyreOdometerKm(e.target.value)}
                        className="w-full h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">Brand <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        list="tyre-brands"
                        placeholder="e.g. MRF, CEAT"
                        value={tyreBrand}
                        onChange={(e) => setTyreBrand(e.target.value)}
                        className="w-full h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                      />
                      <datalist id="tyre-brands">
                        <option value="MRF" />
                        <option value="CEAT" />
                        <option value="Apollo" />
                        <option value="JK Tyre" />
                        <option value="Bridgestone" />
                        <option value="Michelin" />
                        <option value="Goodyear" />
                        <option value="Yokohama" />
                        <option value="Pirelli" />
                        <option value="Continental" />
                      </datalist>
                    </div>
                  </div>
                  {(() => {
                    if (!lastTyreReplacement) {
                      return (
                        <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800/40 px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
                          First tyre replacement on record for this vehicle.
                        </div>
                      );
                    }
                    const curKm = Number(tyreOdometerKm) || 0;
                    const ran = curKm > 0 ? curKm - lastTyreReplacement.odometerKm : null;
                    return (
                      <div className="rounded-lg border border-amber-300/60 bg-white dark:border-amber-500/30 dark:bg-amber-500/5 px-3 py-2 text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                        <span className="font-semibold">Last replacement: </span>
                        {lastTyreReplacement.brand} at {lastTyreReplacement.odometerKm.toLocaleString("en-IN")} km on {new Date(lastTyreReplacement.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}.
                        {ran != null && ran > 0 && (
                          <> Outgoing tyres ran <span className="font-bold">{ran.toLocaleString("en-IN")} km</span>.</>
                        )}
                        {ran != null && ran < 0 && (
                          <> <span className="text-red-600 dark:text-red-400 font-semibold">Odometer is lower than last replacement — check entry.</span></>
                        )}
                      </div>
                    );
                  })()}
                </section>
              )}

              {/* SECTION: Amount — Handling charges are only meaningful for
                  general Services (mechanic / labour fees etc). Other
                  categories collapse the layout to amount + total. */}
              <section className="space-y-3">
                <h4 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Amount</h4>
                <div className={`grid grid-cols-1 gap-3 items-end ${expForm.category === "COMPLIANCE" ? "sm:grid-cols-[1fr_1fr_auto]" : "sm:grid-cols-[1fr_auto]"}`}>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">Amount (&#8377;) <span className="text-red-500">*</span></label>
                    <input type="number" min="0" placeholder="0" value={expForm.amount} onChange={(e) => setExpForm({ ...expForm, amount: e.target.value })} className="w-full h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                  </div>
                  {expForm.category === "COMPLIANCE" && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">Handling (&#8377;)</label>
                      <input type="number" min="0" placeholder="0" value={expForm.handlingCharges} onChange={(e) => setExpForm({ ...expForm, handlingCharges: e.target.value })} className="w-full h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                    </div>
                  )}
                  <div className="h-10 flex items-center gap-2 px-4 rounded-lg bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-500/10 dark:to-amber-500/10 border border-yellow-200/70 dark:border-yellow-500/20 min-w-[120px]">
                    <span className="text-[10px] font-bold text-yellow-700 dark:text-yellow-400/80 uppercase tracking-wider">Total</span>
                    <span className="text-sm font-black text-yellow-700 dark:text-yellow-400 font-mono">
                      &#8377;{((Number(expForm.amount) || 0) + (expForm.category === "COMPLIANCE" ? (Number(expForm.handlingCharges) || 0) : 0)).toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
              </section>

              {/* SECTION: When & Where */}
              <section className="space-y-3">
                <h4 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Date & Receipts</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">Date <span className="text-red-500">*</span></label>
                    <DatePicker value={expForm.expenseDate} onChange={(v) => setExpForm({ ...expForm, expenseDate: v })} placeholder="Select date" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">Attachments</label>
                    <label className="flex items-center gap-2 h-10 px-3 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 hover:border-yellow-400 hover:bg-yellow-50/30 dark:hover:bg-yellow-500/[0.03] cursor-pointer transition-colors group">
                      <Upload className="w-4 h-4 text-gray-400 group-hover:text-yellow-500" />
                      <span className="text-xs text-gray-500 dark:text-gray-400 group-hover:text-yellow-600 truncate">
                        {expProofs.length === 0 ? "Upload receipts (PDF, JPG, PNG)" : `Add more (${expProofs.length} selected)`}
                      </span>
                      <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => { const fs = pickValidatedFiles(e.target, (t, m) => toast.error(t, m)); if (fs.length) setExpProofs((prev) => [...prev, ...fs]); }} />
                    </label>
                  </div>
                </div>
                {expProofs.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {expProofs.map((f, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-yellow-50 dark:bg-yellow-500/10 text-yellow-800 dark:text-yellow-400 text-xs font-medium">
                        <FileText className="w-3 h-3" />
                        <span className="truncate max-w-[180px]">{f.name}</span>
                        <button type="button" onClick={() => setExpProofs((prev) => prev.filter((_, i) => i !== idx))} className="text-yellow-700 hover:text-red-500 transition-colors" title="Remove">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </section>

              {/* SECTION: Notes */}
              <section>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
                <textarea
                  rows={2}
                  placeholder="Optional notes…"
                  value={expForm.description}
                  onChange={(e) => setExpForm({ ...expForm, description: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white resize-none"
                />
              </section>
            </div>

            {/* Sticky footer */}
            <div className="border-t border-gray-100 dark:border-gray-800 px-6 py-3.5 flex items-center justify-between gap-3 bg-gray-50/60 dark:bg-gray-900/60 flex-shrink-0">
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                <span className="text-red-500">*</span> Required fields
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => !saving && setShowModal(false)}
                  disabled={saving}
                  className="h-10 px-5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleLogExpense}
                  disabled={saving || !expVehicleId || !expForm.title || !expForm.amount || !expForm.expenseDate}
                  className="h-10 px-6 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 text-white font-semibold text-sm shadow-md shadow-yellow-500/25 hover:shadow-yellow-500/40 transition-all disabled:opacity-50 disabled:shadow-none flex items-center gap-2"
                >
                  {saving ? "Saving…" : (
                    <>
                      <Plus className="w-4 h-4" />
                      Log Expense
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
