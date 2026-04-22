"use client";
import React, { useEffect, useState, useRef } from "react";
import { vehicleAPI } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import Link from "next/link";
import { ServicesPageSkeleton } from "@/components/ui/Skeleton";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import { Plus, List, Calendar, Wrench, Car, ChevronRight, X, Upload, LayoutGrid, CheckCircle2, Clock, AlertTriangle, Banknote, Search } from "lucide-react";
import { getVehicleTypeIcon } from "@/components/icons/VehicleTypeIcons";
import { resolveImageUrl } from "@/components/vehicles/VehicleThumb";

const API_URL = process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") || "http://localhost:5001";

interface VehicleBasic {
  id: string;
  registrationNumber: string;
  make: string;
  model: string;
  profileImage: string | null;
  group?: { name: string; icon: string; color?: string } | null;
}

type ServiceView = "list" | "grid";

interface ServiceRecord {
  id: string;
  vehicleId: string;
  title: string;
  description: string | null;
  serviceDate: string;
  odometerKm: number | null;
  totalCost: number;
  receiptUrls: string[];
  parts: Array<{ name: string; quantity: number; unitCost: number; proofUrl?: string | null }>;
  nextDueDate: string | null;
  nextDueKm: number | null;
  status: string;
  vehicle?: VehicleBasic;
}

export default function VehicleServicesPage() {
  const toast = useToast();
  const [tab, setTab] = useState<"services" | "schedule">("services");
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [vehicles, setVehicles] = useState<VehicleBasic[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [svcView, setSvcView] = useState<ServiceView>("list");
  const [svcSearch, setSvcSearch] = useState("");
  const [hoverPhoto, setHoverPhoto] = useState<{ url: string; x: number; y: number } | null>(null);
  const calendarRef = useRef<FullCalendar>(null);

  // Add/Schedule service modal
  const [showModal, setShowModal] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [savingService, setSavingService] = useState(false);
  const [svcForm, setSvcForm] = useState({ title: "", description: "", serviceDate: "", odometerKm: "", totalCost: "", nextDueDate: "", nextDueKm: "", status: "COMPLETED" });
  const [svcParts, setSvcParts] = useState<Array<{ name: string; quantity: string; unitCost: string }>>([{ name: "", quantity: "1", unitCost: "" }]);
  const [svcReceipts, setSvcReceipts] = useState<File[]>([]);

  // Calendar vehicle filter
  const [calVehicleId, setCalVehicleId] = useState("");

  const fetchData = async () => {
    try {
      const [svcRes, vehRes] = await Promise.all([
        vehicleAPI.getAllServices(statusFilter ? { status: statusFilter } : undefined),
        vehicleAPI.getAll({ page: 1, limit: 100 }),
      ]);
      setServices(svcRes.data.data);
      setVehicles(vehRes.data.data.vehicles || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [statusFilter]);

  const openAddService = (preDate?: string, preStatus?: string) => {
    const date = preDate || new Date().toISOString().split("T")[0];
    const isFuture = new Date(date) > new Date();
    const status = preStatus || (isFuture ? "UPCOMING" : "COMPLETED");
    setSvcForm({ title: "", description: "", serviceDate: date, odometerKm: "", totalCost: "", nextDueDate: isFuture ? date : "", nextDueKm: "", status });
    setSvcParts([{ name: "", quantity: "1", unitCost: "" }]);
    setSvcReceipts([]);
    setSelectedVehicleId(calVehicleId || "");
    setShowModal(true);
  };

  const handleSaveService = async () => {
    if (!svcForm.title || !svcForm.serviceDate || !selectedVehicleId) return;
    setSavingService(true);
    try {
      const formData = new FormData();
      formData.append("title", svcForm.title);
      if (svcForm.description) formData.append("description", svcForm.description);
      formData.append("serviceDate", svcForm.serviceDate);
      if (svcForm.odometerKm) formData.append("odometerKm", svcForm.odometerKm);
      const partsTotal = svcParts.filter((p) => p.name).reduce((sum, p) => sum + (parseFloat(p.unitCost) || 0) * (parseInt(p.quantity) || 1), 0);
      formData.append("totalCost", svcForm.totalCost || partsTotal.toString());
      if (svcForm.nextDueDate) formData.append("nextDueDate", svcForm.nextDueDate);
      if (svcForm.nextDueKm) formData.append("nextDueKm", svcForm.nextDueKm);
      formData.append("status", svcForm.status);
      const validParts = svcParts.filter((p) => p.name.trim());
      if (validParts.length > 0) formData.append("parts", JSON.stringify(validParts));
      svcReceipts.forEach((f) => formData.append("receipts", f));

      await vehicleAPI.createService(selectedVehicleId, formData);
      toast.success(svcForm.status === "UPCOMING" ? "Service Scheduled" : "Service Logged", "Service record created");
      setShowModal(false);
      fetchData();
    } catch { toast.error("Error", "Failed to save service"); }
    finally { setSavingService(false); }
  };

  // Group services by vehicle for the list view
  const vehicleServiceMap = new Map<string, { vehicle: VehicleBasic; services: ServiceRecord[]; totalCost: number; upcoming: number; overdue: number; completed: number }>();
  for (const svc of services) {
    if (!svc.vehicle) continue;
    const vid = svc.vehicleId;
    if (!vehicleServiceMap.has(vid)) {
      vehicleServiceMap.set(vid, { vehicle: svc.vehicle, services: [], totalCost: 0, upcoming: 0, overdue: 0, completed: 0 });
    }
    const entry = vehicleServiceMap.get(vid)!;
    entry.services.push(svc);
    entry.totalCost += svc.totalCost;
    if (svc.status === "COMPLETED") entry.completed++;
    else if (svc.nextDueDate && new Date(svc.nextDueDate) < new Date()) entry.overdue++;
    else entry.upcoming++;
  }

  // Calendar events — filtered by selected vehicle or all
  const calendarEvents = services
    .filter((s) => !calVehicleId || s.vehicleId === calVehicleId)
    .map((svc) => {
      const isOverdue = svc.nextDueDate && new Date(svc.nextDueDate) < new Date() && svc.status === "UPCOMING";
      const time = svc.serviceDate.includes("T") ? new Date(svc.serviceDate).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "";
      return {
        id: svc.id,
        title: `${svc.vehicle?.registrationNumber || ""} — ${svc.title}`,
        start: svc.serviceDate.split("T")[0],
        allDay: true,
        backgroundColor: svc.status === "COMPLETED" ? "#10b981" : isOverdue ? "#ef4444" : "#eab308",
        textColor: svc.status === "COMPLETED" ? "#fff" : isOverdue ? "#fff" : "#422006",
        borderColor: svc.status === "COMPLETED" ? "#059669" : isOverdue ? "#dc2626" : "#ca8a04",
        extendedProps: { vehicleId: svc.vehicleId, time, serviceDate: svc.serviceDate },
      };
    });

  // Build a set of dates that have services, with their dominant status for day background coloring
  const dayStatusMap = new Map<string, "COMPLETED" | "OVERDUE" | "UPCOMING">();
  for (const svc of services.filter((s) => !calVehicleId || s.vehicleId === calVehicleId)) {
    const dateKey = svc.serviceDate.split("T")[0];
    const isOverdue = svc.nextDueDate && new Date(svc.nextDueDate) < new Date() && svc.status === "UPCOMING";
    const status = svc.status === "COMPLETED" ? "COMPLETED" : isOverdue ? "OVERDUE" : "UPCOMING";
    const priority = { OVERDUE: 3, UPCOMING: 2, COMPLETED: 1 } as const;
    const existing = dayStatusMap.get(dateKey);
    if (!existing || priority[status] > priority[existing]) {
      dayStatusMap.set(dateKey, status);
    }
  }

  if (loading) return <ServicesPageSkeleton />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Services Management</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Track and schedule vehicle services across your fleet</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800/50 rounded-xl">
            <button onClick={() => setTab("services")}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${tab === "services" ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white" : "text-gray-500 hover:text-gray-700 dark:text-gray-400"}`}>
              <List className="w-4 h-4" />
              Services
            </button>
            <button onClick={() => setTab("schedule")}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${tab === "schedule" ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white" : "text-gray-500 hover:text-gray-700 dark:text-gray-400"}`}>
              <Calendar className="w-4 h-4" />
              Schedule
            </button>
          </div>
          <button onClick={() => openAddService()} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-brand-400 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 hover:shadow-brand-500/40 transition-all">
            <Plus className="w-4 h-4" />
            {tab === "schedule" ? "Schedule" : "Add Service"}
          </button>
        </div>
      </div>

      {/* ── SERVICES TAB ── */}
      {tab === "services" && (
        <div className="space-y-5">
          {/* Stats cards */}
          {services.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02] p-4">
                <div className="flex items-center gap-2 mb-2"><Wrench className="w-4 h-4 text-brand-500" /><span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Total</span></div>
                <p className="text-2xl font-black text-gray-900 dark:text-white">{services.length}</p>
              </div>
              <div className="rounded-xl border border-emerald-200/60 bg-emerald-50/50 dark:border-emerald-500/20 dark:bg-emerald-500/5 p-4">
                <div className="flex items-center gap-2 mb-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /><span className="text-[10px] text-emerald-600/60 font-semibold uppercase tracking-wider">Completed</span></div>
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{services.filter((s) => s.status === "COMPLETED").length}</p>
              </div>
              <div className="rounded-xl border border-yellow-200/60 bg-yellow-50/50 dark:border-yellow-500/20 dark:bg-yellow-500/5 p-4">
                <div className="flex items-center gap-2 mb-2"><Clock className="w-4 h-4 text-yellow-500" /><span className="text-[10px] text-yellow-600/60 font-semibold uppercase tracking-wider">Upcoming</span></div>
                <p className="text-2xl font-black text-yellow-600 dark:text-yellow-400">{services.filter((s) => s.status === "UPCOMING").length}</p>
              </div>
              <div className="rounded-xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02] p-4">
                <div className="flex items-center gap-2 mb-2"><Banknote className="w-4 h-4 text-gray-500" /><span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Total Spent</span></div>
                <p className="text-2xl font-black text-gray-900 dark:text-white">&#8377;{services.filter((s) => s.status === "COMPLETED").reduce((s, x) => s + x.totalCost, 0).toLocaleString("en-IN")}</p>
              </div>
            </div>
          )}

          {/* Filters + View Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800/50 rounded-xl">
              {[
                { value: "", label: "All", count: services.length },
                { value: "COMPLETED", label: "Completed", count: services.filter((s) => s.status === "COMPLETED").length },
                { value: "UPCOMING", label: "Upcoming", count: services.filter((s) => s.status === "UPCOMING").length },
              ].map((f) => (
                <button key={f.value} onClick={() => setStatusFilter(f.value)}
                  className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${statusFilter === f.value ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white" : "text-gray-500 hover:text-gray-700 dark:text-gray-400"}`}>
                  {f.label} <span className="text-gray-400">({f.count})</span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input type="text" placeholder="Search reg. no..." value={svcSearch} onChange={(e) => setSvcSearch(e.target.value)}
                  className="h-9 w-44 rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-xs text-gray-900 placeholder:text-gray-400 focus:border-brand-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
              </div>
              <div className="flex gap-0.5 p-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg h-9">
                <button onClick={() => setSvcView("list")} className={`px-2.5 rounded-md transition-all ${svcView === "list" ? "bg-white shadow-sm dark:bg-gray-700" : ""}`}>
                  <List className={`w-4 h-4 ${svcView === "list" ? "text-gray-900 dark:text-white" : "text-gray-400"}`} />
                </button>
                <button onClick={() => setSvcView("grid")} className={`px-2.5 rounded-md transition-all ${svcView === "grid" ? "bg-white shadow-sm dark:bg-gray-700" : ""}`}>
                  <LayoutGrid className={`w-4 h-4 ${svcView === "grid" ? "text-gray-900 dark:text-white" : "text-gray-400"}`} />
                </button>
              </div>
            </div>
          </div>

          {vehicleServiceMap.size === 0 ? (
            <div className="rounded-2xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02] p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-3">
                <Wrench className="w-8 h-8 text-gray-300 dark:text-gray-600" />
              </div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No service records yet</p>
              <p className="text-xs text-gray-400 mt-1">Click &quot;Add Service&quot; to log your first service</p>
            </div>
          ) : svcView === "list" ? (
            /* List View */
            <div className="rounded-2xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02] overflow-hidden divide-y divide-gray-100 dark:divide-gray-800">
              {[...vehicleServiceMap.entries()].filter(([, d]) => !svcSearch || d.vehicle.registrationNumber.toLowerCase().includes(svcSearch.toLowerCase())).map(([vid, data]) => {
                const GroupIcon = data.vehicle.group?.icon ? getVehicleTypeIcon(data.vehicle.group.icon) : Car;
                return (
                <Link key={vid} href={`/vehicles/services/${vid}`}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors group">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden ${!data.vehicle.profileImage ? "bg-gray-100 dark:bg-gray-800" : ""}`}
                    style={!data.vehicle.profileImage && data.vehicle.group?.color ? { backgroundColor: `${data.vehicle.group.color}12` } : undefined}
                    onMouseEnter={(e) => { if (data.vehicle.profileImage) { const r = e.currentTarget.getBoundingClientRect(); setHoverPhoto({ url: `${resolveImageUrl(data.vehicle.profileImage) ?? ""}`, x: r.right + 12, y: r.top + r.height / 2 }); } }}
                    onMouseLeave={() => setHoverPhoto(null)}>
                    {data.vehicle.profileImage ? (
                      <img src={`${resolveImageUrl(data.vehicle.profileImage) ?? ""}`} alt="" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = "none")} />
                    ) : (
                      <GroupIcon className="w-5 h-5" style={data.vehicle.group?.color ? { color: data.vehicle.group.color } : undefined} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-brand-600 font-mono tracking-wide">{data.vehicle.registrationNumber}</span>
                      <span className="text-[10px] text-gray-400">{data.services.length} service{data.services.length !== 1 ? "s" : ""}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{data.vehicle.make} {data.vehicle.model}</p>
                  </div>
                  <div className="hidden sm:flex items-center gap-4 flex-shrink-0 text-center">
                    {data.completed > 0 && <div><p className="text-sm font-bold text-emerald-600">{data.completed}</p><p className="text-[8px] text-gray-400 uppercase">Done</p></div>}
                    {data.upcoming > 0 && <div><p className="text-sm font-bold text-yellow-500">{data.upcoming}</p><p className="text-[8px] text-gray-400 uppercase">Soon</p></div>}
                    {data.overdue > 0 && <div><p className="text-sm font-bold text-red-600">{data.overdue}</p><p className="text-[8px] text-gray-400 uppercase">Due</p></div>}
                    <div><p className="text-sm font-bold text-gray-900 dark:text-white">&#8377;{data.totalCost.toLocaleString("en-IN")}</p><p className="text-[8px] text-gray-400 uppercase">Spent</p></div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-brand-500 flex-shrink-0" />
                </Link>); })}
            </div>
          ) : (
            /* Grid View */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...vehicleServiceMap.entries()].filter(([, d]) => !svcSearch || d.vehicle.registrationNumber.toLowerCase().includes(svcSearch.toLowerCase())).map(([vid, data]) => {
                const GroupIcon = data.vehicle.group?.icon ? getVehicleTypeIcon(data.vehicle.group.icon) : Car;
                return (
                <Link key={vid} href={`/vehicles/services/${vid}`}
                  className="block rounded-2xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02] hover:shadow-lg hover:border-brand-200 dark:hover:border-brand-500/30 transition-all group overflow-hidden">
                  <div className="p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden ${!data.vehicle.profileImage ? "bg-gray-100 dark:bg-gray-800" : ""}`}
                        style={!data.vehicle.profileImage && data.vehicle.group?.color ? { backgroundColor: `${data.vehicle.group.color}12` } : undefined}>
                        {data.vehicle.profileImage ? (
                          <img src={`${resolveImageUrl(data.vehicle.profileImage) ?? ""}`} alt="" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = "none")} />
                        ) : (
                          <GroupIcon className="w-5 h-5" style={data.vehicle.group?.color ? { color: data.vehicle.group.color } : undefined} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-brand-600 font-mono tracking-wide">{data.vehicle.registrationNumber}</h3>
                        <p className="text-xs text-gray-500">{data.vehicle.make} {data.vehicle.model}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center py-3 border-t border-b border-gray-100 dark:border-gray-800">
                      <div><p className="text-lg font-bold text-gray-900 dark:text-white">{data.services.length}</p><p className="text-[8px] text-gray-400 uppercase tracking-wider">Total</p></div>
                      <div><p className="text-lg font-bold text-emerald-600">{data.completed}</p><p className="text-[8px] text-gray-400 uppercase tracking-wider">Done</p></div>
                      <div><p className="text-lg font-bold text-yellow-500">{data.upcoming}</p><p className="text-[8px] text-gray-400 uppercase tracking-wider">Soon</p></div>
                      <div><p className="text-lg font-bold text-gray-900 dark:text-white">&#8377;{data.totalCost.toLocaleString("en-IN")}</p><p className="text-[8px] text-gray-400 uppercase tracking-wider">Spent</p></div>
                    </div>
                    {data.services.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {data.services.slice(0, 3).map((svc) => {
                          const isOverdue = svc.nextDueDate && new Date(svc.nextDueDate) < new Date() && svc.status === "UPCOMING";
                          return (
                            <span key={svc.id} className={`text-[9px] font-medium px-2 py-0.5 rounded-md ${isOverdue ? "bg-red-100 text-red-700" : svc.status === "UPCOMING" ? "bg-yellow-100 text-yellow-700" : "bg-emerald-100 text-emerald-700"}`}>
                              {svc.title}
                            </span>
                          );
                        })}
                        {data.services.length > 3 && <span className="text-[9px] text-gray-400 px-1">+{data.services.length - 3}</span>}
                      </div>
                    )}
                  </div>
                </Link>); })}
            </div>
          )}
        </div>
      )}

      {/* ── SCHEDULE TAB ── */}
      {tab === "schedule" && (
        <div className="rounded-2xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02] overflow-hidden">
          {/* Vehicle filter bar */}
          <div className="flex flex-wrap items-center gap-4 px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/20">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                <Car className="w-4 h-4 text-brand-500" />
                <select value={calVehicleId} onChange={(e) => setCalVehicleId(e.target.value)}
                  className="text-sm font-medium text-gray-900 bg-transparent focus:outline-none dark:text-white min-w-[220px] cursor-pointer">
                  <option value="">All Vehicles</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>{v.registrationNumber} — {v.make} {v.model}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-4 ml-auto">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" />
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Completed</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-yellow-400 ring-2 ring-yellow-400/20" />
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Upcoming</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-red-500 ring-2 ring-red-500/20" />
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Overdue</span>
              </div>
            </div>
          </div>

          <style>{`
            .svc-cal .fc { font-size: 13px; font-family: inherit; }
            .svc-cal .fc-toolbar { padding: 20px 24px 12px; }
            .svc-cal .fc-toolbar-title { font-size: 22px !important; font-weight: 800; letter-spacing: -0.025em; color: #111827; }
            .dark .svc-cal .fc-toolbar-title { color: #f9fafb; }
            .svc-cal .fc-button { font-size: 12px !important; padding: 8px 16px !important; border-radius: 10px !important; font-weight: 600 !important; border: 1px solid #e5e7eb !important; background: #fff !important; color: #374151 !important; box-shadow: 0 1px 2px rgba(0,0,0,0.04) !important; transition: all 0.15s !important; }
            .dark .svc-cal .fc-button { border-color: #374151 !important; background: #1f2937 !important; color: #d1d5db !important; }
            .svc-cal .fc-button:hover { background: #f9fafb !important; border-color: #d1d5db !important; }
            .dark .svc-cal .fc-button:hover { background: #374151 !important; }
            .svc-cal .fc-button-active { background: linear-gradient(135deg, #6366f1, #8b5cf6) !important; color: #fff !important; border-color: #6366f1 !important; box-shadow: 0 2px 8px rgba(99,102,241,0.3) !important; }
            .svc-cal .fc-prev-button, .svc-cal .fc-next-button { padding: 8px 10px !important; }
            .svc-cal .fc-col-header-cell { padding: 12px 0; font-weight: 700; text-transform: uppercase; font-size: 11px; letter-spacing: 0.08em; color: #6b7280; background: #f9fafb; border-color: #f3f4f6; }
            .dark .svc-cal .fc-col-header-cell { background: rgba(31,41,55,0.5); color: #9ca3af; border-color: #1f2937; }
            .svc-cal .fc-daygrid-day { min-height: 110px; transition: all 0.15s; cursor: pointer; border-color: #f3f4f6; }
            .dark .svc-cal .fc-daygrid-day { border-color: #1f2937; }
            .svc-cal .fc-daygrid-day:hover { background: rgba(99,102,241,0.04); }
            .svc-cal .fc-daygrid-day.fc-day-today { background: rgba(99,102,241,0.06) !important; }
            .svc-cal .fc-daygrid-day.fc-day-today .fc-daygrid-day-number { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; border-radius: 8px; padding: 2px 8px; font-weight: 700; }
            .svc-cal .fc-daygrid-day-number { font-size: 14px; font-weight: 600; padding: 8px 10px; color: #374151; }
            .dark .svc-cal .fc-daygrid-day-number { color: #d1d5db; }
            .svc-cal .fc-daygrid-day.fc-day-other .fc-daygrid-day-number { color: #d1d5db; }
            .dark .svc-cal .fc-daygrid-day.fc-day-other .fc-daygrid-day-number { color: #4b5563; }
            .svc-cal .fc-event { cursor: pointer; border-radius: 8px; padding: 3px 8px; font-size: 11px; font-weight: 600; border-left: 3px solid; margin-bottom: 3px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); transition: transform 0.1s, box-shadow 0.1s; }
            .svc-cal .fc-event:hover { transform: translateY(-1px); box-shadow: 0 3px 8px rgba(0,0,0,0.12); }
            .svc-cal .fc-scrollgrid { border-radius: 0 0 16px 16px; overflow: hidden; border-color: #f3f4f6; }
            .dark .svc-cal .fc-scrollgrid { border-color: #1f2937; }
            .svc-cal .fc-day-past-disabled { opacity: 0.45; cursor: not-allowed !important; background: repeating-linear-gradient(135deg, transparent, transparent 4px, rgba(0,0,0,0.02) 4px, rgba(0,0,0,0.02) 8px); }
            .dark .svc-cal .fc-day-past-disabled { background: repeating-linear-gradient(135deg, transparent, transparent 4px, rgba(255,255,255,0.02) 4px, rgba(255,255,255,0.02) 8px); }
            .svc-cal .fc-day-has-completed { background: #d1fae5 !important; }
            .svc-cal .fc-day-has-completed .fc-daygrid-day-number { color: #059669; font-weight: 800; }
            .svc-cal .fc-day-has-overdue { background: #fee2e2 !important; }
            .svc-cal .fc-day-has-overdue .fc-daygrid-day-number { color: #dc2626; font-weight: 800; }
            .svc-cal .fc-day-has-upcoming { background: #fef9c3 !important; }
            .svc-cal .fc-day-has-upcoming .fc-daygrid-day-number { color: #ca8a04; font-weight: 800; }
            .svc-cal .fc-event .fc-event-time { display: none; }
            .svc-cal .fc-event .fc-event-title { white-space: normal; word-break: break-word; }
            .svc-cal .fc-event { position: relative; }
            .svc-cal .fc-event .svc-tooltip { display: none; position: absolute; bottom: calc(100% + 6px); left: 50%; transform: translateX(-50%); background: #1f2937; color: #fff; padding: 6px 10px; border-radius: 8px; font-size: 11px; white-space: nowrap; z-index: 9999; box-shadow: 0 4px 12px rgba(0,0,0,0.2); pointer-events: none; }
            .svc-cal .fc-event .svc-tooltip::after { content: ''; position: absolute; top: 100%; left: 50%; transform: translateX(-50%); border: 5px solid transparent; border-top-color: #1f2937; }
            .svc-cal .fc-event:hover .svc-tooltip { display: block; }
          `}</style>
          <div className="svc-cal">
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              headerToolbar={{ left: "prev,next today", center: "title", right: "" }}
              height="auto"
              fixedWeekCount={false}
              dayMaxEvents={3}
              displayEventTime={false}
              dateClick={(info) => {
                const clickedDate = new Date(info.dateStr);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (clickedDate < today) {
                  toast.warning("Past Date", "Cannot schedule services for past dates");
                  return;
                }
                openAddService(info.dateStr, "UPCOMING");
              }}
              eventDidMount={(info) => {
                const time = info.event.extendedProps.time;
                const dateStr = info.event.extendedProps.serviceDate;
                const date = dateStr ? new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";
                const tooltipText = [date, time].filter(Boolean).join(" • ");
                if (tooltipText) {
                  const tooltip = document.createElement("span");
                  tooltip.className = "svc-tooltip";
                  tooltip.textContent = tooltipText;
                  info.el.appendChild(tooltip);
                }
              }}
              eventClick={(info) => {
                const svc = services.find((s) => s.id === info.event.id);
                if (svc) {
                  window.location.href = `/vehicles/services/${svc.vehicleId}`;
                }
              }}
              dayCellClassNames={(arg) => {
                const classes: string[] = [];
                const dateStr = arg.date.toLocaleDateString("en-CA");
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (arg.date < today) {
                  classes.push("fc-day-past-disabled");
                }
                const status = dayStatusMap.get(dateStr);
                if (status === "COMPLETED") classes.push("fc-day-has-completed");
                else if (status === "OVERDUE") classes.push("fc-day-has-overdue");
                else if (status === "UPCOMING") classes.push("fc-day-has-upcoming");
                return classes;
              }}
              events={calendarEvents}
            />
          </div>
          <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/30 dark:bg-gray-800/10 flex items-center justify-between">
            <p className="text-xs text-gray-400">Click a date to schedule a service &middot; Click an event to view details</p>
            <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Past dates are disabled for scheduling</p>
          </div>
        </div>
      )}

      {/* ── ADD SERVICE MODAL ── */}
      {hoverPhoto && (
        <div className="fixed z-[99999] pointer-events-none" style={{ left: hoverPhoto.x, top: hoverPhoto.y, transform: "translateY(-50%)" }}>
          <img src={hoverPhoto.url} alt="" className="w-48 h-32 object-cover rounded-xl shadow-2xl border-2 border-white dark:border-gray-700" />
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden max-h-[90vh] flex flex-col">
            <div className={`px-6 py-5 flex-shrink-0 ${svcForm.status === "UPCOMING" ? "bg-gradient-to-r from-yellow-500 to-yellow-400" : "bg-gradient-to-r from-brand-500 to-brand-400"}`}>
              <h3 className="text-lg font-bold text-white">{svcForm.status === "UPCOMING" ? "Schedule Service" : "Log Service"}</h3>
              <p className="text-white/60 text-sm mt-0.5">{svcForm.status === "UPCOMING" ? "Plan an upcoming service with expected parts" : "Record a completed service with details"}</p>
            </div>
            <div className="p-6 space-y-5 overflow-y-auto">
              {/* Vehicle selector */}
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Vehicle *</label>
                <select value={selectedVehicleId} onChange={(e) => setSelectedVehicleId(e.target.value)}
                  className="w-full h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:border-brand-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white">
                  <option value="">Select a vehicle</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>{v.registrationNumber} — {v.make} {v.model}</option>
                  ))}
                </select>
              </div>

              {/* Title + Status */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Service Title *</label>
                  <input type="text" placeholder="e.g. Full Service, Oil Change" value={svcForm.title} onChange={(e) => setSvcForm({ ...svcForm, title: e.target.value })}
                    className="w-full h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Status</label>
                  <select value={svcForm.status} onChange={(e) => setSvcForm({ ...svcForm, status: e.target.value })}
                    className="w-full h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:border-brand-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white">
                    <option value="COMPLETED">Completed</option>
                    <option value="UPCOMING">Upcoming</option>
                  </select>
                </div>
              </div>

              {/* Date + Odometer */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">{svcForm.status === "UPCOMING" ? "Scheduled Date *" : "Service Date *"}</label>
                  <input type="date" value={svcForm.serviceDate} onChange={(e) => {
                    const val = e.target.value;
                    setSvcForm((prev) => ({ ...prev, serviceDate: val, ...(prev.status === "UPCOMING" ? { nextDueDate: val } : {}) }));
                  }}
                    className="w-full h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:border-brand-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Odometer (km)</label>
                  <input type="number" placeholder="e.g. 45000" value={svcForm.odometerKm} onChange={(e) => setSvcForm({ ...svcForm, odometerKm: e.target.value })}
                    className="w-full h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                </div>
              </div>

              {/* Parts */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{svcForm.status === "UPCOMING" ? "Parts to be Changed" : "Parts Changed"}</label>
                  <button type="button" onClick={() => setSvcParts([...svcParts, { name: "", quantity: "1", unitCost: "" }])}
                    className="text-[10px] font-semibold text-brand-500 hover:text-brand-600 flex items-center gap-0.5">
                    <Plus className="w-3 h-3" />
                    Add Part
                  </button>
                </div>
                <div className="space-y-2">
                  {svcParts.map((part, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input type="text" placeholder="Part name" value={part.name} onChange={(e) => { const n = [...svcParts]; n[idx] = { ...n[idx], name: e.target.value }; setSvcParts(n); }}
                        className="flex-1 h-9 rounded-lg border border-gray-200 bg-gray-50 px-3 text-xs text-gray-900 placeholder:text-gray-400 focus:border-brand-400 focus:bg-white focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                      <input type="number" placeholder="Qty" value={part.quantity} onChange={(e) => { const n = [...svcParts]; n[idx] = { ...n[idx], quantity: e.target.value }; setSvcParts(n); }}
                        className="w-16 h-9 rounded-lg border border-gray-200 bg-gray-50 px-2 text-xs text-center text-gray-900 placeholder:text-gray-400 focus:border-brand-400 focus:bg-white focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">&#8377;</span>
                        <input type="number" placeholder="Cost" value={part.unitCost} onChange={(e) => { const n = [...svcParts]; n[idx] = { ...n[idx], unitCost: e.target.value }; setSvcParts(n); }}
                          className="w-24 h-9 rounded-lg border border-gray-200 bg-gray-50 pl-6 pr-2 text-xs text-gray-900 placeholder:text-gray-400 focus:border-brand-400 focus:bg-white focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                      </div>
                      {svcParts.length > 1 && (
                        <button type="button" onClick={() => setSvcParts(svcParts.filter((_, i) => i !== idx))}
                          className="w-8 h-9 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center justify-center transition-colors">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Total + Next Due */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Total Cost (&#8377;)</label>
                  <input type="number" placeholder="Auto from parts" value={svcForm.totalCost} onChange={(e) => setSvcForm({ ...svcForm, totalCost: e.target.value })}
                    className="w-full h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Next Due Date</label>
                  <input type="date" value={svcForm.nextDueDate} onChange={(e) => setSvcForm({ ...svcForm, nextDueDate: e.target.value })}
                    className="w-full h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:border-brand-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                </div>
              </div>

              {/* Receipt upload */}
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Receipts</label>
                {svcReceipts.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {svcReceipts.map((f, i) => (
                      <span key={i} className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-yellow-50 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400">
                        {f.name} <button type="button" onClick={() => setSvcReceipts(svcReceipts.filter((_, j) => j !== i))} className="text-red-400">&times;</button>
                      </span>
                    ))}
                  </div>
                )}
                <label className="flex items-center gap-2 p-3 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-brand-400 cursor-pointer transition-colors group">
                  <Upload className="w-4 h-4 text-gray-300 group-hover:text-brand-500" />
                  <span className="text-xs text-gray-400 group-hover:text-brand-600">Upload receipts</span>
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" multiple className="hidden" onChange={(e) => { setSvcReceipts([...svcReceipts, ...Array.from(e.target.files || [])]); e.target.value = ""; }} />
                </label>
              </div>

              {/* Description */}
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Notes</label>
                <textarea rows={2} placeholder="Optional notes..." value={svcForm.description} onChange={(e) => setSvcForm({ ...svcForm, description: e.target.value })}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white resize-none" />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button onClick={handleSaveService} disabled={savingService || !svcForm.title || !svcForm.serviceDate || !selectedVehicleId}
                  className="flex-1 h-11 rounded-xl bg-gradient-to-r from-brand-500 to-brand-400 text-white font-semibold text-sm shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {savingService ? "Saving..." : svcForm.status === "UPCOMING" ? "Schedule Service" : "Log Service"}
                </button>
                <button onClick={() => setShowModal(false)} className="h-11 px-6 rounded-xl border-2 border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 transition-all">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
