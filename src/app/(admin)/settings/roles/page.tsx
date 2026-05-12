"use client";

import { useEffect, useState, useMemo } from "react";
import { rolesAPI, permissionsAPI } from "@/lib/api";
import {
  Shield,
  Plus,
  Trash2,
  Pencil,
  Users,
  Lock,
  Check,
  Search,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

type Role = {
  _id: string;
  id?: string;
  name: string;
  description?: string | null;
  permissions: string[];
  isSystem: boolean;
  memberCount: number;
};

type PermissionItem = { key: string; label: string; description: string };
type PermissionGroup = {
  key: string;
  label: string;
  description: string;
  items: PermissionItem[];
};

type PermissionCatalog = {
  catalog: PermissionGroup[];
  all: string[];
  mine: string[];
};

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [perms, setPerms] = useState<PermissionCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Role | null>(null);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [rolesRes, permsRes] = await Promise.all([
        rolesAPI.list(),
        permissionsAPI.get(),
      ]);
      const list = (rolesRes.data.data as Array<Role & { _id?: string }>).map((r) => ({
        ...r,
        _id: String(r.id ?? r._id),
      }));
      setRoles(list);
      setPerms(permsRes.data.data as PermissionCatalog);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (role: Role) => {
    if (!confirm(`Delete role "${role.name}"? This cannot be undone.`)) return;
    try {
      await rolesAPI.remove(role._id);
      await load();
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Failed to delete role";
      alert(msg);
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-gray-200/80 bg-gradient-to-br from-yellow-50 via-white to-amber-50 dark:border-gray-800 dark:from-yellow-500/[0.04] dark:via-gray-900 dark:to-amber-500/[0.04] p-6 sm:p-8">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full bg-yellow-300/20 blur-3xl dark:bg-yellow-400/10"
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-yellow-700/70 dark:text-yellow-400">
              Settings · Roles
            </span>
            <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              Roles & permissions
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-2xl">
              Define what users in your workspace can do. Start with the built-in
              Admin and Operator roles, or create custom roles for finer control.
            </p>
          </div>
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-yellow-400 to-yellow-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-yellow-500/30 hover:shadow-yellow-500/50 hover:from-yellow-500 hover:to-yellow-600 transition-all"
          >
            <Plus className="w-4 h-4" />
            New role
          </button>
        </div>
      </div>

      {/* Roles list */}
      {loading ? (
        <RolesListSkeleton />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {roles.map((r) => (
            <RoleCard
              key={r._id}
              role={r}
              onEdit={() => setEditing(r)}
              onDelete={() => handleDelete(r)}
            />
          ))}
        </div>
      )}

      {/* Editor modal */}
      {(creating || editing) && perms && (
        <RoleEditor
          role={editing}
          catalog={perms.catalog}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={async () => {
            setCreating(false);
            setEditing(null);
            await load();
          }}
        />
      )}
    </div>
  );
}

// ── Role card ───────────────────────────────────────────────────────────────
function RoleCard({
  role,
  onEdit,
  onDelete,
}: {
  role: Role;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group relative rounded-2xl border border-gray-200/80 bg-white p-5 transition-all hover:shadow-xl hover:shadow-gray-200/40 dark:border-gray-800 dark:bg-white/[0.02]">
      <div className="flex items-start gap-3 mb-4">
        <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-yellow-400/20 to-yellow-500/10 text-yellow-700 dark:text-yellow-400">
          <Shield className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-gray-900 dark:text-white truncate">
              {role.name}
            </h3>
            {role.isSystem && (
              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                <Lock className="w-2.5 h-2.5" />
                System
              </span>
            )}
          </div>
          {role.description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
              {role.description}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 text-[11px] text-gray-500 dark:text-gray-400 mb-4">
        <span className="flex items-center gap-1">
          <Check className="w-3 h-3" />
          {role.permissions.length} permission{role.permissions.length !== 1 ? "s" : ""}
        </span>
        <span className="flex items-center gap-1">
          <Users className="w-3 h-3" />
          {role.memberCount} member{role.memberCount !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="flex gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
        <button
          onClick={onEdit}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700 dark:bg-gray-800/50 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" />
          {role.isSystem ? "View / edit permissions" : "Edit"}
        </button>
        {!role.isSystem && (
          <button
            onClick={onDelete}
            disabled={role.memberCount > 0}
            className="inline-flex items-center justify-center gap-1 rounded-lg bg-red-50 hover:bg-red-100 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-40 disabled:cursor-not-allowed dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/15 transition-colors"
            title={
              role.memberCount > 0
                ? "Reassign members before deleting"
                : "Delete role"
            }
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Role editor modal ───────────────────────────────────────────────────────
function RoleEditor({
  role,
  catalog,
  onClose,
  onSaved,
}: {
  role: Role | null;
  catalog: PermissionGroup[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(role?.permissions ?? []),
  );
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set(catalog.map((g) => g.key)),
  );

  const isEditing = Boolean(role);
  const isSystem = role?.isSystem ?? false;

  const togglePermission = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleGroup = (group: PermissionGroup) => {
    const allOn = group.items.every((i) => selected.has(i.key));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const i of group.items) {
        if (allOn) next.delete(i.key);
        else next.add(i.key);
      }
      return next;
    });
  };

  const toggleGroupExpand = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const filteredGroups = useMemo(() => {
    if (!search.trim()) return catalog;
    const q = search.toLowerCase();
    return catalog
      .map((g) => ({
        ...g,
        items: g.items.filter(
          (i) =>
            i.label.toLowerCase().includes(q) ||
            i.key.toLowerCase().includes(q) ||
            i.description.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [catalog, search]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (isEditing && role) {
        await rolesAPI.update(role._id, {
          name: isSystem ? undefined : name,
          description: description.trim() || null,
          permissions: Array.from(selected),
        });
      } else {
        await rolesAPI.create({
          name,
          description: description.trim() || undefined,
          permissions: Array.from(selected),
        });
      }
      onSaved();
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Failed to save";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => !submitting && onClose()}
      />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-yellow-400 to-yellow-500 px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">
                {isEditing
                  ? isSystem
                    ? `System role: ${role?.name}`
                    : `Edit ${role?.name}`
                  : "New role"}
              </h2>
              <p className="text-white/80 text-xs mt-0.5">
                {isSystem
                  ? "Name is locked; permissions can still be tuned for your workspace."
                  : "Pick a clear name and select the permissions this role grants."}
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <form onSubmit={submit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-5">
            <Field label="Name" required>
              <input
                type="text"
                value={name}
                disabled={isSystem}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="e.g. Dispatcher"
                className="input"
              />
            </Field>
            <Field label="Description" hint="Optional. Helps teammates pick the right role.">
              <input
                type="text"
                value={description ?? ""}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does this role do?"
                className="input"
                maxLength={200}
              />
            </Field>

            <div className="pt-3 border-t border-gray-100 dark:border-gray-800">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                    Permissions
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {selected.size} of{" "}
                    {catalog.reduce((s, g) => s + g.items.length, 0)} selected
                  </p>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search permissions…"
                    className="w-56 h-9 pl-9 pr-3 rounded-lg border border-gray-200 bg-white text-xs text-gray-800 focus:border-yellow-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </div>
              </div>

              <div className="space-y-2">
                {filteredGroups.map((g) => {
                  const allOn = g.items.every((i) => selected.has(i.key));
                  const someOn = g.items.some((i) => selected.has(i.key));
                  const expanded = expandedGroups.has(g.key);
                  return (
                    <div
                      key={g.key}
                      className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30"
                    >
                      <div className="flex items-center gap-3 px-4 py-3">
                        <button
                          type="button"
                          onClick={() => toggleGroup(g)}
                          className="flex items-center justify-center w-5 h-5 rounded border-2 border-gray-300 dark:border-gray-600 transition-colors data-[state=on]:border-yellow-500 data-[state=on]:bg-yellow-500"
                          data-state={allOn ? "on" : "off"}
                          aria-label={`Toggle all ${g.label} permissions`}
                        >
                          {allOn && <Check className="w-3 h-3 text-white" />}
                          {!allOn && someOn && (
                            <span className="w-2 h-0.5 bg-yellow-500" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleGroupExpand(g.key)}
                          className="flex-1 text-left"
                        >
                          <p className="text-sm font-bold text-gray-900 dark:text-white">
                            {g.label}
                          </p>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400">
                            {g.description}
                          </p>
                        </button>
                        <span className="text-[11px] font-bold text-gray-400 tabular-nums">
                          {g.items.filter((i) => selected.has(i.key)).length} /{" "}
                          {g.items.length}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleGroupExpand(g.key)}
                          className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                        >
                          {expanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                      {expanded && (
                        <div className="px-4 pb-3 pt-1 space-y-1.5 border-t border-gray-100 dark:border-gray-800">
                          {g.items.map((i) => {
                            const on = selected.has(i.key);
                            return (
                              <button
                                key={i.key}
                                type="button"
                                onClick={() => togglePermission(i.key)}
                                className={`w-full flex items-start gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                                  on
                                    ? "bg-yellow-50/70 hover:bg-yellow-100/70 dark:bg-yellow-500/[0.08] dark:hover:bg-yellow-500/[0.12]"
                                    : "hover:bg-white dark:hover:bg-gray-800"
                                }`}
                              >
                                <span
                                  className={`mt-0.5 flex items-center justify-center w-4 h-4 rounded border-2 flex-shrink-0 transition-colors ${
                                    on
                                      ? "border-yellow-500 bg-yellow-500"
                                      : "border-gray-300 dark:border-gray-600"
                                  }`}
                                >
                                  {on && <Check className="w-2.5 h-2.5 text-white" />}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold text-gray-900 dark:text-white">
                                    {i.label}
                                  </p>
                                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                    {i.description}
                                  </p>
                                </div>
                                <span className="text-[9px] font-mono text-gray-400 mt-0.5">
                                  {i.key}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-2 dark:border-red-500/30 dark:bg-red-500/10">
                <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-800 dark:text-red-400">{error}</p>
              </div>
            )}
          </div>

          <div className="flex gap-3 px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 sticky bottom-0">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 h-11 rounded-xl bg-gradient-to-r from-yellow-400 to-yellow-500 text-white font-semibold text-sm shadow-lg disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {submitting && (
                <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              )}
              {isEditing ? "Save changes" : "Create role"}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="h-11 px-5 rounded-xl border-2 border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>

      <style jsx>{`
        :global(.input) {
          width: 100%;
          height: 2.75rem;
          border-radius: 0.75rem;
          border: 1px solid rgb(229 231 235);
          background-color: white;
          padding: 0 1rem;
          font-size: 0.875rem;
          color: rgb(31 41 55);
          transition: all 0.15s;
        }
        :global(.dark .input) {
          border-color: rgb(55 65 81);
          background-color: rgb(31 41 55);
          color: white;
        }
        :global(.input:focus) {
          outline: none;
          border-color: rgb(234 179 8);
          box-shadow: 0 0 0 3px rgb(234 179 8 / 0.1);
        }
        :global(.input:disabled) {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1.5 block">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
      {hint && (
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1.5">{hint}</p>
      )}
    </label>
  );
}

function RolesListSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-gray-200/80 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.02]"
        >
          <div className="flex items-start gap-3 mb-4">
            <div className="w-11 h-11 rounded-xl bg-gray-200/70 dark:bg-gray-700/40 animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 rounded bg-gray-200/70 dark:bg-gray-700/40 animate-pulse" />
              <div className="h-3 w-48 rounded bg-gray-200/70 dark:bg-gray-700/40 animate-pulse" />
            </div>
          </div>
          <div className="flex gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
            <div className="flex-1 h-8 rounded-lg bg-gray-200/70 dark:bg-gray-700/40 animate-pulse" />
            <div className="w-12 h-8 rounded-lg bg-gray-200/70 dark:bg-gray-700/40 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}
