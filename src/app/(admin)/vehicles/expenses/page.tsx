"use client";
import React, { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { vehicleAPI } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ExpensesDashboardSkeleton } from "@/components/ui/Skeleton";
import {
  Plus, Download, AlertTriangle, Wrench, Box, ShieldCheck, Car, CheckCircle2,
  Flame, Settings, MoreHorizontal, BarChart3, PieChart, FileText,
  ImageIcon, Upload
} from "lucide-react";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

interface VehicleBasic { id: string; registrationNumber: string; make: string; model: string; }
interface ExpenseItem { source: string; date: string; vehicleId: string; vehicle: VehicleBasic | null; title: string; amount: number; proofUrl: string | null; category: string; }
interface ReportData {
  summary: { totalSpent: number; breakdown: Record<string, number> };
  timeline: Array<{ period: string; [key: string]: string | number }>;
  expenses: ExpenseItem[];
}

const CATEGORY_ICONS: Record<string, React.FC<{ className?: string }>> = {
  challans: AlertTriangle, services: Wrench, parts: Box, insurance: ShieldCheck,
  tolls: Car, compliance: CheckCircle2, fuel: Flame, maintenance: Settings, misc: MoreHorizontal,
};

const CATEGORY_COLORS: Record<string, { bg: string; text: string; dot: string; gradient: string }> = {
  challans: { bg: "bg-red-500/10", text: "text-red-400", dot: "#ef4444", gradient: "from-red-500 to-rose-600" },
  services: { bg: "bg-blue-500/10", text: "text-blue-400", dot: "#3b82f6", gradient: "from-blue-500 to-blue-600" },
  parts: { bg: "bg-indigo-500/10", text: "text-indigo-400", dot: "#6366f1", gradient: "from-indigo-500 to-indigo-600" },
  insurance: { bg: "bg-purple-500/10", text: "text-purple-400", dot: "#8b5cf6", gradient: "from-purple-500 to-purple-600" },
  tolls: { bg: "bg-amber-500/10", text: "text-amber-400", dot: "#f59e0b", gradient: "from-amber-500 to-amber-600" },
  compliance: { bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "#10b981", gradient: "from-emerald-500 to-emerald-600" },
  fuel: { bg: "bg-orange-500/10", text: "text-orange-400", dot: "#f97316", gradient: "from-orange-500 to-orange-600" },
  maintenance: { bg: "bg-cyan-500/10", text: "text-cyan-400", dot: "#06b6d4", gradient: "from-cyan-500 to-cyan-600" },
  misc: { bg: "bg-gray-500/10", text: "text-gray-400", dot: "#6b7280", gradient: "from-gray-500 to-gray-600" },
};

const CATEGORY_LABELS: Record<string, string> = {
  challans: "Challans", services: "Services", parts: "Parts", insurance: "Insurance",
  tolls: "FASTag / Tolls", compliance: "Compliance", fuel: "Fuel", maintenance: "Maintenance", misc: "Miscellaneous",
};

const CATEGORY_COLORS_HEX: Record<string, string> = {
  challans: "#ef4444", services: "#3b82f6", parts: "#6366f1", insurance: "#8b5cf6",
  tolls: "#f59e0b", compliance: "#10b981", fuel: "#f97316", maintenance: "#06b6d4", misc: "#6b7280",
};

const API_URL = process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") || "http://localhost:5001";

export default function VehicleExpensesPage() {
  return (
    <Suspense fallback={<ExpensesDashboardSkeleton />}>
      <VehicleExpensesContent />
    </Suspense>
  );
}

function VehicleExpensesContent() {
  const toast = useToast();
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
  const [expForm, setExpForm] = useState({ category: "COMPLIANCE", title: "", amount: "", expenseDate: new Date().toISOString().split("T")[0], description: "" });
  const [expProof, setExpProof] = useState<File | null>(null);
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

  const handleLogExpense = async () => {
    if (!expVehicleId || !expForm.title || !expForm.amount || !expForm.expenseDate) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("category", expForm.category); fd.append("title", expForm.title); fd.append("amount", expForm.amount); fd.append("expenseDate", expForm.expenseDate);
      if (expForm.description) fd.append("description", expForm.description);
      if (expProof) fd.append("proof", expProof);
      await vehicleAPI.createExpense(expVehicleId, fd);
      toast.success("Expense Logged", "Expense recorded successfully");
      setShowModal(false); setExpForm({ category: "COMPLIANCE", title: "", amount: "", expenseDate: new Date().toISOString().split("T")[0], description: "" }); setExpProof(null);
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
    const headers = ["Date", "Vehicle", "Category", "Source", "Title", "Amount"];
    const rows = filtered.map((e) => [new Date(e.date).toLocaleDateString("en-IN"), e.vehicle?.registrationNumber || "", CATEGORY_LABELS[e.category] || e.category, e.source, e.title, e.amount.toString()]);
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

    const catSectionsHTML = Object.entries(grouped).map(([cat, items]) => {
      const color = CATEGORY_COLORS_HEX[cat] || "#6b7280";
      const label = CATEGORY_LABELS[cat] || cat;
      const catTotal = items.reduce((s, e) => s + e.amount, 0);
      return `<div style="margin-bottom:24px"><div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-left:4px solid ${color};background:${color}10;border-radius:0 10px 10px 0;margin-bottom:8px"><div><span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:6px;background:${color}18;color:${color}">${label}</span><span style="font-size:10px;color:#9ca3af;margin-left:8px">${items.length} txn${items.length > 1 ? "s" : ""}</span></div><div style="font-size:18px;font-weight:800;color:${color}">\u20B9${catTotal.toLocaleString("en-IN")}</div></div><table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr><th style="text-align:left;padding:8px 12px;font-size:9px;text-transform:uppercase;letter-spacing:0.06em;color:#9ca3af;border-bottom:2px solid #e5e7eb">Date</th><th style="text-align:left;padding:8px 12px;font-size:9px;text-transform:uppercase;letter-spacing:0.06em;color:#9ca3af;border-bottom:2px solid #e5e7eb">Vehicle</th><th style="text-align:left;padding:8px 12px;font-size:9px;text-transform:uppercase;letter-spacing:0.06em;color:#9ca3af;border-bottom:2px solid #e5e7eb">Description</th><th style="text-align:right;padding:8px 12px;font-size:9px;text-transform:uppercase;letter-spacing:0.06em;color:#9ca3af;border-bottom:2px solid #e5e7eb">Amount</th></tr></thead><tbody>${items.map((e) => `<tr><td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;color:#374151">${new Date(e.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</td><td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-weight:600;color:#1f2937;font-family:monospace;font-size:11px">${e.vehicle?.registrationNumber || "\u2014"}</td><td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;color:#374151">${e.title}</td><td style="text-align:right;padding:8px 12px;border-bottom:1px solid #f3f4f6;font-weight:700;color:#1f2937">\u20B9${e.amount.toLocaleString("en-IN")}</td></tr>`).join("")}</tbody></table></div>`;
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
      vehicleSpendMap.get(key)!.total += exp.amount;
    }
    const topVehicles = [...vehicleSpendMap.values()].sort((a, b) => b.total - a.total).slice(0, 5);

    const sectionTitle = (text: string) => `<div style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#1f2937;margin-bottom:14px;padding:10px 16px;background:linear-gradient(90deg,#fffbeb,#fff);border-left:3px solid #f59e0b;border-radius:0 8px 8px 0">${text}</div>`;

    container.innerHTML = `
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-35deg);font-size:100px;font-weight:900;color:rgba(156,163,175,0.06);letter-spacing:8px;white-space:nowrap;pointer-events:none;text-transform:uppercase">YELLOW TRACK</div>
      <div style="position:relative;z-index:1">
        <!-- Header -->
        <div style="display:flex;align-items:center;justify-content:space-between;padding:0 0 24px 0;border-bottom:3px solid #f59e0b;margin-bottom:24px">
          <div style="display:flex;align-items:center;gap:12px">
            <img src="/images/logo/yellow-track-logo.png" style="width:40px;height:40px;border-radius:10px" />
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
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px"><img src="/images/logo/yellow-track-logo.png" style="width:28px;height:28px;border-radius:8px" /><span style="font-size:15px;font-weight:800"><span style="color:#f59e0b">Yellow</span> <span style="color:#1f2937">Track</span></span></div>
            <div style="font-size:11px;color:#9ca3af;line-height:1.7">Fleet Management System<br>Confidential \u2014 Auto-generated report<br>${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</div>
          </div>
          <!-- Right: Approved stamp image + text -->
          <div style="flex-shrink:0;text-align:center">
            <img src="/images/approved-stamp.png" style="width:160px;height:160px" />
            <div style="margin-top:6px;font-size:9px;font-weight:800;letter-spacing:1px;color:#166534;text-transform:uppercase">Verified &amp; Approved by</div>
            <div style="display:flex;align-items:center;justify-content:center;gap:5px;margin-top:3px"><img src="/images/logo/yellow-track-logo.png" style="width:18px;height:18px;border-radius:4px;vertical-align:middle;position:relative;top:1px" /><span style="font-size:12px;font-weight:900;letter-spacing:0.5px"><span style="color:#f59e0b">Yellow</span> <span style="color:#1f2937">Track</span></span></div>
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

  const barCategories = report?.timeline?.map((t) => new Date(t.period + "-01").toLocaleDateString("en-IN", { month: "short", year: "2-digit" })) || [];
  const barSeries = activeCategories.map(([key]) => ({
    name: CATEGORY_LABELS[key] || key,
    data: report?.timeline?.map((t) => (typeof t[key] === "number" ? t[key] : 0) as number) || [],
    color: CATEGORY_COLORS[key]?.dot || "#6b7280",
  }));
  const donutSeries = activeCategories.map(([, v]) => v);
  const donutLabels = activeCategories.map(([k]) => CATEGORY_LABELS[k] || k);
  const donutColors = activeCategories.map(([k]) => CATEGORY_COLORS[k]?.dot || "#6b7280");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Expenses Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Track all vehicle-related spending with detailed analytics</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setExpVehicleId(vehicleId || ""); setShowModal(true); }}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-yellow-500 to-yellow-400 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-yellow-500/25 hover:shadow-yellow-500/40 transition-all">
            <Plus className="w-4 h-4" />
            Log Expense
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

      {/* Filters — glassy */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/20 bg-white/60 dark:bg-gray-800/40 backdrop-blur-xl p-4 shadow-lg shadow-gray-200/30 dark:shadow-none dark:border-gray-700/50">
        <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}
          className="h-9 rounded-lg border border-gray-200/80 bg-white/80 dark:bg-gray-800/80 backdrop-blur px-3 text-xs text-gray-900 focus:border-yellow-400 focus:outline-none dark:border-gray-700 dark:text-white min-w-[180px]">
          <option value="">All Vehicles</option>
          {vehicles.map((v) => <option key={v.id} value={v.id}>{v.registrationNumber} — {v.make} {v.model}</option>)}
        </select>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
          className="h-9 rounded-lg border border-gray-200/80 bg-white/80 dark:bg-gray-800/80 backdrop-blur px-3 text-xs text-gray-900 focus:border-yellow-400 focus:outline-none dark:border-gray-700 dark:text-white min-w-[150px]">
          <option value="">All Categories</option>
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <div className="flex gap-1 p-0.5 bg-gray-100/80 dark:bg-gray-800/80 backdrop-blur rounded-lg">
          {[{ key: "this_month", label: "This Month" }, { key: "last_month", label: "Last Month" }, { key: "this_quarter", label: "Quarter" }, { key: "this_year", label: "Year" }, { key: "custom", label: "Custom" }].map((p) => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              className={`px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all ${period === p.key ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm" : "text-gray-500 hover:text-gray-700 dark:text-gray-400"}`}>
              {p.label}
            </button>
          ))}
        </div>
        {period === "custom" && (
          <div className="flex items-center gap-2">
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="h-9 rounded-lg border border-gray-200/80 bg-white/80 backdrop-blur px-3 text-xs text-gray-900 focus:border-yellow-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800/80 dark:text-white" />
            <span className="text-xs text-gray-400">to</span>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="h-9 rounded-lg border border-gray-200/80 bg-white/80 backdrop-blur px-3 text-xs text-gray-900 focus:border-yellow-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800/80 dark:text-white" />
          </div>
        )}
      </div>

      {loading ? (
        <ExpensesDashboardSkeleton />
      ) : report && (
        <>
          {/* 3D Glassy Summary Cards — horizontal scroll */}
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
            <style>{`.scrollbar-hide::-webkit-scrollbar { display: none; }`}</style>
            {/* Total card — 3D dark glass */}
            <div className="relative rounded-2xl overflow-hidden group flex-shrink-0 min-w-[200px]" style={{ perspective: "1000px" }}>
              <div className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-gray-950 p-6 rounded-2xl border border-white/10 shadow-2xl shadow-gray-900/50 transform transition-transform duration-300 group-hover:rotate-y-2 group-hover:scale-[1.02] h-full">
                <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 via-transparent to-transparent rounded-2xl" />
                <div className="absolute top-3 right-3 w-16 h-16 rounded-full bg-yellow-500/10 blur-xl" />
                <div className="relative z-10">
                  <p className="text-[10px] uppercase tracking-widest text-yellow-400/80 font-bold">Total Expenses</p>
                  <p className="text-3xl font-black text-white mt-2 tracking-tight">&#8377;{report.summary.totalSpent.toLocaleString("en-IN")}</p>
                  <p className="text-[10px] text-gray-400 mt-2">{report.expenses.length} transactions</p>
                </div>
              </div>
            </div>

            {/* All category cards — glassy */}
            {activeCategories.map(([key, val]) => {
              const c = CATEGORY_COLORS[key] || CATEGORY_COLORS.misc;
              const pct = report.summary.totalSpent > 0 ? Math.round((val / report.summary.totalSpent) * 100) : 0;
              return (
                <div key={key} className="relative rounded-2xl overflow-hidden group flex-shrink-0 min-w-[180px]" style={{ perspective: "800px" }}>
                  <div className="relative bg-white/70 dark:bg-gray-800/50 backdrop-blur-xl p-5 rounded-2xl border border-white/30 dark:border-gray-700/50 shadow-xl shadow-gray-200/20 dark:shadow-none transform transition-all duration-300 group-hover:scale-[1.03] group-hover:-translate-y-1 h-full">
                    <div className={`absolute inset-0 bg-gradient-to-br ${c.gradient} opacity-[0.04] rounded-2xl`} />
                    <div className="relative z-10">
                      <div className="flex items-center gap-2 mb-3">
                        <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${c.gradient} flex items-center justify-center shadow-lg`} style={{ boxShadow: `0 4px 14px ${c.dot}30` }}>
                          {(() => { const Icon = CATEGORY_ICONS[key] || MoreHorizontal; return <Icon className="w-4 h-4 text-white" />; })()}
                        </div>
                        <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">{CATEGORY_LABELS[key]}</p>
                      </div>
                      <p className="text-xl font-black text-gray-900 dark:text-white">&#8377;{val.toLocaleString("en-IN")}</p>
                      {/* Glass progress bar */}
                      <div className="mt-3 h-1.5 bg-gray-200/50 dark:bg-gray-700/50 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full bg-gradient-to-r ${c.gradient}`} style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1.5">{pct}% of total</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Charts — 3D Glassy */}
          {report.timeline.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Bar Chart — 3D Glass Card */}
              <div className="lg:col-span-2 relative group" style={{ perspective: "1200px" }}>
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-pink-500/5 rounded-3xl blur-xl opacity-60 group-hover:opacity-100 transition-opacity" />
                <div className="relative rounded-3xl bg-white/60 dark:bg-gray-800/30 backdrop-blur-2xl border border-white/40 dark:border-gray-600/30 p-7 shadow-[0_8px_32px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] transform transition-transform duration-500 group-hover:rotate-x-1 group-hover:-translate-y-1">
                  {/* Shine effect */}
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent" />
                  <div className="absolute top-0 left-0 bottom-0 w-px bg-gradient-to-b from-white/40 via-white/10 to-transparent" />
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-5 flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                      <BarChart3 className="w-3.5 h-3.5 text-white" />
                    </span>
                    Monthly Expense Trend
                  </h3>
                  <ReactApexChart type="bar" height={300} options={{
                    chart: { stacked: true, toolbar: { show: false }, fontFamily: "inherit", background: "transparent" },
                    xaxis: { categories: barCategories, labels: { style: { fontSize: "10px" } } },
                    yaxis: { labels: { formatter: (v: number) => `\u20B9${(v / 1000).toFixed(0)}K`, style: { fontSize: "10px" } } },
                    plotOptions: { bar: { borderRadius: 8, columnWidth: "50%" } },
                    legend: { position: "top", fontSize: "11px", fontWeight: 600 },
                    tooltip: { y: { formatter: (v: number) => `\u20B9${v.toLocaleString("en-IN")}` }, theme: "light" },
                    grid: { borderColor: "#e5e7eb30", strokeDashArray: 4 },
                    dataLabels: { enabled: false },
                  }} series={barSeries} />
                </div>
              </div>

              {/* Donut Chart — 3D Glass Card */}
              <div className="relative group" style={{ perspective: "1200px" }}>
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-orange-500/5 to-red-500/5 rounded-3xl blur-xl opacity-60 group-hover:opacity-100 transition-opacity" />
                <div className="relative rounded-3xl bg-white/60 dark:bg-gray-800/30 backdrop-blur-2xl border border-white/40 dark:border-gray-600/30 p-7 shadow-[0_8px_32px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] transform transition-transform duration-500 group-hover:-rotate-x-1 group-hover:-translate-y-1">
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent" />
                  <div className="absolute top-0 right-0 bottom-0 w-px bg-gradient-to-b from-white/40 via-white/10 to-transparent" />
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-5 flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
                      <PieChart className="w-3.5 h-3.5 text-white" />
                    </span>
                    Category Split
                  </h3>
                {donutSeries.length > 0 ? (
                  <ReactApexChart type="donut" height={280} options={{
                    labels: donutLabels, colors: donutColors,
                    legend: { position: "bottom", fontSize: "11px", fontWeight: 600 },
                    plotOptions: { pie: { donut: { size: "68%", labels: { show: true, total: { show: true, label: "Total", fontSize: "11px", fontWeight: "700", formatter: () => `\u20B9${(report.summary.totalSpent / 1000).toFixed(0)}K` } } } } },
                    tooltip: { y: { formatter: (v: number) => `\u20B9${v.toLocaleString("en-IN")}` } },
                    dataLabels: { enabled: false },
                    stroke: { width: 3, colors: ["#fff"] },
                  }} series={donutSeries} />
                ) : <p className="text-sm text-gray-400 text-center py-10">No data</p>}
                </div>
              </div>
            </div>
          )}

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
                      <th className="text-center px-5 py-3.5 font-bold text-gray-500 uppercase tracking-wider text-[10px]">Proof</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100/50 dark:divide-gray-800/50">
                    {getFilteredExpenses().map((exp, i) => {
                      const c = CATEGORY_COLORS[exp.category] || CATEGORY_COLORS.misc;
                      return (
                        <tr key={i} className="hover:bg-white/50 dark:hover:bg-gray-800/30 transition-colors">
                          <td className="px-5 py-3.5 text-gray-600 dark:text-gray-400 whitespace-nowrap">{new Date(exp.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</td>
                          <td className="px-5 py-3.5 font-semibold text-gray-900 dark:text-white whitespace-nowrap font-mono text-[11px]">{exp.vehicle?.registrationNumber || "—"}</td>
                          <td className="px-5 py-3.5">
                            <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-lg ${c.bg} ${c.text}`}>
                              {(() => { const Icon = CATEGORY_ICONS[exp.category] || MoreHorizontal; return <Icon className="w-3 h-3" />; })()}
                              {CATEGORY_LABELS[exp.category] || exp.category}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-gray-700 dark:text-gray-300 max-w-[200px] truncate">{exp.title}</td>
                          <td className="px-5 py-3.5 text-right font-black text-gray-900 dark:text-white whitespace-nowrap">&#8377;{exp.amount.toLocaleString("en-IN")}</td>
                          <td className="px-5 py-3.5 text-center">
                            {exp.proofUrl ? (
                              <a href={`${API_URL}${exp.proofUrl}`} target="_blank" rel="noreferrer" className="w-7 h-7 rounded-lg bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center text-brand-500 hover:text-brand-600 mx-auto transition-colors">
                                <ImageIcon className="w-3.5 h-3.5" />
                              </a>
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

      {/* Log Expense Modal — Compact */}
      {showModal && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-white/90 dark:bg-gray-900/90 backdrop-blur-2xl rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-white/20 dark:border-gray-700/50">
            <div className="bg-gradient-to-r from-yellow-500 to-amber-500 px-5 py-4">
              <h3 className="text-base font-bold text-white">Log Expense</h3>
            </div>
            <div className="p-5 space-y-3">
              {/* Row 1: Vehicle + Category */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Vehicle *</label>
                  <select value={expVehicleId} onChange={(e) => setExpVehicleId(e.target.value)} className="w-full h-9 rounded-lg border border-gray-200 bg-white px-2.5 text-xs text-gray-900 focus:border-yellow-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white">
                    <option value="">Select vehicle</option>
                    {vehicles.map((v) => <option key={v.id} value={v.id}>{v.registrationNumber} — {v.make} {v.model}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Category *</label>
                  <select value={expForm.category} onChange={(e) => setExpForm({ ...expForm, category: e.target.value })} className="w-full h-9 rounded-lg border border-gray-200 bg-white px-2.5 text-xs text-gray-900 focus:border-yellow-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white">
                    <option value="COMPLIANCE">Compliance</option><option value="FUEL">Fuel</option><option value="TYRE">Tyre</option><option value="MAINTENANCE">Maintenance</option><option value="PARKING">Parking</option><option value="TOLL">Toll</option><option value="MISC">Miscellaneous</option>
                  </select>
                </div>
              </div>
              {/* Row 2: Title + Amount */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="col-span-2">
                  <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Title *</label>
                  <input type="text" placeholder="e.g. RC Renewal, Diesel Fill" value={expForm.title} onChange={(e) => setExpForm({ ...expForm, title: e.target.value })} className="w-full h-9 rounded-lg border border-gray-200 bg-white px-2.5 text-xs text-gray-900 placeholder:text-gray-400 focus:border-yellow-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                </div>
                <div>
                  <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Amount (&#8377;) *</label>
                  <input type="number" placeholder="0" value={expForm.amount} onChange={(e) => setExpForm({ ...expForm, amount: e.target.value })} className="w-full h-9 rounded-lg border border-gray-200 bg-white px-2.5 text-xs text-gray-900 placeholder:text-gray-400 focus:border-yellow-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                </div>
              </div>
              {/* Row 3: Date + Proof */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Date *</label>
                  <input type="date" value={expForm.expenseDate} onChange={(e) => setExpForm({ ...expForm, expenseDate: e.target.value })} className="w-full h-9 rounded-lg border border-gray-200 bg-white px-2.5 text-xs text-gray-900 focus:border-yellow-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                </div>
                <div>
                  <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Proof</label>
                  {expProof ? (
                    <div className="flex items-center gap-1.5 h-9 text-[10px]">
                      <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-yellow-50 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 font-medium truncate max-w-[140px]">{expProof.name}</span>
                      <button type="button" onClick={() => setExpProof(null)} className="text-red-500 text-[9px] font-semibold">X</button>
                    </div>
                  ) : (
                    <label className="flex items-center gap-1.5 h-9 px-2.5 rounded-lg border border-dashed border-gray-200 dark:border-gray-700 hover:border-yellow-400 cursor-pointer transition-colors group">
                      <Upload className="w-3.5 h-3.5 text-gray-300 group-hover:text-yellow-500" />
                      <span className="text-[10px] text-gray-400 group-hover:text-yellow-600">Upload receipt</span>
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => { setExpProof(e.target.files?.[0] || null); e.target.value = ""; }} />
                    </label>
                  )}
                </div>
              </div>
              {/* Row 4: Notes */}
              <div>
                <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Notes</label>
                <input type="text" placeholder="Optional notes..." value={expForm.description} onChange={(e) => setExpForm({ ...expForm, description: e.target.value })} className="w-full h-9 rounded-lg border border-gray-200 bg-white px-2.5 text-xs text-gray-900 placeholder:text-gray-400 focus:border-yellow-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
              </div>
              {/* Actions */}
              <div className="flex gap-2.5 pt-1">
                <button onClick={handleLogExpense} disabled={saving || !expVehicleId || !expForm.title || !expForm.amount || !expForm.expenseDate}
                  className="flex-1 h-10 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 text-white font-semibold text-sm shadow-lg shadow-yellow-500/25 transition-all disabled:opacity-50 flex items-center justify-center">
                  {saving ? "Saving..." : "Log Expense"}
                </button>
                <button onClick={() => setShowModal(false)} className="h-10 px-5 rounded-xl border-2 border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 transition-all">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
