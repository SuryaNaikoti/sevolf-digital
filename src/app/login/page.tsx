"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, ArrowRight, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

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
        setErrorMessage(data.error || "Login failed");
      } else {
        router.push("/account");
      }
    } catch {
      setStatus("error");
      setErrorMessage("Network error occurred during authentication.");
    }
  };

  return (
    <div className="max-w-[1440px] mx-auto px-5 md:px-16 py-16 md:py-24">
      <div className="max-w-md mx-auto bg-white border border-[#DDD8CD] rounded-sm p-8 md:p-10 shadow-xs">
        <div className="text-center mb-8">
          <span className="text-xs uppercase tracking-[0.25em] text-[#657052] font-semibold block mb-1">
            CLIENT ACCESS
          </span>
          <h1 className="font-serif text-3xl font-normal text-[#292B27]">
            Sign in to SEVOLF
          </h1>
          <p className="text-xs text-[#77766E] mt-2">
            Access your orders, digital library downloads, and personal license keys.
          </p>
        </div>

        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xs mb-6">
            {errorMessage}
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
              <Link href="/contact" className="text-[11px] text-[#77766E] hover:text-[#292B27] underline">
                Forgot password?
              </Link>
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-[#F5F2EB]/50 border border-[#DDD8CD] px-4 py-3 text-sm text-[#292B27] focus:outline-none focus:border-[#657052] rounded-xs"
            />
          </div>

          <button
            type="submit"
            disabled={status === "loading"}
            className="w-full bg-[#292B27] hover:bg-[#657052] text-white py-3.5 px-4 text-xs uppercase tracking-widest font-semibold flex items-center justify-center gap-2 transition-colors rounded-sm pt-3 disabled:opacity-50"
          >
            <Lock className="w-4 h-4" />
            <span>{status === "loading" ? "Authenticating..." : "Sign In to Library"}</span>
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-[#DDD8CD] text-center text-xs text-[#77766E]">
          <span>New to SEVOLF Digital? </span>
          <Link href="/register" className="font-semibold text-[#292B27] hover:text-[#657052] underline">
            Create an Account
          </Link>
        </div>
      </div>
    </div>
  );
}
