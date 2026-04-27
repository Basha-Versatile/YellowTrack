"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { vehicleAPI, paymentAPI } from "@/lib/api";
import Badge from "@/components/ui/badge/Badge";
import Link from "next/link";
import { useToast } from "@/context/ToastContext";
import { Skeleton } from "@/components/ui/Skeleton";
import { ChevronLeft, Banknote, RefreshCw, Clock, Check, AlertTriangle, Search, Calendar, X, ImageIcon, CheckCircle2 } from "lucide-react";
import { SearchInput } from "@/components/ui/SearchInput";
import { resolveImageUrl } from "@/components/vehicles/VehicleThumb";
import DatePicker from "@/components/ui/DatePicker";

interface Challan {
  id: string;
  amount: number;
  userCharges: number;
  status: string;
  issuedAt: string;
  source: string;
  paidAt: string | null;
  location: string | null;
  unitName: string | null;
  psLimits: string | null;
  violation: string | null;
  challanNumber: string | null;
  proofImageUrl: string | null;
  authorizedBy: string | null;
}

interface Vehicle {
  id: string;
  registrationNumber: string;
  make: string;
  model: string;
  challans: Challan[];
  pendingChallanAmount: number;
}

export default function VehicleChallansPage() {
  const { vehicleId } = useParams<{ vehicleId: string }>();
  const toast = useToast();

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filter, setFilter] = useState<"ALL" | "PENDING" | "PAID">("ALL");

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Pay modal
  const [paying, setPaying] = useState(false);
  const [payMethod, setPayMethod] = useState("UPI");
  const [showPayModal, setShowPayModal] = useState(false);

  // Challan detail
  const [detailChallan, setDetailChallan] = useState<Challan | null>(null);

  useEffect(() => { fetchVehicle(); }, [vehicleId]);

  const fetchVehicle = async () => {
    try {
      const res = await vehicleAPI.getById(vehicleId);
      setVehicle(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await vehicleAPI.syncChallans(vehicleId);
      await fetchVehicle();
      toast.success("Sync Complete", "Challans updated from external source");
    } catch {
      toast.error("Sync Failed", "Could not fetch challans from external source");
    } finally {
      setSyncing(false);
    }
  };

  // Filtered challans
  const filteredChallans = useMemo(() => {
    if (!vehicle) return [];
    let list = vehicle.challans;

    // Search by challan number or violation
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((c) =>
        (c.challanNumber && c.challanNumber.toLowerCase().includes(q)) ||
        (c.violation && c.violation.toLowerCase().includes(q))
      );
    }

    // Date range
    list = list.filter((c) => {
      if (!dateFrom && !dateTo) return true;
      const issued = new Date(c.issuedAt).getTime();
      if (dateFrom && issued < new Date(dateFrom).getTime()) return false;
      if (dateTo && issued > new Date(dateTo + "T23:59:59").getTime()) return false;
      return true;
    });

    // Status filter
    if (filter !== "ALL") {
      list = list.filter((c) => c.status === filter);
    }

    return list;
  }, [vehicle, search, dateFrom, dateTo, filter]);

  const pendingFiltered = useMemo(() => filteredChallans.filter((c) => c.status === "PENDING"), [filteredChallans]);

  const selectedAmount = useMemo(
    () => (vehicle ? vehicle.challans.filter((c) => selected.has(c.id)).reduce((s, c) => s + c.amount, 0) : 0),
    [vehicle, selected]
  );

  // Stats
  const pendingCount = vehicle ? vehicle.challans.filter((c) => c.status === "PENDING").length : 0;
  const paidCount = vehicle ? vehicle.challans.filter((c) => c.status === "PAID").length : 0;
  const pendingAmt = vehicle ? vehicle.challans.filter((c) => c.status === "PENDING").reduce((s, c) => s + c.amount, 0) : 0;
  const paidAmt = vehicle ? vehicle.challans.filter((c) => c.status === "PAID").reduce((s, c) => s + c.amount, 0) : 0;

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const toggleSelectAllPending = () => {
    const pendingIds = pendingFiltered.map((c) => c.id);
    const allSelected = pendingIds.length > 0 && pendingIds.every((id) => selected.has(id));
    if (allSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        pendingIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        pendingIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  const handlePay = async () => {
    if (selected.size === 0) return;
    setPaying(true);
    try {
      if (selected.size === 1) {
        await paymentAPI.paySingle({ challanId: [...selected][0], method: payMethod });
      } else {
        await paymentAPI.payBulk({ challanIds: [...selected], method: payMethod });
      }
      toast.success("Payment Successful", `${selected.size} challan${selected.size > 1 ? "s" : ""} paid`);
      setSelected(new Set());
      setShowPayModal(false);
      setDetailChallan(null);
      await fetchVehicle();
    } catch {
      toast.error("Payment Failed", "Could not process payment. Please try again.");
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
        <Skeleton className="h-10 rounded-xl" />
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="space-y-6">
        <Link href="/challans" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-500 transition-colors">
          <ChevronLeft className="w-4 h-4" />
          Back to challans
        </Link>
        <div className="rounded-2xl border border-gray-200/80 bg-white p-12 text-center dark:border-gray-800 dark:bg-white/[0.02]">
          <p className="text-sm font-medium text-gray-500">Vehicle not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div>
        <Link href="/challans" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-500 transition-colors mb-4">
          <ChevronLeft className="w-4 h-4" />
          Back to challans
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white font-mono tracking-wide">{vehicle.registrationNumber}</h1>
              <span className="text-sm text-gray-400">{vehicle.challans.length} challan{vehicle.challans.length !== 1 ? "s" : ""}</span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{vehicle.make} {vehicle.model}</p>
          </div>
          <div className="flex items-center gap-3">
            {selected.size > 0 && (
              <button
                onClick={() => setShowPayModal(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-brand-400 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 hover:shadow-brand-500/40 transition-all"
              >
                <Banknote className="w-4 h-4" />
                Pay {selected.size} Challan{selected.size > 1 ? "s" : ""} &mdash; &#8377;{selectedAmount.toLocaleString("en-IN")}
              </button>
            )}
            <button
              onClick={handleSync}
              disabled={syncing}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing..." : "Sync Challans"}
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-red-200/60 bg-red-50/50 p-5 dark:border-red-500/20 dark:bg-red-500/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-500/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-red-500/60 uppercase tracking-wider">Pending</p>
              <p className="text-2xl font-black text-red-600 dark:text-red-400">&#8377;{pendingAmt.toLocaleString("en-IN")}</p>
            </div>
          </div>
          <p className="text-[11px] text-red-500/50 mt-2">{pendingCount} unpaid challan{pendingCount !== 1 ? "s" : ""}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200/60 bg-emerald-50/50 p-5 dark:border-emerald-500/20 dark:bg-emerald-500/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
              <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-emerald-500/60 uppercase tracking-wider">Paid</p>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">&#8377;{paidAmt.toLocaleString("en-IN")}</p>
            </div>
          </div>
          <p className="text-[11px] text-emerald-500/50 mt-2">{paidCount} cleared</p>
        </div>
        <div className="rounded-2xl border border-gray-200/80 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.02] col-span-2 sm:col-span-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-gray-500" />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Total</p>
              <p className="text-2xl font-black text-gray-900 dark:text-white">&#8377;{(pendingAmt + paidAmt).toLocaleString("en-IN")}</p>
            </div>
          </div>
          <p className="text-[11px] text-gray-400 mt-2">{vehicle.challans.length} total challan{vehicle.challans.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search by challan number */}
        <SearchInput
          className="w-64"
          value={search}
          onChange={setSearch}
          placeholder="Search challan / violation..."
        />

        {/* Date Range Filter */}
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">From</span>
          <DatePicker value={dateFrom} onChange={setDateFrom} placeholder="From date" />
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">To</span>
          <DatePicker value={dateTo} onChange={setDateTo} placeholder="To date" minDate={dateFrom} />
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(""); setDateTo(""); }}
              className="flex items-center gap-1 h-10 px-3 rounded-xl text-xs font-medium text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
              <X className="w-3.5 h-3.5" />
              Clear
            </button>
          )}
        </div>

        {/* Status filter */}
        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800/50 rounded-xl h-10">
          {(["ALL", "PENDING", "PAID"] as const).map((s) => {
            const cnt = s === "ALL" ? vehicle.challans.length : vehicle.challans.filter((c) => c.status === s).length;
            const dot = s === "PENDING" ? "bg-red-500" : s === "PAID" ? "bg-emerald-500" : "";
            return (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${filter === s ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white" : "text-gray-500 hover:text-gray-700 dark:text-gray-400"}`}
              >
                {s !== "ALL" && <span className={`w-2 h-2 rounded-full ${dot}`} />}
                {s === "ALL" ? "All" : s === "PENDING" ? "Pending" : "Paid"}
                <span className="text-xs text-gray-400">{cnt}</span>
              </button>
            );
          })}
        </div>

      </div>

      {/* Challan Table */}
      {filteredChallans.length === 0 ? (
        <div className="rounded-2xl border border-gray-200/80 bg-white p-12 text-center dark:border-gray-800 dark:bg-white/[0.02]">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
            <Search className="w-7 h-7 text-gray-400" />
          </div>
          <p className="text-sm font-medium text-gray-500">
            {vehicle.challans.length === 0 ? "No challans found for this vehicle" : "No challans match your filters"}
          </p>
          {(search || dateFrom || dateTo || filter !== "ALL") && (
            <p className="text-xs text-gray-400 mt-1">Try adjusting the search, date range, or status filter</p>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                  <th className="px-3 py-3 text-left text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-10">Sno.</th>
                  <th className="px-3 py-3 text-left text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-8">
                    <button
                      onClick={toggleSelectAllPending}
                      className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                        pendingFiltered.length > 0 && pendingFiltered.every((c) => selected.has(c.id))
                          ? "border-brand-500 bg-brand-500"
                          : "border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800 hover:border-brand-400"
                      }`}
                      title="Select All"
                    >
                      {pendingFiltered.length > 0 && pendingFiltered.every((c) => selected.has(c.id)) && (
                        <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                      )}
                    </button>
                  </th>
                  <th className="px-3 py-3 text-left text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Unit Name</th>
                  <th className="px-3 py-3 text-left text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Echallan No</th>
                  <th className="px-3 py-3 text-left text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                  <th className="px-3 py-3 text-left text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Time</th>
                  <th className="px-3 py-3 text-left text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Place of Violation</th>
                  <th className="px-3 py-3 text-left text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">PS Limits</th>
                  <th className="px-3 py-3 text-left text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Violation</th>
                  <th className="px-3 py-3 text-right text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Fine Amount</th>
                  <th className="px-3 py-3 text-right text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">User Charges</th>
                  <th className="px-3 py-3 text-right text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Fine</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredChallans.map((c, idx) => {
                  const isPending = c.status === "PENDING";
                  const isSelected = selected.has(c.id);
                  const totalFine = c.amount + (c.userCharges ?? 0);
                  return (
                    <tr
                      key={c.id}
                      onClick={() => setDetailChallan(c)}
                      className={`transition-colors cursor-pointer ${
                        isSelected
                          ? "bg-brand-25 dark:bg-brand-500/5"
                          : isPending
                          ? "bg-white dark:bg-white/[0.02] hover:bg-gray-50 dark:hover:bg-gray-800/30"
                          : "bg-gray-50/50 dark:bg-gray-800/20 hover:bg-gray-100/50 dark:hover:bg-gray-800/40"
                      }`}
                    >
                      {/* Sno */}
                      <td className="px-3 py-3 text-xs text-gray-500 font-medium">{idx + 1}</td>

                      {/* Checkbox */}
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        {isPending ? (
                          <button
                            onClick={() => toggleSelect(c.id)}
                            className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                              isSelected
                                ? "border-brand-500 bg-brand-500"
                                : "border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800 hover:border-brand-400"
                            }`}
                          >
                            {isSelected && (
                              <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                            )}
                          </button>
                        ) : (
                          <div className="w-4 h-4 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
                            <Check className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" strokeWidth={3} />
                          </div>
                        )}
                      </td>

                      {/* Unit Name */}
                      <td className="px-3 py-3 text-xs text-gray-700 dark:text-gray-300">{c.unitName || "—"}</td>

                      {/* Echallan No */}
                      <td className="px-3 py-3 text-xs text-gray-700 dark:text-gray-300 font-mono">{c.challanNumber || "—"}</td>

                      {/* Date */}
                      <td className="px-3 py-3 text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        {new Date(c.issuedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>

                      {/* Time */}
                      <td className="px-3 py-3 text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        {new Date(c.issuedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false })}
                      </td>

                      {/* Place of Violation */}
                      <td className="px-3 py-3 text-xs text-gray-700 dark:text-gray-300 max-w-[180px]">
                        <span className="line-clamp-2">{c.location || "—"}</span>
                      </td>

                      {/* PS Limits */}
                      <td className="px-3 py-3 text-xs text-gray-700 dark:text-gray-300">{c.psLimits || "—"}</td>

                      {/* Violation */}
                      <td className="px-3 py-3 text-xs text-gray-700 dark:text-gray-300 max-w-[200px]">
                        <span className="line-clamp-2">{c.violation || "—"}</span>
                      </td>

                      {/* Fine Amount */}
                      <td className={`px-3 py-3 text-xs font-bold text-right whitespace-nowrap ${isPending ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                        {c.amount.toLocaleString("en-IN")}
                      </td>

                      {/* User Charges */}
                      <td className="px-3 py-3 text-xs text-gray-700 dark:text-gray-300 text-right whitespace-nowrap">{(c.userCharges ?? 0).toLocaleString("en-IN")}</td>

                      {/* Total Fine */}
                      <td className={`px-3 py-3 text-xs font-black text-right whitespace-nowrap ${isPending ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                        {totalFine.toLocaleString("en-IN")}
                      </td>

                    </tr>
                  );
                })}
              </tbody>

              {/* Grand Total Footer */}
              <tfoot>
                <tr className="bg-gray-50 dark:bg-gray-800/50 border-t-2 border-gray-200 dark:border-gray-700">
                  <td colSpan={9} className="px-3 py-3 text-xs font-bold text-gray-700 dark:text-gray-300 text-right">Grand Total :</td>
                  <td className="px-3 py-3 text-xs font-black text-gray-900 dark:text-white text-right whitespace-nowrap">
                    {filteredChallans.reduce((s, c) => s + c.amount, 0).toLocaleString("en-IN")}
                  </td>
                  <td className="px-3 py-3 text-xs font-bold text-gray-700 dark:text-gray-300 text-right whitespace-nowrap">
                    {filteredChallans.reduce((s, c) => s + (c.userCharges ?? 0), 0).toLocaleString("en-IN")}
                  </td>
                  <td className="px-3 py-3 text-xs font-black text-gray-900 dark:text-white text-right whitespace-nowrap">
                    {filteredChallans.reduce((s, c) => s + c.amount + (c.userCharges ?? 0), 0).toLocaleString("en-IN")}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── CHALLAN DETAIL MODAL ── */}
      {detailChallan && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDetailChallan(null)} />
          <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className={`px-6 py-5 flex-shrink-0 ${detailChallan.status === "PAID" ? "bg-gradient-to-r from-emerald-500 to-green-500" : "bg-gradient-to-r from-red-500 to-rose-500"}`}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white">Challan Details</h3>
                  <p className="text-white/70 text-sm mt-0.5">{vehicle.registrationNumber} &mdash; {detailChallan.challanNumber || "N/A"}</p>
                </div>
                <p className="text-3xl font-black text-white">&#8377;{detailChallan.amount.toLocaleString("en-IN")}</p>
              </div>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-3">
                <DetailTile label="Status">
                  <Badge color={detailChallan.status === "PAID" ? "success" : "error"} variant="light" size="sm">{detailChallan.status}</Badge>
                </DetailTile>
                <DetailTile label="Echallan No">
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 font-mono">{detailChallan.challanNumber || "N/A"}</p>
                </DetailTile>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <DetailTile label="Unit Name">
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{detailChallan.unitName || "N/A"}</p>
                </DetailTile>
                <DetailTile label="Source">
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{detailChallan.source || "N/A"}</p>
                </DetailTile>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <DetailTile label="Date">
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{new Date(detailChallan.issuedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                </DetailTile>
                <DetailTile label="Time">
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{new Date(detailChallan.issuedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}</p>
                </DetailTile>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <DetailTile label="Place of Violation">
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{detailChallan.location || "N/A"}</p>
                </DetailTile>
                <DetailTile label="PS Limits">
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{detailChallan.psLimits || "N/A"}</p>
                </DetailTile>
              </div>

              {/* Violation */}
              <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20">
                <p className="text-[10px] text-red-500/70 uppercase tracking-wider font-medium mb-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Violation
                </p>
                <p className="text-sm font-semibold text-red-700 dark:text-red-400">{detailChallan.violation || "N/A"}</p>
              </div>

              {/* Fine Breakdown */}
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Fine Details</p>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Fine Amount</span>
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">&#8377;{detailChallan.amount.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-sm text-gray-600 dark:text-gray-400">User Charges</span>
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">&#8377;{(detailChallan.userCharges ?? 0).toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-gray-800/30">
                    <span className="text-sm font-bold text-gray-800 dark:text-gray-200">Total Fine</span>
                    <span className={`text-sm font-black ${detailChallan.status === "PAID" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>&#8377;{(detailChallan.amount + (detailChallan.userCharges ?? 0)).toLocaleString("en-IN")}</span>
                  </div>
                </div>
              </div>

              {/* Proof Image */}
              {detailChallan.proofImageUrl ? (
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium mb-2 flex items-center gap-1">
                    <ImageIcon className="w-3 h-3" />
                    Proof Image
                  </p>
                  <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
                    <img src={detailChallan.proofImageUrl.startsWith("http") ? detailChallan.proofImageUrl : (resolveImageUrl(detailChallan.proofImageUrl) ?? "")} alt="Challan Proof" className="w-full h-48 object-cover" />
                  </div>
                </div>
              ) : (
                <DetailTile label="Proof Image">
                  <p className="text-sm text-gray-400">No image available</p>
                </DetailTile>
              )}

              {detailChallan.paidAt && (
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-500/10 p-3.5 flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                  <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Paid on {new Date(detailChallan.paidAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 flex-shrink-0">
              {detailChallan.status === "PENDING" ? (
                <div className="flex gap-3">
                  <button
                    onClick={() => { setSelected(new Set([detailChallan.id])); setDetailChallan(null); setShowPayModal(true); }}
                    className="flex-1 h-11 rounded-xl bg-gradient-to-r from-brand-500 to-brand-400 text-white font-semibold text-sm shadow-lg shadow-brand-500/25 hover:shadow-brand-500/40 transition-all flex items-center justify-center gap-2"
                  >
                    <Banknote className="w-4 h-4" />
                    Pay &#8377;{detailChallan.amount.toLocaleString("en-IN")}
                  </button>
                  <button onClick={() => setDetailChallan(null)}
                    className="h-11 px-6 rounded-xl border-2 border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 transition-all">Close</button>
                </div>
              ) : (
                <button onClick={() => setDetailChallan(null)}
                  className="w-full h-11 rounded-xl border-2 border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 transition-all">Close</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── PAY MODAL ── */}
      {showPayModal && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { if (!paying) setShowPayModal(false); }} />
          <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-gradient-to-r from-brand-500 to-brand-400 px-6 py-5">
              <h3 className="text-lg font-bold text-white">Confirm Payment</h3>
              <p className="text-white/70 text-sm mt-0.5">
                {selected.size} challan{selected.size > 1 ? "s" : ""} &bull; {vehicle.registrationNumber}
              </p>
            </div>

            <div className="p-6 space-y-5">
              <div className="text-center py-4 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Total Amount</p>
                <p className="text-4xl font-black text-gray-900 dark:text-white">&#8377;{selectedAmount.toLocaleString("en-IN")}</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Payment Method</label>
                <div className="grid grid-cols-4 gap-2">
                  {["UPI", "CARD", "CASH", "NETBANKING"].map((m) => (
                    <button key={m} type="button" onClick={() => setPayMethod(m)}
                      className={`py-2.5 rounded-xl text-xs font-bold transition-all border-2 ${
                        payMethod === m
                          ? "border-brand-400 bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:border-brand-500 dark:text-brand-400"
                          : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
                      }`}
                    >{m}</button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={handlePay} disabled={paying || selected.size === 0}
                  className="flex-1 h-12 rounded-xl bg-gradient-to-r from-brand-500 to-brand-400 text-white font-semibold text-sm shadow-lg shadow-brand-500/25 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {paying ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      Processing...
                    </>
                  ) : (
                    <>Pay &#8377;{selectedAmount.toLocaleString("en-IN")}</>
                  )}
                </button>
                <button onClick={() => { if (!paying) setShowPayModal(false); }} disabled={paying}
                  className="h-12 px-6 rounded-xl border-2 border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 transition-all disabled:opacity-50">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailTile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 p-3">
      <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium mb-0.5">{label}</p>
      {children}
    </div>
  );
}
