"use client";
import React, { useEffect, useState } from "react";
import { vehicleGroupAPI } from "@/lib/api";
import { getVehicleTypeIcon, VEHICLE_TYPE_ICONS } from "@/components/icons/VehicleTypeIcons";
import { useToast } from "@/context/ToastContext";
import { VehicleGroupsSkeleton } from "@/components/ui/Skeleton";
import Link from "next/link";
import { ChevronLeft, Plus, Pencil, Trash2, LayoutGrid, List } from "lucide-react";
import { SearchInput } from "@/components/ui/SearchInput";

interface VehicleGroup {
  id: string;
  name: string;
  icon: string;
  color?: string;
  order: number;
  _count: { vehicles: number };
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

  const fetchGroups = async () => {
    try { setGroups((await vehicleGroupAPI.getAll()).data.data); }
    catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchGroups(); }, []);

  const openCreate = () => {
    setEditingGroup(null);
    setFormName("");
    setFormIcon("truck");
    setFormColor("#6366f1");
    setShowModal(true);
  };

  const openEdit = (g: VehicleGroup) => {
    setEditingGroup(g);
    setFormName(g.name);
    setFormIcon(g.icon);
    setFormColor(g.color || "#6366f1");
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    setSaving(true);
    try {
      if (editingGroup) {
        await vehicleGroupAPI.update(editingGroup.id, { name: formName.trim(), icon: formIcon, color: formColor });
        toast.success("Group Updated", `${formName} updated`);
      } else {
        await vehicleGroupAPI.create({ name: formName.trim(), icon: formIcon, color: formColor, order: groups.length + 1 });
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
          <SearchInput
            className="w-44"
            size="sm"
            value={search}
            onChange={setSearch}
            placeholder="Search groups..."
          />
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
            {filteredGroups.map((g) => { const Icon = getVehicleTypeIcon(g.icon); return (
              <div key={g.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${g.color || "#6366f1"}12` }}>
                  <Icon className="w-5 h-5" style={{ color: g.color || "#6366f1" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">{g.name}</h3>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-gray-500">{g._count.vehicles} vehicle{g._count.vehicles !== 1 ? "s" : ""}</span>
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
          {groups.map((g) => { const Icon = getVehicleTypeIcon(g.icon); return (
            <div key={g.id} className="rounded-2xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02] p-5 hover:shadow-lg transition-all">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${g.color || "#6366f1"}15` }}>
                    <Icon className="w-6 h-6" style={{ color: g.color || "#6366f1" }} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">{g.name}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{g._count.vehicles} vehicle{g._count.vehicles !== 1 ? "s" : ""}</p>
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
            {/* Header */}
            <div className="bg-gradient-to-r from-brand-500 to-brand-400 px-6 py-4 flex-shrink-0">
              <h3 className="text-lg font-bold text-white">{editingGroup ? "Edit Group" : "Create Group"}</h3>
              <p className="text-xs text-white/70 mt-1">Documents are now defined per vehicle on each vehicle&apos;s detail page.</p>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto">
              {true && (
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
                    <button onClick={handleSave} disabled={saving || !formName.trim()}
                      className="flex-1 h-11 rounded-xl bg-gradient-to-r from-brand-500 to-brand-400 text-white font-semibold text-sm shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                      {saving ? "Saving..." : editingGroup ? "Update Group" : "Create Group"}
                    </button>
                    <button onClick={() => setShowModal(false)} className="h-11 px-6 rounded-xl border-2 border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 transition-all">Cancel</button>
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
