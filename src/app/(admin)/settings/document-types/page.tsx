"use client";
import React, { useEffect, useState } from "react";
import { documentTypeAPI } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { Modal } from "@/components/ui/modal";
import {
  Plus,
  Pencil,
  Trash2,
  FileText,
  Lock,
  Check,
  X as XIcon,
  ShieldCheck,
} from "lucide-react";

interface DocumentType {
  _id: string;
  id?: string;
  code: string;
  name: string;
  description?: string | null;
  hasExpiry: boolean;
  isSystem: boolean;
  isActive: boolean;
  tenantId?: string | null;
}

export default function DocumentTypesMastersPage() {
  const toast = useToast();
  const [docTypes, setDocTypes] = useState<DocumentType[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<DocumentType | null>(null);
  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formHasExpiry, setFormHasExpiry] = useState(true);
  const [saving, setSaving] = useState(false);

  const [pendingDelete, setPendingDelete] = useState<DocumentType | null>(null);
  const [deleting, setDeleting] = useState(false);
  // OTP-gated delete state.
  const [otpRequested, setOtpRequested] = useState(false);
  const [otpRequesting, setOtpRequesting] = useState(false);
  const [otpInput, setOtpInput] = useState("");
  const [otpExpiresAt, setOtpExpiresAt] = useState<Date | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await documentTypeAPI.getAll();
      const data = (res.data.data ?? []) as DocumentType[];
      setDocTypes(data);
    } catch {
      toast.error("Failed to load", "Could not fetch document types");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreate = () => {
    setEditing(null);
    setFormCode("");
    setFormName("");
    setFormDescription("");
    setFormHasExpiry(true);
    setShowForm(true);
  };

  const openEdit = (dt: DocumentType) => {
    setEditing(dt);
    setFormCode(dt.code);
    setFormName(dt.name);
    setFormDescription(dt.description ?? "");
    setFormHasExpiry(dt.hasExpiry);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formName.trim() || (!editing && !formCode.trim())) {
      toast.error("Missing fields", "Code and name are required");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        // Custom (non-system) types support code renames. The server migrates
        // every ComplianceDocument that references the old code so existing
        // rows stay valid. System types reject any code change.
        const payload: {
          code?: string;
          name: string;
          description?: string;
          hasExpiry: boolean;
        } = {
          name: formName.trim(),
          description: formDescription.trim() || undefined,
          hasExpiry: formHasExpiry,
        };
        if (!editing.isSystem && formCode.trim() && formCode.trim() !== editing.code) {
          payload.code = formCode.trim();
        }
        await documentTypeAPI.update(editing.id ?? editing._id, payload);
        toast.success("Updated", `${formName} updated`);
      } else {
        await documentTypeAPI.create({
          code: formCode.trim(),
          name: formName.trim(),
          description: formDescription.trim() || undefined,
          hasExpiry: formHasExpiry,
        });
        toast.success("Created", `${formName} added to document types`);
      }
      setShowForm(false);
      await load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response
        ?.data?.message;
      toast.error("Save failed", msg ?? "Could not save");
    } finally {
      setSaving(false);
    }
  };

  // OTP-gated delete — request emails a code, confirm validates + deletes.
  const openDelete = (dt: DocumentType) => {
    setPendingDelete(dt);
    setOtpRequested(false);
    setOtpInput("");
    setOtpExpiresAt(null);
  };
  const closeDelete = () => {
    if (deleting || otpRequesting) return;
    setPendingDelete(null);
    setOtpRequested(false);
    setOtpInput("");
    setOtpExpiresAt(null);
  };
  const requestOtp = async () => {
    if (!pendingDelete) return;
    setOtpRequesting(true);
    try {
      const res = await documentTypeAPI.requestDeletion(
        pendingDelete.id ?? pendingDelete._id,
      );
      const expires = (res.data?.data as { expiresAt?: string })?.expiresAt;
      setOtpExpiresAt(expires ? new Date(expires) : null);
      setOtpRequested(true);
      toast.success("Code sent", "Check your email for the 6-digit OTP");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response
        ?.data?.message;
      toast.error("Could not send code", msg ?? "Try again in a moment");
    } finally {
      setOtpRequesting(false);
    }
  };
  const handleDelete = async () => {
    if (!pendingDelete) return;
    if (!/^\d{6}$/.test(otpInput.trim())) {
      toast.error("Invalid code", "Enter the 6-digit code from the email");
      return;
    }
    setDeleting(true);
    try {
      await documentTypeAPI.confirmDeletion(
        pendingDelete.id ?? pendingDelete._id,
        otpInput.trim(),
      );
      toast.success("Deleted", `${pendingDelete.name} removed`);
      closeDelete();
      await load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response
        ?.data?.message;
      toast.error("Delete failed", msg ?? "Could not delete");
    } finally {
      setDeleting(false);
    }
  };

  const systemTypes = docTypes.filter((d) => d.isSystem);
  const customTypes = docTypes.filter((d) => !d.isSystem);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Document Types</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage the list of trackable compliance documents (RC, Insurance, Permit, custom…). These appear when uploading a document on any vehicle.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-brand-400 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 hover:shadow-brand-500/40 transition-all"
        >
          <Plus className="w-4 h-4" />
          Add Document Type
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-sm text-gray-400">Loading…</div>
      ) : (
        <>
          {/* System types — read-only, just for reference */}
          {systemTypes.length > 0 && (
            <section className="rounded-2xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02] overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100 dark:border-gray-800">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Built-in Trackers</h3>
                <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">
                  System · {systemTypes.length}
                </span>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {systemTypes.map((dt) => (
                  <DocTypeRow key={dt.id ?? dt._id} dt={dt} onEdit={openEdit} />
                ))}
              </div>
            </section>
          )}

          {/* Tenant-custom types */}
          <section className="rounded-2xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-brand-500" />
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Custom Trackers</h3>
                <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">
                  Your tenant · {customTypes.length}
                </span>
              </div>
            </div>
            {customTypes.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <FileText className="w-10 h-10 text-gray-200 dark:text-gray-700 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No custom document types yet</p>
                <p className="text-xs text-gray-400 mt-1">Click <span className="font-semibold">Add Document Type</span> to create one — for example "All India Permit" or "GPS Certificate".</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {customTypes.map((dt) => (
                  <DocTypeRow key={dt.id ?? dt._id} dt={dt} onEdit={openEdit} onDelete={openDelete} />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* Form modal */}
      <Modal
        isOpen={showForm}
        onClose={saving ? () => undefined : () => setShowForm(false)}
        showCloseButton={!saving}
        className="w-[92%] max-w-[480px] rounded-2xl bg-white shadow-2xl dark:bg-gray-900"
      >
        <div className="flex flex-col">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                {editing ? "Edit Document Type" : "Add Document Type"}
              </h3>
              <p className="text-[11px] text-gray-400">
                {editing ? "Update label, description, or expiry behavior" : "New tracker visible across all vehicles"}
              </p>
            </div>
          </div>

          <div className="px-6 py-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">
                Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formCode}
                onChange={(e) => setFormCode(e.target.value)}
                disabled={!!editing && !!editing.isSystem}
                placeholder="e.g. ALL_INDIA_PERMIT"
                className="w-full h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm font-mono uppercase text-gray-900 focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white disabled:bg-gray-50 dark:disabled:bg-gray-800/40 disabled:text-gray-400"
              />
              <p className="text-[10px] text-gray-400 mt-1">
                Unique identifier. Uppercase, no spaces.{" "}
                {editing && editing.isSystem
                  ? "System type — code is locked."
                  : editing
                    ? "Renaming will update every vehicle document that references this code."
                    : ""}
              </p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">
                Display Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. All India Permit"
                className="w-full h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">
                Description <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                rows={2}
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Anything operators should know about this document"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white resize-none"
              />
            </div>
            <label className="flex items-start gap-2.5 p-3 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50/60 dark:hover:bg-gray-800/40">
              <input
                type="checkbox"
                checked={formHasExpiry}
                onChange={(e) => setFormHasExpiry(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-gray-300 text-brand-500 focus:ring-brand-400"
              />
              <div>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Has expiry date</p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                  When checked, uploads require an expiry date and the document is tracked for renewal alerts. Uncheck for one-time or lifetime documents.
                </p>
              </div>
            </label>
          </div>

          <div className="px-6 py-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => !saving && setShowForm(false)}
              disabled={saving}
              className="h-10 px-4 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !formName.trim() || (!editing && !formCode.trim())}
              className="h-10 px-5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold shadow-sm transition-colors disabled:opacity-50"
            >
              {saving ? "Saving…" : editing ? "Save Changes" : "Create"}
            </button>
          </div>
        </div>
      </Modal>

      {/* OTP-gated delete modal. Two steps: request → enter code → confirm. */}
      <Modal
        isOpen={pendingDelete !== null}
        onClose={closeDelete}
        showCloseButton={!deleting && !otpRequesting}
        className="w-[92%] max-w-[440px] rounded-2xl bg-white shadow-2xl dark:bg-gray-900"
      >
        <div className="flex flex-col">
          <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-500/15 text-red-600 dark:text-red-400 mb-3 mx-auto">
              <Trash2 className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white text-center">
              Delete &ldquo;{pendingDelete?.name ?? ""}&rdquo;?
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">
              {!otpRequested ? (
                <>
                  Removes this tracker from your tenant. To confirm, we&apos;ll email
                  a 6-digit code to your account.
                </>
              ) : (
                <>
                  We&apos;ve emailed a 6-digit code to your account. Enter it
                  below to finish deleting. Code expires in ~10 minutes.
                </>
              )}
            </p>
          </div>

          {otpRequested && (
            <div className="px-6 py-4">
              <label className="block">
                <span className="text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1.5 block">
                  Confirmation code
                </span>
                <input
                  autoFocus
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ""))}
                  placeholder="6-digit code"
                  className="w-full h-11 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-lg font-mono tracking-[0.4em] text-center text-gray-900 dark:text-white focus:border-red-400 focus:outline-none focus:ring-3 focus:ring-red-400/10"
                />
              </label>
              {otpExpiresAt && (
                <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2 text-center">
                  Code valid until {otpExpiresAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                </p>
              )}
            </div>
          )}

          <div className="flex gap-2.5 px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
            {otpRequested ? (
              <>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting || otpInput.length < 6}
                  className="flex-1 h-10 rounded-lg bg-red-500 hover:bg-red-600 text-white font-semibold text-sm shadow-lg disabled:opacity-50 inline-flex items-center justify-center gap-2"
                >
                  {deleting && (
                    <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  )}
                  Confirm delete
                </button>
                <button
                  type="button"
                  onClick={requestOtp}
                  disabled={deleting || otpRequesting}
                  className="h-10 px-3 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
                  title="Send a fresh code"
                >
                  Resend
                </button>
                <button
                  type="button"
                  onClick={closeDelete}
                  disabled={deleting}
                  className="h-10 px-4 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={requestOtp}
                  disabled={otpRequesting}
                  className="flex-1 h-10 rounded-lg bg-red-500 hover:bg-red-600 text-white font-semibold text-sm shadow-lg disabled:opacity-50 inline-flex items-center justify-center gap-2"
                >
                  {otpRequesting && (
                    <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  )}
                  Email me a code
                </button>
                <button
                  type="button"
                  onClick={closeDelete}
                  disabled={otpRequesting}
                  className="h-10 px-4 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}

function DocTypeRow({
  dt,
  onEdit,
  onDelete,
}: {
  dt: DocumentType;
  onEdit: (dt: DocumentType) => void;
  onDelete?: (dt: DocumentType) => void;
}) {
  return (
    <div className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/60 dark:hover:bg-gray-800/30 transition-colors">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${dt.isSystem ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" : "bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400"}`}>
        {dt.isSystem ? <Lock className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-bold text-gray-900 dark:text-white">{dt.name}</p>
          <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
            {dt.code}
          </span>
          {dt.hasExpiry ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
              <Check className="w-2.5 h-2.5" /> Has Expiry
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
              <XIcon className="w-2.5 h-2.5" /> No Expiry
            </span>
          )}
        </div>
        {dt.description && (
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">{dt.description}</p>
        )}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          type="button"
          onClick={() => onEdit(dt)}
          className="h-8 px-2.5 rounded-lg text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 inline-flex items-center gap-1 transition-colors"
        >
          <Pencil className="w-3 h-3" />
          Edit
        </button>
        {!dt.isSystem && onDelete && (
          <button
            type="button"
            onClick={() => onDelete(dt)}
            className="h-8 px-2.5 rounded-lg text-xs font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 inline-flex items-center gap-1 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
