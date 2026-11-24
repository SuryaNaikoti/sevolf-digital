"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, ArrowRight, ShieldCheck, Eye, EyeOff, ShieldAlert } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get("redirect");
  const successParam = searchParams.get("success");
  const errorParam = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState(errorParam || "");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setErrorMessage("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setErrorMessage(data.error || "Authentication failed. Please check your credentials.");
      } else {
        // Enforce role-based redirection safely:
        // If a redirect is explicitly specified:
        // - if redirect is /admin* and user is not admin, deny and redirect to /account
        if (redirectParam?.startsWith("/admin")) {
          if (data.user?.isAdmin) {
            router.push(redirectParam);
          } else {
            router.push("/account");
          }
        } else if (data.user?.isAdmin && (!redirectParam || redirectParam === "/account")) {
          // If admin logs in, navigate directly to /admin
          router.push("/admin");
        } else {
          router.push(redirectParam || "/account");
        }
      }
    } catch {
      setStatus("error");
      setErrorMessage("Network error occurred during authentication.");
    }
  };

  const isAdminAttempt = redirectParam?.startsWith("/admin");

  return (
    <div className="max-w-[1440px] mx-auto px-5 md:px-16 py-16 md:py-24">
      <div className="max-w-md mx-auto bg-white border border-[#DDD8CD] rounded-sm p-8 md:p-10 shadow-xs">
        <div className="text-center mb-8">
          <span className="text-xs uppercase tracking-[0.25em] text-[#657052] font-semibold block mb-1">
            {isAdminAttempt ? "ADMINISTRATIVE ACCESS" : "CLIENT ACCESS"}
          </span>
          <h1 className="font-serif text-3xl font-normal text-[#292B27]">
            {isAdminAttempt ? "SEVOLF Control Center" : "Sign in to SEVOLF"}
          </h1>
          <p className="text-xs text-[#77766E] mt-2">
            {isAdminAttempt
              ? "Sign in with your verified administrative credentials to access store controls."
              : "Access your orders, digital library downloads, and personal license keys."}
          </p>
        </div>

        {successParam && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xs mb-6 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
            <span>{successParam}</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xs mb-6 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#292B27] mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@domain.com"
              className="w-full bg-[#F5F2EB]/50 border border-[#DDD8CD] px-4 py-3 text-sm text-[#292B27] focus:outline-none focus:border-[#657052] rounded-xs"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#292B27]">
                Password
              </label>
              <Link href="/forgot-password" className="text-[11px] text-[#77766E] hover:text-[#292B27] underline">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#F5F2EB]/50 border border-[#DDD8CD] px-4 py-3 pr-10 text-sm text-[#292B27] focus:outline-none focus:border-[#657052] rounded-xs"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#77766E] hover:text-[#292B27]"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={status === "loading"}
            className="w-full bg-[#292B27] hover:bg-[#657052] text-white py-3.5 px-4 text-xs uppercase tracking-widest font-semibold flex items-center justify-center gap-2 transition-colors rounded-sm pt-3 disabled:opacity-50"
          >
            <Lock className="w-4 h-4" />
            <span>{status === "loading" ? "Authenticating..." : isAdminAttempt ? "Enter Control Center" : "Sign In to Library"}</span>
          </button>
        </form>

        {!isAdminAttempt && (
          <div className="mt-8 pt-6 border-t border-[#DDD8CD] text-center text-xs text-[#77766E]">
            <span>New to SEVOLF Digital? </span>
            <Link href="/register" className="font-semibold text-[#292B27] hover:text-[#657052] underline">
              Create an Account
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="max-w-[1440px] mx-auto px-5 py-24 text-center text-xs text-[#77766E]">Loading sign in...</div>}>
      <LoginForm />
    </Suspense>
  );
}
