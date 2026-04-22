"use client";
import React, { useEffect, useState } from "react";
import Image from "next/image";
import { fastagAPI, vehicleAPI } from "@/lib/api";
import Badge from "@/components/ui/badge/Badge";
import { useToast } from "@/context/ToastContext";
import Pagination from "@/components/ui/Pagination";
import { FASTagSkeleton } from "@/components/ui/Skeleton";
import { Plus, CreditCard, List, LayoutGrid, Truck, RefreshCw } from "lucide-react";
import { getVehicleTypeIcon } from "@/components/icons/VehicleTypeIcons";
import { resolveImageUrl } from "@/components/vehicles/VehicleThumb";
import { SearchInput } from "@/components/ui/SearchInput";

interface Fastag {
  id: string;
  tagId: string;
  provider: string | null;
  balance: number;
  status: string;
  enrolledAt: string;
  expiryDate: string;
  isActive: boolean;
  vehicle: { id: string; registrationNumber: string; make: string; model: string; profileImage: string | null; group?: { id: string; name: string; icon: string; color?: string } | null };
  transactions?: Array<{ id: string; type: string; amount: number; balance: number; description: string | null; tollPlaza: string | null; createdAt: string }>;
}

interface Vehicle { id: string; registrationNumber: string; make: string; model: string; }

export default function FASTagPage() {
  const toast = useToast();
  const [fastags, setFastags] = useState<Fastag[]>([]);
  const [view, setView] = useState<"list" | "grid">("list");
  const [stats, setStats] = useState({ total: 0, active: 0, totalBalance: 0, lowBalance: 0 });
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [createForm, setCreateForm] = useState({ vehicleId: "", tagId: "", provider: "", initialBalance: "500" });
  const [creating, setCreating] = useState(false);

  const [hoverPhoto, setHoverPhoto] = useState<{ url: string; x: number; y: number } | null>(null);

  // Recharge modal
  const [rechargeFastag, setRechargeFastag] = useState<Fastag | null>(null);
  const [rechargeAmount, setRechargeAmount] = useState("");
  const [recharging, setRecharging] = useState(false);

  // Transactions modal
  const [txFastag, setTxFastag] = useState<Fastag | null>(null);
  const [transactions, setTransactions] = useState<Fastag["transactions"]>([]);
  const [txLoading, setTxLoading] = useState(false);

  const fetchData = async (page = 1) => {
    try {
      const [fastagRes, statsRes] = await Promise.all([
        fastagAPI.getAll({ page, limit: 10, status: statusFilter !== "ALL" ? statusFilter : undefined, search: search || undefined }),
        fastagAPI.getStats(),
      ]);
      setFastags(fastagRes.data.data.fastags);
      setPagination({ page: fastagRes.data.data.page, totalPages: fastagRes.data.data.totalPages, total: fastagRes.data.data.total });
      setStats(statsRes.data.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []); // eslint-disable-line

  // Debounced live search
  const [didMountSearch, setDidMountSearch] = useState(false);
  useEffect(() => {
    if (!didMountSearch) { setDidMountSearch(true); return; }
    const timer = setTimeout(() => fetchData(1), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const handleCreate = async () => {
    if (!createForm.vehicleId || !createForm.tagId) return;
    setCreating(true);
    try {
      await fastagAPI.create({ vehicleId: createForm.vehicleId, tagId: createForm.tagId, provider: createForm.provider || undefined, initialBalance: Number(createForm.initialBalance) || 500 });
      toast.success("FASTag Created", "FASTag linked to vehicle successfully");
      setShowCreate(false);
      setCreateForm({ vehicleId: "", tagId: "", provider: "", initialBalance: "500" });
      fetchData();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error("Failed", e.response?.data?.message || "Could not create FASTag");
    } finally { setCreating(false); }
  };

  const handleRecharge = async () => {
    if (!rechargeFastag || !rechargeAmount) return;
    setRecharging(true);
    try {
      await fastagAPI.recharge(rechargeFastag.id, Number(rechargeAmount));
      toast.success("Recharged", `₹${rechargeAmount} added successfully`);
      setRechargeFastag(null); setRechargeAmount("");
      fetchData();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error("Failed", e.response?.data?.message || "Recharge failed");
    } finally { setRecharging(false); }
  };

  const openTransactions = async (f: Fastag) => {
    setTxFastag(f); setTxLoading(true);
    try {
      const res = await fastagAPI.getTransactions(f.id, { limit: 50 });
      setTransactions(res.data.data.transactions);
    } catch { setTransactions([]); }
    finally { setTxLoading(false); }
  };

  const openCreate = async () => {
    setShowCreate(true);
    try {
      const res = await vehicleAPI.getAll({ limit: 100 });
      setVehicles(res.data.data.vehicles);
    } catch { /* ignore */ }
  };

  const balanceColor = (b: number) => b >= 500 ? "text-emerald-600 dark:text-emerald-400" : b >= 100 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400";
  const PROVIDERS = ["ICICI", "Paytm", "Airtel", "HDFC", "Axis", "Kotak", "SBI", "IndusInd"];

  if (loading) return <FASTagSkeleton />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Image src="/images/fastag.png" alt="FASTag" width={100} height={20} className="h-14 w-60" />
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage FASTags, recharge, and track toll transactions</p>
        </div>
        <button onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-brand-400 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 hover:shadow-brand-500/40 transition-all">
          <Plus className="w-4 h-4" />
          Create FASTag
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-gray-200/80 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.02]">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Total Tags</p>
          <p className="text-2xl font-black text-gray-900 dark:text-white mt-1">{stats.total}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200/60 bg-emerald-50/50 p-5 dark:border-emerald-500/20 dark:bg-emerald-500/5">
          <p className="text-[10px] font-semibold text-emerald-500/60 uppercase tracking-wider">Active</p>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{stats.active}</p>
        </div>
        <div className="rounded-2xl border border-brand-200/60 bg-brand-25 p-5 dark:border-brand-500/20 dark:bg-brand-500/5">
          <p className="text-[10px] font-semibold text-brand-500/60 uppercase tracking-wider">Total Balance</p>
          <p className="text-2xl font-black text-brand-600 dark:text-brand-400 mt-1">&#8377;{stats.totalBalance.toLocaleString("en-IN")}</p>
        </div>
        <div className="rounded-2xl border border-red-200/60 bg-red-50/50 p-5 dark:border-red-500/20 dark:bg-red-500/5">
          <p className="text-[10px] font-semibold text-red-500/60 uppercase tracking-wider">Low Balance</p>
          <p className="text-2xl font-black text-red-600 dark:text-red-400 mt-1">{stats.lowBalance}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <SearchInput
          className="flex-1"
          value={search}
          onChange={setSearch}
          placeholder="Search by tag ID or vehicle..."
        />
        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800/50 rounded-xl h-10">
          {["ALL", "ACTIVE", "INACTIVE", "EXPIRED"].map((s) => (
            <button key={s} onClick={() => { setStatusFilter(s); setTimeout(() => fetchData(1), 0); }}
              className={`rounded-lg px-3 text-xs font-semibold transition-all ${statusFilter === s ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white" : "text-gray-500 hover:text-gray-700 dark:text-gray-400"}`}>
              {s === "ALL" ? "All" : s}
            </button>
          ))}
        </div>
        <div className="flex gap-0.5 p-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg h-10">
          <button onClick={() => setView("list")} className={`px-2.5 rounded-md transition-all ${view === "list" ? "bg-white shadow-sm dark:bg-gray-700" : ""}`}>
            <List className={`w-4 h-4 ${view === "list" ? "text-gray-900 dark:text-white" : "text-gray-400"}`} />
          </button>
          <button onClick={() => setView("grid")} className={`px-2.5 rounded-md transition-all ${view === "grid" ? "bg-white shadow-sm dark:bg-gray-700" : ""}`}>
            <LayoutGrid className={`w-4 h-4 ${view === "grid" ? "text-gray-900 dark:text-white" : "text-gray-400"}`} />
          </button>
        </div>
      </div>

      {/* FASTag List */}
      {fastags.length === 0 ? (
        <div className="rounded-2xl border border-gray-200/80 bg-white p-12 text-center dark:border-gray-800 dark:bg-white/[0.02]">
          <div className="w-14 h-14 rounded-2xl bg-yellow-100 dark:bg-yellow-500/20 flex items-center justify-center mx-auto mb-4">
            <CreditCard className="w-7 h-7 text-yellow-600" />
          </div>
          <p className="text-sm text-gray-500">No FASTags found</p>
          <button onClick={openCreate} className="mt-3 text-sm font-medium text-brand-500 hover:text-brand-600">Create your first FASTag</button>
        </div>
      ) : view === "list" ? (
        <div className="space-y-3">
          {fastags.map((f) => {
            const GroupIcon = f.vehicle.group?.icon ? getVehicleTypeIcon(f.vehicle.group.icon) : Truck;
            return (
            <div key={f.id} className={`rounded-xl border bg-white dark:bg-white/[0.02] transition-all hover:shadow-lg ${f.isActive ? "border-gray-200/80 dark:border-gray-800" : "border-gray-100 dark:border-gray-800/50 opacity-60"}`}>
              <div className="p-4 flex items-center gap-4">
                {/* Vehicle Image / Group Icon */}
                {f.vehicle.profileImage ? (
                  <div className="w-11 h-11 rounded-xl overflow-hidden flex-shrink-0 cursor-pointer"
                    onMouseEnter={(e) => { const r = e.currentTarget.getBoundingClientRect(); setHoverPhoto({ url: `${resolveImageUrl(f.vehicle.profileImage) ?? ""}`, x: r.right + 12, y: r.top + r.height / 2 }); }}
                    onMouseLeave={() => setHoverPhoto(null)}>
                    <img src={`${resolveImageUrl(f.vehicle.profileImage) ?? ""}`} alt={f.vehicle.registrationNumber} className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = "none")} />
                  </div>
                ) : (
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: f.vehicle.group?.color ? f.vehicle.group.color + '12' : '#f3f4f6' }}>
                    <GroupIcon className="w-5 h-5" style={f.vehicle.group?.color ? { color: f.vehicle.group.color } : undefined} />
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-gray-900 dark:text-white font-mono">{f.vehicle.registrationNumber}</span>
                    <Badge color={f.status === "ACTIVE" ? "success" : f.status === "EXPIRED" ? "error" : "warning"} variant="light" size="sm">{f.status}</Badge>
                    {f.provider && <span className="text-[10px] px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-500 font-semibold">{f.provider}</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    <span className="font-mono">{f.tagId.slice(0, 4)}****{f.tagId.slice(-4)}</span>
                    <span className="text-gray-300 dark:text-gray-600">&bull;</span>
                    <span>{f.vehicle.make} {f.vehicle.model}</span>
                    <span className="text-gray-300 dark:text-gray-600">&bull;</span>
                    <span>Exp: {new Date(f.expiryDate).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}</span>
                  </div>
                </div>

                {/* Balance */}
                <div className="text-right flex-shrink-0">
                  <p className={`text-lg font-black ${balanceColor(f.balance)}`}>&#8377;{f.balance.toLocaleString("en-IN")}</p>
                  <p className="text-[10px] text-gray-400">Balance</p>
                </div>

                {/* Actions */}
                <div className="flex gap-1.5 flex-shrink-0">
                  {f.isActive && (
                    <button onClick={() => { setRechargeFastag(f); setRechargeAmount(""); }}
                      className="rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all">
                      Recharge
                    </button>
                  )}
                  <button onClick={() => openTransactions(f)}
                    className="rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 p-1.5 text-gray-500 transition-colors" title="Transactions">
                    <List className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      ) : (
        /* ── GRID VIEW ── */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {fastags.map((f) => {
            const GroupIcon = f.vehicle.group?.icon ? getVehicleTypeIcon(f.vehicle.group.icon) : Truck;
            return (
              <div key={f.id} className={`rounded-2xl border bg-white dark:bg-white/[0.02] overflow-hidden transition-all hover:shadow-lg ${f.isActive ? "border-gray-200/80 dark:border-gray-800" : "border-gray-100 dark:border-gray-800/50 opacity-60"}`}>
                <div className={`h-1.5 ${f.isActive ? "bg-gradient-to-r from-yellow-400 to-yellow-600" : "bg-gray-200 dark:bg-gray-700"}`} />
                <div className="p-5">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {f.vehicle.profileImage ? (
                        <img src={`${resolveImageUrl(f.vehicle.profileImage) ?? ""}`} alt={f.vehicle.registrationNumber} className="w-11 h-11 rounded-xl object-cover shadow-md" onError={(e) => (e.currentTarget.style.display = "none")} />
                      ) : (
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center shadow-md" style={{ backgroundColor: f.vehicle.group?.color ? f.vehicle.group.color + '12' : undefined, background: !f.vehicle.group?.color ? (f.isActive ? 'linear-gradient(to bottom right, #facc15, #ca8a04)' : undefined) : undefined }}>
                          <GroupIcon className="w-5 h-5" style={f.vehicle.group?.color ? { color: f.vehicle.group.color } : { color: 'white' }} />
                        </div>
                      )}
                      <div>
                        <h3 className="text-sm font-black text-gray-900 dark:text-white font-mono">{f.vehicle.registrationNumber}</h3>
                        <p className="text-xs text-gray-500">{f.vehicle.make} {f.vehicle.model}</p>
                      </div>
                    </div>
                    <Badge color={f.status === "ACTIVE" ? "success" : f.status === "EXPIRED" ? "error" : "warning"} variant="light" size="sm">{f.status}</Badge>
                  </div>

                  {/* Tag details */}
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-500 font-mono font-semibold">{f.tagId.slice(0, 4)}****{f.tagId.slice(-4)}</span>
                    {f.provider && <span className="text-[10px] px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-500 font-semibold">{f.provider}</span>}
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-500 font-semibold">Exp: {new Date(f.expiryDate).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}</span>
                  </div>

                  {/* Balance */}
                  <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 p-3 text-center mb-3">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">Balance</p>
                    <p className={`text-xl font-black ${balanceColor(f.balance)}`}>&#8377;{f.balance.toLocaleString("en-IN")}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    {f.isActive && (
                      <button onClick={() => { setRechargeFastag(f); setRechargeAmount(""); }}
                        className="flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 px-3 py-2 text-xs font-semibold text-white shadow-md shadow-emerald-500/20 transition-all text-center">
                        Recharge
                      </button>
                    )}
                    <button onClick={() => openTransactions(f)}
                      className="rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 px-3 py-2 text-xs font-semibold text-gray-500 transition-colors">
                      Transactions
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Pagination currentPage={pagination.page} totalPages={pagination.totalPages} totalItems={pagination.total} itemsPerPage={10} onPageChange={(p) => fetchData(p)} onItemsPerPageChange={() => {}} itemLabel="fastags" />

      {/* ── CREATE MODAL ── */}
      {showCreate && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowCreate(false)} />
          <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-gradient-to-r from-yellow-500 to-yellow-400 px-6 py-5">
              <h3 className="text-lg font-bold text-white">Create FASTag</h3>
              <p className="text-white/70 text-sm mt-0.5">Link a FASTag to a vehicle</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Vehicle <span className="text-red-500">*</span></label>
                <select value={createForm.vehicleId} onChange={(e) => setCreateForm({ ...createForm, vehicleId: e.target.value })}
                  className="w-full h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 focus:border-brand-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white">
                  <option value="">Select vehicle</option>
                  {vehicles.map((v) => <option key={v.id} value={v.id}>{v.registrationNumber} — {v.make} {v.model}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">FASTag ID <span className="text-red-500">*</span></label>
                <input type="text" value={createForm.tagId} onChange={(e) => setCreateForm({ ...createForm, tagId: e.target.value })} placeholder="e.g., 3408XXXX12345678"
                  className="w-full h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm font-mono text-gray-900 placeholder:text-gray-400 focus:border-brand-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Provider</label>
                  <select value={createForm.provider} onChange={(e) => setCreateForm({ ...createForm, provider: e.target.value })}
                    className="w-full h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 focus:border-brand-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white">
                    <option value="">Select</option>
                    {PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Initial Balance</label>
                  <input type="number" value={createForm.initialBalance} onChange={(e) => setCreateForm({ ...createForm, initialBalance: e.target.value })} placeholder="500"
                    className="w-full h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 focus:border-brand-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={handleCreate} disabled={creating || !createForm.vehicleId || !createForm.tagId}
                  className="flex-1 h-11 rounded-xl bg-gradient-to-r from-yellow-500 to-yellow-400 text-white font-semibold text-sm shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {creating ? "Creating..." : "Create FASTag"}
                </button>
                <button onClick={() => setShowCreate(false)} className="h-11 px-6 rounded-xl border-2 border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 transition-all">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── RECHARGE MODAL ── */}
      {hoverPhoto && (
        <div className="fixed z-[99999] pointer-events-none" style={{ left: hoverPhoto.x, top: hoverPhoto.y, transform: "translateY(-50%)" }}>
          <img src={hoverPhoto.url} alt="" className="w-48 h-32 object-cover rounded-xl shadow-2xl border-2 border-white dark:border-gray-700" />
        </div>
      )}

      {rechargeFastag && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setRechargeFastag(null)} />
          <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-500 to-green-500 px-6 py-5">
              <h3 className="text-lg font-bold text-white">Recharge FASTag</h3>
              <p className="text-white/70 text-sm mt-0.5">{rechargeFastag.vehicle.registrationNumber} &mdash; {rechargeFastag.tagId.slice(0, 4)}****{rechargeFastag.tagId.slice(-4)}</p>
            </div>
            <div className="p-6 space-y-5">
              <div className="text-center py-3 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Current Balance</p>
                <p className={`text-3xl font-black ${balanceColor(rechargeFastag.balance)}`}>&#8377;{rechargeFastag.balance.toLocaleString("en-IN")}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Recharge Amount</label>
                <div className="flex gap-2 mb-3 flex-wrap">
                  {[500, 1000, 2000, 5000].map((a) => (
                    <button key={a} type="button" onClick={() => setRechargeAmount(String(a))}
                      className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all ${rechargeAmount === String(a) ? "border-emerald-400 bg-emerald-50 text-emerald-600" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                      &#8377;{a.toLocaleString("en-IN")}
                    </button>
                  ))}
                </div>
                <input type="number" value={rechargeAmount} onChange={(e) => setRechargeAmount(e.target.value)} placeholder="Enter amount" min={100} max={10000}
                  className="w-full h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 focus:border-emerald-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
              </div>
              <div className="flex gap-3">
                <button onClick={handleRecharge} disabled={recharging || !rechargeAmount || Number(rechargeAmount) < 100}
                  className="flex-1 h-11 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 text-white font-semibold text-sm shadow-lg transition-all disabled:opacity-50 flex items-center justify-center">
                  {recharging ? "Processing..." : `Recharge ₹${Number(rechargeAmount || 0).toLocaleString("en-IN")}`}
                </button>
                <button onClick={() => setRechargeFastag(null)} className="h-11 px-5 rounded-xl border-2 border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 transition-all">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TRANSACTIONS MODAL ── */}
      {txFastag && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setTxFastag(null)} />
          <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-brand-500 to-brand-400 px-6 py-5 flex-shrink-0">
              <h3 className="text-lg font-bold text-white">Transactions</h3>
              <p className="text-white/70 text-sm mt-0.5">{txFastag.vehicle.registrationNumber} &mdash; &#8377;{txFastag.balance.toLocaleString("en-IN")} balance</p>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {txLoading ? (
                <div className="py-8 text-center text-sm text-gray-400">Loading...</div>
              ) : !transactions || transactions.length === 0 ? (
                <div className="py-8 text-center text-sm text-gray-400">No transactions yet</div>
              ) : (
                <div className="space-y-2">
                  {transactions.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${tx.type === "RECHARGE" ? "bg-emerald-100 dark:bg-emerald-500/20" : tx.type === "REFUND" ? "bg-blue-100 dark:bg-blue-500/20" : "bg-red-100 dark:bg-red-500/20"}`}>
                          {tx.type === "RECHARGE" ? (
                            <Plus className={`w-4 h-4 text-emerald-600`} />
                          ) : tx.type === "REFUND" ? (
                            <RefreshCw className={`w-4 h-4 text-blue-600`} />
                          ) : (
                            <Truck className={`w-4 h-4 text-red-600`} />
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">{tx.description || tx.type}</p>
                          <p className="text-[10px] text-gray-400">{new Date(tx.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-bold ${tx.type === "TOLL" ? "text-red-600" : "text-emerald-600"}`}>{tx.type === "TOLL" ? "-" : "+"}&#8377;{tx.amount.toLocaleString("en-IN")}</p>
                        <p className="text-[10px] text-gray-400">Bal: &#8377;{tx.balance.toLocaleString("en-IN")}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 flex-shrink-0">
              <button onClick={() => setTxFastag(null)} className="w-full h-11 rounded-xl border-2 border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 transition-all">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
