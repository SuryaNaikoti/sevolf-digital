import React from "react";
import Link from "next/link";
import { LucideIcon } from "lucide-react";

// 1. AdminPageHeader: Consistent title, subtitle, and primary/secondary actions
export interface AdminPageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: {
    text: string;
    variant?: "success" | "warning" | "neutral" | "error";
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
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2">
      <div className="space-y-0.5">
        <div className="flex items-center space-x-2.5">
          <h1 className="text-xl font-bold text-[#202223] tracking-tight">{title}</h1>
          {badge && (
            <AdminStatusBadge variant={badge.variant || "neutral"}>
              {badge.text}
            </AdminStatusBadge>
          )}
        </div>
        {subtitle && <p className="text-xs text-[#6D7175]">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center space-x-2 shrink-0">{actions}</div>}
    </div>
  );
}

// 2. AdminCard: Uniform white card surface with crisp 1px neutral border
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
    <div className={`bg-white border border-[#E1E3E5] rounded-lg shadow-2xs overflow-hidden ${className}`}>
      {(title || action) && (
        <div className="px-4 py-3 border-b border-[#E1E3E5] flex items-center justify-between bg-[#FAFBFB]">
          <div>
            {title && (
              <h2 className="text-xs font-semibold text-[#202223] uppercase tracking-wider font-mono">
                {title}
              </h2>
            )}
            {subtitle && <p className="text-[11px] text-[#6D7175]">{subtitle}</p>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      <div className={padding ? "p-4 sm:p-5" : ""}>{children}</div>
      {footer && (
        <div className="px-4 py-3 border-t border-[#E1E3E5] bg-[#FAFBFB] text-xs text-[#6D7175]">
          {footer}
        </div>
      )}
    </div>
  );
}

// 3. AdminStatusBadge: High-clarity status pills
export interface AdminStatusBadgeProps {
  variant?: "success" | "warning" | "error" | "neutral" | "info";
  children: React.ReactNode;
  className?: string;
}

export function AdminStatusBadge({
  variant = "neutral",
  children,
  className = "",
}: AdminStatusBadgeProps) {
  const variantStyles = {
    success: "bg-emerald-50 text-emerald-800 border-emerald-200",
    warning: "bg-amber-50 text-amber-800 border-amber-200",
    error: "bg-red-50 text-red-800 border-red-200",
    neutral: "bg-[#F6F6F7] text-[#6D7175] border-[#E1E3E5]",
    info: "bg-blue-50 text-blue-800 border-blue-200",
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wider border ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

// 4. AdminButton: Primary & Secondary actions with clear disabled reasoning
export interface AdminButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "plain";
  icon?: LucideIcon;
  restrictedReason?: string;
}

export function AdminButton({
  variant = "secondary",
  icon: Icon,
  children,
  disabled,
  restrictedReason,
  className = "",
  ...props
}: AdminButtonProps) {
  const baseStyles = "inline-flex items-center justify-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-md shadow-2xs transition-colors shrink-0";
  
  const variantStyles = {
    primary: "bg-[#008060] hover:bg-[#006e52] text-white disabled:bg-[#008060]/70 disabled:cursor-not-allowed",
    secondary: "bg-white border border-[#BABFC3] text-[#202223] hover:bg-[#F6F6F7] disabled:bg-[#F6F6F7] disabled:text-[#8C9196] disabled:border-[#D2D5D8] disabled:cursor-not-allowed",
    danger: "bg-red-600 hover:bg-red-700 text-white disabled:bg-red-300 disabled:cursor-not-allowed",
    plain: "text-[#008060] hover:underline shadow-none px-0 py-0 disabled:text-[#8C9196] disabled:no-underline disabled:cursor-not-allowed",
  };

  return (
    <button
      disabled={disabled}
      title={disabled && restrictedReason ? `Restricted: ${restrictedReason}` : undefined}
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {Icon && <Icon className="w-3.5 h-3.5" />}
      <span>{children}</span>
    </button>
  );
}

// 5. AdminEmptyState: Professional Shopify-style empty state box
export interface AdminEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function AdminEmptyState({
  icon: Icon,
  title,
  description,
  action,
}: AdminEmptyStateProps) {
  return (
    <div className="p-10 text-center space-y-3">
      <div className="w-10 h-10 rounded-full bg-[#F6F6F7] border border-[#E1E3E5] mx-auto flex items-center justify-center text-[#6D7175]">
        <Icon className="w-4 h-4" />
      </div>
      <div className="space-y-1">
        <h3 className="text-xs font-semibold text-[#202223]">{title}</h3>
        <p className="text-xs text-[#6D7175] max-w-sm mx-auto leading-normal">{description}</p>
      </div>
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}
