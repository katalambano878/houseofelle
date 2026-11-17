'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  formatRange,
  promoCountdownTarget,
  promoHref,
  promoRange,
  useCountdown,
  usePromo,
  type StorefrontPromo,
} from '@/hooks/usePromo';
import { useCMS } from '@/context/CMSContext';
import { CategoryChips, CountdownTiles, SALE_PERKS, whatsappLink } from '@/components/sale/SaleBits';

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

/** Welcome popup announcing the current sale, shown once per sale to each visitor. */
export default function PromoPopup() {
  const promo = usePromo();
  const pathname = usePathname() || '/';
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);
  const { getSetting } = useCMS();
  const whatsapp = getSetting('contact_whatsapp') || '0570551050';
  const timing = promo ? promoCountdownTarget(promo) : { target: null, label: '' };
  const countdown = useCountdown(timing.target);

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
    show();
    return () => clearTimeout(showTimer);
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
  const range = promoRange(promo);
  const status = promo.live ? 'On now' : 'Coming soon';

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-6">
      <div className="promo-backdrop-in absolute inset-0 bg-blue-900/70 backdrop-blur-[3px]" onClick={close} aria-hidden="true" />
      <div
        id="promo-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="promo-title"
        aria-describedby="promo-message"
        className="promo-card-in relative w-full sm:max-w-3xl max-h-[92dvh] overflow-y-auto overscroll-contain bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl pb-[env(safe-area-inset-bottom)] sm:grid sm:grid-cols-[1.05fr_1fr]"
      >
        <button
          ref={closeRef}
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute top-3 right-3 z-10 w-10 h-10 flex items-center justify-center rounded-full text-white/80 hover:text-white hover:bg-white/10 sm:text-gray-500 sm:hover:text-gray-900 sm:hover:bg-gray-100 transition-colors cursor-pointer"
        >
          <i className="ri-close-line text-2xl" aria-hidden="true" />
        </button>

        {/* Left: the offer itself */}
        <div className="relative bg-blue-800 text-white px-6 sm:px-8 pt-7 pb-6 sm:py-10 overflow-hidden flex flex-col">
          <svg className="absolute -right-20 -top-20 w-72 h-72 text-blue-500/25" viewBox="0 0 200 200" fill="none" aria-hidden="true">
            <circle cx="100" cy="100" r="98" stroke="currentColor" />
            <circle cx="100" cy="100" r="74" stroke="currentColor" />
            <circle cx="100" cy="100" r="50" stroke="currentColor" />
          </svg>
          <div className="absolute -bottom-24 -left-16 w-64 h-64 rounded-full bg-blue-500/15 blur-3xl" aria-hidden="true" />

          <p className="relative inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-blue-500">
            <span className={`w-1.5 h-1.5 rounded-full bg-blue-500 ${promo.live ? 'animate-pulse motion-reduce:animate-none' : ''}`} aria-hidden="true" />
            {promo.name} · {status}
          </p>
          <h2 id="promo-title" className="relative mt-2 sm:mt-3 font-serif text-[1.75rem] sm:text-[2.4rem] leading-[1.05] text-balance">
            {title || promo.name}
          </h2>

          {range && (
            <div className="relative mt-3 sm:mt-5">
              <p className="text-xs uppercase tracking-[0.2em] text-white/60">{range.min === range.max ? 'Save' : 'Save up to'}</p>
              <p className="flex items-baseline gap-2 leading-none mt-1">
                <span className="text-5xl sm:text-7xl font-bold tracking-tight text-blue-500 tabular-nums">
                  {`${range.max}%`}
                </span>
                <span className="text-lg text-white/80">off</span>
              </p>
              {range.min !== range.max && (
                <p className="mt-2 text-sm text-white/70">Discounts from {formatRange(range)} on selected items</p>
              )}
            </div>
          )}

          <div className="relative mt-4 sm:mt-auto sm:pt-8">
            {countdown ? (
              <CountdownTiles countdown={countdown} label={timing.label} tone="dark" />
            ) : (
              <p className="hidden sm:block text-sm text-white/70">
                {promo.live ? 'Limited time only, while stocks last.' : 'Dropping soon. Be first in line for the best scents.'}
              </p>
            )}
          </div>
        </div>

        {/* Right: what, how and the next step */}
        <div className="px-6 sm:px-8 pt-5 sm:pt-12 sm:pb-8 flex flex-col">
          {message && (
            <p id="promo-message" className="text-gray-700 leading-relaxed text-pretty">
              {message}
            </p>
          )}

          <p className="mt-4 sm:mt-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-500 mb-2">On sale across</p>
          <CategoryChips onNavigate={close} tone="light" />

          <ul className="hidden sm:block mt-5 space-y-2.5">
            {SALE_PERKS.map((p) => (
              <li key={p.title} className="flex items-start gap-3 text-sm">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                  <i className={p.icon} aria-hidden="true" />
                </span>
                <span>
                  <span className="font-semibold text-gray-900">{p.title}</span>
                  <span className="text-gray-500"> · {p.text}</span>
                </span>
              </li>
            ))}
          </ul>

          <div className="sticky bottom-0 -mx-6 px-6 pt-3 pb-3 mt-4 bg-white border-t border-gray-100 sm:static sm:mx-0 sm:px-0 sm:pb-0 sm:border-0 sm:mt-auto sm:pt-6">
            <Link
              href={promoHref(promo)}
              onClick={close}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-semibold py-3.5 transition-colors active:scale-[0.98] motion-reduce:active:scale-100"
            >
              {promo.live ? cta_label || 'Shop the sale' : 'Browse the collection'}
              <i className="ri-arrow-right-line" aria-hidden="true" />
            </Link>
            <a
              href={whatsappLink(whatsapp, `Hello House of Elle, I'd like to know more about the ${promo.name} sale.`)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl ring-1 ring-gray-200 hover:ring-gray-300 hover:bg-gray-50 text-gray-800 font-medium py-3 transition-colors"
            >
              <i className="ri-whatsapp-line text-lg text-green-600" aria-hidden="true" />
              {promo.live ? 'Order on WhatsApp' : 'Reserve on WhatsApp'}
            </a>
            <button
              type="button"
              onClick={close}
              className="mt-1 w-full py-2.5 text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors cursor-pointer"
            >
              Maybe later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
