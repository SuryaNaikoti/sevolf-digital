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
    </div>
  );
}
