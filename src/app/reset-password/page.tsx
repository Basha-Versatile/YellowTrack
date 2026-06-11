"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { authAPI } from "@/lib/api";
import { useToast } from "@/context/ToastContext";

export default function ResetPasswordPage() {
  const router = useRouter();
  const toast = useToast();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setSubmitting(true);
    try {
      await authAPI.resetPassword(newPassword, confirmPassword);
      // Fire before navigating — the ToastProvider lives in the root layout,
      // so the toast survives the client-side replace into /dashboard.
      toast.success(
        "Password Updated Successfully",
        "Your new password is now active.",
      );
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Could not update password";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-white/[0.02]">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">
        Set a new password
      </h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Your account requires a fresh password before you can continue.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <PasswordField
          label="New password"
          value={newPassword}
          onChange={setNewPassword}
          show={showNew}
          onToggle={() => setShowNew((v) => !v)}
        />
        <PasswordField
          label="Confirm password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          show={showConfirm}
          onToggle={() => setShowConfirm((v) => !v)}
        />
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full h-11 rounded-xl bg-gradient-to-r from-brand-400 to-brand-500 text-white font-semibold text-sm shadow-lg disabled:opacity-50"
        >
          {submitting ? "Saving…" : "Save and continue"}
        </button>
      </form>
    </div>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  show,
  onToggle,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wider">
        {label}
      </label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="new-password"
          required
          className="w-full h-11 rounded-xl border border-gray-200 bg-white pl-4 pr-11 text-sm text-gray-800 focus:border-brand-400 focus:outline-none focus:ring-3 focus:ring-brand-400/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white transition-all"
        />
        <button
          type="button"
          onClick={onToggle}
          tabIndex={-1}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:text-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
