'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { money } from '@/lib/format-money';
import { orderSource } from '@/lib/delivery';

const SEEN_KEY = 'houseofelle.admin.seenOrderIds';
const POLL_MS = 20000;

type OrderAlert = {
  id: string;
  order_number: string;
  email: string | null;
  total: number;
  created_at: string;
  payment_status: string;
  status: string;
  metadata: any;
  shipping_address: any;
};

function loadSeen(): Set<string> {
  try {
    const ids = JSON.parse(localStorage.getItem(SEEN_KEY) || '[]');
    return new Set(Array.isArray(ids) ? ids : []);
  } catch {
    return new Set();
  }
}

function saveSeen(ids: Set<string>) {
  try {
    // Keep the list short; only recent orders are ever shown.
    localStorage.setItem(SEEN_KEY, JSON.stringify([...ids].slice(-200)));
  } catch {
    /* private mode */
  }
}

function timeAgo(iso: string) {
  const m = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function customerName(o: OrderAlert) {
  const a = o.shipping_address || {};
  const full = [a.firstName, a.lastName].filter(Boolean).join(' ').trim() || a.full_name;
  return full || o.email || 'Guest';
}

/** Header bell: the latest paid orders, a count of unseen ones, and a desktop alert when one arrives. */
export default function AdminOrderBell() {
  const [open, setOpen] = useState(false);
  const [orders, setOrders] = useState<OrderAlert[]>([]);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [toFulfil, setToFulfil] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const knownIds = useRef<Set<string> | null>(null);

  const refresh = useCallback(async () => {
    const [{ data, error }, fulfil] = await Promise.all([
      supabase
        .from('orders')
        .select('id, order_number, email, total, created_at, payment_status, status, metadata, shipping_address')
        .eq('payment_status', 'paid')
        .order('created_at', { ascending: false })
        .limit(15),
      supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('payment_status', 'paid')
        .in('status', ['pending', 'processing']),
    ]);
    if (!fulfil.error) setToFulfil(fulfil.count ?? 0);
    if (error || !data) return;
    const rows = data as OrderAlert[];
    setOrders(rows);

    let stored = loadSeen();
    let firstVisit = false;
    try {
      firstVisit = !localStorage.getItem(SEEN_KEY);
    } catch {
      /* ignore */
    }
    if (firstVisit) {
      // First time on this device: only orders from the last hour count as new.
      const cutoff = Date.now() - 60 * 60 * 1000;
      rows.filter((o) => new Date(o.created_at).getTime() < cutoff).forEach((o) => stored.add(o.id));
      saveSeen(stored);
      stored = loadSeen();
    }
    setSeen(stored);

    if (knownIds.current) {
      const newcomers = rows.filter((o) => !knownIds.current!.has(o.id));
      if (newcomers.length && 'Notification' in window && Notification.permission === 'granted') {
        const latest = newcomers[0];
        new Notification('New House of Elle order', {
          body: `${latest.order_number} · GH₵${money(latest.total)} · ${customerName(latest)}`,
          icon: '/favicon/favicon-32x32.png',
        });
      }
    }
    knownIds.current = new Set(rows.map((o) => o.id));
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(() => {
      if (document.visibilityState === 'visible' || 'Notification' in window) refresh();
    }, POLL_MS);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const unseen = orders.filter((o) => !seen.has(o.id)).length;

  const markSeen = (ids: string[]) => {
    const next = new Set(seen);
    ids.forEach((id) => next.add(id));
    saveSeen(next);
    setSeen(next);
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
      refresh();
    }
  };

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label={unseen ? `${unseen} new paid orders` : 'Order alerts'}
        className="relative w-10 h-10 flex items-center justify-center text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
      >
        <i className="ri-notification-3-line text-xl" aria-hidden="true" />
        {unseen > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unseen > 9 ? '9+' : unseen}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[min(22rem,calc(100vw-2rem))] bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-40">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">Paid orders</p>
              <p className="text-xs text-gray-500">
                {toFulfil > 0 ? `${toFulfil} waiting to be packed or delivered` : 'Nothing waiting to fulfil'}
              </p>
            </div>
            {unseen > 0 && (
              <button
                type="button"
                onClick={() => markSeen(orders.map((o) => o.id))}
                className="text-xs font-semibold text-blue-700 hover:text-blue-800 cursor-pointer"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {orders.length === 0 ? (
              <p className="px-4 py-10 text-sm text-gray-500 text-center">No paid orders yet.</p>
            ) : (
              orders.map((o) => {
                const isNew = !seen.has(o.id);
                const pos = orderSource(o) === 'pos';
                return (
                  <Link
                    key={o.id}
                    href={`/admin/orders/${o.id}`}
                    onClick={() => {
                      markSeen([o.id]);
                      setOpen(false);
                    }}
                    className={`flex gap-3 px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${isNew ? 'bg-blue-50/60' : ''}`}
                  >
                    <span
                      className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${isNew ? 'bg-blue-700' : 'bg-transparent'}`}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-gray-900 truncate">{o.order_number}</span>
                        <span className="text-[11px] text-gray-500 shrink-0">{timeAgo(o.created_at)}</span>
                      </span>
                      <span className="block text-xs text-gray-600 truncate">{customerName(o)}</span>
                      <span className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-semibold text-gray-900 tabular-nums">GH₵{money(o.total)}</span>
                        <span
                          className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${pos ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-700'}`}
                        >
                          {pos ? 'POS' : 'Website'}
                        </span>
                        <span className="text-[11px] text-gray-500 capitalize">{o.status}</span>
                      </span>
                    </span>
                  </Link>
                );
              })
            )}
          </div>
          <Link
            href="/admin/orders"
            onClick={() => setOpen(false)}
            className="block px-4 py-3 text-center text-sm font-semibold text-blue-700 hover:bg-gray-50"
          >
            View all orders
          </Link>
        </div>
      )}
    </div>
  );
}
