"use client";
import React, { useState } from "react";

import { useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { EyeCloseIcon, EyeIcon } from "@/icons";
import Image from "next/image";

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      className="flex items-center justify-center w-9 h-9 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/10 dark:text-white/70 dark:hover:bg-white/20 transition-colors"
      aria-label="Toggle theme"
    >
      {theme === "dark" ? (
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M10 1.54c.414 0 .75.336.75.75v1.25a.75.75 0 0 1-1.5 0V2.29a.75.75 0 0 1 .75-.75Zm0 5.253a3.207 3.207 0 1 0 0 6.414 3.207 3.207 0 0 0 0-6.414ZM5.294 10a4.707 4.707 0 1 1 9.414 0 4.707 4.707 0 0 1-9.414 0Zm10.687-4.92a.75.75 0 0 0-1.06-1.06l-.884.884a.75.75 0 0 0 1.06 1.06l.884-.884ZM18.458 10a.75.75 0 0 1-.75.75h-1.25a.75.75 0 0 1 0-1.5h1.25a.75.75 0 0 1 .75.75Zm-3.477 5.98a.75.75 0 0 0 1.06-1.06l-.884-.884a.75.75 0 0 0-1.06 1.06l.884.884ZM10 15.709a.75.75 0 0 1 .75.75v1.25a.75.75 0 0 1-1.5 0v-1.25a.75.75 0 0 1 .75-.75Zm-4.036-.612a.75.75 0 0 0-1.061-1.061l-.884.884a.75.75 0 0 0 1.06 1.06l.885-.883ZM4.292 10a.75.75 0 0 1-.75.75H2.292a.75.75 0 0 1 0-1.5h1.25a.75.75 0 0 1 .75.75Zm.611-4.036a.75.75 0 0 0 1.06-1.061l-.883-.884a.75.75 0 0 0-1.061 1.06l.884.885Z"
            fill="currentColor"
          />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
          <path
            d="M17.455 11.97l.725.191a.75.75 0 0 0-1.065-.744l.34.553ZM8.031 2.546l.549.51a.75.75 0 0 0-.257-1.39l-.292.88ZM12.915 13.004c-3.268 0-5.918-2.65-5.918-5.919h-1.5c0 4.097 3.321 7.419 7.418 7.419v-1.5Zm4.029-1.583a7.356 7.356 0 0 1-4.029 1.583v1.5c1.95 0 3.727-.754 5.05-1.984l-1.021-1.099Zm-.215.358c-.786 2.982-3.502 5.18-6.729 5.18v1.5c3.925 0 7.225-2.673 8.18-6.298l-1.45-.382ZM10 16.959c-3.843 0-6.958-3.116-6.958-6.959h-1.5c0 4.672 3.787 8.459 8.458 8.459v-1.5ZM3.042 10c0-3.228 2.198-5.943 5.18-6.729l-.383-1.45C4.215 2.775 1.542 6.074 1.542 10h1.5Zm3.955-2.915c0-1.557.6-2.971 1.583-4.029L7.481 2.035A8.418 8.418 0 0 0 5.497 7.085h1.5Z"
            fill="currentColor"
          />
        </svg>
      )}
    </button>
  );
}

export default function AuthPage() {
  const searchParams = useSearchParams();
  const modeParam = searchParams.get("mode");
  const [isSignUp, setIsSignUp] = useState(modeParam === "signup");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Sign In fields
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);

  // Sign Up fields
  const [name, setName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");

  const { login, register } = useAuth();

  // Backend registerSchema enforces min(6), so every valid account password
  // is at least 6 chars. Use the same floor on login to short-circuit hopeless
  // 1-char attempts before they hit the API.
  const PASSWORD_MIN = 6;
  const EMAIL_RE = /^\S+@\S+\.\S+$/;

  const loginEmailValid = EMAIL_RE.test(loginEmail.trim());
  const loginPasswordValid = loginPassword.length >= PASSWORD_MIN;
  const loginInvalid = !loginEmailValid || !loginPasswordValid;

  const regEmailValid = EMAIL_RE.test(regEmail.trim());
  const regPasswordValid = regPassword.length >= PASSWORD_MIN;
  const regNameValid = name.trim().length >= 2;
  const registerInvalid = !regNameValid || !regEmailValid || !regPasswordValid;

  // Strength score 0-4 used to drive the meter on the Sign Up form.
  // 0 = empty, 1 = too short, 2 = fair, 3 = good, 4 = strong.
  const passwordStrength = (p: string): { score: 0 | 1 | 2 | 3 | 4; label: string } => {
    if (!p) return { score: 0, label: "" };
    if (p.length < PASSWORD_MIN) return { score: 1, label: "Too short" };
    let bonuses = 0;
    if (p.length >= 10) bonuses++;
    if (/[A-Z]/.test(p) && /[a-z]/.test(p)) bonuses++;
    if (/\d/.test(p)) bonuses++;
    if (/[^A-Za-z0-9]/.test(p)) bonuses++;
    if (bonuses <= 1) return { score: 2, label: "Fair" };
    if (bonuses <= 2) return { score: 3, label: "Good" };
    return { score: 4, label: "Strong" };
  };

  const regStrength = passwordStrength(regPassword);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (loginInvalid) {
      setError(
        !loginEmailValid
          ? "Enter a valid email address"
          : `Password must be at least ${PASSWORD_MIN} characters`,
      );
      return;
    }
    if (!loginEmail || !loginPassword) {
      setError("Email and password are required");
      return;
    }
    setLoading(true);
    try {
      await login(loginEmail, loginPassword, rememberMe);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (registerInvalid) {
      setError(
        !regNameValid
          ? "Name must be at least 2 characters"
          : !regEmailValid
            ? "Enter a valid email address"
            : `Password must be at least ${PASSWORD_MIN} characters`,
      );
      return;
    }
    setLoading(true);
    try {
      await register(name, regEmail, regPassword);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setError("");
    setShowPassword(false);
    setIsSignUp(!isSignUp);
  };

  const inputClass =
    "h-10 w-full rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2 text-sm text-gray-800 placeholder:text-gray-400 transition-all duration-200 focus:outline-none focus:border-yellow-400 focus:bg-white focus:ring-3 focus:ring-yellow-400/10 dark:bg-white/5 dark:border-white/10 dark:text-white dark:placeholder:text-white/30 dark:focus:border-yellow-400 dark:focus:bg-white/10 dark:focus:ring-yellow-400/10";

  const passwordInputClass = `${inputClass} pr-10`;

  // The yellow-track-logo.svg packs the wordmark inside a 1080x1080 canvas
  // with ~60% whitespace, so the embedded "Yellow Track" text becomes
  // unreadable below ~280px. On the auth screens we have a narrow column, so
  // we render the brand as a small mark + crisp typographic wordmark instead.
  const logo = (
    <div className="mb-3 flex items-center gap-2.5">
      <Image
        src="/images/logo/yellow-track-logo.svg"
        alt=""
        aria-hidden
        width={48}
        height={48}
        className="h-11 w-11 object-contain shrink-0"
      />
      <div className="flex flex-col leading-none">
        <span className="text-[22px] font-extrabold tracking-tight">
          <span className="text-yellow-500">Yellow</span>
          <span className="text-gray-900 dark:text-white"> Track</span>
        </span>
        <span className="mt-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-white/40">
          Fleet Compliance
        </span>
      </div>
    </div>
  );

  return (
    <div className="relative w-full min-h-screen overflow-hidden bg-gray-100 dark:bg-gray-950 flex items-center justify-center">
      {/* Animated background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 via-transparent to-yellow-600/5 dark:from-yellow-500/20 dark:via-gray-950 dark:to-yellow-600/20" />
        <div className="absolute top-0 left-0 w-[500px] h-[500px] rounded-full bg-yellow-500/5 dark:bg-yellow-500/10 blur-[100px] animate-pulse" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-yellow-400/5 dark:bg-yellow-400/10 blur-[80px] animate-pulse [animation-delay:1s]" />
        <div
          className="absolute inset-0 opacity-[0.02] dark:opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)`,
            backgroundSize: "50px 50px",
          }}
        />
      </div>

      {/* Theme toggle - fixed top right */}
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      {/* Main container */}
      <div className="relative z-10 w-full max-w-[880px] mx-4 sm:mx-6">
        <div className="relative w-full min-h-[520px] sm:h-[500px] rounded-2xl overflow-hidden shadow-xl shadow-black/10 dark:shadow-black/50">

          {/* ── SIGN IN FORM PANEL ── */}
          <div
            className={`absolute inset-0 w-full lg:w-1/2 flex items-center justify-center transition-all duration-700 ease-in-out ${
              isSignUp
                ? "lg:translate-x-full opacity-0 pointer-events-none scale-95"
                : "translate-x-0 opacity-100 scale-100"
            }`}
          >
            <div className="w-full h-full flex items-center justify-center bg-white dark:bg-gray-900 px-6 sm:px-10">
              <div className="w-full max-w-xs">
                <div className="mb-1">
                  {logo}
                  <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
                    Welcome back
                  </h1>
                  <p className="mt-1 text-gray-500 dark:text-gray-400 text-xs">
                    Sign in to manage your fleet compliance
                  </p>
                </div>

                <form onSubmit={handleSignIn} className="space-y-3.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">Email</label>
                    <input
                      type="email"
                      placeholder="admin@fleet.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        aria-describedby="login-password-hint"
                        className={passwordInputClass}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        className="absolute right-2 top-1/2 z-30 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 [&_svg]:h-[18px] [&_svg]:w-[18px]"
                      >
                        {showPassword ? (
                          <EyeIcon className="fill-current" />
                        ) : (
                          <EyeCloseIcon className="fill-current" />
                        )}
                      </button>
                    </div>
                    <p
                      id="login-password-hint"
                      className={`mt-1 text-[10px] leading-snug ${
                        loginPassword.length > 0 && !loginPasswordValid
                          ? "text-red-500 dark:text-red-400"
                          : "text-gray-400 dark:text-white/40"
                      }`}
                    >
                      {loginPassword.length === 0
                        ? `Required · at least ${PASSWORD_MIN} characters`
                        : !loginPasswordValid
                          ? `Password must be at least ${PASSWORD_MIN} characters`
                          : ` `}
                    </p>
                  </div>

                  {error && !isSignUp && (
                    <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-xs text-red-600 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-400">
                      {error}
                    </div>
                  )}

                  <div className="-mt-1 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <label className="flex items-center gap-2 cursor-pointer select-none text-[11px] font-semibold text-gray-600 dark:text-gray-300">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          className="h-3.5 w-3.5 rounded border-gray-300 text-yellow-500 focus:ring-2 focus:ring-yellow-400/40 dark:border-white/20 dark:bg-white/5"
                        />
                        Remember me
                      </label>
                      <a
                        href="/forgot-password"
                        className="text-[11px] font-semibold text-yellow-600 hover:text-yellow-700 dark:text-yellow-400 dark:hover:text-yellow-300"
                      >
                        Forgot password?
                      </a>
                    </div>
                    <p className="text-[10px] leading-snug text-gray-400 dark:text-white/40">
                      {rememberMe
                        ? "Stay signed in on this device for up to 7 days."
                        : "You'll be signed out automatically when you close this browser."}
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || loginInvalid}
                    className="w-full h-10 rounded-lg bg-gradient-to-r from-yellow-400 to-yellow-500 text-white font-semibold text-sm shadow-md shadow-yellow-500/20 hover:shadow-yellow-500/30 hover:from-yellow-500 hover:to-yellow-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                  >
                    {loading && !isSignUp ? "Signing in..." : "Sign In"}
                  </button>
                </form>

                {/* <div className="mt-3.5 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-[11px] text-amber-700 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-400">
                  <p className="font-semibold">Demo: admin@fleet.com / admin123</p>
                </div> */}

                <p className="mt-4 text-xs text-gray-500 dark:text-gray-400 lg:hidden text-center">
                  Don&apos;t have an account?{" "}
                  <button onClick={switchMode} className="text-yellow-500 font-semibold hover:text-yellow-600">
                    Sign Up
                  </button>
                </p>
              </div>
            </div>
          </div>

          {/* ── SIGN UP FORM PANEL ── */}
          <div
            className={`absolute inset-0 w-full lg:w-1/2 flex items-center justify-center transition-all duration-700 ease-in-out ${
              isSignUp
                ? "lg:translate-x-full opacity-100 scale-100"
                : "lg:translate-x-[200%] translate-x-full opacity-0 pointer-events-none scale-95"
            }`}
          >
            <div className="w-full h-full flex items-center justify-center bg-white dark:bg-gray-900 px-6 sm:px-10">
              <div className="w-full max-w-xs">
                <div className="mb-5">
                  {logo}
                  <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
                    Create account
                  </h1>
                  <p className="mt-1 text-gray-500 dark:text-gray-400 text-xs">
                    Get started with fleet compliance management
                  </p>
                </div>

                <form onSubmit={handleSignUp} className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">Full Name</label>
                    <input
                      type="text"
                      placeholder="John Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">Email</label>
                    <input
                      type="email"
                      placeholder="you@company.com"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        placeholder={`At least ${PASSWORD_MIN} characters`}
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        aria-describedby="reg-password-strength"
                        className={passwordInputClass}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        className="absolute right-2 top-1/2 z-30 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 [&_svg]:h-[18px] [&_svg]:w-[18px]"
                      >
                        {showPassword ? (
                          <EyeIcon className="fill-current" />
                        ) : (
                          <EyeCloseIcon className="fill-current" />
                        )}
                      </button>
                    </div>
                    {(() => {
                      // 4-segment strength meter. Empty state still shows the
                      // segments (greyed) so the affordance is discoverable.
                      const filled = regStrength.score;
                      const barColor =
                        regStrength.score === 1
                          ? "bg-red-500"
                          : regStrength.score === 2
                            ? "bg-amber-500"
                            : regStrength.score === 3
                              ? "bg-yellow-500"
                              : regStrength.score === 4
                                ? "bg-emerald-500"
                                : "bg-gray-200 dark:bg-white/10";
                      const labelTone =
                        regStrength.score === 1
                          ? "text-red-500 dark:text-red-400"
                          : regStrength.score === 4
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-gray-400 dark:text-white/40";
                      return (
                        <div
                          id="reg-password-strength"
                          className="mt-1.5 flex flex-col gap-1"
                        >
                          <div className="flex gap-1">
                            {[1, 2, 3, 4].map((i) => (
                              <span
                                key={i}
                                className={`h-1 flex-1 rounded-full transition-colors ${
                                  i <= filled ? barColor : "bg-gray-200 dark:bg-white/10"
                                }`}
                              />
                            ))}
                          </div>
                          <p className={`text-[10px] leading-snug ${labelTone}`}>
                            {regPassword.length === 0
                              ? `Required · at least ${PASSWORD_MIN} characters`
                              : !regPasswordValid
                                ? `Password must be at least ${PASSWORD_MIN} characters`
                                : `Strength: ${regStrength.label}`}
                          </p>
                        </div>
                      );
                    })()}
                  </div>

                  {error && isSignUp && (
                    <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-xs text-red-600 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-400">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading || registerInvalid}
                    className="w-full h-10 rounded-lg bg-gradient-to-r from-yellow-400 to-yellow-500 text-white font-semibold text-sm shadow-md shadow-yellow-500/20 hover:shadow-yellow-500/30 hover:from-yellow-500 hover:to-yellow-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                  >
                    {loading && isSignUp ? "Creating account..." : "Create Account"}
                  </button>
                </form>

                <p className="mt-4 text-xs text-gray-500 dark:text-gray-400 lg:hidden text-center">
                  Already have an account?{" "}
                  <button onClick={switchMode} className="text-yellow-500 font-semibold hover:text-yellow-600">
                    Sign In
                  </button>
                </p>
              </div>
            </div>
          </div>

          {/* ── SLIDING OVERLAY PANEL ── */}
          <div
            className={`absolute top-0 w-1/2 h-full transition-transform duration-700 ease-in-out z-20 hidden lg:block ${
              isSignUp ? "translate-x-0" : "translate-x-full"
            }`}
          >
            <div className="relative w-full h-full overflow-hidden">
              {/* White background */}
              <div className="absolute inset-0 bg-white dark:bg-gray-900 border-l border-gray-100 dark:border-gray-800" />

              {/* Decorative elements */}
              <div className="absolute top-10 right-10 w-40 h-40 rounded-full border-2 border-gray-900/5 dark:border-white/20" />
              <div className="absolute top-6 right-6 w-40 h-40 rounded-full border border-gray-900/3 dark:border-white/10" />
              <div className="absolute bottom-16 left-8 w-28 h-28 rounded-full border-2 border-gray-900/5 dark:border-white/20" />
              <div className="absolute bottom-20 left-12 w-16 h-16 rounded-full bg-gray-900/3 dark:bg-white/10" />
              <div className="absolute top-1/4 left-8 w-3 h-3 rounded-full bg-gray-900/10 dark:bg-white/20" />
              <div className="absolute bottom-1/4 right-12 w-4 h-4 rounded-full bg-gray-900/5 dark:bg-white/15" />
              <div className="absolute top-1/2 right-6 w-2 h-2 rounded-full bg-gray-900/10 dark:bg-white/20" />

              {/* Content */}
              <div className="relative z-10 flex flex-col items-center justify-center h-full px-10 text-center">
                {/* Sign In CTA */}
                <div
                  className={`absolute inset-0 flex flex-col items-center justify-center px-10 transition-all duration-500 ${
                    isSignUp ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6 pointer-events-none"
                  }`}
                >
                  <Image src="/images/logo/yellow-track-logo.svg" alt="Yellow Track" width={112} height={112} className="w-28 h-28 object-contain mb-6" />
                  <h2 className="text-4xl font-black text-gray-900 dark:text-white mb-3 tracking-tight leading-[1.1]">
                    Welcome<br />Back!
                  </h2>
                  <p className="text-gray-900/60 dark:text-white/70 text-base mb-8 max-w-[260px] leading-relaxed">
                    Sign in to access your dashboard and manage your fleet operations.
                  </p>
                  <button
                    onClick={switchMode}
                    className="px-10 py-3.5 rounded-2xl bg-gray-900 text-yellow-400 dark:bg-white dark:text-yellow-600 font-bold text-sm shadow-xl shadow-gray-900/20 dark:shadow-white/20 hover:bg-gray-800 dark:hover:bg-gray-100 transition-all duration-300 active:scale-95"
                  >
                    Sign In
                  </button>
                </div>

                {/* Sign Up CTA */}
                <div
                  className={`absolute inset-0 flex flex-col items-center justify-center px-10 transition-all duration-500 ${
                    !isSignUp ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6 pointer-events-none"
                  }`}
                >
                  <Image src="/images/logo/yellow-track-logo.svg" alt="Yellow Track" width={112} height={112} className="w-28 h-28 object-contain mb-6" />
                  <h2 className="text-4xl font-black text-gray-900 dark:text-white mb-3 tracking-tight leading-[1.1]">
                    Join<br />Yellow Track
                  </h2>
                  <p className="text-gray-900/60 dark:text-white/70 text-base mb-8 max-w-[260px] leading-relaxed">
                    Create an account to manage vehicles, drivers, and compliance — all in one place.
                  </p>
                  <button
                    onClick={switchMode}
                    className="px-10 py-3.5 rounded-2xl bg-gray-900 text-yellow-400 dark:bg-white dark:text-yellow-600 font-bold text-sm shadow-xl shadow-gray-900/20 dark:shadow-white/20 hover:bg-gray-800 dark:hover:bg-gray-100 transition-all duration-300 active:scale-95"
                  >
                    Create Account
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom branding */}
        <p className="text-center mt-4 text-[10px] text-gray-400 dark:text-white/20 tracking-widest uppercase">
          Yellow Track &mdash; Fleet Compliance Management
        </p>
      </div>
    </div>
  );
}
