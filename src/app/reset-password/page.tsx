"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound, ShieldAlert, CheckCircle2, Eye, EyeOff, Lock } from "lucide-react";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (newPassword.length < 8) {
      setErrorMessage("New password must be at least 8 characters long.");
      setStatus("error");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("Passwords do not match. Please re-enter.");
      setStatus("error");
      return;
    }

    setStatus("loading");

    try {
      const res = await fetch("/api/auth/update-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });
      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setErrorMessage(data.error || "Password update failed. Please request a new recovery link.");
      } else {
        setStatus("success");
        setTimeout(() => {
          router.push("/login?success=Password%20reset%20successfully.%20Please%20sign%20in.");
        }, 1500);
      }
    } catch {
      setStatus("error");
      setErrorMessage("A network error occurred. Please try again.");
    }
  };

  return (
    <div className="max-w-[1440px] mx-auto px-5 md:px-16 py-16 md:py-24">
      <div className="max-w-md mx-auto bg-white border border-[#DDD8CD] rounded-sm p-8 md:p-10 shadow-xs">
        <div className="text-center mb-8">
          <span className="text-xs uppercase tracking-[0.25em] text-[#657052] font-semibold block mb-1">
            SECURITY VERIFICATION
          </span>
          <h1 className="font-serif text-3xl font-normal text-[#292B27]">
            Set New Password
          </h1>
          <p className="text-xs text-[#77766E] mt-2">
            Establish a new, strong password for your SEVOLF Digital account.
          </p>
        </div>

        {status === "success" ? (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xs space-y-2">
            <div className="flex items-center gap-2 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Password Updated Successfully</span>
            </div>
            <p className="leading-relaxed">
              Your password has been securely reset. Redirecting you to sign in...
            </p>
          </div>
        ) : (
          <>
            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xs mb-6 flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#292B27] mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    required
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    className="w-full bg-[#F5F2EB]/50 border border-[#DDD8CD] px-4 py-3 pr-10 text-sm text-[#292B27] focus:outline-none focus:border-[#657052] rounded-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#77766E] hover:text-[#292B27]"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#292B27] mb-1.5">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="w-full bg-[#F5F2EB]/50 border border-[#DDD8CD] px-4 py-3 pr-10 text-sm text-[#292B27] focus:outline-none focus:border-[#657052] rounded-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#77766E] hover:text-[#292B27]"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="p-3 bg-[#FAF8F5] border border-[#DDD8CD] rounded-xs text-[11px] text-[#77766E] space-y-0.5">
                <p className="font-semibold text-[#292B27]">Requirements:</p>
                <p>• Minimum 8 characters in length.</p>
                <p>• Avoid reusing previous passwords.</p>
              </div>

              <button
                type="submit"
                disabled={status === "loading"}
                className="w-full bg-[#292B27] hover:bg-[#657052] text-white py-3.5 px-4 text-xs uppercase tracking-widest font-semibold flex items-center justify-center gap-2 transition-colors rounded-sm pt-3 disabled:opacity-50"
              >
                <Lock className="w-4 h-4" />
                <span>{status === "loading" ? "Updating Password..." : "Set New Password"}</span>
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
