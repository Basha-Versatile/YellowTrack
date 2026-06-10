"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CreditCard as CreditCardIcon,
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  CheckCircle2,
  CalendarClock,
  IndianRupee,
  BellRing,
  AlertTriangle,
} from "lucide-react";
import { creditCardAPI } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import DatePicker from "@/components/ui/DatePicker";
import { ALERT_LEAD_DAYS, ordinal } from "@/lib/credit-card";

/**
 * Credit-card billing days are stored as 1-31 day-of-month integers, but the
 * UI presents a calendar picker for consistency with the rest of the app.
 * These two helpers convert between the integer and a YYYY-MM-DD string the
 * DatePicker expects. We use the current month as the visible context — the
 * year/month don't actually matter for the stored value, only the day does.
 */
function dayToDateString(day: string | number | null | undefined): string {
  const n = typeof day === "string" ? parseInt(day, 10) : Number(day);
  if (!Number.isFinite(n) || n < 1 || n > 31) return "";
  // Use January so any day 1-31 maps to a valid date. The year/month
  // aren't read downstream — submit pulls only the day-of-month portion.
  const y = new Date().getFullYear();
  const d = String(n).padStart(2, "0");
  return `${y}-01-${d}`;
}
// (dateStringToDay was removed — form state now keeps the full ISO date
// instead of just the day, so the picker's month/year survive re-renders.
// dayFromIso is the runtime helper that extracts the day at submit time.)

type Card = {
  id: string;
  bankName: string;
  last4: string;
  cardholderName: string;
  billDayOfMonth: number;
  dueDayOfMonth: number;
  currentBillAmount: number;
  currentBillMonth: string | null;
  paid: boolean;
  nextDueDate: string;
  daysUntilDue: number;
  isPaidThisCycle: boolean;
  isStale: boolean;
};

type Overview = {
  cards: Card[];
  stats: { totalCards: number; totalBillAmount: number; unpaidCount: number };
  settings: { alertWhatsapp: string | null };
};

type FormState = {
  id: string | null;
  bankName: string;
  last4: string;
  cardholderName: string;
  // ISO YYYY-MM-DD strings — what the DatePicker writes back. Only the
  // day-of-month portion ever gets persisted, but storing the whole picked
  // date here means the calendar UI reopens to the month/year the user
  // actually selected (no surprise jump back to January between renders).
  billDate: string;
  dueDate: string;
  currentBillAmount: string;
};

const dayFromIso = (iso: string): number => {
  const parts = iso?.split("-") ?? [];
  const n = parseInt(parts[2] ?? "", 10);
  return Number.isFinite(n) ? n : 0;
};

const inr = (n: number) =>
  `₹${(Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });

function dueLabel(days: number) {
  if (days < 0) return { text: "Overdue", tone: "red" as const };
  if (days === 0) return { text: "Due today", tone: "red" as const };
  if (days === 1) return { text: "Due tomorrow", tone: "red" as const };
  if (days <= 7) return { text: `Due in ${days} days`, tone: "amber" as const };
  return { text: `Due in ${days} days`, tone: "gray" as const };
}

export default function CreditCardsPage() {
  const toast = useToast();
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [form, setForm] = useState<FormState | null>(null);
  const [original, setOriginal] = useState<Card | null>(null);
  const [saving, setSaving] = useState(false);
  // Confirm-save dialog gate — the form's "Save" button validates and opens
  // this; the user then confirms in a centred dialog before the API call.
  const [confirmSave, setConfirmSave] = useState(false);
  // Confirm-edit dialog gate — clicking Edit on a row stages the card here
  // and shows a "Edit this credit card?" prompt before opening the form.
  const [confirmEdit, setConfirmEdit] = useState<Card | null>(null);

  const [confirmDelete, setConfirmDelete] = useState<Card | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [payTarget, setPayTarget] = useState<Card | null>(null);
  const [paying, setPaying] = useState(false);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [numberInput, setNumberInput] = useState("");
  const [savingNumber, setSavingNumber] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await creditCardAPI.list();
      setData(res.data?.data as Overview);
    } catch {
      toast.error("Failed to load", "Could not load credit cards");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const cards = useMemo(() => data?.cards ?? [], [data]);
  const stats = data?.stats ?? { totalCards: 0, totalBillAmount: 0, unpaidCount: 0 };
  const alertNumber = data?.settings.alertWhatsapp ?? null;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter((c) =>
      `${c.bankName} ${c.cardholderName} ${c.last4}`.toLowerCase().includes(q),
    );
  }, [cards, search]);

  // ── Add / edit ────────────────────────────────────────────────────────
  const openNew = () =>
    setForm({
      id: null,
      bankName: "",
      last4: "",
      cardholderName: "",
      billDate: "",
      dueDate: "",
      currentBillAmount: "",
    });

  const openEdit = (c: Card) => {
    setOriginal(c);
    setForm({
      id: c.id,
      bankName: c.bankName,
      last4: c.last4,
      cardholderName: c.cardholderName,
      // Seed the picker with a synthetic January date so day 1-31 is always
      // valid. The user can then re-pick into any month; whichever month
      // they land on is preserved in form state so the calendar doesn't
      // jump back here on re-render.
      billDate: dayToDateString(c.billDayOfMonth),
      dueDate: dayToDateString(c.dueDayOfMonth),
      currentBillAmount: String(c.currentBillAmount ?? ""),
    });
  };

  const closeForm = () => {
    if (saving) return;
    setForm(null);
    setOriginal(null);
  };

  /**
   * Save button handler — validates the form, then opens the confirm dialog.
   * The actual API call happens in `handleSave` (invoked by the dialog's
   * onConfirm). This two-step gate matches the rest of the credit-card
   * destructive/state-changing actions (delete, mark-paid).
   */
  const requestSave = () => {
    if (!form) return;
    const bankName = form.bankName.trim();
    const cardholderName = form.cardholderName.trim();
    const last4 = form.last4.trim();
    const billDay = dayFromIso(form.billDate);
    const dueDay = dayFromIso(form.dueDate);

    if (!bankName) return toast.error("Bank required", "Enter the bank name");
    if (!/^\d{4}$/.test(last4))
      return toast.error("Invalid card", "Enter the last 4 digits");
    if (!cardholderName)
      return toast.error("Name required", "Enter the cardholder name");
    if (!(billDay >= 1 && billDay <= 31))
      return toast.error("Bill date", "Pick a bill date from the calendar");
    if (!(dueDay >= 1 && dueDay <= 31))
      return toast.error("Due date", "Pick a due date from the calendar");

    setConfirmSave(true);
  };

  const handleSave = async () => {
    if (!form) return;
    const bankName = form.bankName.trim();
    const cardholderName = form.cardholderName.trim();
    const last4 = form.last4.trim();
    const billDay = dayFromIso(form.billDate);
    const dueDay = dayFromIso(form.dueDate);
    const amount = form.currentBillAmount === "" ? 0 : Number(form.currentBillAmount);

    setSaving(true);
    try {
      if (form.id) {
        // Only send fields that actually changed so editing (say) the bank name
        // doesn't reset the paid status (amount changes reset it server-side).
        const patch: Record<string, unknown> = {};
        if (original) {
          if (bankName !== original.bankName) patch.bankName = bankName;
          if (last4 !== original.last4) patch.last4 = last4;
          if (cardholderName !== original.cardholderName)
            patch.cardholderName = cardholderName;
          if (billDay !== original.billDayOfMonth) patch.billDayOfMonth = billDay;
          if (dueDay !== original.dueDayOfMonth) patch.dueDayOfMonth = dueDay;
          if (amount !== (original.currentBillAmount ?? 0))
            patch.currentBillAmount = amount;
        }
        if (Object.keys(patch).length === 0) {
          closeForm();
          return;
        }
        await creditCardAPI.update(form.id, patch);
        toast.success("Card updated", `${bankName} ****${last4}`);
      } else {
        await creditCardAPI.create({
          bankName,
          last4,
          cardholderName,
          billDayOfMonth: billDay,
          dueDayOfMonth: dueDay,
          currentBillAmount: amount || undefined,
        });
        toast.success("Card added", `${bankName} ****${last4}`);
      }
      setForm(null);
      setOriginal(null);
      setConfirmSave(false);
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
      await creditCardAPI.remove(confirmDelete.id);
      toast.success("Card removed", `${confirmDelete.bankName} ****${confirmDelete.last4}`);
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

  const handlePay = async () => {
    if (!payTarget) return;
    setPaying(true);
    try {
      await creditCardAPI.pay(payTarget.id);
      toast.success("Marked paid", `${payTarget.bankName} ****${payTarget.last4}`);
      setPayTarget(null);
      await load();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Could not update";
      toast.error("Failed", msg);
    } finally {
      setPaying(false);
    }
  };

  const openSettings = () => {
    setNumberInput(alertNumber ?? "");
    setSettingsOpen(true);
  };

  const handleSaveNumber = async () => {
    setSavingNumber(true);
    try {
      const value = numberInput.trim();
      await creditCardAPI.updateSettings(value || null);
      toast.success("Saved", value ? "Reminder number updated" : "Reminder number cleared");
      setSettingsOpen(false);
      await load();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Could not save number";
      toast.error("Failed", msg);
    } finally {
      setSavingNumber(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
            <CreditCardIcon className="w-6 h-6 text-yellow-500" />
            Credit Cards
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Track your credit-card bills by hand — enter each month&apos;s amount,
            see totals, and get WhatsApp reminders{" "}
            {ALERT_LEAD_DAYS.join(" & ")} days before the due date.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openSettings}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3.5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:border-yellow-400 transition-colors"
            title="Set the WhatsApp number reminders are sent to"
          >
            <BellRing className="w-3.5 h-3.5" />
            {alertNumber ? "Reminder number" : "Set reminder number"}
          </button>
          <button
            onClick={openNew}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-yellow-400 to-yellow-500 px-4 py-2.5 text-sm font-bold text-white shadow shadow-yellow-500/25 hover:shadow-yellow-500/40 transition-all"
          >
            <Plus className="w-3.5 h-3.5" /> Add card
          </button>
        </div>
      </div>

      {/* Reminder number warning */}
      {!loading && !alertNumber && cards.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-3.5 py-2.5 text-sm text-amber-800 dark:text-amber-300">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>
            No WhatsApp reminder number set — due-date alerts won&apos;t be sent.{" "}
            <button onClick={openSettings} className="font-semibold underline">
              Add one
            </button>
            .
          </span>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard
          icon={<CreditCardIcon className="w-4 h-4 text-yellow-500" />}
          label="Total cards"
          value={String(stats.totalCards)}
        />
        <StatCard
          icon={<IndianRupee className="w-4 h-4 text-brand-500" />}
          label="Total bills"
          value={inr(stats.totalBillAmount)}
        />
        <StatCard
          icon={<CalendarClock className="w-4 h-4 text-red-500" />}
          label="Unpaid"
          value={String(stats.unpaidCount)}
          tone={stats.unpaidCount > 0 ? "red" : undefined}
        />
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by bank, name, or last 4…"
          className="w-full sm:w-96 h-10 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 pl-9 pr-3 text-sm text-gray-800 dark:text-gray-200 focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/20"
        />
      </div>

      {/* List */}
      {loading ? (
        <p className="text-sm text-gray-400 text-center py-10">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800 p-10 text-center">
          <CreditCardIcon className="w-10 h-10 text-gray-300 dark:text-gray-700 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            {search ? "No cards match this search." : "No cards yet."}
          </p>
          {!search && (
            <button
              onClick={openNew}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-yellow-700 hover:text-yellow-800 dark:text-yellow-400"
            >
              <Plus className="w-3.5 h-3.5" /> Add your first card
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => (
            <CardRow
              key={c.id}
              card={c}
              onEdit={() => setConfirmEdit(c)}
              onDelete={() => setConfirmDelete(c)}
              onPay={() => setPayTarget(c)}
            />
          ))}
        </div>
      )}

      {/* Add / edit modal */}
      <Modal
        isOpen={form !== null}
        onClose={closeForm}
        className="w-[92%] max-w-[480px] rounded-2xl bg-white shadow-2xl dark:bg-gray-900"
      >
        <div className="flex flex-col">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 flex items-center justify-center">
              <CreditCardIcon className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-bold text-gray-900 dark:text-white truncate">
                {form?.id ? "Edit card" : "Add credit card"}
              </h3>
              <p className="text-[11px] text-gray-400">
                Bill &amp; due days are fixed once and repeat every month.
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
            <Field label="Bank name" required>
              <input
                autoFocus
                value={form?.bankName ?? ""}
                onChange={(e) => setForm((p) => (p ? { ...p, bankName: e.target.value } : p))}
                disabled={saving}
                maxLength={60}
                placeholder="HDFC Bank"
                className={inputCls}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Last 4 digits" required>
                <input
                  value={form?.last4 ?? ""}
                  onChange={(e) =>
                    setForm((p) =>
                      p ? { ...p, last4: e.target.value.replace(/\D/g, "").slice(0, 4) } : p,
                    )
                  }
                  disabled={saving}
                  inputMode="numeric"
                  placeholder="1234"
                  className={inputCls}
                />
              </Field>
              <Field label="Cardholder" required>
                <input
                  value={form?.cardholderName ?? ""}
                  onChange={(e) =>
                    setForm((p) => (p ? { ...p, cardholderName: e.target.value } : p))
                  }
                  disabled={saving}
                  maxLength={80}
                  placeholder="Vamsi S"
                  className={inputCls}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Bill date (day)" required>
                {/* Calendar picker stays at whatever month/year the user
                    selected — only the day-of-month is persisted, but the
                    full ISO string lives in form state so the picker doesn't
                    visually jump on re-render. */}
                <DatePicker
                  value={form?.billDate ?? ""}
                  onChange={(iso) =>
                    setForm((p) => (p ? { ...p, billDate: iso } : p))
                  }
                  placeholder="Pick a date"
                />
              </Field>
              <Field label="Due date (day)" required>
                <DatePicker
                  value={form?.dueDate ?? ""}
                  onChange={(iso) =>
                    setForm((p) => (p ? { ...p, dueDate: iso } : p))
                  }
                  placeholder="Pick a date"
                />
              </Field>
            </div>
            <Field
              label={form?.id ? "Bill amount (this month)" : "Bill amount (optional)"}
            >
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
                <input
                  value={form?.currentBillAmount ?? ""}
                  onChange={(e) =>
                    setForm((p) =>
                      p ? { ...p, currentBillAmount: e.target.value.replace(/[^\d.]/g, "") } : p,
                    )
                  }
                  disabled={saving}
                  inputMode="decimal"
                  placeholder="0"
                  className={`${inputCls} pl-7`}
                />
              </div>
              {form?.id && (
                <p className="mt-1 text-[11px] text-gray-400">
                  Changing the amount marks it as a new statement and resets the paid status.
                </p>
              )}
            </Field>
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
              onClick={requestSave}
              disabled={saving}
              className="rounded-xl px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 shadow-sm transition-colors disabled:opacity-50 inline-flex items-center gap-2"
            >
              {saving && (
                <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              )}
              {form?.id ? "Update" : "Save"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Reminder-number modal */}
      <Modal
        isOpen={settingsOpen}
        onClose={() => !savingNumber && setSettingsOpen(false)}
        className="w-[92%] max-w-[440px] rounded-2xl bg-white shadow-2xl dark:bg-gray-900"
      >
        <div className="flex flex-col">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 flex items-center justify-center">
              <BellRing className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                WhatsApp reminder number
              </h3>
              <p className="text-[11px] text-gray-400">
                Personal number that due-date alerts are sent to.
              </p>
            </div>
            <button
              type="button"
              onClick={() => !savingNumber && setSettingsOpen(false)}
              className="w-8 h-8 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="px-6 py-4">
            <Field label="WhatsApp number">
              <input
                autoFocus
                value={numberInput}
                onChange={(e) => setNumberInput(e.target.value)}
                disabled={savingNumber}
                placeholder="919812345678"
                className={inputCls}
              />
            </Field>
            <p className="mt-2 text-[11px] text-gray-400">
              Include the country code (e.g. 91 for India). Leave blank to turn reminders off.
            </p>
          </div>
          <div className="px-6 py-3 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => !savingNumber && setSettingsOpen(false)}
              disabled={savingNumber}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveNumber}
              disabled={savingNumber}
              className="rounded-xl px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 shadow-sm transition-colors disabled:opacity-50 inline-flex items-center gap-2"
            >
              {savingNumber && (
                <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              )}
              Save
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={confirmEdit !== null}
        title="Edit this credit card?"
        message={
          confirmEdit
            ? `Open the edit form for ${confirmEdit.bankName} ****${confirmEdit.last4}? You can change the bank, card details, bill/due dates, or current bill amount.`
            : ""
        }
        confirmLabel="Yes, Edit"
        cancelLabel="No, Cancel"
        onConfirm={() => {
          if (confirmEdit) openEdit(confirmEdit);
          setConfirmEdit(null);
        }}
        onCancel={() => setConfirmEdit(null)}
      />

      <ConfirmDialog
        isOpen={confirmSave}
        title={form?.id ? "Update this credit card?" : "Save this credit card?"}
        message={
          form
            ? `${form.bankName.trim() || "Bank"} ****${form.last4 || "----"} — bill on the ${ordinal(dayFromIso(form.billDate))}, due on the ${ordinal(dayFromIso(form.dueDate))} every month.`
            : ""
        }
        confirmLabel={form?.id ? "Update" : "Save"}
        cancelLabel="Cancel"
        loading={saving}
        onConfirm={handleSave}
        onCancel={() => !saving && setConfirmSave(false)}
      />

      <ConfirmDialog
        isOpen={confirmDelete !== null}
        title="Are you sure you want to delete this credit card?"
        message={
          confirmDelete
            ? `${confirmDelete.bankName} ****${confirmDelete.last4} will be removed from your tracker. Past bill history is kept for your records.`
            : "This removes the card from your tracker. Past bill history is kept for your records."
        }
        confirmLabel="Yes, Delete"
        cancelLabel="No, Cancel"
        variant="danger"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => !deleting && setConfirmDelete(null)}
      />

      <ConfirmDialog
        isOpen={payTarget !== null}
        title={`Mark ${payTarget ? inr(payTarget.currentBillAmount) : ""} paid?`}
        message={`Marks this month's ${payTarget?.bankName ?? ""} ****${payTarget?.last4 ?? ""} bill as paid and records it to history. Reminders for this cycle stop.`}
        confirmLabel="Mark paid"
        cancelLabel="Cancel"
        loading={paying}
        onConfirm={handlePay}
        onCancel={() => !paying && setPayTarget(null)}
      />
    </div>
  );
}

// ── Small bits ───────────────────────────────────────────────────────────────

const inputCls =
  "w-full h-10 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm text-gray-800 dark:text-gray-200 focus:border-yellow-400 focus:outline-none focus:ring-3 focus:ring-yellow-400/10 disabled:opacity-60";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1.5 block">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
    </label>
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
  value: string;
  tone?: "red";
}) {
  const valueClass =
    tone === "red"
      ? "text-red-600 dark:text-red-400"
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

function CardRow({
  card,
  onEdit,
  onDelete,
  onPay,
}: {
  card: Card;
  onEdit: () => void;
  onDelete: () => void;
  onPay: () => void;
}) {
  const due = dueLabel(card.daysUntilDue);
  const dueToneCls =
    due.tone === "red"
      ? "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400"
      : due.tone === "amber"
        ? "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400"
        : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300";

  return (
    <div className="rounded-2xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-white/[0.02] p-4 sm:p-5 transition-all hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-base font-bold text-gray-900 dark:text-white">
              {card.bankName}
            </p>
            <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
              •••• {card.last4}
            </span>
            {card.isPaidThisCycle && (
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                <CheckCircle2 className="w-2.5 h-2.5" /> Paid
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {card.cardholderName} · Bill date {ordinal(card.billDayOfMonth)}
          </p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {!card.isPaidThisCycle && (
            <button
              type="button"
              onClick={onPay}
              className="rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 px-2.5 py-1.5 text-xs font-bold"
              title="Mark this month's bill paid"
            >
              Pay
            </button>
          )}
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
            title="Remove"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xl font-black text-gray-900 dark:text-white">
            {inr(card.currentBillAmount)}
          </p>
          {card.isStale && (
            <button
              onClick={onEdit}
              className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 hover:underline"
            >
              Enter this month&apos;s bill →
            </button>
          )}
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold ${dueToneCls}`}
        >
          <CalendarClock className="w-3.5 h-3.5" />
          {due.text} ({fmtDate(card.nextDueDate)})
        </span>
      </div>
    </div>
  );
}
