'use client';

import Link from 'next/link';
import type { Countdown } from '@/hooks/usePromo';

/** The store's four ranges, in the words customers use. */
export const SALE_CATEGORIES = [
  { slug: 'perfume', label: 'Scents for Him', icon: 'ri-drop-line' },
  { slug: 'body-care-essentials', label: 'Scents for Her', icon: 'ri-flower-line' },
  { slug: 'home-fragrance', label: 'Home & Candles', icon: 'ri-fire-line' },
  { slug: 'gift-sets-bundles', label: 'Gift Sets', icon: 'ri-gift-line' },
] as const;

export const SALE_PERKS = [
  { icon: 'ri-shield-check-line', title: 'Genuine scents', text: 'Authentic, long-lasting fragrances' },
  { icon: 'ri-truck-line', title: 'We deliver', text: 'Within Accra and outside Accra' },
  { icon: 'ri-smartphone-line', title: 'Easy payment', text: 'Mobile Money online, or cash in store' },
] as const;

export function whatsappLink(number: string, text: string): string {
  const digits = number.replace(/\D/g, '');
  const intl = digits.startsWith('0') ? `233${digits.slice(1)}` : digits;
  return `https://wa.me/${intl}?text=${encodeURIComponent(text)}`;
}

/** Days / hrs / min / sec tiles. `tone` picks colours for a dark or light surface. */
export function CountdownTiles({ countdown, label, tone }: { countdown: Countdown; label: string; tone: 'dark' | 'light' }) {
  const parts = [
    ['days', countdown.days],
    ['hrs', countdown.hours],
    ['min', countdown.minutes],
    ['sec', countdown.seconds],
  ] as const;
  const tile = tone === 'dark' ? 'bg-white/10 ring-1 ring-white/15' : 'bg-blue-50';
  const value = tone === 'dark' ? 'text-white' : 'text-blue-800';
  const sub = tone === 'dark' ? 'text-white/60' : 'text-gray-500';
  return (
    <div role="timer" aria-label={`${label} ${countdown.days} days ${countdown.hours} hours ${countdown.minutes} minutes`}>
      <p className={`text-[11px] font-semibold uppercase tracking-[0.2em] mb-2 ${sub}`}>{label}</p>
      <div className="grid grid-cols-4 gap-2 max-w-xs">
        {parts.map(([name, v]) => (
          <div key={name} className={`rounded-xl py-2 text-center ${tile}`}>
            <span className={`block text-xl sm:text-2xl font-bold tabular-nums ${value}`}>{String(v).padStart(2, '0')}</span>
            <span className={`block text-[10px] uppercase tracking-wider ${sub}`}>{name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CategoryChips({ onNavigate, tone }: { onNavigate?: () => void; tone: 'dark' | 'light' }) {
  const chip =
    tone === 'dark'
      ? 'bg-white/5 text-white ring-1 ring-white/15 hover:bg-white/10'
      : 'bg-blue-50 text-blue-800 ring-1 ring-blue-200/70 hover:bg-blue-100';
  return (
    <ul className="grid grid-cols-2 gap-2">
      {SALE_CATEGORIES.map((c) => (
        <li key={c.slug}>
          <Link
            href={`/shop?category=${c.slug}`}
            onClick={onNavigate}
            className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${chip}`}
          >
            <i className={`${c.icon} text-base text-blue-500`} aria-hidden="true" />
            {c.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
