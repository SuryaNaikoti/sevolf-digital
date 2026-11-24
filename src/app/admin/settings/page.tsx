"use client";

import React, { useEffect, useState } from "react";
import {
  ShieldAlert,
  KeyRound,
  ExternalLink,
  PowerOff,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Lock,
  Radio,
  Eye,
  EyeOff,
} from "lucide-react";

interface IntegrationField {
  key: string;
  label: string;
  type: string;
  isSecret: boolean;
  configured: boolean;
  maskedValue: string;
}

interface IntegrationCard {
  id: string;
  name: string;
  category: string;
  description: string;
  docsUrl: string;
  status: "disconnected" | "configured" | "active" | "error";
  environment: "test" | "live";
  isLiveActive: boolean;
  fields: IntegrationField[];
}

export default function IntegrationsSettingsPage() {
  const [integrations, setIntegrations] = useState<IntegrationCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);
  const [testEmailAddress, setTestEmailAddress] = useState<string>("");
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Security / Change Password State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [passwordFeedback, setPasswordFeedback] = useState<{ success: boolean; message: string } | null>(null);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordFeedback(null);

    if (newPassword.length < 8) {
      setPasswordFeedback({ success: false, message: "New password must be at least 8 characters long." });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordFeedback({ success: false, message: "New password and confirmation do not match." });
      return;
    }

    setPasswordStatus("loading");

    try {
      const res = await fetch("/api/admin/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();

      if (!res.ok) {
        setPasswordFeedback({ success: false, message: data.error || "Password change failed." });
        setPasswordStatus("error");
      } else {
        setPasswordFeedback({ success: true, message: "Password updated successfully." });
        setPasswordStatus("success");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch {
      setPasswordFeedback({ success: false, message: "Network error occurred while updating password." });
      setPasswordStatus("error");
    }
  };

  const fetchSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings");
      if (!res.ok) {
        throw new Error(`Failed to load integrations: HTTP ${res.status}`);
      }
      const data = await res.json();
      setIntegrations(data.integrations || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load integration settings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleTestConnection = async (providerId: string, sendEmail = false) => {
    if (sendEmail) {
      setSendingTestEmail(true);
    } else {
      setTestingId(providerId);
    }
    setTestResult(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId,
          testOnly: true,
          sendTestEmail: sendEmail,
          recipientEmail: testEmailAddress.trim() || undefined,
        }),
      });
      const data = await res.json();
      setTestResult({
        id: providerId,
        success: data.success,
        message: data.message || (data.success ? "Connection verified successfully." : data.error || "Connection test failed."),
      });
    } catch (err: any) {
      setTestResult({
        id: providerId,
        success: false,
        message: "Network error during connection verification.",
      });
    } finally {
      setTestingId(null);
      setSendingTestEmail(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#202223] tracking-tight">Settings & Integrations</h1>
          <p className="text-xs text-[#6D7175]">
            Configure payment gateways, email delivery, web analytics, and cloud storage providers.
          </p>
        </div>

        <button
          onClick={fetchSettings}
          className="flex items-center space-x-1.5 px-3 py-1.5 border border-[#BABFC3] bg-white text-[#202223] text-xs font-semibold rounded-md shadow-2xs hover:bg-[#F6F6F7] transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[#6D7175] ${loading ? "animate-spin" : ""}`} />
          <span>Refresh Status</span>
        </button>
      </div>

      {/* Security Architecture Directive Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2 text-xs leading-relaxed text-amber-900 shadow-2xs">
        <div className="flex items-center space-x-2 text-amber-950 font-semibold">
          <ShieldAlert className="w-4 h-4 text-amber-700" />
          <span>Strict Pre-Launch Gateway & Integration Security</span>
        </div>
        <p className="text-amber-800/90 leading-relaxed">
          In strict compliance with Directive Section 7 & 10: Secret keys and private API tokens are securely managed on the server and are never exposed in browser payloads. Live payment processing and automated transactional email dispatch remain <strong>safely disabled</strong> until the owner explicitly authorizes them.
        </p>
      </div>

      {loading ? (
        <div className="p-16 text-center space-y-3 bg-white border border-[#E1E3E5] rounded-lg shadow-2xs">
          <RefreshCw className="w-6 h-6 text-[#8C9196] animate-spin mx-auto" />
          <p className="text-xs text-[#6D7175]">Inspecting server integration configurations...</p>
        </div>
      ) : error ? (
        <div className="p-12 text-center space-y-3 bg-white border border-[#E1E3E5] rounded-lg shadow-2xs">
          <AlertTriangle className="w-8 h-8 text-rose-600 mx-auto" />
          <h3 className="text-sm font-semibold text-[#202223]">Unable to load integration settings</h3>
          <p className="text-xs text-[#6D7175] max-w-sm mx-auto">{error}</p>
          <button
            onClick={fetchSettings}
            className="px-3 py-1.5 bg-[#202223] text-white text-xs font-semibold rounded-md"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {integrations.map((card) => {
            const isConfigured = card.status === "configured" || card.status === "active";
            const isActive = card.status === "active";
            const hasTest = testResult && testResult.id === card.id;

            return (
              <div
                key={card.id}
                className="bg-white border border-[#E1E3E5] rounded-lg p-4 flex flex-col justify-between space-y-4 shadow-2xs hover:border-[#BABFC3] transition-colors"
              >
                <div className="space-y-3">
                  {/* Title & Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-mono uppercase font-semibold px-2 py-0.5 rounded bg-[#F6F6F7] text-[#6D7175] border border-[#E1E3E5]">
                          {card.category}
                        </span>
                        <h3 className="text-sm font-semibold text-[#202223]">{card.name}</h3>
                      </div>
                      <p className="text-xs text-[#6D7175] mt-1 leading-normal">{card.description}</p>
                    </div>

                    <span
                      className={`flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium shrink-0 ${
                        isActive
                          ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                          : isConfigured
                          ? "bg-sky-50 text-sky-800 border border-sky-200"
                          : "bg-[#F6F6F7] text-[#6D7175] border border-[#E1E3E5]"
                      }`}
                    >
                      {isActive ? (
                        <>
                          <Radio className="w-2.5 h-2.5 text-emerald-600 animate-pulse" />
                          <span>ACTIVE</span>
                        </>
                      ) : isConfigured ? (
                        <>
                          <CheckCircle2 className="w-2.5 h-2.5 text-sky-600" />
                          <span>CONFIGURED</span>
                        </>
                      ) : (
                        <>
                          <PowerOff className="w-2.5 h-2.5 text-[#8C9196]" />
                          <span>DISCONNECTED</span>
                        </>
                      )}
                    </span>
                  </div>

                  {/* Configured Fields Display */}
                  <div className="space-y-2 pt-2 border-t border-[#E1E3E5]">
                    {card.fields.map((f) => (
                      <div key={f.key} className="space-y-1">
                        <label className="text-[11px] font-mono text-[#6D7175] flex items-center justify-between">
                          <span>{f.label}</span>
                          {f.isSecret ? (
                            <span className="text-[9px] text-[#8C9196] uppercase flex items-center gap-1">
                              <Lock className="w-2.5 h-2.5" />
                              Encrypted Secret
                            </span>
                          ) : (
                            <span className="text-[9px] text-[#8C9196] uppercase">Public ID</span>
                          )}
                        </label>
                        <input
                          type="text"
                          readOnly
                          value={f.maskedValue || (f.configured ? "••••••••••••" : "Not configured")}
                          className={`w-full text-xs font-mono border rounded px-2.5 py-1.5 focus:outline-hidden ${
                            f.configured
                              ? "bg-white border-[#D2D5D8] text-[#202223]"
                              : "bg-[#FAFBFB] border-[#E1E3E5] text-[#8C9196] italic"
                          }`}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Test Result Message */}
                  {hasTest && (
                    <div
                      className={`p-2.5 rounded text-xs leading-normal flex items-start space-x-2 border ${
                        testResult.success
                          ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                          : "bg-rose-50 text-rose-900 border-rose-200"
                      }`}
                    >
                      {testResult.success ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      )}
                      <span>{testResult.message}</span>
                    </div>
                  )}
                </div>

                {/* Card Footer Actions */}
                {card.id === "resend" && (
                  <div className="pt-2 pb-1 border-t border-[#E1E3E5] space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="email"
                        placeholder="test-recipient@example.com"
                        value={testEmailAddress}
                        onChange={(e) => setTestEmailAddress(e.target.value)}
                        className="flex-1 text-xs border border-[#D2D5D8] rounded px-2.5 py-1.5 focus:outline-hidden focus:border-black"
                      />
                      <button
                        onClick={() => handleTestConnection("resend", true)}
                        disabled={sendingTestEmail || !card.fields.find((f) => f.key === "apiKey")?.configured}
                        className="px-2.5 py-1.5 rounded text-xs font-semibold bg-[#202223] text-white hover:bg-black disabled:opacity-50 transition-colors shrink-0 flex items-center gap-1 shadow-2xs"
                      >
                        <RefreshCw className={`w-3 h-3 ${sendingTestEmail ? "animate-spin" : ""}`} />
                        <span>Send Test Email</span>
                      </button>
                    </div>
                    <p className="text-[10px] text-[#8C9196]">
                      Send a live sample transactional email to verify DNS delivery and sender domain reputation.
                    </p>
                  </div>
                )}
                <div className="pt-3 border-t border-[#E1E3E5] flex items-center justify-between text-xs">
                  <a
                    href={card.docsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#6D7175] hover:text-[#202223] flex items-center space-x-1 transition-colors"
                  >
                    <span>Official Docs</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>

                  <button
                    onClick={() => handleTestConnection(card.id, false)}
                    disabled={testingId === card.id || sendingTestEmail}
                    className="px-3 py-1 rounded text-xs font-semibold bg-[#202223] text-white hover:bg-black disabled:opacity-50 transition-colors flex items-center space-x-1.5 shadow-2xs"
                  >
                    <RefreshCw className={`w-3 h-3 ${testingId === card.id ? "animate-spin" : ""}`} />
                    <span>Test Connection</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Security & Authentication Section */}
      <div className="bg-white border border-[#E1E3E5] rounded-lg p-5 sm:p-6 shadow-2xs space-y-6">
        <div className="flex items-center space-x-2.5 pb-4 border-b border-[#E1E3E5]">
          <KeyRound className="w-5 h-5 text-[#202223]" />
          <div>
            <h2 className="text-base font-semibold text-[#202223]">Admin Security & Password</h2>
            <p className="text-xs text-[#6D7175]">
              Update your administrator credentials through Supabase Auth identity verification.
            </p>
          </div>
        </div>

        {passwordFeedback && (
          <div
            className={`p-3.5 rounded-md text-xs border flex items-start gap-2.5 ${
              passwordFeedback.success
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-red-50 border-red-200 text-red-800"
            }`}
          >
            {passwordFeedback.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            )}
            <span className="leading-relaxed">{passwordFeedback.message}</span>
          </div>
        )}

        <form onSubmit={handlePasswordChange} className="max-w-xl space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#202223] mb-1.5">
              Current Password
            </label>
            <div className="relative">
              <input
                type={showCurrentPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                className="w-full text-xs bg-[#F6F6F7] border border-[#D2D5D8] rounded-md px-3 py-2 pr-9 text-[#202223] focus:outline-hidden focus:bg-white focus:border-[#202223]"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8C9196] hover:text-[#202223]"
              >
                {showCurrentPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#202223] mb-1.5">
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
                  className="w-full text-xs bg-[#F6F6F7] border border-[#D2D5D8] rounded-md px-3 py-2 pr-9 text-[#202223] focus:outline-hidden focus:bg-white focus:border-[#202223]"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8C9196] hover:text-[#202223]"
                >
                  {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#202223] mb-1.5">
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
                  className="w-full text-xs bg-[#F6F6F7] border border-[#D2D5D8] rounded-md px-3 py-2 pr-9 text-[#202223] focus:outline-hidden focus:bg-white focus:border-[#202223]"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8C9196] hover:text-[#202223]"
                >
                  {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          <div className="p-3 bg-[#F6F6F7] border border-[#E1E3E5] rounded-md text-[11px] text-[#6D7175] space-y-1">
            <p className="font-semibold text-[#202223]">Password Security Guidelines:</p>
            <ul className="list-disc list-inside space-y-0.5 pl-1">
              <li>Must contain at least 8 characters.</li>
              <li>Stored only in Supabase Auth cryptographic vault (never in public database tables).</li>
              <li>Requires identity re-authentication before update.</li>
            </ul>
          </div>

          <button
            type="submit"
            disabled={passwordStatus === "loading"}
            className="px-4 py-2 rounded-md text-xs font-semibold bg-[#202223] text-white hover:bg-black disabled:opacity-50 transition-colors shadow-2xs flex items-center gap-1.5"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>{passwordStatus === "loading" ? "Updating Password..." : "Update Password"}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
