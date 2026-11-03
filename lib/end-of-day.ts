// End of day: types and the pure summary maths. Safe on client and server.
// The SQL that loads a day lives in app/api/admin/end-of-day/route.ts.
//
// Only PAID orders count as money collected, on the day the payment went through
// (metadata.payment_verified_at, else the order time). Cancelled or refunded
// orders never count. Website vs POS comes from orderSource() in lib/delivery.

export type PaymentBucket = 'cash' | 'momo' | 'card' | 'other';
export const PAYMENT_BUCKETS: PaymentBucket[] = ['cash', 'momo', 'card', 'other'];

export const BUCKET_META: Record<PaymentBucket, { label: string; icon: string }> = {
  cash: { label: 'Cash', icon: 'ri-money-dollar-box-line' },
  momo: { label: 'Mobile Money', icon: 'ri-smartphone-line' },
  card: { label: 'Card', icon: 'ri-bank-card-line' },
  other: { label: 'Other', icon: 'ri-more-2-line' },
};

/** POS saves cash, card or moolre (MoMo); the website saves moolre. */
export function paymentBucket(method: string | null | undefined): PaymentBucket {
  const m = String(method || '').toLowerCase();
  if (m === 'cash') return 'cash';
  if (m === 'card') return 'card';
  if (m === 'moolre' || m === 'momo' || m === 'mobile_money' || m === 'mtn') return 'momo';
  return 'other';
}

export type OrderState = 'collected' | 'awaiting' | 'failed' | 'void' | 'paid_other_day';

export const ORDER_STATE_META: Record<OrderState, { label: string; badge: string }> = {
  collected: { label: 'Paid', badge: 'bg-green-100 text-green-800' },
  awaiting: { label: 'Not paid yet', badge: 'bg-amber-100 text-amber-800' },
  failed: { label: 'Payment failed', badge: 'bg-red-100 text-red-700' },
  void: { label: 'Cancelled or refunded', badge: 'bg-gray-100 text-gray-600' },
  paid_other_day: { label: 'Paid on another day', badge: 'bg-gray-100 text-gray-600' },
};

export type DayOrderItem = {
  product_id: string | null;
  product_name: string;
  variant_name: string | null;
  quantity: number;
  total_price: number;
};

export type DayOrder = {
  id: string;
  order_number: string;
  customer: string;
  status: string;
  payment_status: string;
  payment_method: string | null;
  bucket: PaymentBucket;
  source: 'web' | 'pos';
  total: number;
  discount_total: number;
  shipping_total: number;
  created_at: string;
  paid_at: string | null;
  /** Placed on an earlier day, paid on this one. */
  created_earlier: boolean;
  state: OrderState;
  items: DayOrderItem[];
};

export type ChannelTotals = { orders: number; collected: number; byMethod: Record<PaymentBucket, number> };

export type DaySummary = {
  collected: number;
  ordersCount: number;
  itemsSold: number;
  averageOrder: number;
  discounts: number;
  deliveryFees: number;
  web: ChannelTotals;
  pos: ChannelTotals;
  byMethod: Record<PaymentBucket, number>;
  /** POS cash sales: what should have gone into the drawer. */
  cashSales: number;
  awaiting: { count: number; total: number };
  failed: { count: number; total: number };
  voided: { count: number; total: number };
  paidFromEarlierDays: { count: number; total: number };
  topProducts: Array<{ key: string; name: string; qty: number; revenue: number }>;
  byHour: Array<{ hour: number; web: number; pos: number }>;
};

const VOID = new Set(['cancelled', 'canceled', 'refunded']);
const round2 = (n: number) => Math.round(n * 100) / 100;
const zeroMethods = (): Record<PaymentBucket, number> => ({ cash: 0, momo: 0, card: 0, other: 0 });

/** Classifies an order for a day that runs from `start` (inclusive) to `end` (exclusive). */
export function orderState(
  o: { status: string; payment_status: string; created_at: string; paid_at: string | null },
  start: string,
  end: string
): OrderState {
  const t = (iso: string | null) => (iso ? new Date(iso).getTime() : NaN);
  const s = t(start);
  const e = t(end);
  if (VOID.has(String(o.status).toLowerCase()) || o.payment_status === 'refunded' || o.payment_status === 'partially_refunded') return 'void';
  if (o.payment_status === 'paid') {
    const paid = t(o.paid_at || o.created_at);
    return paid >= s && paid < e ? 'collected' : 'paid_other_day';
  }
  if (o.payment_status === 'failed') return 'failed';
  return 'awaiting';
}

export function summarizeDay(orders: DayOrder[], timeZoneOffsetHours = 0): DaySummary {
  const summary: DaySummary = {
    collected: 0,
    ordersCount: 0,
    itemsSold: 0,
    averageOrder: 0,
    discounts: 0,
    deliveryFees: 0,
    web: { orders: 0, collected: 0, byMethod: zeroMethods() },
    pos: { orders: 0, collected: 0, byMethod: zeroMethods() },
    byMethod: zeroMethods(),
    cashSales: 0,
    awaiting: { count: 0, total: 0 },
    failed: { count: 0, total: 0 },
    voided: { count: 0, total: 0 },
    paidFromEarlierDays: { count: 0, total: 0 },
    topProducts: [],
    byHour: Array.from({ length: 24 }, (_, hour) => ({ hour, web: 0, pos: 0 })),
  };
  const products = new Map<string, { key: string; name: string; qty: number; revenue: number }>();

  for (const o of orders) {
    const total = Number(o.total) || 0;
    if (o.state === 'awaiting') {
      summary.awaiting.count += 1;
      summary.awaiting.total += total;
      continue;
    }
    if (o.state === 'failed') {
      summary.failed.count += 1;
      summary.failed.total += total;
      continue;
    }
    if (o.state === 'void') {
      summary.voided.count += 1;
      summary.voided.total += total;
      continue;
    }
    if (o.state !== 'collected') continue;

    summary.ordersCount += 1;
    summary.collected += total;
    summary.discounts += Number(o.discount_total) || 0;
    summary.deliveryFees += Number(o.shipping_total) || 0;
    summary.byMethod[o.bucket] += total;
    const channel = o.source === 'pos' ? summary.pos : summary.web;
    channel.orders += 1;
    channel.collected += total;
    channel.byMethod[o.bucket] += total;
    if (o.source === 'pos' && o.bucket === 'cash') summary.cashSales += total;
    if (o.created_earlier) {
      summary.paidFromEarlierDays.count += 1;
      summary.paidFromEarlierDays.total += total;
    }

    const paidAt = new Date(o.paid_at || o.created_at);
    if (!Number.isNaN(paidAt.getTime())) {
      const hour = (paidAt.getUTCHours() + timeZoneOffsetHours + 24) % 24;
      summary.byHour[hour][o.source] += total;
    }

    for (const item of o.items || []) {
      const qty = Number(item.quantity) || 0;
      summary.itemsSold += qty;
      const key = `${item.product_id || item.product_name}::${item.variant_name || ''}`;
      const name = item.variant_name ? `${item.product_name} (${item.variant_name})` : item.product_name;
      const cur = products.get(key) || { key, name: name || 'Product', qty: 0, revenue: 0 };
      cur.qty += qty;
      cur.revenue += Number(item.total_price) || 0;
      products.set(key, cur);
    }
  }

  const r = (c: ChannelTotals) => {
    c.collected = round2(c.collected);
    for (const k of PAYMENT_BUCKETS) c.byMethod[k] = round2(c.byMethod[k]);
  };
  summary.collected = round2(summary.collected);
  summary.discounts = round2(summary.discounts);
  summary.deliveryFees = round2(summary.deliveryFees);
  summary.cashSales = round2(summary.cashSales);
  summary.averageOrder = summary.ordersCount ? round2(summary.collected / summary.ordersCount) : 0;
  for (const k of PAYMENT_BUCKETS) summary.byMethod[k] = round2(summary.byMethod[k]);
  r(summary.web);
  r(summary.pos);
  for (const g of [summary.awaiting, summary.failed, summary.voided, summary.paidFromEarlierDays]) g.total = round2(g.total);
  for (const h of summary.byHour) {
    h.web = round2(h.web);
    h.pos = round2(h.pos);
  }
  summary.topProducts = [...products.values()]
    .map((p) => ({ ...p, revenue: round2(p.revenue) }))
    .sort((a, b) => b.revenue - a.revenue || b.qty - a.qty)
    .slice(0, 10);
  return summary;
}

export type DayExpense = {
  id: string;
  staff_name: string | null;
  amount: number;
  description: string;
  category: string | null;
  status: 'pending' | 'approved' | 'rejected';
};

export type CashCount = {
  opening: number;
  counted: number | null;
  expected: number;
  variance: number | null;
  expensesFromDrawer: boolean;
};

/** Expected drawer cash: opening float plus POS cash sales, less approved expenses paid from the drawer. */
export function cashCount(opts: {
  opening: number;
  counted: number | null;
  cashSales: number;
  approvedExpenses: number;
  expensesFromDrawer: boolean;
}): CashCount {
  const expected = round2(opts.opening + opts.cashSales - (opts.expensesFromDrawer ? opts.approvedExpenses : 0));
  return {
    opening: round2(opts.opening),
    counted: opts.counted == null ? null : round2(opts.counted),
    expected,
    variance: opts.counted == null ? null : round2(opts.counted - expected),
    expensesFromDrawer: opts.expensesFromDrawer,
  };
}

/** What a closed day stores in end_of_day_reports.snapshot. */
export type DaySnapshot = {
  version: 1;
  summary: DaySummary;
  orders: DayOrder[];
  expenses: { approvedTotal: number; pendingTotal: number; items: DayExpense[] };
  cash: CashCount;
  reopened?: Array<{ by: string; at: string; closed_at: string | null; closed_by_name: string | null }>;
};

export type SavedReport = {
  id: string;
  report_date: string;
  opening_cash: number;
  counted_cash: number | null;
  expected_cash: number;
  variance: number | null;
  website_collected: number;
  pos_collected: number;
  cash_collected: number;
  card_collected: number;
  momo_collected: number;
  other_collected: number;
  orders_count: number;
  items_sold: number;
  order_total: number;
  expenses_total: number;
  notes: string | null;
  snapshot: Partial<DaySnapshot>;
  closed_by: string | null;
  closed_by_name: string | null;
  closed_at: string | null;
  updated_at: string | null;
};
