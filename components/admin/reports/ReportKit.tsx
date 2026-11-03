'use client';

// Shared building blocks for the admin report screens (Expenses, Profit margins, End of Day).
// Matches the admin look: white rounded-xl cards, gray borders, Remix icons, brand blue-* scale.

import { useEffect, useId, useRef, type ReactNode } from 'react';

export const btnPrimary =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
export const btnSecondary =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
export const btnDanger =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
export const inputBase =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:bg-gray-50 disabled:text-gray-500';
export const inputError = 'border-red-400 focus:border-red-500 focus:ring-red-500/20';
export const labelBase = 'mb-1.5 block text-sm font-semibold text-gray-700';

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-blue-600">{eyebrow}</p>}
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-gray-600 sm:text-base">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 md:justify-end">{actions}</div>}
    </div>
  );
}

export type StatTone = 'neutral' | 'brand' | 'good' | 'warn' | 'bad';

const STAT_ICON_TONE: Record<StatTone, string> = {
  neutral: 'bg-gray-100 text-gray-600',
  brand: 'bg-blue-100 text-blue-700',
  good: 'bg-green-100 text-green-700',
  warn: 'bg-amber-100 text-amber-700',
  bad: 'bg-red-100 text-red-700',
};

export function Stat({
  label,
  value,
  hint,
  icon,
  tone = 'neutral',
  emphasis,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: string;
  tone?: StatTone;
  emphasis?: boolean;
}) {
  if (emphasis) {
    return (
      <div className="rounded-xl border border-blue-800 bg-blue-800 p-4 text-white shadow-sm sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium text-blue-200">{label}</p>
          {icon && <i className={`${icon} text-xl text-blue-500`} aria-hidden="true" />}
        </div>
        <p className="mt-2 text-lg font-bold tabular-nums sm:text-2xl">{value}</p>
        {hint && <p className="mt-1 text-xs text-blue-200/80">{hint}</p>}
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-gray-600">{label}</p>
        {icon && (
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${STAT_ICON_TONE[tone]}`}>
            <i className={`${icon} text-base`} aria-hidden="true" />
          </span>
        )}
      </div>
      <p className="mt-2 text-lg font-bold text-gray-900 tabular-nums sm:text-2xl">{value}</p>
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

export function Panel({
  title,
  subtitle,
  actions,
  children,
  className = '',
  flush,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** No inner padding (for tables and lists). */
  flush?: boolean;
}) {
  return (
    <section className={`overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm ${className}`}>
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 px-4 py-3.5 sm:px-5">
          <div className="min-w-0">
            {title && <h2 className="text-base font-bold text-gray-900">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={flush ? '' : 'p-4 sm:p-5'}>{children}</div>
    </section>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
  compact,
}: {
  icon: string;
  title: string;
  body?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`flex flex-col items-center text-center ${compact ? 'px-4 py-8' : 'px-6 py-14'}`}>
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-700">
        <i className={`${icon} text-2xl`} aria-hidden="true" />
      </span>
      <p className="font-semibold text-gray-900">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-gray-500">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between">
      <span className="flex items-start gap-2">
        <i className="ri-error-warning-line mt-0.5 text-base" aria-hidden="true" />
        {message}
      </span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="self-start font-semibold underline underline-offset-2 hover:text-red-900 sm:self-auto">
          Try again
        </button>
      )}
    </div>
  );
}

/** A short-lived confirmation line. Announced to screen readers. */
export function Flash({ message, tone = 'good', onDone }: { message: string; tone?: 'good' | 'warn'; onDone: () => void }) {
  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(onDone, 4500);
    return () => window.clearTimeout(t);
  }, [message, onDone]);
  if (!message) return null;
  return (
    <div
      role="status"
      className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium ${
        tone === 'good' ? 'border-green-200 bg-green-50 text-green-800' : 'border-amber-200 bg-amber-50 text-amber-800'
      }`}
    >
      <i className={tone === 'good' ? 'ri-checkbox-circle-line' : 'ri-information-line'} aria-hidden="true" />
      <span className="flex-1">{message}</span>
      <button type="button" onClick={onDone} className="rounded p-1 hover:bg-black/5" aria-label="Dismiss">
        <i className="ri-close-line" aria-hidden="true" />
      </button>
    </div>
  );
}

export function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-gray-100 ${className}`} />;
}

export function SkeletonStats({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <SkeletonBlock className="h-4 w-24" />
          <SkeletonBlock className="mt-3 h-7 w-32" />
          <SkeletonBlock className="mt-2 h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonRows({ rows = 6 }: { rows?: number }) {
  return (
    <div className="divide-y divide-gray-100" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-4 sm:px-5">
          <SkeletonBlock className="h-9 w-9 shrink-0" />
          <div className="flex-1 space-y-2">
            <SkeletonBlock className="h-3.5 w-2/5" />
            <SkeletonBlock className="h-3 w-1/4" />
          </div>
          <SkeletonBlock className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

/** Accessible confirmation dialog for destructive or important actions. */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  tone = 'danger',
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body?: ReactNode;
  confirmLabel: string;
  tone?: 'danger' | 'primary';
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const bodyId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [open, busy, onCancel]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" onMouseDown={() => !busy && onCancel()}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={body ? bodyId : undefined}
        className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
              tone === 'danger' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-700'
            }`}
          >
            <i className={tone === 'danger' ? 'ri-delete-bin-6-line text-lg' : 'ri-question-line text-lg'} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-bold text-gray-900">{title}</h2>
            {body && <div id={bodyId} className="mt-1 text-sm text-gray-600">{body}</div>}
          </div>
        </div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button ref={cancelRef} type="button" onClick={onCancel} disabled={busy} className={btnSecondary}>
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={busy} className={tone === 'danger' ? btnDanger : btnPrimary}>
            {busy && <i className="ri-loader-4-line animate-spin" aria-hidden="true" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Text input with a GH₵ prefix. */
export function MoneyInput({
  id,
  value,
  onChange,
  invalid,
  placeholder = '0.00',
  disabled,
  describedBy,
  className = '',
  autoFocus,
  onKeyDown,
  onBlur,
  ariaLabel,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
  placeholder?: string;
  disabled?: boolean;
  describedBy?: string;
  className?: string;
  autoFocus?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onBlur?: () => void;
  ariaLabel?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-medium text-gray-500">GH₵</span>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'))}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        aria-label={ariaLabel}
        autoFocus={autoFocus}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        className={`${inputBase} pl-12 tabular-nums ${invalid ? inputError : ''}`}
      />
    </div>
  );
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1.5 flex items-center gap-1 text-xs font-medium text-red-600">
      <i className="ri-error-warning-fill" aria-hidden="true" />
      {message}
    </p>
  );
}

/** CSV cell: always quoted, inner quotes doubled, formula-looking values defused. */
export function csvCell(value: unknown): string {
  let v = value == null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  return `"${v.replace(/"/g, '""')}"`;
}

export function downloadCsv(filename: string, rows: unknown[][]) {
  const csv = rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Plain number for CSV cells (no currency symbol, two decimals). */
export function csvMoney(n: number | null | undefined): string {
  return n == null || !Number.isFinite(Number(n)) ? '' : Number(n).toFixed(2);
}

/** Parses a typed money value; null when empty or invalid. */
export function parseMoney(value: string): number | null {
  if (value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}
