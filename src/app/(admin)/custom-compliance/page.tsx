"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  FolderArchive,
  Plus,
  Search,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Building2,
  X,
  Pencil,
  Trash2,
  Lock,
} from "lucide-react";
import { customComplianceAPI } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

type Group = {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  _count: {
    documents: number;
    green: number;
    yellow: number;
    orange: number;
    red: number;
  };
  createdAt?: string;
  lock?: { enabled: boolean; recoveryEmail: string | null; setAt: string | null } | null;
};

type GroupFormState = {
  id: string | null;
  name: string;
  description: string;
};

export default function CustomCompliancePage() {
  const toast = useToast();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<GroupFormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Group | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await customComplianceAPI.listGroups();
      setGroups((res.data?.data ?? []) as Group[]);
    } catch {
      toast.error("Failed to load", "Could not load compliance groups");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) =>
      `${g.name} ${g.description ?? ""}`.toLowerCase().includes(q),
    );
  }, [groups, search]);

  const totals = useMemo(() => {
    return groups.reduce(
      (acc, g) => {
        acc.docs += g._count.documents;
        acc.red += g._count.red;
        acc.yellow += g._count.yellow + g._count.orange;
        acc.green += g._count.green;
        return acc;
      },
      { docs: 0, red: 0, yellow: 0, green: 0 },
    );
  }, [groups]);

  const openNew = () => setForm({ id: null, name: "", description: "" });
  const openEdit = (g: Group) =>
    setForm({ id: g.id, name: g.name, description: g.description ?? "" });
  const closeForm = () => {
    if (saving) return;
    setForm(null);
  };

  const handleSave = async () => {
    if (!form) return;
    const name = form.name.trim();
    if (!name) {
      toast.error("Name required", "Enter a group name");
      return;
    }
    setSaving(true);
    try {
      if (form.id) {
        await customComplianceAPI.updateGroup(form.id, {
          name,
          description: form.description.trim() || null,
        });
        toast.success("Group updated", name);
      } else {
        await customComplianceAPI.createGroup({
          name,
          description: form.description.trim() || null,
        });
        toast.success("Group created", name);
      }
      setForm(null);
      await load();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Save failed";
      toast.error("Could not save", msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await customComplianceAPI.deleteGroup(confirmDelete.id);
      toast.success("Group deleted", confirmDelete.name);
      setConfirmDelete(null);
      await load();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Delete failed";
      toast.error("Could not delete", msg);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
            <FolderArchive className="w-6 h-6 text-yellow-500" />
            Custom Compliance
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            A documents bank for everything that isn&apos;t tied to a specific
            vehicle — companies, agreements, licences, deeds. Group them, track
            expiries, share whole bundles or single documents.
          </p>
        </div>
        <button
          onClick={openNew}
          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-yellow-400 to-yellow-500 px-4 py-2.5 text-sm font-bold text-white shadow shadow-yellow-500/25 hover:shadow-yellow-500/40 transition-all"
        >
          <Plus className="w-3.5 h-3.5" /> New group
        </button>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          icon={<Building2 className="w-4 h-4 text-yellow-500" />}
          label="Groups"
          value={groups.length}
        />
        <StatCard
          icon={<FolderArchive className="w-4 h-4 text-brand-500" />}
          label="Documents"
          value={totals.docs}
        />
        <StatCard
          icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />}
          label="Valid"
          value={totals.green}
          tone="green"
        />
        <StatCard
          icon={<AlertTriangle className="w-4 h-4 text-red-500" />}
          label="Expiring / expired"
          value={totals.yellow + totals.red}
          tone={totals.red > 0 ? "red" : totals.yellow > 0 ? "amber" : undefined}
        />
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search groups…"
          className="w-full sm:w-80 h-10 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 pl-9 pr-3 text-sm text-gray-800 dark:text-gray-200 focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/20"
        />
      </div>

      {/* List */}
      {loading ? (
        <p className="text-sm text-gray-400 text-center py-10">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800 p-10 text-center">
          <FolderArchive className="w-10 h-10 text-gray-300 dark:text-gray-700 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            {search ? "No groups match this search." : "No groups yet."}
          </p>
          {!search && (
            <button
              onClick={openNew}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-yellow-700 hover:text-yellow-800 dark:text-yellow-400"
            >
              <Plus className="w-3.5 h-3.5" /> Create your first group
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((g) => (
            <GroupCard
              key={g.id}
              group={g}
              onEdit={() => openEdit(g)}
              onDelete={() => setConfirmDelete(g)}
            />
          ))}
        </div>
      )}

      {/* Group form modal */}
      <Modal
        isOpen={form !== null}
        onClose={closeForm}
        className="w-[92%] max-w-[480px] rounded-2xl bg-white shadow-2xl dark:bg-gray-900"
      >
        <div className="flex flex-col">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 flex items-center justify-center">
              <FolderArchive className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-bold text-gray-900 dark:text-white truncate">
                {form?.id ? "Edit group" : "New group"}
              </h3>
              <p className="text-[11px] text-gray-400">
                e.g. <em>Blue Drive India</em> or <em>Company Agreements</em>
              </p>
            </div>
            <button
              type="button"
              onClick={closeForm}
              disabled={saving}
              className="w-8 h-8 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="px-6 py-4 space-y-3">
            <label className="block">
              <span className="text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1.5 block">
                Name <span className="text-red-500">*</span>
              </span>
              <input
                autoFocus
                type="text"
                value={form?.name ?? ""}
                onChange={(e) =>
                  setForm((p) => (p ? { ...p, name: e.target.value } : p))
                }
                disabled={saving}
                maxLength={120}
                placeholder="Blue Drive India"
                className="w-full h-10 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm text-gray-800 dark:text-gray-200 focus:border-yellow-400 focus:outline-none focus:ring-3 focus:ring-yellow-400/10 disabled:opacity-60"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1.5 block">
                Description{" "}
                <span className="text-gray-400 font-normal normal-case">(optional)</span>
              </span>
              <textarea
                value={form?.description ?? ""}
                onChange={(e) =>
                  setForm((p) => (p ? { ...p, description: e.target.value } : p))
                }
                disabled={saving}
                rows={3}
                maxLength={500}
                placeholder="GST, labour licence, partnership deed, etc."
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-800 dark:text-gray-200 focus:border-yellow-400 focus:outline-none focus:ring-3 focus:ring-yellow-400/10 disabled:opacity-60"
              />
            </label>
          </div>
          <div className="px-6 py-3 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={closeForm}
              disabled={saving}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !(form?.name ?? "").trim()}
              className="rounded-xl px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 shadow-sm transition-colors disabled:opacity-50 inline-flex items-center gap-2"
            >
              {saving && (
                <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              )}
              {form?.id ? "Save changes" : "Create group"}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={confirmDelete !== null}
        title={`Delete "${confirmDelete?.name ?? "this group"}"?`}
        message={`This removes the group and every document inside it. Files in storage are kept for audit but the group disappears from the documents bank.`}
        confirmLabel="Delete group"
        cancelLabel="Keep"
        variant="danger"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => !deleting && setConfirmDelete(null)}
      />
    </div>
  );
}

// ── Small bits ─────────────────────────────────────────────────────────────

function GroupCard({
  group,
  onEdit,
  onDelete,
}: {
  group: Group;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { documents, green, yellow, orange, red } = group._count;
  const expiring = yellow + orange;
  return (
    <div className="group rounded-2xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-white/[0.02] p-5 transition-all hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <Link
          href={`/custom-compliance/${group.id}`}
          className="flex-1 min-w-0"
        >
          <div className="flex items-center gap-1.5">
            <p className="text-base font-bold text-gray-900 dark:text-white truncate group-hover:text-yellow-600 dark:group-hover:text-yellow-400 transition-colors">
              {group.name}
            </p>
            {group.lock?.enabled && (
              <span
                title="Folder is locked"
                className="inline-flex items-center justify-center flex-shrink-0 w-5 h-5 rounded-md bg-yellow-100 dark:bg-yellow-500/15 text-yellow-700 dark:text-yellow-300"
              >
                <Lock className="w-3 h-3" />
              </span>
            )}
          </div>
          {group.description ? (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
              {group.description}
            </p>
          ) : (
            <p className="mt-1 text-xs text-gray-400 italic">No description</p>
          )}
        </Link>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={onEdit}
            className="w-7 h-7 rounded-lg text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-500/10 flex items-center justify-center"
            title="Edit"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="w-7 h-7 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center justify-center"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider">
          <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-2 py-1">
            {documents} doc{documents === 1 ? "" : "s"}
          </span>
          {green > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-2 py-1">
              <CheckCircle2 className="w-2.5 h-2.5" /> {green}
            </span>
          )}
          {expiring > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 px-2 py-1">
              <Clock className="w-2.5 h-2.5" /> {expiring}
            </span>
          )}
          {red > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 px-2 py-1">
              <AlertTriangle className="w-2.5 h-2.5" /> {red}
            </span>
          )}
        </div>
        <Link
          href={`/custom-compliance/${group.id}`}
          className="text-[11px] font-semibold text-yellow-700 hover:text-yellow-800 dark:text-yellow-400 inline-flex items-center gap-0.5"
        >
          Open
          <ChevronRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone?: "green" | "amber" | "red";
}) {
  const valueClass =
    tone === "red"
      ? "text-red-600 dark:text-red-400"
      : tone === "amber"
        ? "text-amber-600 dark:text-amber-400"
        : tone === "green"
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-gray-900 dark:text-white";
  return (
    <div className="rounded-xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-white/[0.02] px-3.5 py-3">
      <div className="flex items-center gap-1.5">
        {icon}
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          {label}
        </p>
      </div>
      <p className={`mt-1.5 text-xl font-black ${valueClass}`}>{value}</p>
    </div>
  );
}
