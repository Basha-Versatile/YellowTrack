"use client";
import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { vehicleAPI } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import Link from "next/link";
import Badge from "@/components/ui/badge/Badge";
import { ServiceDetailSkeleton } from "@/components/ui/Skeleton";
import { ChevronLeft, Car, ChevronRight, AlertTriangle, Wrench, ChevronDown, ImageIcon, Clock, FileText, Trash2, CheckCircle2, Banknote, Search } from "lucide-react";
import { getVehicleTypeIcon } from "@/components/icons/VehicleTypeIcons";

interface ServicePart { name: string; quantity: number; unitCost: number; proofUrl?: string | null; }
interface ServiceRecord {
  id: string; title: string; description: string | null; serviceDate: string; odometerKm: number | null;
  totalCost: number; receiptUrls: string[]; parts: ServicePart[]; nextDueDate: string | null;
  nextDueKm: number | null; status: string;
}
interface Vehicle {
  id: string; registrationNumber: string; make: string; model: string; profileImage: string | null;
  group?: { name: string; icon: string; color?: string } | null;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") || "http://localhost:5001";

export default function VehicleServiceDetailPage() {
  const params = useParams();
  const toast = useToast();
  const vehicleId = params.id as string;
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | "COMPLETED" | "UPCOMING" | "OVERDUE">("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [titleSearch, setTitleSearch] = useState("");
  const [hoverPhoto, setHoverPhoto] = useState<{ url: string; x: number; y: number } | null>(null);

  const fetchData = async () => {
    try {
      const [vRes, sRes] = await Promise.all([vehicleAPI.getById(vehicleId), vehicleAPI.getServices(vehicleId)]);
      setVehicle(vRes.data.data);
      setServices(sRes.data.data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [vehicleId]);

  const handleDelete = async (serviceId: string) => {
    try {
      await vehicleAPI.deleteService(vehicleId, serviceId);
      setServices((prev) => prev.filter((s) => s.id !== serviceId));
      toast.success("Deleted", "Service record removed");
    } catch { toast.error("Error", "Failed to delete"); }
  };

  const filteredServices = services.filter((svc) => {
    if (titleSearch && !svc.title.toLowerCase().includes(titleSearch.toLowerCase())) return false;
    if (filter === "ALL") return true;
    if (filter === "COMPLETED") return svc.status === "COMPLETED";
    if (filter === "UPCOMING") return svc.status === "UPCOMING" && (!svc.nextDueDate || new Date(svc.nextDueDate) >= new Date());
    if (filter === "OVERDUE") return svc.status === "UPCOMING" && svc.nextDueDate && new Date(svc.nextDueDate) < new Date();
    return true;
  });

  const overdueCount = services.filter((s) => s.status === "UPCOMING" && s.nextDueDate && new Date(s.nextDueDate) < new Date()).length;
  const upcomingCount = services.filter((s) => s.status === "UPCOMING" && (!s.nextDueDate || new Date(s.nextDueDate) >= new Date())).length;
  const completedCount = services.filter((s) => s.status === "COMPLETED").length;
  const totalSpent = services.filter((s) => s.status === "COMPLETED").reduce((sum, s) => sum + s.totalCost, 0);

  if (loading) return <ServiceDetailSkeleton />;
  if (!vehicle) return <div className="text-center py-20"><p className="text-gray-500">Vehicle not found</p></div>;

  const GroupIcon = vehicle.group?.icon ? getVehicleTypeIcon(vehicle.group.icon) : Car;

  return (
    <div className="space-y-6">
      {/* Header — hero style */}
      <div className="rounded-2xl bg-gradient-to-r from-gray-900 via-gray-800 to-gray-950 p-6 relative overflow-hidden">
        <div className="absolute top-4 right-6 w-32 h-32 rounded-full border border-white/5" />
        <div className="absolute -bottom-8 right-20 w-40 h-40 rounded-full border border-white/3" />
        <div className="relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link href="/vehicles/services" className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-white/50 hover:bg-white/10 hover:text-white transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </Link>
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden border-2 border-white/10 ${vehicle.profileImage ? "cursor-pointer" : ""}`}
                style={!vehicle.profileImage && vehicle.group?.color ? { backgroundColor: `${vehicle.group.color}25` } : { backgroundColor: "rgba(255,255,255,0.1)" }}
                onMouseEnter={(e) => { if (vehicle.profileImage) { const r = e.currentTarget.getBoundingClientRect(); setHoverPhoto({ url: `${API_URL}${vehicle.profileImage}`, x: r.right + 12, y: r.top + r.height / 2 }); } }}
                onMouseLeave={() => setHoverPhoto(null)}>
                {vehicle.profileImage ? (
                  <img src={`${API_URL}${vehicle.profileImage}`} alt="" className="w-full h-full object-cover" />
                ) : (
                  <GroupIcon className="w-6 h-6" style={vehicle.group?.color ? { color: vehicle.group.color } : { color: "rgba(255,255,255,0.5)" }} />
                )}
              </div>
              <div>
                <h1 className="text-xl font-bold text-white font-mono tracking-wide">{vehicle.registrationNumber}</h1>
                <p className="text-sm text-white/40">{vehicle.make} {vehicle.model} — Service History</p>
              </div>
            </div>
            <Link href={`/vehicles/${vehicleId}`} className="text-xs font-medium text-white/50 hover:text-white flex items-center gap-1 transition-colors">
              View Vehicle Details <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* Stats — colored cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02] p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-400 to-brand-500" />
          <div className="flex items-center gap-2 mb-2"><Wrench className="w-4 h-4 text-brand-500" /><span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Total</span></div>
          <p className="text-2xl font-black text-gray-900 dark:text-white">{services.length}</p>
        </div>
        <div className="rounded-xl border border-emerald-200/60 bg-emerald-50/50 dark:border-emerald-500/20 dark:bg-emerald-500/5 p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 to-emerald-500" />
          <div className="flex items-center gap-2 mb-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /><span className="text-[10px] text-emerald-600/60 font-semibold uppercase tracking-wider">Completed</span></div>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{completedCount}</p>
        </div>
        <div className="rounded-xl border border-yellow-200/60 bg-yellow-50/50 dark:border-yellow-500/20 dark:bg-yellow-500/5 p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-400 to-yellow-500" />
          <div className="flex items-center gap-2 mb-2"><Clock className="w-4 h-4 text-yellow-500" /><span className="text-[10px] text-yellow-600/60 font-semibold uppercase tracking-wider">Upcoming</span></div>
          <p className="text-2xl font-black text-yellow-600 dark:text-yellow-400">{upcomingCount}</p>
        </div>
        <div className="rounded-xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02] p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-gray-300 to-gray-400" />
          <div className="flex items-center gap-2 mb-2"><Banknote className="w-4 h-4 text-gray-500" /><span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Spent</span></div>
          <p className="text-2xl font-black text-gray-900 dark:text-white">&#8377;{totalSpent.toLocaleString("en-IN")}</p>
        </div>
      </div>

      {/* Overdue alert */}
      {overdueCount > 0 && (
        <div className="flex items-center gap-3 px-5 py-4 rounded-xl bg-gradient-to-r from-red-50 to-red-50/50 border border-red-200 dark:from-red-500/10 dark:to-transparent dark:border-red-500/20">
          <div className="w-9 h-9 rounded-lg bg-red-100 dark:bg-red-500/20 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-red-700 dark:text-red-400">{overdueCount} service{overdueCount > 1 ? "s" : ""} overdue</p>
            <p className="text-[11px] text-red-500/70">Immediate attention required</p>
          </div>
        </div>
      )}

      {/* Filter tabs + search */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800/50 rounded-xl">
          {([
            { key: "ALL" as const, label: "All", count: services.length },
            { key: "COMPLETED" as const, label: "Completed", count: completedCount },
            { key: "UPCOMING" as const, label: "Upcoming", count: upcomingCount },
            { key: "OVERDUE" as const, label: "Overdue", count: overdueCount },
          ]).map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${filter === f.key ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white" : "text-gray-500 hover:text-gray-700 dark:text-gray-400"}`}>
              {f.label} <span className="text-gray-400">({f.count})</span>
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input type="text" placeholder="Search service title..." value={titleSearch} onChange={(e) => setTitleSearch(e.target.value)}
            className="h-9 w-52 rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-xs text-gray-900 placeholder:text-gray-400 focus:border-brand-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
        </div>
      </div>

      {/* Service list */}
      {filteredServices.length === 0 ? (
        <div className="rounded-2xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02] p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-3">
            <Wrench className="w-7 h-7 text-gray-300 dark:text-gray-600" />
          </div>
          <p className="text-sm font-medium text-gray-500">No {filter === "ALL" ? "" : filter.toLowerCase()} services found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredServices.map((svc) => {
            const isOverdue = svc.status === "UPCOMING" && svc.nextDueDate && new Date(svc.nextDueDate) < new Date();
            const isExpanded = expandedId === svc.id;
            const statusGradient = isOverdue ? "from-red-500 to-rose-600" : svc.status === "UPCOMING" ? "from-yellow-400 to-yellow-500" : "from-emerald-500 to-green-600";
            const statusBg = isOverdue ? "bg-red-100 dark:bg-red-500/20" : svc.status === "UPCOMING" ? "bg-yellow-100 dark:bg-yellow-500/20" : "bg-emerald-100 dark:bg-emerald-500/20";
            const statusIcon = isOverdue ? "text-red-600 dark:text-red-400" : svc.status === "UPCOMING" ? "text-yellow-600 dark:text-yellow-400" : "text-emerald-600 dark:text-emerald-400";
            return (
              <div key={svc.id} className={`rounded-2xl border bg-white dark:bg-white/[0.02] overflow-hidden transition-all ${isOverdue ? "border-red-200 dark:border-red-500/20" : isExpanded ? "border-brand-200 dark:border-brand-500/30 shadow-lg" : "border-gray-200/80 dark:border-gray-800 hover:shadow-md"}`}>
                {/* Accent bar */}
                <div className={`h-1 bg-gradient-to-r ${statusGradient}`} />
                {/* Main row */}
                <button onClick={() => setExpandedId(isExpanded ? null : svc.id)}
                  className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${statusBg}`}>
                      <Wrench className={`w-5 h-5 ${statusIcon}`} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white">{svc.title}</h3>
                        <Badge color={isOverdue ? "error" : svc.status === "UPCOMING" ? "warning" : "success"} variant="light" size="sm">
                          {isOverdue ? "OVERDUE" : svc.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-500">
                        <span>{new Date(svc.serviceDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                        {svc.odometerKm && <span className="flex items-center gap-0.5">{svc.odometerKm.toLocaleString()} km</span>}
                        {svc.parts.length > 0 && <span>{svc.parts.length} part{svc.parts.length > 1 ? "s" : ""}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0 ml-3">
                    <p className="text-base font-black text-gray-900 dark:text-white">&#8377;{svc.totalCost.toLocaleString("en-IN")}</p>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`} />
                  </div>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-5 pb-5 border-t border-gray-100 dark:border-gray-800 pt-4 space-y-4 bg-gray-50/30 dark:bg-gray-800/10">
                    {/* Parts table */}
                    {svc.parts.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Parts {svc.status === "UPCOMING" ? "Planned" : "Changed"}</p>
                        <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-white/[0.02]">
                          <table className="w-full text-xs">
                            <thead className="bg-gray-50 dark:bg-gray-800/50">
                              <tr>
                                <th className="text-left px-4 py-2.5 font-bold text-[10px] text-gray-500 uppercase tracking-wider">Part</th>
                                <th className="text-center px-3 py-2.5 font-bold text-[10px] text-gray-500 uppercase tracking-wider">Qty</th>
                                <th className="text-right px-3 py-2.5 font-bold text-[10px] text-gray-500 uppercase tracking-wider">Unit Cost</th>
                                <th className="text-right px-3 py-2.5 font-bold text-[10px] text-gray-500 uppercase tracking-wider">Total</th>
                                <th className="text-center px-3 py-2.5 font-bold text-[10px] text-gray-500 uppercase tracking-wider">Proof</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                              {svc.parts.map((p, i) => (
                                <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/20">
                                  <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-white">{p.name}</td>
                                  <td className="px-3 py-2.5 text-center text-gray-600 dark:text-gray-400">{p.quantity}</td>
                                  <td className="px-3 py-2.5 text-right text-gray-600 dark:text-gray-400">&#8377;{p.unitCost.toLocaleString("en-IN")}</td>
                                  <td className="px-3 py-2.5 text-right font-bold text-gray-900 dark:text-white">&#8377;{(p.unitCost * p.quantity).toLocaleString("en-IN")}</td>
                                  <td className="px-3 py-2.5 text-center">
                                    {p.proofUrl ? (
                                      <a href={`${API_URL}${p.proofUrl}`} target="_blank" rel="noreferrer" className="inline-flex w-7 h-7 rounded-lg bg-brand-50 dark:bg-brand-500/10 items-center justify-center text-brand-500 hover:text-brand-600 mx-auto">
                                        <ImageIcon className="w-3.5 h-3.5" />
                                      </a>
                                    ) : <span className="text-gray-300">—</span>}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Next due */}
                    {(svc.nextDueDate || svc.nextDueKm) && (
                      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl ${isOverdue ? "bg-red-50 dark:bg-red-500/5 border border-red-100 dark:border-red-500/10" : "bg-yellow-50 dark:bg-yellow-500/5 border border-yellow-100 dark:border-yellow-500/10"}`}>
                        <Clock className={`w-4 h-4 flex-shrink-0 ${isOverdue ? "text-red-500" : "text-yellow-500"}`} />
                        <div className="text-xs">
                          {svc.nextDueDate && <span className={`font-semibold ${isOverdue ? "text-red-700 dark:text-red-400" : "text-yellow-700 dark:text-yellow-400"}`}>Next due: {new Date(svc.nextDueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>}
                          {svc.nextDueKm && <span className="text-gray-500 ml-3">at {svc.nextDueKm.toLocaleString()} km</span>}
                        </div>
                      </div>
                    )}

                    {/* Receipts */}
                    {svc.receiptUrls.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Receipts</p>
                        <div className="flex flex-wrap gap-2">
                          {svc.receiptUrls.map((url, i) => (
                            <a key={i} href={`${API_URL}${url}`} target="_blank" rel="noreferrer"
                              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-700 dark:text-gray-300 hover:border-brand-300 hover:text-brand-600 dark:hover:border-brand-500/30 transition-all shadow-sm">
                              <FileText className="w-3.5 h-3.5" />
                              Receipt {i + 1}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Description */}
                    {svc.description && (
                      <div className="px-4 py-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Notes</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">{svc.description}</p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-3">
                      <Link href={`/vehicles/${vehicleId}`} className="text-xs font-medium text-brand-500 hover:text-brand-600 flex items-center gap-1 transition-colors">
                        Edit on vehicle page <ChevronRight className="w-3 h-3" />
                      </Link>
                      <button onClick={() => handleDelete(svc.id)} className="text-xs font-medium text-red-500 hover:text-red-600 flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                        <Trash2 className="w-3 h-3" />
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Hover photo preview */}
      {hoverPhoto && (
        <div className="fixed z-[99999] pointer-events-none" style={{ left: hoverPhoto.x, top: hoverPhoto.y, transform: "translateY(-50%)" }}>
          <img src={hoverPhoto.url} alt="" className="w-44 h-44 rounded-2xl object-cover shadow-2xl ring-4 ring-white dark:ring-gray-900" />
        </div>
      )}
    </div>
  );
}
