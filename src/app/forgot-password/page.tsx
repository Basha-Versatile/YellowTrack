"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, EyeOff, Mail, ShieldCheck, Lock } from "lucide-react";
import { authAPI } from "@/lib/api";

type Step = "email" | "otp" | "password";

const RESEND_SECONDS = 60;

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [verifyToken, setVerifyToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const requestOtp = async (isResend = false) => {
    setError("");
    setInfo("");
    if (!email) {
      setError("Email is required");
      return;
    }
    setSubmitting(true);
    try {
      await authAPI.forgotPasswordRequest(email);
      setStep("otp");
      setResendIn(RESEND_SECONDS);
      setInfo(
        isResend
          ? "We've sent another code to your email."
          : "We've sent a 6-digit code to your email. It expires in 10 minutes.",
      );
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Could not send code. Try again.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const verifyOtp = async () => {
    setError("");
    setInfo("");
    if (!/^\d{6}$/.test(otp)) {
      setError("Enter the 6-digit code from the email");
      return;
    }
    setSubmitting(true);
    try {
      const res = await authAPI.forgotPasswordVerify(email, otp);
      const token = (res.data.data as { verifyToken: string }).verifyToken;
      setVerifyToken(token);
      setStep("password");
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Could not verify code";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
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
      await authAPI.forgotPasswordReset(
        verifyToken,
        newPassword,
        confirmPassword,
      );
      setInfo("Password updated! Redirecting to sign in…");
      setTimeout(() => router.replace("/auth"), 1200);
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Could not update password";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative w-full min-h-screen overflow-hidden bg-gray-100 dark:bg-gray-950 flex items-center justify-center p-4">
      {/* Animated background — matches the auth page */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 via-transparent to-yellow-600/5 dark:from-yellow-500/20 dark:via-gray-950 dark:to-yellow-600/20" />
        <div className="absolute top-0 left-0 w-[500px] h-[500px] rounded-full bg-yellow-500/5 dark:bg-yellow-500/10 blur-[100px] animate-pulse" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-yellow-400/5 dark:bg-yellow-400/10 blur-[80px] animate-pulse [animation-delay:1s]" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="rounded-2xl bg-white dark:bg-gray-900 shadow-xl shadow-black/10 dark:shadow-black/50 overflow-hidden">
          {/* Header */}
          <div className="px-6 sm:px-8 pt-7 pb-5">
            <div className="flex items-center gap-2.5 mb-5">
              <Image
                src="/images/logo/yellow-track-logo.svg"
                alt="Yellow Track"
                width={64}
                height={64}
                className="w-16 h-16 object-contain"
              />
              <span className="text-lg font-extrabold tracking-tight">
                <span className="text-yellow-500">Yellow</span>
                <span className="text-gray-900 dark:text-white"> Track</span>
              </span>
            </div>

            <Stepper step={step} />

            <h1 className="mt-5 text-xl font-bold text-gray-900 dark:text-white tracking-tight">
              {step === "email" && "Reset your password"}
              {step === "otp" && "Enter the verification code"}
              {step === "password" && "Set a new password"}
            </h1>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {step === "email" &&
                "Enter the email you use to sign in. We'll send a 6-digit code."}
              {step === "otp" && (
                <>
                  We&apos;ve emailed a code to{" "}
                  <span className="font-semibold text-gray-700 dark:text-gray-300">
                    {email}
                  </span>
                  . Codes expire after 10 minutes.
                </>
              )}
              {step === "password" &&
                "Use at least 8 characters. You'll be signed out of all other devices."}
            </p>
          </div>

          {/* Body */}
          <div className="px-6 sm:px-8 pb-7">
            {step === "email" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void requestOtp(false);
                }}
                className="space-y-3.5"
              >
                <FormField label="Email" Icon={Mail}>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                    autoComplete="email"
                    className={inputClass}
                  />
                </FormField>
                {error && <ErrorBanner>{error}</ErrorBanner>}
                <SubmitButton submitting={submitting}>Send code</SubmitButton>
              </form>
            )}

            {step === "otp" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void verifyOtp();
                }}
                className="space-y-3.5"
              >
                <FormField label="6-digit code" Icon={ShieldCheck}>
                  <OtpInput value={otp} onChange={setOtp} />
                </FormField>
                {info && !error && <InfoBanner>{info}</InfoBanner>}
                {error && <ErrorBanner>{error}</ErrorBanner>}
                <SubmitButton submitting={submitting}>Verify code</SubmitButton>
                <div className="flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setStep("email");
                      setOtp("");
                      setError("");
                      setInfo("");
                    }}
                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    Change email
                  </button>
                  <button
                    type="button"
                    disabled={resendIn > 0 || submitting}
                    onClick={() => void requestOtp(true)}
                    className="font-semibold text-yellow-600 dark:text-yellow-400 hover:underline disabled:text-gray-400 disabled:dark:text-gray-500 disabled:cursor-not-allowed disabled:no-underline"
                  >
                    {resendIn > 0
                      ? `Resend in ${resendIn}s`
                      : "Resend code"}
                  </button>
                </div>
              </form>
            )}

            {step === "password" && (
              <form onSubmit={submitPassword} className="space-y-3.5">
                <FormField label="New password" Icon={Lock}>
                  <PasswordInput
                    value={newPassword}
                    onChange={setNewPassword}
                    show={showNew}
                    onToggle={() => setShowNew((v) => !v)}
                    placeholder="At least 8 characters"
                  />
                </FormField>
                <FormField label="Confirm password" Icon={Lock}>
                  <PasswordInput
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                    show={showConfirm}
                    onToggle={() => setShowConfirm((v) => !v)}
                    placeholder="Re-type your new password"
                  />
                </FormField>
                {info && !error && <InfoBanner>{info}</InfoBanner>}
                {error && <ErrorBanner>{error}</ErrorBanner>}
                <SubmitButton submitting={submitting}>
                  Update password
                </SubmitButton>
              </form>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 sm:px-8 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
            <Link
              href="/auth"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

const inputClass =
  "h-10 w-full rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2 text-sm text-gray-800 placeholder:text-gray-400 transition-all duration-200 focus:outline-none focus:border-yellow-400 focus:bg-white focus:ring-3 focus:ring-yellow-400/10 dark:bg-white/5 dark:border-white/10 dark:text-white dark:placeholder:text-white/30 dark:focus:border-yellow-400 dark:focus:bg-white/10";

function Stepper({ step }: { step: Step }) {
  const stepIndex = useMemo(() => {
    if (step === "email") return 0;
    if (step === "otp") return 1;
    return 2;
  }, [step]);
  const labels = ["Email", "Verify", "Reset"];
  return (
    <div className="flex items-center gap-2">
      {labels.map((label, i) => {
        const active = i <= stepIndex;
        const done = i < stepIndex;
        return (
          <div key={label} className="flex items-center gap-2 flex-1">
            <div
              className={`flex items-center justify-center h-6 w-6 rounded-full text-[10px] font-bold transition-colors ${
                active
                  ? done
                    ? "bg-emerald-500 text-white"
                    : "bg-yellow-500 text-white"
                  : "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500"
              }`}
            >
              {i + 1}
            </div>
            <span
              className={`text-[10px] font-bold uppercase tracking-wider ${
                active
                  ? "text-gray-900 dark:text-white"
                  : "text-gray-400 dark:text-gray-500"
              }`}
            >
              {label}
            </span>
            {i < labels.length - 1 && (
              <div
                className={`flex-1 h-px ${
                  done ? "bg-emerald-300 dark:bg-emerald-500/40" : "bg-gray-200 dark:bg-gray-700"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function FormField({
  label,
  Icon,
  children,
}: {
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">
        <Icon className="w-3 h-3" />
        {label}
      </span>
      {children}
    </label>
  );
}

function PasswordInput({
  value,
  onChange,
  show,
  onToggle,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="new-password"
        required
        placeholder={placeholder}
        className={`${inputClass} pr-10`}
      />
      <button
        type="button"
        onClick={onToggle}
        tabIndex={-1}
        aria-label={show ? "Hide password" : "Show password"}
        className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-7 h-7 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

function OtpInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(6, " ").slice(0, 6).split("");

  const setAt = (i: number, ch: string) => {
    const arr = value.padEnd(6, " ").slice(0, 6).split("");
    arr[i] = ch;
    const next = arr.join("").replace(/\s+$/, "");
    onChange(next);
  };

  const onDigitChange = (i: number, raw: string) => {
    const ch = raw.replace(/\D/g, "").slice(-1);
    if (!ch) {
      setAt(i, " ");
      return;
    }
    setAt(i, ch);
    if (i < 5) refs.current[i + 1]?.focus();
  };

  const onKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[i].trim()) {
      if (i > 0) {
        refs.current[i - 1]?.focus();
        setAt(i - 1, " ");
      }
    }
    if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
    if (e.key === "ArrowRight" && i < 5) refs.current[i + 1]?.focus();
  };

  const onPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    e.preventDefault();
    onChange(pasted);
    refs.current[Math.min(pasted.length, 5)]?.focus();
  };

  return (
    <div className="flex gap-2">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d.trim()}
          onChange={(e) => onDigitChange(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e)}
          onPaste={onPaste}
          className="w-full h-12 rounded-lg border border-gray-200 bg-gray-50 text-center text-lg font-bold font-mono text-gray-900 focus:outline-none focus:border-yellow-400 focus:bg-white focus:ring-3 focus:ring-yellow-400/10 dark:bg-white/5 dark:border-white/10 dark:text-white dark:focus:bg-white/10"
        />
      ))}
    </div>
  );
}

function SubmitButton({
  submitting,
  children,
}: {
  submitting: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={submitting}
      className="w-full h-10 rounded-lg bg-gradient-to-r from-yellow-400 to-yellow-500 text-white font-semibold text-sm shadow-md shadow-yellow-500/20 hover:shadow-yellow-500/30 hover:from-yellow-500 hover:to-yellow-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] inline-flex items-center justify-center gap-2"
    >
      {submitting && (
        <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
      )}
      {children}
    </button>
  );
}

function ErrorBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-xs text-red-600 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-400">
      {children}
    </div>
  );
}

function InfoBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-xs text-blue-700 dark:bg-blue-500/10 dark:border-blue-500/20 dark:text-blue-400">
      {children}
    </div>
  );
}
