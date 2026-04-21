"use client";
import React, { useEffect, useState } from "react";
import { vehicleGroupAPI, documentTypeAPI } from "@/lib/api";
import { getVehicleTypeIcon, VEHICLE_TYPE_ICONS } from "@/components/icons/VehicleTypeIcons";
import { useToast } from "@/context/ToastContext";
import { VehicleGroupsSkeleton } from "@/components/ui/Skeleton";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ChevronDown, Plus, FileText, Pencil, Trash2, Check, LayoutGrid, List, Search } from "lucide-react";

interface DocumentType {
  id: string;
  code: string;
  name: string;
  description?: string;
  hasExpiry: boolean;
  isSystem: boolean;
}

interface GroupDocType {
  documentType: DocumentType;
}

interface VehicleGroup {
  id: string;
  tyreCount?: number;
  name: string;
  icon: string;
  color?: string;
  order: number;
  _count: { vehicles: number };
  requiredDocTypes?: GroupDocType[];
}

const COLORS = ["#6366f1", "#3b82f6", "#10b981", "#f59e0b", "#f97316", "#ec4899", "#8b5cf6", "#6b7280", "#ef4444", "#14b8a6"];

export default function VehicleGroupsPage() {
  const toast = useToast();
  const [groups, setGroups] = useState<VehicleGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<VehicleGroup | null>(null);
  const [formName, setFormName] = useState("");
  const [formIcon, setFormIcon] = useState("truck");
  const [formColor, setFormColor] = useState("#6366f1");
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<"list" | "grid">("list");
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [formTyreCount, setFormTyreCount] = useState(4);
  const [modalStep, setModalStep] = useState(1);

  // Document type state
  const [allDocTypes, setAllDocTypes] = useState<DocumentType[]>([]);
  const [selectedDocTypeIds, setSelectedDocTypeIds] = useState<string[]>([]);
  const [showOthers, setShowOthers] = useState(false);
  const [newDocName, setNewDocName] = useState("");
  const [newDocCode, setNewDocCode] = useState("");
  const [creatingDoc, setCreatingDoc] = useState(false);

  const fetchGroups = async () => {
    try { setGroups((await vehicleGroupAPI.getAll()).data.data); }
    catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const fetchDocTypes = async () => {
    try { setAllDocTypes((await documentTypeAPI.getAll()).data.data); }
    catch { /* ignore */ }
  };

  useEffect(() => { fetchGroups(); }, []);

  const openCreate = () => {
    setEditingGroup(null);
    setFormName("");
    setFormIcon("truck");
    setFormColor("#6366f1");
    setFormTyreCount(4);
    setSelectedDocTypeIds([]);
    setShowOthers(false);
    setNewDocName("");
    setNewDocCode("");
    setModalStep(1);
    fetchDocTypes();
    setShowModal(true);
  };

  const openEdit = (g: VehicleGroup) => {
    setEditingGroup(g);
    setFormName(g.name);
    setFormIcon(g.icon);
    setFormColor(g.color || "#6366f1");
    setFormTyreCount(g.tyreCount ?? 4);
    setSelectedDocTypeIds(g.requiredDocTypes?.map((rdt) => rdt.documentType.id) || []);
    setShowOthers(false);
    setNewDocName("");
    setNewDocCode("");
    setModalStep(1);
    fetchDocTypes();
    setShowModal(true);
  };

  const handleCreateCustomDoc = async () => {
    if (!newDocName.trim() || !newDocCode.trim()) return;
    setCreatingDoc(true);
    try {
      const res = await documentTypeAPI.create({ code: newDocCode.trim(), name: newDocName.trim() });
      const created = res.data.data;
      setAllDocTypes((prev) => [...prev, created]);
      setSelectedDocTypeIds((prev) => [...prev, created.id]);
      setNewDocName("");
      setNewDocCode("");
      toast.success("Document Type Created", `${created.name} added`);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error("Error", e.response?.data?.message || "Failed to create");
    } finally { setCreatingDoc(false); }
  };

  const toggleDocType = (id: string) => {
    setSelectedDocTypeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    setSaving(true);
    try {
      if (editingGroup) {
        await vehicleGroupAPI.update(editingGroup.id, { name: formName.trim(), icon: formIcon, color: formColor, tyreCount: formTyreCount, requiredDocTypeIds: selectedDocTypeIds });
        toast.success("Group Updated", `${formName} updated`);
      } else {
        await vehicleGroupAPI.create({ name: formName.trim(), icon: formIcon, color: formColor, tyreCount: formTyreCount, order: groups.length + 1, requiredDocTypeIds: selectedDocTypeIds.length > 0 ? selectedDocTypeIds : undefined });
        toast.success("Group Created", `${formName} created`);
      }
      setShowModal(false);
      await fetchGroups();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error("Error", e.response?.data?.message || "Something went wrong");
    } finally { setSaving(false); }
  };

  const handleDelete = async (g: VehicleGroup) => {
    if (g._count.vehicles > 0) { toast.error("Cannot Delete", `${g.name} has ${g._count.vehicles} vehicle${g._count.vehicles > 1 ? "s" : ""} assigned`); return; }
    setDeleting(g.id);
    try { await vehicleGroupAPI.remove(g.id); toast.success("Deleted", `${g.name} deleted`); await fetchGroups(); }
    catch (err: unknown) { const e = err as { response?: { data?: { message?: string } } }; toast.error("Error", e.response?.data?.message || "Failed"); }
    finally { setDeleting(null); }
  };

  const filteredGroups = groups.filter((g) => !search || g.name.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <VehicleGroupsSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/vehicles" className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800">
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Vehicle Groups</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage vehicle categories and types</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input type="text" placeholder="Search groups..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-44 rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-xs text-gray-900 placeholder:text-gray-400 focus:border-brand-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
          </div>
          <div className="flex gap-0.5 p-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <button onClick={() => setView("list")} className={`p-1.5 rounded-md transition-all ${view === "list" ? "bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white" : "text-gray-400 hover:text-gray-600"}`} title="List view">
              <List className="w-4 h-4" />
            </button>
            <button onClick={() => setView("grid")} className={`p-1.5 rounded-md transition-all ${view === "grid" ? "bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white" : "text-gray-400 hover:text-gray-600"}`} title="Grid view">
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
          <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-brand-400 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 hover:shadow-brand-500/40 transition-all">
            <Plus className="w-4 h-4" />
            Add Group
          </button>
        </div>
      </div>

      {filteredGroups.length === 0 ? (
        <div className="rounded-2xl border border-gray-200/80 bg-white p-12 text-center dark:border-gray-800 dark:bg-white/[0.02]">
          <p className="text-gray-500">{search ? "No groups match your search" : "No vehicle groups yet"}</p>
          {!search && <button onClick={openCreate} className="mt-3 text-sm font-medium text-brand-500 hover:text-brand-600">Create your first group</button>}
        </div>
      ) : view === "list" ? (
        /* List View */
        <div className="rounded-2xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02] overflow-hidden">
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {filteredGroups.map((g) => { const Icon = getVehicleTypeIcon(g.icon); const docCount = g.requiredDocTypes?.length || 0; return (
              <div key={g.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${g.color || "#6366f1"}12` }}>
                  <Icon className="w-5 h-5" style={{ color: g.color || "#6366f1" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">{g.name}</h3>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-gray-500">{g._count.vehicles} vehicle{g._count.vehicles !== 1 ? "s" : ""}</span>
                    <span className="text-[10px] text-gray-400 flex items-center gap-1"><FileText className="w-3 h-3" />{docCount} docs</span>
                    {g.tyreCount && <span className="text-[10px] text-gray-400">{g.tyreCount} tyres</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => openEdit(g)} className="rounded-lg p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(g)} disabled={deleting === g.id} className="rounded-lg p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50">
                    {deleting === g.id
                      ? <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            ); })}
          </div>
        </div>
      ) : (
        /* Grid View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {groups.map((g) => { const Icon = getVehicleTypeIcon(g.icon); const docCount = g.requiredDocTypes?.length || 0; return (
            <div key={g.id} className="rounded-2xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02] p-5 hover:shadow-lg transition-all">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${g.color || "#6366f1"}15` }}>
                    <Icon className="w-6 h-6" style={{ color: g.color || "#6366f1" }} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">{g.name}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{g._count.vehicles} vehicle{g._count.vehicles !== 1 ? "s" : ""}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      {docCount} doc{docCount !== 1 ? "s" : ""} required
                    </p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(g)} className="rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(g)} disabled={deleting === g.id} className="rounded-lg p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50">
                    {deleting === g.id
                      ? <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          ); })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden max-h-[90vh] flex flex-col">
            {/* Header with step indicator */}
            <div className="bg-gradient-to-r from-brand-500 to-brand-400 px-6 py-4 flex-shrink-0">
              <h3 className="text-lg font-bold text-white">{editingGroup ? "Edit Group" : "Create Group"}</h3>
              <div className="flex items-center gap-3 mt-3">
                {[{ n: 1, label: "Basic Info" }, { n: 2, label: "Configuration" }].map((s) => (
                  <div key={s.n} className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${modalStep >= s.n ? "bg-white text-brand-600" : "bg-white/20 text-white/60"}`}>{s.n}</div>
                    <span className={`text-xs font-medium ${modalStep >= s.n ? "text-white" : "text-white/40"}`}>{s.label}</span>
                    {s.n === 1 && <div className={`w-8 h-0.5 rounded ${modalStep >= 2 ? "bg-white" : "bg-white/20"}`} />}
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto">
              {/* ── STEP 1: Basic Info ── */}
              {modalStep === 1 && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Group Name</label>
                    <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g., Trucks, Buses..."
                      className="w-full h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-400 focus:outline-none focus:ring-3 focus:ring-brand-400/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Icon</label>
                    <div className="grid grid-cols-4 gap-2">
                      {VEHICLE_TYPE_ICONS.map((item) => (
                        <button key={item.key} type="button" onClick={() => setFormIcon(item.key)}
                          className={`flex flex-col items-center gap-1.5 rounded-xl border-2 py-3 transition-all ${formIcon === item.key ? "border-brand-400 bg-brand-50 dark:bg-brand-500/10" : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800"}`}>
                          <item.component className="w-6 h-6" style={{ color: formColor }} />
                          <span className="text-[10px] font-semibold text-gray-600 dark:text-gray-400">{item.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Color</label>
                    <div className="flex gap-2 flex-wrap">
                      {COLORS.map((c) => (
                        <button key={c} type="button" onClick={() => setFormColor(c)}
                          className={`w-8 h-8 rounded-lg transition-all ${formColor === c ? "ring-2 ring-offset-2 ring-brand-400 dark:ring-offset-gray-900" : "hover:scale-110"}`}
                          style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button onClick={() => setModalStep(2)} disabled={!formName.trim()}
                      className="flex-1 h-11 rounded-xl bg-gradient-to-r from-brand-500 to-brand-400 text-white font-semibold text-sm shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <button onClick={() => setShowModal(false)} className="h-11 px-6 rounded-xl border-2 border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 transition-all">Cancel</button>
                  </div>
                </>
              )}

              {/* ── STEP 2: Tyre Count + Documents ── */}
              {modalStep === 2 && (
                <>
                  {/* Tyre Count */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Tyre Count</label>
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1.5">
                        {[4, 6, 8, 10].map((n) => (
                          <button key={n} type="button" onClick={() => setFormTyreCount(n)}
                            className={`w-10 h-10 rounded-xl border-2 text-sm font-bold transition-all ${formTyreCount === n ? "border-brand-400 bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:border-brand-500 dark:text-brand-400" : "border-gray-200 bg-white text-gray-500 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"}`}>
                            {n}
                          </button>
                        ))}
                      </div>
                      <span className="text-[10px] text-gray-400">or</span>
                      <input type="number" min={4} max={20} value={formTyreCount} onChange={(e) => setFormTyreCount(Math.max(4, parseInt(e.target.value) || 4))}
                        className="w-16 h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-center font-semibold text-gray-900 focus:border-brand-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1.5">4 = Car/SUV, 6 = LCV, 8 = Mini Truck, 10 = Truck/Bus. + Spare added automatically</p>
                  </div>

                  {/* Required Documents */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                      Required Documents
                      <span className="ml-2 text-gray-400 font-normal normal-case">({selectedDocTypeIds.length} selected)</span>
                    </label>
                    <p className="text-[11px] text-gray-400 mb-3">Click to toggle which documents are collected for this group</p>

                    {allDocTypes.length === 0 ? (
                      <p className="text-xs text-gray-400">Loading document types...</p>
                    ) : (
                      <>
                        <div className="flex flex-wrap gap-2 mb-3">
                          {allDocTypes.filter((dt) => dt.isSystem).map((dt) => {
                            const isSelected = selectedDocTypeIds.includes(dt.id);
                            return (
                              <button key={dt.id} type="button" onClick={() => toggleDocType(dt.id)}
                                className={`relative flex items-center gap-2 rounded-xl border-2 px-3.5 py-2.5 transition-all ${isSelected ? "border-brand-400 bg-brand-50 shadow-sm dark:bg-brand-500/10 dark:border-brand-500" : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600"}`}>
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${isSelected ? "bg-brand-100 dark:bg-brand-500/20" : "bg-gray-100 dark:bg-gray-700"}`}>
                                  <FileText className={`w-4 h-4 transition-colors ${isSelected ? "text-brand-600 dark:text-brand-400" : "text-gray-400"}`} />
                                </div>
                                <div className="text-left">
                                  <p className={`text-xs font-semibold leading-tight ${isSelected ? "text-gray-900 dark:text-white" : "text-gray-600 dark:text-gray-400"}`}>{dt.name}</p>
                                  <p className="text-[9px] font-mono text-gray-400 mt-0.5">{dt.code}</p>
                                </div>
                                {isSelected && (
                                  <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-brand-500 flex items-center justify-center shadow-sm">
                                    <Check className="w-3 h-3 text-white" strokeWidth={3} />
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>

                        {/* Others — custom doc types */}
                        {(() => {
                          const customDocTypes = allDocTypes.filter((dt) => !dt.isSystem);
                          const hasCustomSelected = customDocTypes.some((dt) => selectedDocTypeIds.includes(dt.id));
                          return (
                            <div className={`rounded-xl border-2 transition-all ${showOthers || hasCustomSelected ? "border-gray-200 dark:border-gray-700" : "border-dashed border-gray-200 dark:border-gray-700"}`}>
                              <button type="button" onClick={() => setShowOthers(!showOthers)} className="w-full flex items-center justify-between px-4 py-3 text-left">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                                    <Plus className="w-4 h-4 text-gray-400" />
                                  </div>
                                  <div>
                                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Others (Custom Documents)</p>
                                    <p className="text-[10px] text-gray-400">{customDocTypes.length === 0 ? "Add custom document types" : `${customDocTypes.length} custom type${customDocTypes.length > 1 ? "s" : ""} available`}</p>
                                  </div>
                                </div>
                                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showOthers ? "rotate-180" : ""}`} />
                              </button>
                              {showOthers && (
                                <div className="px-4 pb-4 space-y-3 border-t border-gray-100 dark:border-gray-800 pt-3">
                                  {customDocTypes.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                      {customDocTypes.map((dt) => {
                                        const isSelected = selectedDocTypeIds.includes(dt.id);
                                        return (
                                          <button key={dt.id} type="button" onClick={() => toggleDocType(dt.id)}
                                            className={`relative flex items-center gap-2 rounded-lg border-2 px-3 py-2 transition-all text-xs ${isSelected ? "border-brand-400 bg-brand-50 dark:bg-brand-500/10 dark:border-brand-500" : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800"}`}>
                                            <span className={`font-semibold ${isSelected ? "text-brand-600 dark:text-brand-400" : "text-gray-600 dark:text-gray-400"}`}>{dt.name}</span>
                                            <span className="text-[9px] font-mono text-gray-400">{dt.code}</span>
                                            {isSelected && (
                                              <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-brand-500 flex items-center justify-center">
                                                <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                                              </div>
                                            )}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  )}
                                  <div className="rounded-lg border border-dashed border-gray-200 dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-800/50">
                                    <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Create New Document Type</p>
                                    <div className="flex gap-2">
                                      <input type="text" placeholder="Name (e.g. Route Permit)" value={newDocName} onChange={(e) => setNewDocName(e.target.value)}
                                        className="flex-1 h-9 rounded-lg border border-gray-200 bg-white px-3 text-xs text-gray-900 placeholder:text-gray-400 focus:border-brand-400 focus:outline-none dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
                                      <input type="text" placeholder="Code" value={newDocCode} onChange={(e) => setNewDocCode(e.target.value.toUpperCase())}
                                        className="w-28 h-9 rounded-lg border border-gray-200 bg-white px-3 text-xs font-mono text-gray-900 placeholder:text-gray-400 focus:border-brand-400 focus:outline-none dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
                                      <button type="button" onClick={handleCreateCustomDoc} disabled={creatingDoc || !newDocName.trim() || !newDocCode.trim()}
                                        className="h-9 px-3 rounded-lg bg-brand-500 text-white text-xs font-semibold hover:bg-brand-600 transition-colors disabled:opacity-50 flex items-center gap-1 flex-shrink-0">
                                        {creatingDoc ? <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                                        : <Plus className="w-3 h-3" />}
                                        Add
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </>
                    )}
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button onClick={() => setModalStep(1)}
                      className="h-11 px-5 rounded-xl border-2 border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 transition-all flex items-center gap-1.5">
                      <ChevronLeft className="w-4 h-4" />
                      Back
                    </button>
                    <button onClick={handleSave} disabled={saving || !formName.trim()}
                      className="flex-1 h-11 rounded-xl bg-gradient-to-r from-brand-500 to-brand-400 text-white font-semibold text-sm shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                      {saving ? "Saving..." : editingGroup ? "Update Group" : "Create Group"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
