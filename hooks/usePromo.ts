'use client';

import { useEffect, useState } from 'react';

export interface StorefrontPromo {
  id: string;
  name: string;
  live: boolean;
  banner_text: string | null;
  popup: { title: string | null; message: string | null; cta_label: string | null } | null;
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
