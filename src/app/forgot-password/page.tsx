"use client";

import React, { useState } from "react";
import Link from "next/link";
import { KeyRound, ArrowRight, ShieldCheck, ShieldAlert, ArrowLeft } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setErrorMessage("");

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setErrorMessage(data.error || "Unable to send password reset email.");
      } else {
        setStatus("success");
      }
    } catch {
      setStatus("error");
      setErrorMessage("Network error occurred. Please try again.");
    }
  };

  return (
    <div className="max-w-[1440px] mx-auto px-5 md:px-16 py-16 md:py-24">
      <div className="max-w-md mx-auto bg-white border border-[#DDD8CD] rounded-sm p-8 md:p-10 shadow-xs">
        <div className="mb-6">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-xs text-[#77766E] hover:text-[#292B27] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to sign in</span>
          </Link>
        </div>

        <div className="text-center mb-8">
          <span className="text-xs uppercase tracking-[0.25em] text-[#657052] font-semibold block mb-1">
            ACCOUNT RECOVERY
          </span>
          <h1 className="font-serif text-3xl font-normal text-[#292B27]">
            Reset Password
          </h1>
          <p className="text-xs text-[#77766E] mt-2">
            Enter your email address and we will dispatch a secure password recovery link to your inbox.
          </p>
        </div>

        {status === "success" ? (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xs space-y-2">
            <div className="flex items-center gap-2 font-semibold">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Password Reset Link Dispatched</span>
            </div>
            <p className="leading-relaxed">
              If an account exists for <strong>{email}</strong>, a secure reset email has been sent. Please check your inbox and follow the link to establish a new password.
            </p>
            <div className="pt-2">
              <Link
                href="/login"
                className="text-emerald-900 underline font-semibold hover:text-emerald-950"
              >
                Return to Login
              </Link>
            </div>
          </div>
        ) : (
          <>
            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xs mb-6 flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleReset} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#292B27] mb-1.5">
                  Account Email
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

              <button
                type="submit"
                disabled={status === "loading"}
                className="w-full bg-[#292B27] hover:bg-[#657052] text-white py-3.5 px-4 text-xs uppercase tracking-widest font-semibold flex items-center justify-center gap-2 transition-colors rounded-sm pt-3 disabled:opacity-50"
              >
                <KeyRound className="w-4 h-4" />
                <span>{status === "loading" ? "Dispatching..." : "Send Reset Link"}</span>
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
