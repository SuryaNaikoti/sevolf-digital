"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserPlus, ArrowRight, ShieldCheck } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setErrorMessage("");

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setErrorMessage(data.error || "Registration failed");
      } else {
        router.push("/account");
      }
    } catch {
      setStatus("error");
      setErrorMessage("Network error during registration.");
    }
  };

  return (
    <div className="max-w-[1440px] mx-auto px-5 md:px-16 py-16 md:py-24">
      <div className="max-w-md mx-auto bg-white border border-[#DDD8CD] rounded-sm p-8 md:p-10 shadow-xs">
        <div className="text-center mb-8">
          <span className="text-xs uppercase tracking-[0.25em] text-[#657052] font-semibold block mb-1">
            NEW MEMBERSHIP
          </span>
          <h1 className="font-serif text-3xl font-normal text-[#292B27]">
            Create SEVOLF Account
          </h1>
          <p className="text-xs text-[#77766E] mt-2">
            Securely preserve your digital purchases, licenses, and downloads forever.
          </p>
        </div>

        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xs mb-6">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#292B27] mb-1.5">
              Full Name
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="E.g. Siddharth Sen"
              className="w-full bg-[#F5F2EB]/50 border border-[#DDD8CD] px-4 py-3 text-sm text-[#292B27] focus:outline-none focus:border-[#657052] rounded-xs"
            />
          </div>

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
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#292B27] mb-1.5">
              Create Password
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="w-full bg-[#F5F2EB]/50 border border-[#DDD8CD] px-4 py-3 text-sm text-[#292B27] focus:outline-none focus:border-[#657052] rounded-xs"
            />
          </div>

          <button
            type="submit"
            disabled={status === "loading"}
            className="w-full bg-[#292B27] hover:bg-[#657052] text-white py-3.5 px-4 text-xs uppercase tracking-widest font-semibold flex items-center justify-center gap-2 transition-colors rounded-sm pt-3 disabled:opacity-50"
          >
            <UserPlus className="w-4 h-4" />
            <span>{status === "loading" ? "Creating Account..." : "Create Account"}</span>
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-[#DDD8CD] text-center text-xs text-[#77766E]">
          <span>Already have an account? </span>
          <Link href="/login" className="font-semibold text-[#292B27] hover:text-[#657052] underline">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
