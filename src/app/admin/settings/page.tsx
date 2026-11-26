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
  CreditCard,
  ShieldCheck,
  Settings as SettingsIcon,
} from "lucide-react";
import {
  AdminPageHeader,
  AdminCard,
  AdminStatusBadge,
  AdminButton,
} from "@/components/admin/ui/AdminComponents";

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
        throw new Error(data.error || "Failed to update administrator password.");
      }

      setPasswordStatus("success");
      setPasswordFeedback({ success: true, message: "Administrator password updated successfully." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPasswordStatus("error");
      setPasswordFeedback({ success: false, message: err?.message || "Failed to update administrator password." });
    }
  };

  const fetchIntegrations = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings");
      if (!res.ok) {
        throw new Error(`Failed to load integrations registry: HTTP ${res.status}`);
      }
      const data = await res.json();
      setIntegrations(data.integrations || []);
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred loading integrations.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const handleTestConnection = async (integrationId: string) => {
    setTestingId(integrationId);
    setTestResult(null);

    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test_connection", integrationId }),
      });
      const data = await res.json();
      setTestResult({
        id: integrationId,
        success: data.success,
        message: data.message || (data.success ? "Connection established." : "Connection failed."),
      });
    } catch (err: any) {
      setTestResult({
        id: integrationId,
        success: false,
        message: err?.message || "Network error while pinging integration.",
      });
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div className="space-y-10 max-w-5xl">
      {/* Header */}
      <AdminPageHeader
        title="Settings & System Registry"
        subtitle="Operational secrets vault, payment gateway credentials, Resend email routing, and RBAC authentication."
        badge={{ text: "Fail-Closed Security Enforced", variant: "neutral" }}
        actions={
          <AdminButton
            variant="secondary"
            icon={RefreshCw}
            onClick={fetchIntegrations}
            disabled={loading}
          >
            Refresh Status
          </AdminButton>
        }
      />

      {/* SECTION 1: CHANGE PASSWORD & RBAC */}
      <div id="security" className="space-y-4">
        <div className="border-b border-[#E8E5DD] pb-2">
          <h2 className="text-lg font-serif font-normal text-[#22231F]">Administrator Password & RBAC</h2>
          <p className="text-xs text-[#85847D]">
            Reauthenticate with your current administrator password to establish new credentials.
          </p>
        </div>

        <AdminCard title="Security Credentials" subtitle="Server-side reauthenticated via Supabase Auth">
          <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md text-xs font-sans">
            {passwordFeedback && (
              <div
                className={`p-3.5 rounded-lg text-xs flex items-center space-x-2 border ${
                  passwordFeedback.success
                    ? "bg-[#F2F5F0] border-[#D4DCCF] text-[#55694B]"
                    : "bg-[#FDF4F3] border-[#F0D0CD] text-[#9A423B]"
                }`}
              >
                {passwordFeedback.success ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                )}
                <span>{passwordFeedback.message}</span>
              </div>
            )}

            <div>
              <label className="block text-[#22231F] font-medium mb-1">Current Admin Password</label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? "text" : "password"}
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full border border-[#E8E5DD] rounded-md px-3 py-2 pr-9 text-[#22231F] focus:outline-hidden focus:border-[#85866A]"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#85847D] hover:text-[#22231F]"
                >
                  {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[#22231F] font-medium mb-1">New Password (Min 8 Characters)</label>
              <div className="relative">
                <input
                  type={showNewPassword ? "text" : "password"}
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full border border-[#E8E5DD] rounded-md px-3 py-2 pr-9 text-[#22231F] focus:outline-hidden focus:border-[#85866A]"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#85847D] hover:text-[#22231F]"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[#22231F] font-medium mb-1">Confirm New Password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full border border-[#E8E5DD] rounded-md px-3 py-2 pr-9 text-[#22231F] focus:outline-hidden focus:border-[#85866A]"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#85847D] hover:text-[#22231F]"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <AdminButton
              type="submit"
              variant="primary"
              disabled={passwordStatus === "loading"}
            >
              {passwordStatus === "loading" ? "Updating..." : "Update Password"}
            </AdminButton>
          </form>
        </AdminCard>
      </div>

      {/* SECTION 2: INTEGRATIONS & GATEWAY REGISTRY */}
      <div id="integrations" className="space-y-4">
        <div className="border-b border-[#E8E5DD] pb-2">
          <h2 className="text-lg font-serif font-normal text-[#22231F]">Third-Party Services Registry</h2>
          <p className="text-xs text-[#85847D]">
            External infrastructure services, payment gateways, and transactional email providers.
          </p>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-[#85847D] font-mono">
            Loading integrations status...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {integrations.map((item) => (
              <AdminCard
                key={item.id}
                title={item.name}
                subtitle={item.category}
                action={
                  <AdminStatusBadge
                    variant={
                      item.status === "active"
                        ? "success"
                        : item.status === "configured"
                        ? "warning"
                        : "neutral"
                    }
                  >
                    {item.status}
                  </AdminStatusBadge>
                }
              >
                <div className="space-y-4 text-xs font-sans">
                  <p className="text-[#85847D] leading-relaxed">{item.description}</p>

                  <div className="space-y-1.5 pt-2 border-t border-[#E8E5DD]">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-[#85847D]">
                      Configured Keys
                    </span>
                    <div className="space-y-1">
                      {item.fields.map((f) => (
                        <div
                          key={f.key}
                          className="flex items-center justify-between p-2 rounded bg-[#FAF8F5] border border-[#E8E5DD]"
                        >
                          <span className="text-[#22231F] font-mono text-[11px]">{f.label}</span>
                          <span className="text-[#85847D] font-mono text-[11px]">{f.maskedValue}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between">
                    <button
                      onClick={() => handleTestConnection(item.id)}
                      disabled={testingId === item.id}
                      className="text-xs font-mono uppercase tracking-wider text-[#85866A] hover:text-[#22231F] hover:underline"
                    >
                      {testingId === item.id ? "Pinging..." : "Test Connection →"}
                    </button>
                    {item.docsUrl && (
                      <a
                        href={item.docsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-[#85847D] hover:text-[#22231F] flex items-center space-x-1"
                      >
                        <span>Docs</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>

                  {testResult && testResult.id === item.id && (
                    <div
                      className={`p-3 rounded text-[11px] font-mono border ${
                        testResult.success
                          ? "bg-[#F2F5F0] border-[#D4DCCF] text-[#55694B]"
                          : "bg-[#FDF4F3] border-[#F0D0CD] text-[#9A423B]"
                      }`}
                    >
                      {testResult.message}
                    </div>
                  )}
                </div>
              </AdminCard>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
