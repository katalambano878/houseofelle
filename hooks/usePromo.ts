'use client';

import { useEffect, useState } from 'react';

export interface StorefrontPromo {
  id: string;
  name: string;
  live: boolean;
  banner_text: string | null;
  popup: { title: string | null; message: string | null; cta_label: string | null } | null;
  starts_at: string | null;
  ends_at: string | null;
  product_count: number;
  max_percent: number;
  min_percent: number;
  updated_at: string;
}

// One request per page load, shared by the banner, the popup and the sale page.
let pending: Promise<StorefrontPromo | null> | null = null;

export function loadPromo(): Promise<StorefrontPromo | null> {
  if (!pending) {
    pending = fetch('/api/storefront/promo')
      .then((r) => (r.ok ? r.json() : { promo: null }))
      .then((d) => (d?.promo as StorefrontPromo) ?? null)
      .catch(() => null);
  }
  return pending;
}

/** The current sale announcement, or null. `undefined` while loading. */
export function usePromo(): StorefrontPromo | null | undefined {
  const [promo, setPromo] = useState<StorefrontPromo | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    loadPromo().then((p) => alive && setPromo(p));
    return () => {
      alive = false;
    };
  }, []);
  return promo;
}

/** Where the sale's call-to-action goes: the sale page once prices are live. */
export function promoHref(promo: StorefrontPromo): string {
  return promo.live && promo.product_count > 0 ? '/sale' : '/shop';
}

/**
 * The discount range to advertise: the real one once products are in the sale,
 * otherwise the range the owner wrote in the banner or popup ("10 to 40% off").
 */
export function promoRange(promo: StorefrontPromo): { min: number; max: number } | null {
  if (promo.max_percent > 0) return { min: promo.min_percent || promo.max_percent, max: promo.max_percent };
  const text = [promo.banner_text, promo.popup?.message, promo.popup?.title].filter(Boolean).join(' ');
  const pair = /(\d{1,2})\s*(?:%\s*)?(?:to|-|–|—)\s*(\d{1,2})\s*%/i.exec(text);
  if (pair) return { min: Number(pair[1]), max: Number(pair[2]) };
  const single = /(\d{1,2})\s*%/.exec(text);
  return single ? { min: Number(single[1]), max: Number(single[1]) } : null;
}

export function formatRange(r: { min: number; max: number }): string {
  return r.min === r.max ? `${r.max}%` : `${r.min}–${r.max}%`;
}

export interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/** Ticks every second until `target`; null when there is no target or it has passed. */
export function useCountdown(target: string | null): Countdown | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!target) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [target]);
  if (!target || now === null) return null;
  const ms = new Date(target).getTime() - now;
  if (ms <= 0) return null;
  return {
    days: Math.floor(ms / 86_400_000),
    hours: Math.floor((ms % 86_400_000) / 3_600_000),
    minutes: Math.floor((ms % 3_600_000) / 60_000),
    seconds: Math.floor((ms % 60_000) / 1000),
  };
}

/** The countdown to show: to the start while announced, to the end while live. */
export function promoCountdownTarget(promo: StorefrontPromo): { target: string | null; label: string } {
  if (promo.live) return { target: promo.ends_at, label: 'Ends in' };
  return { target: promo.starts_at, label: 'Starts in' };
}
