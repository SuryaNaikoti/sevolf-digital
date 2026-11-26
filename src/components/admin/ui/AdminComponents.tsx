import React from "react";
import Link from "next/link";
import { LucideIcon } from "lucide-react";

// 1. AdminPageHeader: Editorial serif title, warm muted subtitle, metadata badges & studio action buttons
export interface AdminPageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: {
    text: string;
    variant?: "success" | "warning" | "neutral" | "error" | "accent";
  };
  backUrl?: string;
  actions?: React.ReactNode;
}

export function AdminPageHeader({
  title,
  subtitle,
  badge,
  backUrl,
  actions,
}: AdminPageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#E8E5DD]/70">
      <div className="space-y-1">
        <div className="flex items-center flex-wrap gap-2.5">
          <h1 className="text-2xl sm:text-3xl font-serif font-light text-[#22231F] tracking-tight">
            {title}
          </h1>
          {badge && (
            <AdminStatusBadge variant={badge.variant || "neutral"}>
              {badge.text}
            </AdminStatusBadge>
          )}
        </div>
        {subtitle && (
          <p className="text-xs sm:text-[13px] text-[#85847D] max-w-3xl leading-relaxed font-sans">
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center space-x-2.5 shrink-0 self-start sm:self-auto pt-1 sm:pt-0">
          {actions}
        </div>
      )}
    </div>
  );
}

// 2. AdminCard: White card with warm architectural border (#E8E5DD) and subtle warmth
export interface AdminCardProps {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  footer?: React.ReactNode;
  padding?: boolean;
}

export function AdminCard({
  title,
  subtitle,
  action,
  children,
  className = "",
  footer,
  padding = true,
}: AdminCardProps) {
  return (
    <div
      className={`bg-white border border-[#E8E5DD] rounded-lg shadow-[0_1px_3px_rgba(34,35,31,0.02)] overflow-hidden transition-all ${className}`}
    >
      {(title || action) && (
        <div className="px-5 py-3.5 border-b border-[#E8E5DD] flex items-center justify-between bg-[#FDFCFA]">
          <div className="space-y-0.5">
            {title && (
              <h2 className="text-[11px] font-mono uppercase tracking-[0.12em] font-medium text-[#22231F]">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="text-xs text-[#85847D] font-sans">{subtitle}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={padding ? "p-5 sm:p-6" : ""}>{children}</div>
      {footer && (
        <div className="px-5 py-3 border-t border-[#E8E5DD] bg-[#FAF8F5] text-xs text-[#85847D]">
          {footer}
        </div>
      )}
    </div>
  );
}

// 3. AdminStatusBadge: Restrained, sophisticated status pills
export interface AdminStatusBadgeProps {
  variant?: "success" | "warning" | "error" | "neutral" | "info" | "accent";
  children: React.ReactNode;
  className?: string;
}

export function AdminStatusBadge({
  variant = "neutral",
  children,
  className = "",
}: AdminStatusBadgeProps) {
  const variantStyles = {
    success: "bg-[#F2F5F0] text-[#55694B] border-[#D4DCCF]",
    warning: "bg-[#FBF7F0] text-[#8C6D34] border-[#EADFCB]",
    error: "bg-[#FDF4F3] text-[#9A423B] border-[#F0D0CD]",
    neutral: "bg-[#F7F5F0] text-[#7A7870] border-[#E8E5DD]",
    info: "bg-[#F3F6F9] text-[#47637D] border-[#D5E1ED]",
    accent: "bg-[#F6F6F2] text-[#63644F] border-[#D9DAC6]",
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-[0.08em] font-medium border ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

// 4. AdminButton: Minimalist studio button with tactile precision
export interface AdminButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "plain" | "accent";
  icon?: LucideIcon;
  restrictedReason?: string;
}

export function AdminButton({
  variant = "secondary",
  icon: Icon,
  restrictedReason,
  children,
  className = "",
  disabled,
  ...props
}: AdminButtonProps) {
  const base =
    "inline-flex items-center justify-center space-x-1.5 px-3.5 py-1.5 rounded-md text-xs font-sans font-medium transition-all duration-150 focus:outline-hidden disabled:cursor-not-allowed";

  const variants = {
    primary:
      "bg-[#20211F] text-white hover:bg-[#2F302D] active:bg-[#181917] disabled:bg-[#85847D]/30 disabled:text-[#85847D] shadow-xs",
    secondary:
      "bg-white border border-[#DCD9D0] text-[#22231F] hover:bg-[#F7F5F0] hover:border-[#85866A] active:bg-[#EFECE5] disabled:bg-[#F7F5F0] disabled:text-[#85847D]/50 shadow-xs",
    accent:
      "bg-[#85866A] text-white hover:bg-[#737459] active:bg-[#60614A] disabled:bg-[#85866A]/40 shadow-xs",
    danger:
      "bg-white border border-[#E8C5C2] text-[#A8534C] hover:bg-[#FDF4F3] active:bg-[#F8E3E1] disabled:opacity-50",
    plain:
      "text-[#63644F] hover:text-[#22231F] hover:bg-[#F7F5F0] rounded p-1.5",
  };

  return (
    <button
      {...props}
      disabled={disabled || !!restrictedReason}
      title={restrictedReason || props.title}
      className={`${base} ${variants[variant]} ${className}`}
    >
      {Icon && <Icon className="w-3.5 h-3.5 shrink-0 opacity-80" />}
      <span>{children}</span>
    </button>
  );
}

// 5. AdminEmptyState: Generous editorial empty state
export function AdminEmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="py-14 px-4 text-center max-w-md mx-auto space-y-3.5">
      <div className="w-12 h-12 rounded-full bg-[#F7F5F0] border border-[#E8E5DD] mx-auto flex items-center justify-center text-[#85866A]">
        <Icon className="w-5 h-5 stroke-[1.5]" />
      </div>
      <div className="space-y-1">
        <h3 className="text-base font-serif font-normal text-[#22231F] tracking-tight">
          {title}
        </h3>
        <p className="text-xs text-[#85847D] leading-relaxed font-sans">{description}</p>
      </div>
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}
