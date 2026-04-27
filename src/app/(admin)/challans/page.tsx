"use client";
import React, { useEffect, useMemo, useState } from "react";
import { vehicleAPI, paymentAPI } from "@/lib/api";
import Link from "next/link";
import { ChallansSkeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/context/ToastContext";
import Pagination, { useClientPagination } from "@/components/ui/Pagination";
import DatePicker from "@/components/ui/DatePicker";
import { AlertTriangle, Clock, Check, Banknote, Calendar, X, ChevronRight, RefreshCw, List, LayoutGrid } from "lucide-react";
import { VehicleThumb, resolveImageUrl } from "@/components/vehicles/VehicleThumb";
import { SearchInput } from "@/components/ui/SearchInput";

interface Challan {
  id: string;
  amount: number;
  status: string;
  issuedAt: string;
}

interface Vehicle {
  id: string;
  registrationNumber: string;
  make: string;
  model: string;
  profileImage: string | null;
  group?: { id: string; name: string; icon: string; color?: string } | null;
  challans: Challan[];
  pendingChallanAmount: number;
}

export default function ChallansPage() {
  const toast = useToast();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PENDING" | "PAID">("ALL");
  const [view, setView] = useState<"list" | "grid">("list");
  const [hoverPhoto, setHoverPhoto] = useState<{ url: string; x: number; y: number } | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);

  // Pay all pending for a vehicle
  const [payVehicle, setPayVehicle] = useState<Vehicle | null>(null);
  const [paying, setPaying] = useState(false);
  const [payMethod, setPayMethod] = useState("UPI");

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const res = await vehicleAPI.getAll({ limit: 100 });
      setVehicles(res.data.data.vehicles);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async (vehicleId: string) => {
    setSyncing(vehicleId);
    try {
      await vehicleAPI.syncChallans(vehicleId);
      await fetchData();
      toast.success("Sync Complete", "Challans updated from external source");
    } catch {
      toast.error("Sync Failed", "Could not fetch challans from external source");
    } finally {
      setSyncing(null);
    }
  };

  const handlePayAllPending = async () => {
    if (!payVehicle) return;
    const pendingIds = payVehicle.challans.filter((c) => c.status === "PENDING").map((c) => c.id);
    if (pendingIds.length === 0) return;
    setPaying(true);
    try {
      if (pendingIds.length === 1) {
        await paymentAPI.paySingle({ challanId: pendingIds[0], method: payMethod });
      } else {
        await paymentAPI.payBulk({ challanIds: pendingIds, method: payMethod });
      }
      toast.success("Payment Successful", `${pendingIds.length} challan${pendingIds.length > 1 ? "s" : ""} paid`);
      setPayVehicle(null);
      await fetchData();
    } catch {
      toast.error("Payment Failed", "Could not process payment. Please try again.");
    } finally {
      setPaying(false);
    }
  };

  // Filter vehicles by search, date range, and status (all combinations)
  const filteredVehicles = useMemo(() => {
    return vehicles.filter((v) => {
      // Must have challans
      if (v.challans.length === 0) return false;

      // Search by registration number
      if (search && !v.registrationNumber.toLowerCase().includes(search.toLowerCase())) return false;

      // Filter challans by date range
      let matchingChallans = v.challans;
      if (dateFrom || dateTo) {
        matchingChallans = matchingChallans.filter((c) => {
          const issued = new Date(c.issuedAt).getTime();
          if (dateFrom && issued < new Date(dateFrom).getTime()) return false;
          if (dateTo && issued > new Date(dateTo + "T23:59:59").getTime()) return false;
          return true;
        });
        if (matchingChallans.length === 0) return false;
      }

      // Filter by status
      if (statusFilter !== "ALL") {
        const hasMatchingStatus = matchingChallans.some((c) => c.status === statusFilter);
        if (!hasMatchingStatus) return false;
      }

      return true;
    });
  }, [vehicles, search, dateFrom, dateTo, statusFilter]);

  const { page, setPage, perPage, setPerPage, totalPages, totalItems, paginatedItems: paginatedVehicles } =
    useClientPagination(filteredVehicles, 10);

  // Global stats
  const allChallans = useMemo(() => vehicles.flatMap((v) => v.challans), [vehicles]);
  const totalPending = useMemo(() => allChallans.filter((c) => c.status === "PENDING").reduce((s, c) => s + c.amount, 0), [allChallans]);
  const totalPaid = useMemo(() => allChallans.filter((c) => c.status === "PAID").reduce((s, c) => s + c.amount, 0), [allChallans]);
  const pendingCount = useMemo(() => allChallans.filter((c) => c.status === "PENDING").length, [allChallans]);
  const paidCount = useMemo(() => allChallans.filter((c) => c.status === "PAID").length, [allChallans]);

  // Pay modal amount
  const payVehiclePendingAmt = payVehicle
    ? payVehicle.challans.filter((c) => c.status === "PENDING").reduce((s, c) => s + c.amount, 0)
    : 0;
  const payVehiclePendingCount = payVehicle
    ? payVehicle.challans.filter((c) => c.status === "PENDING").length
    : 0;

  if (loading) {
    return <ChallansSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Challans</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Traffic fines &amp; payment management &mdash; grouped by vehicle</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-gray-200/80 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-gray-500" />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Total</p>
              <p className="text-2xl font-black text-gray-900 dark:text-white">{allChallans.length}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-red-200/60 bg-red-50/50 p-5 dark:border-red-500/20 dark:bg-red-500/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-500/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-red-500/60 uppercase tracking-wider">Pending</p>
              <p className="text-2xl font-black text-red-600 dark:text-red-400">&#8377;{totalPending.toLocaleString("en-IN")}</p>
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
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">&#8377;{totalPaid.toLocaleString("en-IN")}</p>
            </div>
          </div>
          <p className="text-[11px] text-emerald-500/50 mt-2">{paidCount} cleared</p>
        </div>
        <div className="rounded-2xl border border-brand-200/60 bg-brand-25 p-5 dark:border-brand-500/20 dark:bg-brand-500/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-100 dark:bg-brand-500/20 flex items-center justify-center">
              <Banknote className="w-5 h-5 text-brand-600 dark:text-brand-400" />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-brand-500/60 uppercase tracking-wider">Grand Total</p>
              <p className="text-2xl font-black text-brand-600 dark:text-brand-400">&#8377;{(totalPending + totalPaid).toLocaleString("en-IN")}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search + Date Range + Status Filter + View Toggle — single row */}
      <div className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-hide" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
        <SearchInput
          className="w-52 flex-shrink-0"
          value={search}
          onChange={setSearch}
          placeholder="Search registration no..."
        />
        <div className="flex items-center gap-2 flex-shrink-0">
          <Calendar className="w-4 h-4 text-gray-400" />
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
        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800/50 rounded-xl h-10 flex-shrink-0">
          {(["ALL", "PENDING", "PAID"] as const).map((s) => {
            const dot = s === "PENDING" ? "bg-red-500" : s === "PAID" ? "bg-emerald-500" : "";
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${statusFilter === s ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white" : "text-gray-500 hover:text-gray-700 dark:text-gray-400"}`}
              >
                {s !== "ALL" && <span className={`w-2 h-2 rounded-full ${dot}`} />}
                {s === "ALL" ? "All" : s === "PENDING" ? "Unpaid" : "Paid"}
              </button>
            );
          })}
        </div>
        <div className="flex gap-0.5 p-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg h-10 flex-shrink-0 ml-auto">
          <button onClick={() => setView("list")} className={`px-2.5 rounded-md transition-all ${view === "list" ? "bg-white shadow-sm dark:bg-gray-700" : ""}`}>
            <List className={`w-4 h-4 ${view === "list" ? "text-gray-900 dark:text-white" : "text-gray-400"}`} />
          </button>
          <button onClick={() => setView("grid")} className={`px-2.5 rounded-md transition-all ${view === "grid" ? "bg-white shadow-sm dark:bg-gray-700" : ""}`}>
            <LayoutGrid className={`w-4 h-4 ${view === "grid" ? "text-gray-900 dark:text-white" : "text-gray-400"}`} />
          </button>
        </div>
      </div>

      {/* Vehicle List */}
      {totalItems === 0 ? (
        <div className="rounded-2xl border border-gray-200/80 bg-white p-12 text-center dark:border-gray-800 dark:bg-white/[0.02]">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
            <Check className="w-7 h-7 text-gray-400" />
          </div>
          <p className="text-sm font-medium text-gray-500">
            {search || dateFrom || dateTo || statusFilter !== "ALL"
              ? "No vehicles match your filters"
              : "No challans found for any vehicle"}
          </p>
          {(search || dateFrom || dateTo || statusFilter !== "ALL") && (
            <p className="text-xs text-gray-400 mt-1">Try adjusting the search, date range, or status filter</p>
          )}
        </div>
      ) : view === "list" ? (
        /* List View */
        <div className="rounded-2xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02] overflow-hidden divide-y divide-gray-100 dark:divide-gray-800">
          {paginatedVehicles.map((v) => {
            const pending = v.challans.filter((c) => c.status === "PENDING");
            const paid = v.challans.filter((c) => c.status === "PAID");
            const pendingAmt = pending.reduce((s, c) => s + c.amount, 0);
            const paidAmt = paid.reduce((s, c) => s + c.amount, 0);
            return (
              <div key={v.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                <div
                  onMouseEnter={(e) => {
                    const url = resolveImageUrl(v.profileImage);
                    if (url) {
                      const r = e.currentTarget.getBoundingClientRect();
                      setHoverPhoto({ url, x: r.right + 12, y: r.top + r.height / 2 });
                    }
                  }}
                  onMouseLeave={() => setHoverPhoto(null)}
                >
                  <VehicleThumb profileImage={v.profileImage} group={v.group} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Link href={`/vehicles/${v.id}`} className="text-sm font-bold text-gray-900 dark:text-white hover:text-brand-500 font-mono tracking-wide">{v.registrationNumber}</Link>
                    <span className="text-[10px] text-gray-400">{v.challans.length} challan{v.challans.length !== 1 ? "s" : ""}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{v.make} {v.model}</p>
                </div>
                <div className="flex-shrink-0 text-right">
                  {pendingAmt > 0 && <p className="text-base font-black text-red-600 dark:text-red-400">&#8377;{pendingAmt.toLocaleString("en-IN")} <span className="text-[9px] font-medium text-red-400">({pending.length})</span></p>}
                  {paidAmt > 0 && <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">&#8377;{paidAmt.toLocaleString("en-IN")} <span className="text-[9px] text-emerald-400">paid</span></p>}
                </div>
                <div className="flex-shrink-0 flex items-center gap-1.5">
                  <button onClick={() => handleSync(v.id)} disabled={syncing === v.id} className="rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 p-2 text-gray-500 transition-colors disabled:opacity-50" title="Sync">
                    <RefreshCw className={`w-3.5 h-3.5 ${syncing === v.id ? "animate-spin" : ""}`} />
                  </button>
                  {pending.length > 0 && <button onClick={() => setPayVehicle(v)} className="rounded-lg bg-gradient-to-r from-brand-500 to-brand-400 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm">Pay</button>}
                  <Link href={`/challans/${v.id}`} className="rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 p-2 text-gray-500 transition-colors"><ChevronRight className="w-3.5 h-3.5" /></Link>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Grid View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedVehicles.map((v) => {
            const pending = v.challans.filter((c) => c.status === "PENDING");
            const paid = v.challans.filter((c) => c.status === "PAID");
            const pendingAmt = pending.reduce((s, c) => s + c.amount, 0);
            const paidAmt = paid.reduce((s, c) => s + c.amount, 0);
            return (
              <div key={v.id} className="rounded-2xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02] p-5 hover:shadow-lg transition-all">
                <div className="flex items-center gap-3 mb-3">
                  <VehicleThumb profileImage={v.profileImage} group={v.group} />
                  <div className="min-w-0">
                    <Link href={`/vehicles/${v.id}`} className="text-sm font-bold text-gray-900 dark:text-white hover:text-brand-500 font-mono tracking-wide">{v.registrationNumber}</Link>
                    <p className="text-xs text-gray-500">{v.make} {v.model}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between mb-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                  <span className="text-[10px] text-gray-400">{v.challans.length} challan{v.challans.length !== 1 ? "s" : ""}</span>
                  <div className="text-right">
                    {pendingAmt > 0 && <p className="text-base font-black text-red-600 dark:text-red-400">&#8377;{pendingAmt.toLocaleString("en-IN")}</p>}
                    {paidAmt > 0 && <p className="text-[11px] font-bold text-emerald-600">&#8377;{paidAmt.toLocaleString("en-IN")} paid</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {pending.length > 0 && <button onClick={() => setPayVehicle(v)} className="flex-1 rounded-lg bg-gradient-to-r from-brand-500 to-brand-400 py-2 text-xs font-semibold text-white text-center shadow-sm">Pay &#8377;{pendingAmt.toLocaleString("en-IN")}</button>}
                  <button onClick={() => handleSync(v.id)} disabled={syncing === v.id} className="rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 p-2 text-gray-500 disabled:opacity-50"><RefreshCw className={`w-3.5 h-3.5 ${syncing === v.id ? "animate-spin" : ""}`} /></button>
                  <Link href={`/challans/${v.id}`} className="rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 p-2 text-gray-500"><ChevronRight className="w-3.5 h-3.5" /></Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        totalItems={totalItems}
        itemsPerPage={perPage}
        onPageChange={setPage}
        onItemsPerPageChange={setPerPage}
        itemLabel="vehicles"
      />

      {/* ── PAY ALL PENDING MODAL ── */}
      {/* Hover photo preview */}
      {hoverPhoto && (
        <div className="fixed z-[99999] pointer-events-none" style={{ left: hoverPhoto.x, top: hoverPhoto.y, transform: "translateY(-50%)" }}>
          <img src={hoverPhoto.url} alt="" className="w-48 h-32 object-cover rounded-xl shadow-2xl border-2 border-white dark:border-gray-700" />
        </div>
      )}

      {payVehicle && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { if (!paying) setPayVehicle(null); }} />
          <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-gradient-to-r from-brand-500 to-brand-400 px-6 py-5">
              <h3 className="text-lg font-bold text-white">Pay All Pending Challans</h3>
              <p className="text-white/70 text-sm mt-0.5">
                {payVehicle.registrationNumber} &bull; {payVehiclePendingCount} challan{payVehiclePendingCount > 1 ? "s" : ""}
              </p>
            </div>

            <div className="p-6 space-y-5">
              <div className="text-center py-4 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Total Amount</p>
                <p className="text-4xl font-black text-gray-900 dark:text-white">&#8377;{payVehiclePendingAmt.toLocaleString("en-IN")}</p>
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
                <button onClick={handlePayAllPending} disabled={paying || payVehiclePendingCount === 0}
                  className="flex-1 h-12 rounded-xl bg-gradient-to-r from-brand-500 to-brand-400 text-white font-semibold text-sm shadow-lg shadow-brand-500/25 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {paying ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      Processing...
                    </>
                  ) : (
                    <>Pay &#8377;{payVehiclePendingAmt.toLocaleString("en-IN")}</>
                  )}
                </button>
                <button onClick={() => { if (!paying) setPayVehicle(null); }} disabled={paying}
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
