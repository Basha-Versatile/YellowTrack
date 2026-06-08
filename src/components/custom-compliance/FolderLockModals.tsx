"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Lock,
  LockOpen,
  Mail,
  KeyRound,
  ShieldAlert,
  X,
} from "lucide-react";
import { customComplianceAPI } from "@/lib/api";

const PASSWORD_MIN = 6;
const EMAIL_RE = /^\S+@\S+\.\S+$/;

function parseApiMessage(err: unknown): string {
  return (
    (err as { response?: { data?: { message?: string; errors?: string[] } } })
      ?.response?.data?.errors?.[0] ??
    (err as { response?: { data?: { message?: string } } })?.response?.data
      ?.message ??
    "Something went wrong"
  );
}

// ── First-time lock setup ─────────────────────────────────────────────

export function FolderLockSetupModal({
  groupId,
  folderName,
  onClose,
  onDone,
}: {
  groupId: string;
  folderName: string;
  onClose: () => void;
  onDone: () => Promise<void> | void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailValid = EMAIL_RE.test(email.trim());
  const pwValid = password.length >= PASSWORD_MIN;
  const pwMatch = password === confirmPassword && confirmPassword.length > 0;
  const canSubmit = emailValid && pwValid && pwMatch && !submitting;

  const onSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await customComplianceAPI.enableLock(groupId, {
        email: email.trim(),
        password,
        confirmPassword,
      });
      await onDone();
    } catch (err) {
      setError(parseApiMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell
      title="Lock folder"
      icon={<Lock className="w-4 h-4" />}
      onClose={submitting ? undefined : onClose}
      tone="brand"
    >
      <div className="space-y-3.5">
        <p className="text-xs text-gray-600 dark:text-gray-400">
          Set a password to restrict access to{" "}
          <span className="font-semibold text-gray-900 dark:text-white">
            {folderName}
          </span>{" "}
          for other users in your workspace. You&rsquo;ll be able to reset the
          password using the recovery email below.
        </p>
        <Field
          label="Recovery email"
          icon={<Mail className="w-3 h-3" />}
          required
          hint="If anyone forgets the password, the reset code will be sent here."
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@example.com"
            autoComplete="email"
            className={fieldInputClass}
          />
        </Field>
        <Field label="Password" icon={<KeyRound className="w-3 h-3" />} required>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={`At least ${PASSWORD_MIN} characters`}
            autoComplete="new-password"
            className={fieldInputClass}
          />
        </Field>
        <Field label="Confirm password" icon={<KeyRound className="w-3 h-3" />} required>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Type the same password again"
            autoComplete="new-password"
            className={fieldInputClass}
          />
        </Field>
        {error && <ErrorMsg>{error}</ErrorMsg>}
      </div>
      <ModalFooter
        cancelLabel="Cancel"
        confirmLabel={submitting ? "Locking…" : "Lock folder"}
        onCancel={onClose}
        onConfirm={() => void onSubmit()}
        confirmDisabled={!canSubmit}
        tone="brand"
      />
    </ModalShell>
  );
}

// ── Unlock screen (replaces folder content when locked) ───────────────

export function FolderUnlockScreen({
  groupId,
  folderName,
  recoveryEmail,
  blockedUntil,
  onUnlocked,
  onForgot,
}: {
  groupId: string;
  folderName: string;
  recoveryEmail: string | null;
  blockedUntil: string | null;
  onUnlocked: () => Promise<void> | void;
  onForgot: () => void;
}) {
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Local countdown for the rate-limit lockout. Updated every second; the
  // password field stays disabled while > 0.
  const [blockedMs, setBlockedMs] = useState(0);
  useEffect(() => {
    if (!blockedUntil) {
      setBlockedMs(0);
      return;
    }
    const tick = () => {
      setBlockedMs(
        Math.max(0, new Date(blockedUntil).getTime() - Date.now()),
      );
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [blockedUntil]);

  const isBlocked = blockedMs > 0;
  const blockedLabel = useMemo(() => {
    const m = Math.ceil(blockedMs / 60_000);
    return `Locked out — try again in ${m} minute${m === 1 ? "" : "s"}`;
  }, [blockedMs]);

  const onSubmit = async () => {
    if (!password || submitting || isBlocked) return;
    setSubmitting(true);
    setError(null);
    try {
      await customComplianceAPI.unlock(groupId, password);
      setPassword("");
      await onUnlocked();
    } catch (err) {
      setError(parseApiMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[55vh] px-4">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200/80 bg-white p-6 shadow-md dark:border-gray-800 dark:bg-white/[0.02]">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-yellow-400 to-amber-500 text-white shadow-md shadow-yellow-500/30">
            <Lock className="w-5 h-5" />
          </div>
          <h2 className="mt-3 text-base font-bold text-gray-900 dark:text-white">
            {folderName}
          </h2>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            This folder is locked. Enter the password to unlock it for 3
            minutes.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void onSubmit();
          }}
          className="mt-4 space-y-2.5"
        >
          <input
            autoFocus
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Folder password"
            disabled={submitting || isBlocked}
            autoComplete="current-password"
            className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-yellow-400 focus:outline-none focus:ring-3 focus:ring-yellow-400/10 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
          {isBlocked ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
              <ShieldAlert className="w-3.5 h-3.5 inline mr-1" />
              {blockedLabel}
            </div>
          ) : (
            error && <ErrorMsg>{error}</ErrorMsg>
          )}
          <button
            type="submit"
            disabled={!password || submitting || isBlocked}
            className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-yellow-400 to-yellow-500 text-sm font-bold text-white shadow shadow-yellow-500/30 hover:shadow-yellow-500/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all"
          >
            <LockOpen className="w-3.5 h-3.5" />
            {submitting ? "Unlocking…" : "Unlock"}
          </button>
        </form>

        <div className="mt-3 flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
          <span>
            {recoveryEmail
              ? `Reset code goes to ${maskEmail(recoveryEmail)}`
              : ""}
          </span>
          <button
            type="button"
            onClick={onForgot}
            disabled={!recoveryEmail}
            className="font-semibold text-yellow-700 hover:text-yellow-800 dark:text-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Forgot password?
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Forgot password (OTP) ─────────────────────────────────────────────

export function FolderForgotPasswordModal({
  groupId,
  folderName,
  recoveryEmail,
  onClose,
  onDone,
}: {
  groupId: string;
  folderName: string;
  recoveryEmail: string | null;
  onClose: () => void;
  onDone: () => Promise<void> | void;
}) {
  const [stage, setStage] = useState<"send" | "verify">("send");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldownSec, setCooldownSec] = useState(0);

  useEffect(() => {
    if (cooldownSec <= 0) return;
    const id = window.setTimeout(() => setCooldownSec((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [cooldownSec]);

  const sendOtp = async () => {
    if (sending || cooldownSec > 0) return;
    setSending(true);
    setError(null);
    try {
      await customComplianceAPI.requestLockReset(groupId);
      setStage("verify");
      setCooldownSec(60);
    } catch (err) {
      setError(parseApiMessage(err));
    } finally {
      setSending(false);
    }
  };

  const verify = async () => {
    if (submitting) return;
    if (!/^\d{6}$/.test(otp.trim())) {
      setError("Enter the 6-digit code from the email");
      return;
    }
    if (newPassword.length < PASSWORD_MIN) {
      setError(`Password must be at least ${PASSWORD_MIN} characters`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await customComplianceAPI.verifyLockReset(groupId, {
        otp: otp.trim(),
        newPassword,
        confirmPassword,
      });
      await onDone();
    } catch (err) {
      setError(parseApiMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell
      title="Reset folder password"
      icon={<KeyRound className="w-4 h-4" />}
      onClose={submitting ? undefined : onClose}
      tone="brand"
    >
      <div className="space-y-3.5">
        <p className="text-xs text-gray-600 dark:text-gray-400">
          {recoveryEmail
            ? `Send a 6-digit code to ${maskEmail(recoveryEmail)} to reset the password for `
            : `Send a code to your recovery email to reset the password for `}
          <span className="font-semibold text-gray-900 dark:text-white">
            {folderName}
          </span>
          .
        </p>

        {stage === "send" ? (
          <button
            type="button"
            onClick={() => void sendOtp()}
            disabled={sending || !recoveryEmail}
            className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-yellow-400 to-yellow-500 text-sm font-bold text-white shadow shadow-yellow-500/30 hover:shadow-yellow-500/50 disabled:opacity-50"
          >
            <Mail className="w-3.5 h-3.5" />
            {sending ? "Sending…" : "Send code"}
          </button>
        ) : (
          <>
            <Field label="Verification code" icon={<KeyRound className="w-3 h-3" />} required>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) =>
                  setOtp(e.target.value.replace(/[^\d]/g, "").slice(0, 6))
                }
                placeholder="6-digit code"
                className={`${fieldInputClass} font-mono tracking-[0.4em] text-center text-base`}
              />
            </Field>
            <Field label="New password" icon={<KeyRound className="w-3 h-3" />} required>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={`At least ${PASSWORD_MIN} characters`}
                className={fieldInputClass}
              />
            </Field>
            <Field label="Confirm password" icon={<KeyRound className="w-3 h-3" />} required>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Type the same password again"
                className={fieldInputClass}
              />
            </Field>
            <div className="flex items-center justify-end text-[11px]">
              <button
                type="button"
                onClick={() => void sendOtp()}
                disabled={sending || cooldownSec > 0}
                className="font-semibold text-yellow-700 hover:text-yellow-800 dark:text-yellow-400 disabled:opacity-50"
              >
                {cooldownSec > 0
                  ? `Resend in ${cooldownSec}s`
                  : sending
                    ? "Sending…"
                    : "Resend code"}
              </button>
            </div>
          </>
        )}
        {error && <ErrorMsg>{error}</ErrorMsg>}
      </div>
      {stage === "verify" && (
        <ModalFooter
          cancelLabel="Cancel"
          confirmLabel={submitting ? "Updating…" : "Update password"}
          onCancel={onClose}
          onConfirm={() => void verify()}
          confirmDisabled={submitting || !otp || !newPassword || !confirmPassword}
          tone="brand"
        />
      )}
    </ModalShell>
  );
}

// ── Remove lock ───────────────────────────────────────────────────────

export function FolderRemoveLockModal({
  groupId,
  folderName,
  onClose,
  onDone,
}: {
  groupId: string;
  folderName: string;
  onClose: () => void;
  onDone: () => Promise<void> | void;
}) {
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    if (!password || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await customComplianceAPI.removeLock(groupId, password);
      await onDone();
    } catch (err) {
      setError(parseApiMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell
      title="Disable folder lock"
      icon={<KeyRound className="w-4 h-4" />}
      onClose={submitting ? undefined : onClose}
      tone="danger"
    >
      <div className="space-y-3.5">
        <p className="text-xs text-gray-600 dark:text-gray-400">
          Enter the current password to remove the lock from{" "}
          <span className="font-semibold text-gray-900 dark:text-white">
            {folderName}
          </span>
          . Everyone in your workspace will be able to access this folder
          without a password again.
        </p>
        <Field label="Current password" icon={<KeyRound className="w-3 h-3" />} required>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            className={fieldInputClass}
          />
        </Field>
        {error && <ErrorMsg>{error}</ErrorMsg>}
      </div>
      <ModalFooter
        cancelLabel="Cancel"
        confirmLabel={submitting ? "Disabling…" : "Disable lock"}
        onCancel={onClose}
        onConfirm={() => void onSubmit()}
        confirmDisabled={!password || submitting}
        tone="danger"
      />
    </ModalShell>
  );
}

// ── Small shared bits ─────────────────────────────────────────────────

const fieldInputClass =
  "h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-yellow-400 focus:outline-none focus:ring-3 focus:ring-yellow-400/10 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-white";

function Field({
  label,
  icon,
  required,
  hint,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5 flex items-center gap-1">
        {icon}
        {label}
        {required && <span className="text-red-500">*</span>}
      </span>
      {children}
      {hint && (
        <p className="mt-1 text-[10px] text-gray-400 dark:text-gray-500">{hint}</p>
      )}
    </label>
  );
}

function ErrorMsg({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
      {children}
    </div>
  );
}

function ModalShell({
  title,
  icon,
  onClose,
  tone = "brand",
  children,
}: {
  title: string;
  icon: React.ReactNode;
  onClose?: () => void;
  tone?: "brand" | "danger";
  children: React.ReactNode;
}) {
  const headerClass =
    tone === "danger"
      ? "bg-gradient-to-r from-red-500 to-rose-600"
      : "bg-gradient-to-r from-yellow-400 to-amber-500";
  return (
    <div className="fixed inset-0 z-[100002] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div
        className="w-full max-w-md rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`flex items-center justify-between rounded-t-2xl px-5 py-4 text-white ${headerClass}`}
        >
          <div className="flex items-center gap-2">
            {icon}
            <h3 className="text-sm font-bold uppercase tracking-wider">
              {title}
            </h3>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-7 w-7 items-center justify-center rounded-md text-white/80 hover:bg-white/15 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

function ModalFooter({
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
  confirmDisabled,
  tone = "brand",
}: {
  cancelLabel: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirmDisabled?: boolean;
  tone?: "brand" | "danger";
}) {
  const confirmClass =
    tone === "danger"
      ? "bg-gradient-to-r from-red-500 to-rose-600 shadow-red-500/20 hover:shadow-red-500/40"
      : "bg-gradient-to-r from-yellow-400 to-yellow-500 shadow-yellow-500/30 hover:shadow-yellow-500/50";
  return (
    <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-3 dark:border-gray-800 -mx-5 -mb-4 mt-4 rounded-b-2xl bg-gray-50 dark:bg-gray-900/60">
      <button
        type="button"
        onClick={onCancel}
        className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
      >
        {cancelLabel}
      </button>
      <button
        type="button"
        onClick={onConfirm}
        disabled={confirmDisabled}
        className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold text-white shadow disabled:opacity-50 disabled:cursor-not-allowed ${confirmClass}`}
      >
        {confirmLabel}
      </button>
    </div>
  );
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local.slice(0, 2)}${"*".repeat(Math.max(1, local.length - 4))}${local.slice(-2)}@${domain}`;
}
