'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { promoHref, usePromo, type StorefrontPromo } from '@/hooks/usePromo';

const SEEN_PREFIX = 'hoe.promo.seen.';
const SHOW_DELAY_MS = 1800;
// Never interrupt someone who is paying or tracking an order.
const QUIET_PATHS = ['/checkout', '/cart', '/order-success', '/order-tracking', '/account', '/auth', '/admin'];

function seenKey(p: StorefrontPromo) {
  // Re-show when the owner edits the popup or the sale goes live.
  return `${SEEN_PREFIX}${p.id}.${p.live ? 'live' : 'soon'}.${p.updated_at}`;
}

function readSeen(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function markSeen(key: string) {
  try {
    localStorage.setItem(key, '1');
  } catch {
    /* private mode: it will show again next visit */
  }
}

function useCountdown(endsAt: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!endsAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [endsAt]);
  if (!endsAt) return null;
  const ms = new Date(endsAt).getTime() - now;
  if (ms <= 0) return null;
  return {
    days: Math.floor(ms / 86_400_000),
    hours: Math.floor((ms % 86_400_000) / 3_600_000),
    minutes: Math.floor((ms % 3_600_000) / 60_000),
    seconds: Math.floor((ms % 60_000) / 1000),
  };
}

/** Welcome popup announcing the current sale, shown once per sale to each visitor. */
export default function PromoPopup() {
  const promo = usePromo();
  const pathname = usePathname() || '/';
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);
  const countdown = useCountdown(promo?.live ? promo.ends_at : null);

  const quiet = QUIET_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`)) || pathname === '/sale';

  useEffect(() => {
    if (!promo?.popup || quiet || readSeen(seenKey(promo))) return;
    let showTimer: ReturnType<typeof setTimeout> | undefined;
    const show = () => {
      showTimer = setTimeout(() => {
        lastFocus.current = document.activeElement as HTMLElement | null;
        setOpen(true);
      }, SHOW_DELAY_MS);
    };
    // Wait until the visitor has answered the cookie banner, so the two never stack.
    const consentGiven = () => {
      try {
        return localStorage.getItem('cookieConsent') !== null;
      } catch {
        return true;
      }
    };
    if (consentGiven()) {
      show();
      return () => clearTimeout(showTimer);
    }
    const poll = setInterval(() => {
      if (consentGiven()) {
        clearInterval(poll);
        show();
      }
    }, 800);
    return () => {
      clearInterval(poll);
      clearTimeout(showTimer);
    };
  }, [promo, quiet]);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'Tab') {
        // Keep focus inside the dialog.
        const nodes = document.querySelectorAll<HTMLElement>('#promo-dialog a, #promo-dialog button');
        if (!nodes.length) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function close() {
    if (promo) markSeen(seenKey(promo));
    setOpen(false);
    lastFocus.current?.focus?.();
  }

  if (!open || !promo?.popup) return null;

  const { title, message, cta_label } = promo.popup;
  const hasRange = promo.live && promo.max_percent > 0;
  const range =
    hasRange && promo.min_percent !== promo.max_percent
      ? `${promo.min_percent}–${promo.max_percent}%`
      : hasRange
        ? `${promo.max_percent}%`
        : null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4">
      <div className="promo-backdrop-in absolute inset-0 bg-blue-900/60 backdrop-blur-[2px]" onClick={close} aria-hidden="true" />
      <div
        id="promo-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="promo-title"
        aria-describedby="promo-message"
        className="promo-card-in relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden pb-[env(safe-area-inset-bottom)]"
      >
        <button
          ref={closeRef}
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute top-3 right-3 z-10 w-10 h-10 flex items-center justify-center rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        >
          <i className="ri-close-line text-2xl" aria-hidden="true" />
        </button>

        <div className="relative bg-blue-800 text-white px-7 pt-9 pb-8 overflow-hidden">
          {/* Fine gold rings, a quiet nod to a perfume bottle's cap. */}
          <svg className="absolute -right-16 -top-16 w-64 h-64 text-blue-500/25" viewBox="0 0 200 200" fill="none" aria-hidden="true">
            <circle cx="100" cy="100" r="98" stroke="currentColor" />
            <circle cx="100" cy="100" r="74" stroke="currentColor" />
            <circle cx="100" cy="100" r="50" stroke="currentColor" />
          </svg>
          <p className="relative text-[11px] font-semibold uppercase tracking-[0.28em] text-blue-500">
            {promo.live ? `${promo.name} · On now` : `${promo.name} · Coming soon`}
          </p>
          <h2 id="promo-title" className="relative mt-3 font-serif text-[2rem] leading-[1.1] text-balance">
            {title || promo.name}
          </h2>
          {range && (
            <p className="relative mt-4 flex items-baseline gap-2">
              <span className="text-5xl font-bold tracking-tight text-blue-500 tabular-nums">{range}</span>
              <span className="text-sm text-white/80">off</span>
            </p>
          )}
        </div>

        <div className="px-7 pt-6 pb-7">
          {message && (
            <p id="promo-message" className="text-gray-600 leading-relaxed text-pretty">
              {message}
            </p>
          )}

          {countdown && (
            <div className="mt-5" aria-label="Time left in the sale">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Ends in</p>
              <div className="grid grid-cols-4 gap-2">
                {(
                  [
                    ['days', countdown.days],
                    ['hrs', countdown.hours],
                    ['min', countdown.minutes],
                    ['sec', countdown.seconds],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-blue-50 py-2 text-center">
                    <span className="block text-xl font-bold text-blue-800 tabular-nums">{String(value).padStart(2, '0')}</span>
                    <span className="block text-[10px] uppercase tracking-wider text-gray-500">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Link
            href={promoHref(promo)}
            onClick={close}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-semibold py-3.5 transition-colors active:scale-[0.98] motion-reduce:active:scale-100"
          >
            {cta_label || 'Shop the sale'}
            <i className="ri-arrow-right-line" aria-hidden="true" />
          </Link>
          <button
            type="button"
            onClick={close}
            className="mt-2 w-full py-2.5 text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors cursor-pointer"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
