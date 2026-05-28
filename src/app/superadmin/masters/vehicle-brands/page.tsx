"use client";

import { useEffect, useMemo, useState } from "react";
import { superadminVehicleBrandAPI } from "@/lib/api";
import { VEHICLE_BRAND_ICON_KEYS } from "@/lib/vehicle-brand-icons";
import { VehicleBrandIcon } from "@/components/icons/VehicleBrandIcon";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  CheckCircle2,
  XCircle,
  X,
  Upload,
  AlertCircle,
  Clock,
  Tag,
} from "lucide-react";

type Brand = {
  id: string;
  _id?: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  iconKey: string | null;
  description: string | null;
  status: "APPROVED" | "PENDING" | "REJECTED";
  requestedByTenantId?: string | null;
  requestedAt?: string | null;
  approvedAt?: string | null;
  rejectionReason?: string | null;
};

type StatusFilter = "ALL" | "APPROVED" | "PENDING" | "REJECTED";

const STATUS_TINT: Record<Brand["status"], string> = {
  APPROVED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  PENDING: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  REJECTED: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

export default function VehicleBrandsMastersPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [editing, setEditing] = useState<Brand | null>(null);
  const [creating, setCreating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Brand | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await superadminVehicleBrandAPI.list();
      const list = (res.data.data as Array<Brand & { _id?: string }>).map((b) => ({
        ...b,
        id: String(b.id ?? b._id),
      }));
      setBrands(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const summary = useMemo(() => {
    const approved = brands.filter((b) => b.status === "APPROVED").length;
    const pending = brands.filter((b) => b.status === "PENDING").length;
    const rejected = brands.filter((b) => b.status === "REJECTED").length;
    return { approved, pending, rejected };
  }, [brands]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return brands.filter((b) => {
      if (statusFilter !== "ALL" && b.status !== statusFilter) return false;
      if (q && !b.name.toLowerCase().includes(q) && !b.slug.includes(q))
        return false;
      return true;
    });
  }, [brands, search, statusFilter]);

  const handleApprove = async (b: Brand) => {
    try {
      await superadminVehicleBrandAPI.approve(b.id);
      setToast({ type: "success", message: `${b.name} approved` });
      await load();
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Approve failed";
      setToast({ type: "error", message: msg });
    }
  };

  const handleReject = async (b: Brand) => {
    const reason = window.prompt(`Reject ${b.name}? Optional reason:`);
    if (reason === null) return; // user cancelled
    try {
      await superadminVehicleBrandAPI.reject(b.id, reason || undefined);
      setToast({ type: "success", message: `${b.name} rejected` });
      await load();
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Reject failed";
      setToast({ type: "error", message: msg });
    }
  };

  const handleDelete = async (b: Brand) => {
    try {
      await superadminVehicleBrandAPI.remove(b.id);
      setToast({ type: "success", message: `${b.name} deleted` });
      setPendingDelete(null);
      await load();
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Delete failed";
      setToast({ type: "error", message: msg });
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
              Platform · Masters
            </span>
            <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              Vehicle brands
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {summary.approved} approved · {summary.pending} pending · {summary.rejected} rejected
            </p>
          </div>
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-yellow-400 to-yellow-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-yellow-500/30 hover:from-yellow-500 hover:to-yellow-600 transition-all"
          >
            <Plus className="w-4 h-4" />
            New brand
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02] p-3 flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search brands…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-200 focus:border-yellow-400 focus:outline-none focus:ring-3 focus:ring-yellow-400/10"
          />
        </div>
        <div className="inline-flex p-1 rounded-xl bg-gray-100 dark:bg-gray-800/60 gap-0.5">
          {(["ALL", "PENDING", "APPROVED", "REJECTED"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 h-8 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all ${
                statusFilter === s
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              {s === "ALL" ? "All" : s.toLowerCase()}
              {s !== "ALL" && (
                <span className="ml-1 text-gray-400">
                  {s === "APPROVED" ? summary.approved : s === "PENDING" ? summary.pending : summary.rejected}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="rounded-2xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02] overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <span className="inline-block w-5 h-5 rounded-full border-2 border-gray-300 border-t-yellow-500 animate-spin" />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">Loading brands…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Tag className="w-10 h-10 text-gray-200 dark:text-gray-700 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">No brands yet</p>
            <p className="text-xs text-gray-400 mt-1">
              Add the first vehicle brand or wait for tenants to request one.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {filtered.map((b) => (
              <li
                key={b.id}
                className="px-4 py-3 flex items-center gap-4 hover:bg-gray-50/60 dark:hover:bg-gray-800/30"
              >
                <div className="flex items-center justify-center w-11 h-11 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex-shrink-0">
                  <VehicleBrandIcon brand={b} size={28} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                      {b.name}
                    </p>
                    <span
                      className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${STATUS_TINT[b.status]}`}
                    >
                      {b.status}
                    </span>
                    {b.status === "PENDING" && b.requestedAt && (
                      <span className="text-[10px] text-gray-400 inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Requested {new Date(b.requestedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                    {b.description ?? `slug: ${b.slug}`}
                  </p>
                  {b.status === "REJECTED" && b.rejectionReason && (
                    <p className="text-[11px] text-red-600 dark:text-red-400 mt-0.5">
                      Rejected: {b.rejectionReason}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {b.status === "PENDING" && (
                    <>
                      <button
                        onClick={() => handleApprove(b)}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 px-2.5 py-1.5 text-xs font-bold"
                        title="Approve"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(b)}
                        className="inline-flex items-center gap-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400 px-2.5 py-1.5 text-xs font-bold"
                        title="Reject"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Reject
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => setEditing(b)}
                    className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:hover:text-white dark:hover:bg-gray-800"
                    title="Edit"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setPendingDelete(b)}
                    className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-500/10"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {(creating || editing) && (
        <BrandEditor
          brand={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={async (msg) => {
            setCreating(false);
            setEditing(null);
            setToast({ type: "success", message: msg });
            await load();
          }}
          onError={(msg) => setToast({ type: "error", message: msg })}
        />
      )}

      {pendingDelete && (
        <ConfirmDeleteModal
          brand={pendingDelete}
          onClose={() => setPendingDelete(null)}
          onConfirm={() => handleDelete(pendingDelete)}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-[100000] max-w-sm">
          <div
            className={`flex items-center gap-3 rounded-xl border px-4 py-3 shadow-2xl ${
              toast.type === "success"
                ? "border-emerald-200 bg-white text-emerald-700 dark:border-emerald-500/30 dark:bg-gray-900 dark:text-emerald-400"
                : "border-red-200 bg-white text-red-700 dark:border-red-500/30 dark:bg-gray-900 dark:text-red-400"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
            )}
            <p className="text-sm font-medium">{toast.message}</p>
            <button
              onClick={() => setToast(null)}
              className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Brand editor modal ─────────────────────────────────────────────────────
function BrandEditor({
  brand,
  onClose,
  onSaved,
  onError,
}: {
  brand: Brand | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const isEditing = Boolean(brand);
  const [name, setName] = useState(brand?.name ?? "");
  const [iconKey, setIconKey] = useState(brand?.iconKey ?? "");
  const [description, setDescription] = useState(brand?.description ?? "");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(brand?.logoUrl ?? null);
  const [submitting, setSubmitting] = useState(false);

  const onLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setLogoFile(f);
    if (f) setLogoPreview(URL.createObjectURL(f));
  };

  const submit = async () => {
    if (!name.trim()) {
      onError("Brand name is required");
      return;
    }
    setSubmitting(true);
    try {
      if (isEditing && brand) {
        await superadminVehicleBrandAPI.update(brand.id, {
          name,
          logo: logoFile,
          iconKey: iconKey || null,
          description: description?.trim() || null,
        });
        onSaved(`${name} updated`);
      } else {
        await superadminVehicleBrandAPI.create({
          name,
          logo: logoFile,
          iconKey: iconKey || null,
          description: description?.trim() || null,
        });
        onSaved(`${name} created`);
      }
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Save failed";
      onError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const preview = { name: name || "Brand", logoUrl: logoPreview, iconKey };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !submitting && onClose()} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
        <div className="bg-gradient-to-r from-yellow-400 to-yellow-500 px-6 py-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">
              {isEditing ? "Edit brand" : "New brand"}
            </h2>
            <p className="text-white/80 text-xs mt-0.5">
              Upload a logo or pick a preset icon — either is fine.
            </p>
          </div>
          <button
            type="button"
            onClick={() => !submitting && onClose()}
            className="text-white/80 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {/* Preview */}
          <div className="flex items-center gap-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/40 p-3">
            <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
              <VehicleBrandIcon brand={preview} size={36} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Preview</p>
              <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                {preview.name}
              </p>
            </div>
          </div>

          <Field label="Brand name" required>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Toyota"
              maxLength={80}
              className="input"
            />
          </Field>

          <Field label="Logo image" hint="PNG / JPG. Optional if a preset icon is selected.">
            <div className="flex items-center gap-3">
              {logoPreview && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoPreview}
                  alt=""
                  className="w-12 h-12 rounded-lg border border-gray-200 dark:border-gray-700 object-contain bg-white"
                />
              )}
              <label className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                <Upload className="w-3.5 h-3.5" />
                {logoPreview ? "Replace" : "Upload"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  onChange={onLogoChange}
                  className="hidden"
                />
              </label>
              {logoPreview && (
                <button
                  type="button"
                  onClick={() => {
                    setLogoFile(null);
                    setLogoPreview(null);
                  }}
                  className="text-xs font-semibold text-gray-500 hover:text-red-600"
                >
                  Remove
                </button>
              )}
            </div>
          </Field>

          <Field label="Preset icon" hint="Fallback when no logo is uploaded.">
            <select
              value={iconKey ?? ""}
              onChange={(e) => setIconKey(e.target.value)}
              className="input"
            >
              <option value="">— none —</option>
              {VEHICLE_BRAND_ICON_KEYS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Description" hint="Optional.">
            <input
              type="text"
              value={description ?? ""}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={240}
              className="input"
            />
          </Field>
        </div>

        <div className="flex gap-2.5 px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="flex-1 h-10 rounded-lg bg-gradient-to-r from-yellow-400 to-yellow-500 text-white font-semibold text-sm shadow-lg disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {submitting && (
              <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
            )}
            {isEditing ? "Save" : "Create"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="h-10 px-4 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Cancel
          </button>
        </div>

        <style jsx>{`
          :global(.input) {
            width: 100%;
            height: 2.5rem;
            border-radius: 0.625rem;
            border: 1px solid rgb(229 231 235);
            background-color: white;
            padding: 0 0.875rem;
            font-size: 0.875rem;
            color: rgb(31 41 55);
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
        `}</style>
      </div>
    </div>
  );
}

function ConfirmDeleteModal({
  brand,
  onClose,
  onConfirm,
}: {
  brand: Brand;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden">
        <div className="p-6">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-500/15 text-red-600 dark:text-red-400 mb-4 mx-auto">
            <Trash2 className="w-5 h-5" />
          </div>
          <h2 className="text-base font-bold text-gray-900 dark:text-white text-center">
            Delete {brand.name}?
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">
            Vehicles tagged with this brand will keep the brand name as a label, but
            the icon / logo association will be lost.
          </p>
        </div>
        <div className="flex gap-2.5 px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
          <button
            onClick={onConfirm}
            className="flex-1 h-10 rounded-lg bg-red-500 hover:bg-red-600 text-white font-semibold text-sm"
          >
            Delete
          </button>
          <button
            onClick={onClose}
            className="h-10 px-4 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Cancel
          </button>
        </div>
      </div>
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
      {hint && <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1.5">{hint}</p>}
    </label>
  );
}
