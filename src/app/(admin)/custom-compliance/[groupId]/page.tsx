"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Upload,
  FileText,
  ExternalLink,
  X,
  Pencil,
  Trash2,
  Share2,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  FolderArchive,
  Lock,
  LockOpen,
  KeyRound,
} from "lucide-react";
import { customComplianceAPI } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  FolderLockSetupModal,
  FolderUnlockScreen,
  FolderForgotPasswordModal,
  FolderRemoveLockModal,
} from "@/components/custom-compliance/FolderLockModals";

type LockStatus = {
  enabled: boolean;
  recoveryEmail: string | null;
  unlockedUntil: string | null;
  blockedUntil: string | null;
  setAt: string | null;
};

type Group = {
  id: string;
  name: string;
  description: string | null;
  docLimit: number;
  docCount: number;
};

type Doc = {
  id: string;
  groupId: string;
  label: string;
  documentNumber: string | null;
  issuedDate: string | null;
  expiryDate: string | null;
  documentUrl: string | null;
  documentUrls: string[];
  status: "GREEN" | "YELLOW" | "ORANGE" | "RED";
  notes: string | null;
  isLifetime?: boolean;
  daysUntilExpiry: number | null;
};

type DocFormState = {
  id: string | null;
  label: string;
  documentNumber: string;
  issuedDate: string;
  expiryDate: string;
  lifetime: boolean;
  notes: string;
  files: File[];
};

const emptyDocForm = (): DocFormState => ({
  id: null,
  label: "",
  documentNumber: "",
  issuedDate: "",
  expiryDate: "",
  lifetime: false,
  notes: "",
  files: [],
});

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const STATUS_TINT: Record<Doc["status"], string> = {
  GREEN: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30",
  YELLOW: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30",
  ORANGE: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/30",
  RED: "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/30",
};

function statusLabel(d: Doc): string {
  if (!d.expiryDate) return d.isLifetime ? "Lifetime" : "No expiry";
  if (d.daysUntilExpiry === null) return "—";
  if (d.daysUntilExpiry <= 0) return `${Math.abs(d.daysUntilExpiry)}d overdue`;
  return `${d.daysUntilExpiry}d left`;
}

export default function CustomComplianceGroupPage() {
  const router = useRouter();
  const toast = useToast();
  const params = useParams<{ groupId: string }>();
  const groupId = params?.groupId;

  const [group, setGroup] = useState<Group | null>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [docForm, setDocForm] = useState<DocFormState | null>(null);
  const [docSaving, setDocSaving] = useState(false);

  const [confirmDeleteDoc, setConfirmDeleteDoc] = useState<Doc | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Share-doc state — `target` is either a single Doc (one-doc share) or
  // "GROUP" (the whole bundle).
  const [shareOpen, setShareOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<Doc[] | "GROUP" | null>(null);
  const [shareSelected, setShareSelected] = useState<Set<string>>(new Set());
  const [shareSubmitting, setShareSubmitting] = useState(false);
  const [shareResult, setShareResult] = useState<{
    url: string;
    expiresAt: string;
  } | null>(null);
  const [shareCopied, setShareCopied] = useState(false);

  // ── Folder lock state ──────────────────────────────────────────
  const [lockStatus, setLockStatus] = useState<LockStatus | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [remainingMs, setRemainingMs] = useState(0);

  const loadLockStatus = useCallback(async () => {
    if (!groupId) return;
    try {
      const res = await customComplianceAPI.getLockStatus(groupId);
      setLockStatus(res.data?.data as LockStatus);
    } catch {
      // Non-fatal — leave previous state. UI still renders content if it had any.
    }
  }, [groupId]);

  // Tick the unlock-remaining countdown every second so the operator can
  // see how much time they have left before the folder re-locks itself.
  useEffect(() => {
    if (!lockStatus?.unlockedUntil) {
      setRemainingMs(0);
      return;
    }
    const tick = () => {
      const ms = new Date(lockStatus.unlockedUntil!).getTime() - Date.now();
      setRemainingMs(Math.max(0, ms));
      if (ms <= 0) {
        // Unlock just expired — refresh status to flip the page back to the
        // lock screen on the next render.
        void loadLockStatus();
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [lockStatus?.unlockedUntil, loadLockStatus]);

  const load = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    try {
      const [groupRes, docsRes] = await Promise.all([
        customComplianceAPI.getGroup(groupId),
        customComplianceAPI.listDocuments(groupId),
      ]);
      const g = groupRes.data?.data as
        | {
            _id?: string;
            id?: string;
            name?: string;
            description?: string | null;
            docLimit?: number;
            docCount?: number;
          }
        | undefined;
      if (g) {
        setGroup({
          id: String(g._id ?? g.id ?? groupId),
          name: g.name ?? "Group",
          description: g.description ?? null,
          docLimit: typeof g.docLimit === "number" ? g.docLimit : 10,
          docCount: typeof g.docCount === "number" ? g.docCount : 0,
        });
      }
      setDocs((docsRes.data?.data ?? []) as Doc[]);
    } catch {
      toast.error("Failed to load", "Could not load this group");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  useEffect(() => {
    load();
    void loadLockStatus();
  }, [load, loadLockStatus]);

  const summary = useMemo(() => {
    const counts = { total: docs.length, green: 0, yellow: 0, red: 0 };
    for (const d of docs) {
      if (d.status === "GREEN") counts.green++;
      else if (d.status === "YELLOW" || d.status === "ORANGE") counts.yellow++;
      else if (d.status === "RED") counts.red++;
    }
    return counts;
  }, [docs]);

  const openNewDoc = () => setDocForm(emptyDocForm());
  const openEditDoc = (d: Doc) =>
    setDocForm({
      id: d.id,
      label: d.label,
      documentNumber: d.documentNumber ?? "",
      issuedDate: d.issuedDate
        ? new Date(d.issuedDate).toISOString().slice(0, 10)
        : "",
      expiryDate: d.expiryDate
        ? new Date(d.expiryDate).toISOString().slice(0, 10)
        : "",
      lifetime: !d.expiryDate && Boolean(d.issuedDate),
      notes: d.notes ?? "",
      files: [],
    });
  const closeDocForm = () => {
    if (docSaving) return;
    setDocForm(null);
  };

  const handleDocSave = async () => {
    if (!docForm || !groupId) return;
    const label = docForm.label.trim();
    if (!label) {
      toast.error("Label required", "Give the document a name");
      return;
    }
    if (!docForm.lifetime && !docForm.expiryDate && docForm.id === null) {
      // First-time create — nudge user to pick a validity period.
      if (
        !confirm(
          "No expiry date and not marked as lifetime. Save anyway with no validity tracked?",
        )
      ) {
        return;
      }
    }
    setDocSaving(true);
    try {
      if (docForm.id) {
        await customComplianceAPI.updateDocument(docForm.id, {
          label,
          documentNumber: docForm.documentNumber.trim() || null,
          issuedDate: docForm.issuedDate || null,
          expiryDate: docForm.lifetime ? null : docForm.expiryDate || null,
          lifetime: docForm.lifetime,
          notes: docForm.notes.trim() || null,
        });
        // Append files if user attached any during edit
        if (docForm.files.length > 0) {
          await customComplianceAPI.appendFiles(docForm.id, docForm.files);
        }
        toast.success("Document updated", label);
      } else {
        await customComplianceAPI.createDocument(groupId, {
          label,
          documentNumber: docForm.documentNumber.trim() || null,
          issuedDate: docForm.issuedDate || null,
          expiryDate: docForm.lifetime ? null : docForm.expiryDate || null,
          lifetime: docForm.lifetime,
          notes: docForm.notes.trim() || null,
          documents: docForm.files,
        });
        toast.success("Document added", label);
      }
      setDocForm(null);
      await load();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Save failed";
      toast.error("Could not save", msg);
    } finally {
      setDocSaving(false);
    }
  };

  const handleDocDelete = async () => {
    if (!confirmDeleteDoc) return;
    setDeleting(true);
    try {
      await customComplianceAPI.deleteDocument(confirmDeleteDoc.id);
      toast.success("Document deleted", confirmDeleteDoc.label);
      setConfirmDeleteDoc(null);
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

  const openShareGroup = () => {
    setShareTarget("GROUP");
    setShareSelected(new Set());
    setShareResult(null);
    setShareOpen(true);
  };

  const openShareSingle = (doc: Doc) => {
    setShareTarget([doc]);
    setShareSelected(new Set([doc.id]));
    setShareResult(null);
    setShareOpen(true);
  };

  const closeShare = () => {
    if (shareSubmitting) return;
    setShareOpen(false);
    setShareTarget(null);
    setShareSelected(new Set());
    setShareResult(null);
    setShareCopied(false);
  };

  const handleCreateShare = async () => {
    if (!groupId) return;
    setShareSubmitting(true);
    try {
      const payload =
        shareTarget === "GROUP"
          ? { groupId }
          : { documentIds: Array.from(shareSelected) };
      const res = await customComplianceAPI.createShare(payload);
      const data = res.data?.data as { url?: string; expiresAt?: string } | undefined;
      if (data?.url && data?.expiresAt) {
        setShareResult({ url: data.url, expiresAt: data.expiresAt });
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Could not create share link";
      toast.error("Share failed", msg);
    } finally {
      setShareSubmitting(false);
    }
  };

  const copyShareUrl = async () => {
    if (!shareResult) return;
    try {
      await navigator.clipboard.writeText(shareResult.url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch {
      toast.error("Copy failed", "Couldn't write to clipboard");
    }
  };

  if (loading) {
    return <p className="text-sm text-gray-400 text-center py-10">Loading…</p>;
  }
  if (!group) {
    return (
      <div className="text-center py-10">
        <p className="text-sm text-gray-500 dark:text-gray-400">Group not found.</p>
        <button
          onClick={() => router.push("/custom-compliance")}
          className="mt-2 text-xs font-semibold text-yellow-700 dark:text-yellow-400"
        >
          Back to groups
        </button>
      </div>
    );
  }

  // Locked + no active unlock grant for this user → show the lock screen
  // instead of the folder content. The screen is fed the folder name +
  // recovery email (already on lockStatus) and calls back into the page
  // when the user successfully unlocks or completes a reset.
  const isLocked =
    Boolean(lockStatus?.enabled) && !lockStatus?.unlockedUntil;

  if (isLocked && lockStatus) {
    return (
      <>
        <FolderUnlockScreen
          groupId={group.id}
          folderName={group.name}
          recoveryEmail={lockStatus.recoveryEmail}
          blockedUntil={lockStatus.blockedUntil}
          onUnlocked={async () => {
            await loadLockStatus();
          }}
          onForgot={() => setForgotOpen(true)}
        />
        {forgotOpen && (
          <FolderForgotPasswordModal
            groupId={group.id}
            folderName={group.name}
            recoveryEmail={lockStatus.recoveryEmail}
            onClose={() => setForgotOpen(false)}
            onDone={async () => {
              setForgotOpen(false);
              await loadLockStatus();
            }}
          />
        )}
      </>
    );
  }

  return (
    <div className="space-y-5">
      <Link
        href="/custom-compliance"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to groups
      </Link>

      {/* Lock controls — visible inline so the operator can always
          enable / re-lock / disable without digging into a menu. */}
      <LockControls
        lockStatus={lockStatus}
        remainingMs={remainingMs}
        onOpenSetup={() => setSetupOpen(true)}
        onOpenRemove={() => setRemoveOpen(true)}
        onRelock={async () => {
          try {
            await customComplianceAPI.relock(group.id);
            toast.info("Folder re-locked");
            await loadLockStatus();
          } catch {
            toast.error("Re-lock failed");
          }
        }}
      />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
            <FolderArchive className="w-6 h-6 text-yellow-500" />
            {group.name}
          </h1>
          {group.description && (
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {group.description}
            </p>
          )}
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            <span
              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-semibold mr-1.5 ${
                summary.total >= group.docLimit
                  ? "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400"
                  : summary.total >= group.docLimit - 2
                    ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
                    : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
              }`}
              title="Plan cap on documents per group"
            >
              {summary.total} / {group.docLimit} docs
            </span>
            {summary.green > 0 && ` · ${summary.green} valid`}
            {summary.yellow > 0 && ` · ${summary.yellow} expiring`}
            {summary.red > 0 && ` · ${summary.red} expired`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openShareGroup}
            disabled={docs.length === 0}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50"
            title="Share every document in this group"
          >
            <Share2 className="w-3.5 h-3.5" />
            Share whole group
          </button>
          <button
            onClick={openNewDoc}
            disabled={summary.total >= group.docLimit}
            title={
              summary.total >= group.docLimit
                ? `This group is at its ${group.docLimit}-document plan cap`
                : undefined
            }
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-yellow-400 to-yellow-500 px-4 py-2.5 text-sm font-bold text-white shadow shadow-yellow-500/25 hover:shadow-yellow-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-3.5 h-3.5" /> Add document
          </button>
        </div>
      </div>

      {/* Plan-cap notice — shown when at or one away from the limit, so the
          user understands why the Add button is disabled / about to be. */}
      {summary.total >= group.docLimit - 1 && (
        <div
          className={`rounded-xl border px-4 py-2.5 text-xs ${
            summary.total >= group.docLimit
              ? "border-red-200 bg-red-50/60 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
              : "border-amber-200 bg-amber-50/60 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
          }`}
        >
          {summary.total >= group.docLimit ? (
            <>
              <strong>Plan cap reached.</strong> This group is at the{" "}
              {group.docLimit}-document limit. Remove a document or upgrade
              the plan to add more.
            </>
          ) : (
            <>
              <strong>1 document left.</strong> You can add{" "}
              {group.docLimit - summary.total} more in this group before
              hitting the {group.docLimit}-document plan cap.
            </>
          )}
        </div>
      )}

      {/* Documents */}
      {docs.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800 p-10 text-center">
          <FileText className="w-10 h-10 text-gray-300 dark:text-gray-700 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            No documents yet.
          </p>
          <button
            onClick={openNewDoc}
            disabled={summary.total >= group.docLimit}
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-yellow-700 hover:text-yellow-800 dark:text-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-3.5 h-3.5" /> Add the first document
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {docs.map((d) => (
            <DocCard
              key={d.id}
              doc={d}
              onEdit={() => openEditDoc(d)}
              onDelete={() => setConfirmDeleteDoc(d)}
              onShare={() => openShareSingle(d)}
            />
          ))}
        </div>
      )}

      {/* Doc form modal (create + edit) */}
      <Modal
        isOpen={docForm !== null}
        onClose={closeDocForm}
        className="w-[92%] max-w-[560px] rounded-2xl bg-white shadow-2xl dark:bg-gray-900"
      >
        <div className="flex flex-col max-h-[90vh]">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-bold text-gray-900 dark:text-white truncate">
                {docForm?.id ? "Edit document" : "Add document"}
              </h3>
              <p className="text-[11px] text-gray-400">
                Under <em>{group.name}</em>
              </p>
            </div>
            <button
              type="button"
              onClick={closeDocForm}
              disabled={docSaving}
              className="w-8 h-8 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-6 py-4 space-y-3 overflow-y-auto">
            <label className="block">
              <span className="text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1.5 block">
                Label <span className="text-red-500">*</span>
              </span>
              <input
                autoFocus={docForm?.id === null}
                type="text"
                value={docForm?.label ?? ""}
                onChange={(e) =>
                  setDocForm((p) => (p ? { ...p, label: e.target.value } : p))
                }
                disabled={docSaving}
                maxLength={120}
                placeholder="GST Certificate"
                className="w-full h-10 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm text-gray-800 dark:text-gray-200 focus:border-yellow-400 focus:outline-none focus:ring-3 focus:ring-yellow-400/10 disabled:opacity-60"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1.5 block">
                Document number{" "}
                <span className="text-gray-400 font-normal normal-case">(optional)</span>
              </span>
              <input
                type="text"
                value={docForm?.documentNumber ?? ""}
                onChange={(e) =>
                  setDocForm((p) =>
                    p ? { ...p, documentNumber: e.target.value } : p,
                  )
                }
                disabled={docSaving}
                maxLength={120}
                placeholder="e.g. 29AABCB1234M1Z5"
                className="w-full h-10 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm text-gray-800 dark:text-gray-200 focus:border-yellow-400 focus:outline-none focus:ring-3 focus:ring-yellow-400/10 disabled:opacity-60"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1.5 block">
                  Issued date
                </span>
                <input
                  type="date"
                  value={docForm?.issuedDate ?? ""}
                  max={docForm?.expiryDate || undefined}
                  onChange={(e) =>
                    setDocForm((p) =>
                      p ? { ...p, issuedDate: e.target.value } : p,
                    )
                  }
                  disabled={docSaving}
                  className="w-full h-10 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm text-gray-800 dark:text-gray-200 focus:border-yellow-400 focus:outline-none focus:ring-3 focus:ring-yellow-400/10 disabled:opacity-60"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1.5 block">
                  Expiry date
                </span>
                <input
                  type="date"
                  value={docForm?.lifetime ? "" : docForm?.expiryDate ?? ""}
                  min={docForm?.issuedDate || undefined}
                  onChange={(e) =>
                    setDocForm((p) =>
                      p ? { ...p, expiryDate: e.target.value } : p,
                    )
                  }
                  disabled={docSaving || (docForm?.lifetime ?? false)}
                  className="w-full h-10 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm text-gray-800 dark:text-gray-200 focus:border-yellow-400 focus:outline-none focus:ring-3 focus:ring-yellow-400/10 disabled:opacity-60"
                />
              </label>
            </div>
            <label className="inline-flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={docForm?.lifetime ?? false}
                onChange={(e) =>
                  setDocForm((p) =>
                    p
                      ? {
                          ...p,
                          lifetime: e.target.checked,
                          expiryDate: e.target.checked ? "" : p.expiryDate,
                        }
                      : p,
                  )
                }
                disabled={docSaving}
                className="w-4 h-4 rounded border-gray-300 text-yellow-500 focus:ring-yellow-400"
              />
              Lifetime validity (no expiry)
            </label>

            <label className="block">
              <span className="text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1.5 block">
                Notes{" "}
                <span className="text-gray-400 font-normal normal-case">(optional)</span>
              </span>
              <textarea
                value={docForm?.notes ?? ""}
                onChange={(e) =>
                  setDocForm((p) => (p ? { ...p, notes: e.target.value } : p))
                }
                disabled={docSaving}
                rows={2}
                maxLength={500}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-800 dark:text-gray-200 focus:border-yellow-400 focus:outline-none focus:ring-3 focus:ring-yellow-400/10 disabled:opacity-60"
              />
            </label>

            <div>
              <span className="text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1.5 block">
                Files {docForm?.id ? <span className="text-gray-400 font-normal normal-case">(adds to existing)</span> : ""}
              </span>
              <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 px-3 py-3">
                {(docForm?.files ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {(docForm?.files ?? []).map((f, idx) => (
                      <span
                        key={`${f.name}-${idx}`}
                        className="inline-flex items-center gap-1 rounded-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-2 py-1 text-[11px] text-gray-700 dark:text-gray-200"
                      >
                        <FileText className="w-3 h-3 text-gray-400" />
                        <span className="truncate max-w-[160px]">{f.name}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setDocForm((p) =>
                              p
                                ? {
                                    ...p,
                                    files: p.files.filter((_, i) => i !== idx),
                                  }
                                : p,
                            )
                          }
                          disabled={docSaving}
                          className="text-gray-400 hover:text-red-500"
                          title="Remove"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Upload className="w-4 h-4 text-gray-400" />
                  <span className="text-xs text-gray-500 dark:text-gray-400 truncate flex-1">
                    {(docForm?.files?.length ?? 0) === 0
                      ? "Select PDF, JPG, or PNG"
                      : `${docForm?.files.length} file${(docForm?.files.length ?? 0) === 1 ? "" : "s"} ready`}
                  </span>
                  <label className="inline-flex items-center gap-1 rounded-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-2 py-1 text-[11px] font-semibold text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800">
                    {(docForm?.files?.length ?? 0) === 0 ? "Browse" : "Add more"}
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      multiple
                      disabled={docSaving}
                      onChange={(e) => {
                        const incoming = Array.from(e.target.files ?? []);
                        if (incoming.length === 0) return;
                        setDocForm((p) => {
                          if (!p) return p;
                          const seen = new Set(
                            p.files.map((f) => `${f.name}_${f.size}`),
                          );
                          const merged = [...p.files];
                          for (const f of incoming) {
                            const key = `${f.name}_${f.size}`;
                            if (!seen.has(key)) {
                              merged.push(f);
                              seen.add(key);
                            }
                          }
                          return { ...p, files: merged };
                        });
                        e.target.value = "";
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="px-6 py-3 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={closeDocForm}
              disabled={docSaving}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDocSave}
              disabled={docSaving || !(docForm?.label ?? "").trim()}
              className="rounded-xl px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 shadow-sm transition-colors disabled:opacity-50 inline-flex items-center gap-2"
            >
              {docSaving && (
                <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              )}
              {docForm?.id ? "Save changes" : "Add document"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Share modal */}
      <Modal
        isOpen={shareOpen}
        onClose={closeShare}
        className="w-[92%] max-w-[520px] rounded-2xl bg-white shadow-2xl dark:bg-gray-900"
      >
        <div className="flex flex-col">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 flex items-center justify-center">
              <Share2 className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-bold text-gray-900 dark:text-white truncate">
                {shareResult
                  ? "Link is ready"
                  : shareTarget === "GROUP"
                    ? `Share "${group.name}" — entire group`
                    : Array.isArray(shareTarget) && shareTarget.length === 1
                      ? `Share "${shareTarget[0].label}"`
                      : "Share documents"}
              </h3>
              <p className="text-[11px] text-gray-400">
                24-hour link · single merged PDF on the other end
              </p>
            </div>
          </div>

          {!shareResult ? (
            <div className="px-6 py-4 space-y-3 max-h-[60vh] overflow-y-auto">
              {shareTarget === "GROUP" && (
                <div className="rounded-lg border border-blue-200 bg-blue-50/60 dark:border-blue-500/30 dark:bg-blue-500/10 px-3 py-2 text-[11px] text-blue-800 dark:text-blue-300">
                  Every document currently in this group ({docs.length}) will be
                  included in the share. Documents added later are picked up
                  automatically until the link expires.
                </div>
              )}
              {Array.isArray(shareTarget) && shareTarget.length > 0 && (
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Sharing:{" "}
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {shareTarget[0].label}
                  </span>
                </p>
              )}
            </div>
          ) : (
            <div className="px-6 py-5 space-y-3">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 dark:border-emerald-500/30 dark:bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-800 dark:text-emerald-300">
                Link generated. Anyone with this URL can preview and download
                the selected documents until{" "}
                <strong>
                  {new Date(shareResult.expiresAt).toLocaleString("en-IN", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </strong>
                .
              </div>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={shareResult.url}
                  onFocus={(e) => e.currentTarget.select()}
                  className="flex-1 h-10 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 text-xs font-mono text-gray-700 dark:text-gray-300"
                />
                <button
                  type="button"
                  onClick={copyShareUrl}
                  className="h-10 px-3 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 shrink-0"
                >
                  {shareCopied ? "Copied" : "Copy"}
                </button>
              </div>
              <a
                href={shareResult.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-yellow-700 hover:text-yellow-800 dark:text-yellow-400"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open in new tab
              </a>
            </div>
          )}

          <div className="px-6 py-3 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={closeShare}
              disabled={shareSubmitting}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors disabled:opacity-60"
            >
              {shareResult ? "Done" : "Cancel"}
            </button>
            {!shareResult && (
              <button
                type="button"
                onClick={handleCreateShare}
                disabled={shareSubmitting}
                className="rounded-xl px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 shadow-sm transition-colors disabled:opacity-50 inline-flex items-center gap-2"
              >
                {shareSubmitting && (
                  <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                )}
                Generate link
              </button>
            )}
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={confirmDeleteDoc !== null}
        title={`Delete "${confirmDeleteDoc?.label ?? "this document"}"?`}
        message={`The document and its files will be removed from this group. This cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Keep"
        variant="danger"
        loading={deleting}
        onConfirm={handleDocDelete}
        onCancel={() => !deleting && setConfirmDeleteDoc(null)}
      />

      {/* Folder lock — setup, forgot, remove. Unlock screen is rendered
          via the early return above when isLocked. */}
      {setupOpen && (
        <FolderLockSetupModal
          groupId={group.id}
          folderName={group.name}
          onClose={() => setSetupOpen(false)}
          onDone={async () => {
            setSetupOpen(false);
            toast.success("Folder locked", `"${group.name}" is now password-protected.`);
            await loadLockStatus();
          }}
        />
      )}
      {forgotOpen && lockStatus && (
        <FolderForgotPasswordModal
          groupId={group.id}
          folderName={group.name}
          recoveryEmail={lockStatus.recoveryEmail}
          onClose={() => setForgotOpen(false)}
          onDone={async () => {
            setForgotOpen(false);
            await loadLockStatus();
          }}
        />
      )}
      {removeOpen && (
        <FolderRemoveLockModal
          groupId={group.id}
          folderName={group.name}
          onClose={() => setRemoveOpen(false)}
          onDone={async () => {
            setRemoveOpen(false);
            toast.success("Lock removed", `"${group.name}" is no longer password-protected.`);
            await loadLockStatus();
          }}
        />
      )}
    </div>
  );
}

// ── Inline header strip for lock controls ──────────────────────────────

function LockControls({
  lockStatus,
  remainingMs,
  onOpenSetup,
  onOpenRemove,
  onRelock,
}: {
  lockStatus: LockStatus | null;
  remainingMs: number;
  onOpenSetup: () => void;
  onOpenRemove: () => void;
  onRelock: () => void;
}) {
  if (!lockStatus) return null;
  // Not locked at all — show a single CTA.
  if (!lockStatus.enabled) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200/80 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800/40">
        <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
          <LockOpen className="w-3.5 h-3.5" />
          This folder is unlocked. Add a password to restrict access for
          other workspace users.
        </div>
        <button
          type="button"
          onClick={onOpenSetup}
          className="inline-flex items-center gap-1.5 rounded-md border border-yellow-200 bg-white px-3 py-1.5 text-[11px] font-bold text-yellow-700 hover:bg-yellow-50 dark:border-yellow-500/30 dark:bg-yellow-500/5 dark:text-yellow-300 dark:hover:bg-yellow-500/15"
        >
          <Lock className="w-3 h-3" />
          Lock folder
        </button>
      </div>
    );
  }
  // Locked AND I'm currently unlocked — show countdown + re-lock + disable.
  const totalSec = Math.floor(remainingMs / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-yellow-200/80 bg-gradient-to-r from-yellow-50 to-amber-50 px-3 py-2 dark:border-yellow-500/30 dark:from-yellow-500/10 dark:to-amber-500/10">
      <div className="flex items-center gap-2 text-xs text-yellow-800 dark:text-yellow-300">
        <Lock className="w-3.5 h-3.5" />
        <span className="font-semibold">Unlocked</span>
        <span className="text-yellow-700/80 dark:text-yellow-400/70">·</span>
        <span className="font-mono font-bold">
          {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
        </span>
        <span className="text-yellow-700/80 dark:text-yellow-400/70">
          remaining
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onRelock}
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          <Lock className="w-3 h-3" />
          Re-lock now
        </button>
        <button
          type="button"
          onClick={onOpenRemove}
          className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-red-600 hover:bg-red-50 dark:border-red-500/30 dark:bg-red-500/5 dark:text-red-300 dark:hover:bg-red-500/15"
        >
          <KeyRound className="w-3 h-3" />
          Disable lock
        </button>
      </div>
    </div>
  );
}

// ── Small bits ─────────────────────────────────────────────────────────────

function DocCard({
  doc,
  onEdit,
  onDelete,
  onShare,
}: {
  doc: Doc;
  onEdit: () => void;
  onDelete: () => void;
  onShare: () => void;
}) {
  const tint = STATUS_TINT[doc.status];
  return (
    <div className={`rounded-xl border p-4 transition-all hover:shadow-md ${tint}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
            {doc.label}
          </p>
          <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {doc.expiryDate
              ? `Exp ${formatDate(doc.expiryDate)}`
              : doc.isLifetime
                ? "Lifetime"
                : "No expiry"}
            {doc.issuedDate ? ` · from ${formatDate(doc.issuedDate)}` : ""}
          </p>
          {doc.documentNumber && (
            <p className="text-[10px] font-mono text-gray-500 dark:text-gray-400 mt-0.5">
              No. {doc.documentNumber}
            </p>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <span className="text-[10px] font-bold uppercase tracking-wider">
            {doc.status === "GREEN" && (
              <CheckCircle2 className="inline w-3 h-3 mr-1" />
            )}
            {(doc.status === "YELLOW" || doc.status === "ORANGE") && (
              <Clock className="inline w-3 h-3 mr-1" />
            )}
            {doc.status === "RED" && (
              <AlertTriangle className="inline w-3 h-3 mr-1" />
            )}
            {statusLabel(doc)}
          </span>
        </div>
      </div>

      {doc.documentUrls.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {doc.documentUrls.map((url, i) => (
            <a
              key={`${url}-${i}`}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md bg-white/70 dark:bg-gray-900/40 border border-current/20 px-2 py-1 text-[10px] font-semibold hover:opacity-80"
            >
              <FileText className="w-3 h-3" />
              File {i + 1}
              <ExternalLink className="w-2.5 h-2.5 opacity-60" />
            </a>
          ))}
        </div>
      )}
      {doc.notes && (
        <p className="mt-2 text-[11px] text-gray-600 dark:text-gray-400 italic">
          {doc.notes}
        </p>
      )}

      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={onShare}
          disabled={doc.documentUrls.length === 0}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-yellow-700 dark:text-yellow-400 hover:text-yellow-800 disabled:opacity-40"
        >
          <Share2 className="w-3 h-3" /> Share
        </button>
        <span className="text-gray-300 dark:text-gray-700">|</span>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-600 dark:text-gray-400 hover:text-yellow-700"
        >
          <Pencil className="w-3 h-3" /> Edit
        </button>
        <span className="text-gray-300 dark:text-gray-700">|</span>
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-red-500 hover:text-red-600"
        >
          <Trash2 className="w-3 h-3" /> Delete
        </button>
      </div>
    </div>
  );
}
