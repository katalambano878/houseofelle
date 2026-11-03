'use client';

import Link from 'next/link';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { adminFetch, cedis } from '@/lib/admin-fetch';
import {
  BUCKET_META,
  ORDER_STATE_META,
  PAYMENT_BUCKETS,
  cashCount,
  type DayExpense,
  type DayOrder,
  type DaySummary,
  type SavedReport,
} from '@/lib/end-of-day';
import { categoryOf } from '@/lib/expenses';
import { addDays, formatDateTime, formatDay, formatTime, todayInAccra } from '@/lib/report-dates';
import {
  ConfirmDialog,
  EmptyState,
  ErrorBanner,
  FieldError,
  Flash,
  MoneyInput,
  Panel,
  SkeletonBlock,
  SkeletonStats,
  Stat,
  btnPrimary,
  btnSecondary,
  csvMoney,
  downloadCsv,
  inputBase,
  labelBase,
  parseMoney,
} from '@/components/admin/reports/ReportKit';

type DayExpenses = { approvedTotal: number; pendingTotal: number; items: DayExpense[] };

type DayResponse = {
  date: string;
  today: string;
  live: { summary: DaySummary; orders: DayOrder[]; expenses: DayExpenses };
  report: SavedReport | null;
  history: Array<{ report_date: string; collected: number; variance: number | null; expenses_total: number; closed_at: string | null; closed_by_name: string | null }>;
  previous: { report_date: string; counted_cash: number } | null;
  canReopen: boolean;
};

type OrderFilter = 'all' | 'collected' | 'unpaid' | 'other';

const DRAFT_PREFIX = 'hoe-eod-draft-';

export default function EndOfDayPage() {
  const uid = useId();
  const [date, setDate] = useState(() => todayInAccra());
  const [data, setData] = useState<DayResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');

  const [openingText, setOpeningText] = useState('');
  const [countedText, setCountedText] = useState('');
  const [notes, setNotes] = useState('');
  const [fromDrawer, setFromDrawer] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ openingCash?: string; countedCash?: string }>({});
  const [confirmClose, setConfirmClose] = useState(false);
  const [confirmReopen, setConfirmReopen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [orderFilter, setOrderFilter] = useState<OrderFilter>('all');
  const seq = useRef(0);
  const draftReady = useRef(false);

  const load = useCallback(async (target: string) => {
    const mine = ++seq.current;
    setLoading(true);
    setError('');
    draftReady.current = false;
    try {
      const res = await adminFetch<DayResponse>(`/api/admin/end-of-day?date=${encodeURIComponent(target)}`);
      if (mine !== seq.current) return;
      setData(res);
      const r = res.report;
      let draft: { opening?: string; counted?: string; notes?: string; fromDrawer?: boolean } | null = null;
      try {
        draft = JSON.parse(window.localStorage.getItem(DRAFT_PREFIX + target) || 'null');
      } catch {
        draft = null;
      }
      if (r && r.closed_at) {
        setOpeningText(String(r.opening_cash ?? 0));
        setCountedText(r.counted_cash != null ? String(r.counted_cash) : '');
        setNotes(r.notes || '');
        setFromDrawer(Boolean(r.snapshot?.cash?.expensesFromDrawer));
      } else if (draft) {
        setOpeningText(draft.opening ?? '');
        setCountedText(draft.counted ?? '');
        setNotes(draft.notes ?? '');
        setFromDrawer(Boolean(draft.fromDrawer));
      } else if (r) {
        // Reopened day: start from what was saved.
        setOpeningText(String(r.opening_cash ?? 0));
        setCountedText(r.counted_cash != null ? String(r.counted_cash) : '');
        setNotes(r.notes || '');
        setFromDrawer(Boolean(r.snapshot?.cash?.expensesFromDrawer));
      } else {
        setOpeningText('');
        setCountedText('');
        setNotes('');
        setFromDrawer(false);
      }
      setFieldErrors({});
      draftReady.current = true;
    } catch (err) {
      if (mine !== seq.current) return;
      setError(err instanceof Error ? err.message : 'Could not load the day.');
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(date);
  }, [date, load]);

  const report = data?.report ?? null;
  const closed = Boolean(report?.closed_at);
  const snap = closed ? report?.snapshot : null;

  // Keep an unsent count on this device so a refresh does not lose it.
  useEffect(() => {
    if (!draftReady.current || closed || !data) return;
    try {
      const key = DRAFT_PREFIX + data.date;
      if (!openingText && !countedText && !notes && !fromDrawer) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, JSON.stringify({ opening: openingText, counted: countedText, notes, fromDrawer }));
    } catch {
      /* storage unavailable */
    }
  }, [openingText, countedText, notes, fromDrawer, closed, data]);

  // A closed day shows what was saved; an open day shows live figures.
  const summary: DaySummary | null = (snap?.summary as DaySummary | undefined) ?? data?.live.summary ?? null;
  const orders: DayOrder[] = (snap?.orders as DayOrder[] | undefined) ?? data?.live.orders ?? [];
  const expenses: DayExpenses | null = (snap?.expenses as DayExpenses | undefined) ?? data?.live.expenses ?? null;

  const opening = parseMoney(openingText) ?? 0;
  const counted = parseMoney(countedText);
  const cash = closed && snap?.cash
    ? snap.cash
    : cashCount({
        opening,
        counted,
        cashSales: summary?.cashSales ?? 0,
        approvedExpenses: expenses?.approvedTotal ?? 0,
        expensesFromDrawer: fromDrawer,
      });

  const liveChanged =
    closed && data && summary
      ? Math.abs(data.live.summary.collected - summary.collected) > 0.004 || data.live.summary.ordersCount !== summary.ordersCount
      : false;

  const isToday = data ? date === data.today : date === todayInAccra();
  const maxDate = data?.today ?? todayInAccra();

  const visibleOrders = useMemo(() => {
    switch (orderFilter) {
      case 'collected':
        return orders.filter((o) => o.state === 'collected');
      case 'unpaid':
        return orders.filter((o) => o.state === 'awaiting' || o.state === 'failed');
      case 'other':
        return orders.filter((o) => o.state === 'void' || o.state === 'paid_other_day');
      default:
        return orders;
    }
  }, [orders, orderFilter]);

  const validate = () => {
    const e: { openingCash?: string; countedCash?: string } = {};
    if (openingText.trim() !== '' && parseMoney(openingText) == null) e.openingCash = 'Enter a number, like 200.';
    if (countedText.trim() === '') e.countedCash = 'Count the cash in the drawer before you close the day.';
    else if (parseMoney(countedText) == null) e.countedCash = 'Enter a number, like 1250.50.';
    setFieldErrors(e);
    return Object.keys(e).length === 0;
  };

  const closeDay = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await adminFetch<{ message: string }>('/api/admin/end-of-day', {
        method: 'POST',
        body: JSON.stringify({ action: 'close', date, openingCash: opening, countedCash: counted, notes, expensesFromDrawer: fromDrawer }),
      });
      try {
        window.localStorage.removeItem(DRAFT_PREFIX + date);
      } catch {
        /* storage unavailable */
      }
      setFlash(res.message);
      setConfirmClose(false);
      await load(date);
    } catch (err) {
      setConfirmClose(false);
      setError(err instanceof Error ? err.message : 'Could not close the day.');
    } finally {
      setSaving(false);
    }
  };

  const reopenDay = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await adminFetch<{ message: string }>('/api/admin/end-of-day', {
        method: 'POST',
        body: JSON.stringify({ action: 'reopen', date }),
      });
      setFlash(res.message);
      setConfirmReopen(false);
      await load(date);
    } catch (err) {
      setConfirmReopen(false);
      setError(err instanceof Error ? err.message : 'Could not reopen the day.');
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = () => {
    if (!summary || !expenses) return;
    const rows: unknown[][] = [
      ['House of Elle', 'End of day', date],
      ['Status', closed ? `Closed ${formatDateTime(report?.closed_at)} by ${report?.closed_by_name || ''}` : 'Not closed'],
      [],
      ['Summary', 'Amount (GHS)'],
      ['Collected (paid orders)', csvMoney(summary.collected)],
      ['Website', csvMoney(summary.web.collected)],
      ['POS', csvMoney(summary.pos.collected)],
      ...PAYMENT_BUCKETS.map((b) => [`${BUCKET_META[b].label} (website ${csvMoney(summary.web.byMethod[b])}, POS ${csvMoney(summary.pos.byMethod[b])})`, csvMoney(summary.byMethod[b])]),
      ['Paid orders', summary.ordersCount],
      ['Items sold', summary.itemsSold],
      ['Discounts given', csvMoney(summary.discounts)],
      ['Delivery fees', csvMoney(summary.deliveryFees)],
      ['Not paid yet', `${summary.awaiting.count} orders`, csvMoney(summary.awaiting.total)],
      ['Approved expenses', csvMoney(expenses.approvedTotal)],
      ['Expenses waiting for review', csvMoney(expenses.pendingTotal)],
      ['Takings after approved expenses', csvMoney(summary.collected - expenses.approvedTotal)],
      [],
      ['Cash drawer', 'Amount (GHS)'],
      ['Opening cash', csvMoney(cash.opening)],
      ['POS cash sales', csvMoney(summary.cashSales)],
      ['Expenses paid from drawer', cash.expensesFromDrawer ? csvMoney(expenses.approvedTotal) : '0.00'],
      ['Expected in drawer', csvMoney(cash.expected)],
      ['Counted', csvMoney(cash.counted)],
      ['Variance (counted minus expected)', csvMoney(cash.variance)],
      ['Notes', closed ? report?.notes || '' : notes],
      [],
      ['Top products', 'Qty', 'Revenue (GHS)'],
      ...summary.topProducts.map((p) => [p.name, p.qty, csvMoney(p.revenue)]),
      [],
      ['Orders'],
      ['Order', 'Time', 'Channel', 'Customer', 'Method', 'Payment', 'Order status', 'Counted today', 'Total (GHS)', 'Items'],
      ...orders.map((o) => [
        o.order_number,
        formatTime(o.paid_at || o.created_at),
        o.source === 'pos' ? 'POS' : 'Website',
        o.customer,
        BUCKET_META[o.bucket].label,
        ORDER_STATE_META[o.state].label,
        o.status,
        o.state === 'collected' ? 'Yes' : 'No',
        csvMoney(o.total),
        o.items.map((i) => `${i.quantity} x ${i.product_name}${i.variant_name ? ` (${i.variant_name})` : ''}`).join('; '),
      ]),
      [],
      ['Expenses'],
      ['Staff', 'Category', 'Description', 'Status', 'Amount (GHS)'],
      ...expenses.items.map((x) => [x.staff_name || '', categoryOf(x.category), x.description, x.status, csvMoney(x.amount)]),
    ];
    downloadCsv(`house-of-elle-end-of-day-${date}.csv`, rows);
  };

  const shiftDay = (days: number) => {
    const next = addDays(date, days);
    if (next > maxDate) return;
    setDate(next);
  };

  return (
    <div className="eod-page mx-auto max-w-7xl space-y-6">
      <style>{`
        @media print {
          aside, header, .no-print { display: none !important; }
          body, .min-h-screen { background: #fff !important; }
          main { padding: 0 !important; }
          [class*="lg:ml-64"] { margin-left: 0 !important; }
          .eod-page section { break-inside: avoid; box-shadow: none !important; }
          @page { margin: 14mm; }
        }
      `}</style>

      {/* Print heading */}
      <div className="hidden print:block">
        <p className="text-sm text-gray-600">House of Elle</p>
        <p className="text-2xl font-bold text-gray-900">End of day · {formatDay(date, 'weekday')}</p>
        <p className="mt-1 text-sm text-gray-600">
          {closed ? `Closed ${formatDateTime(report?.closed_at)} by ${report?.closed_by_name || 'staff'}` : `Not closed · printed ${formatDateTime(new Date().toISOString())}`}
        </p>
      </div>

      {/* Header and day picker */}
      <div className="no-print flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-blue-600">Sell</p>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">End of day</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600 sm:text-base">
            Check what came in from the website and the POS, count the cash drawer, then close the day. Accra time.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-lg border border-gray-300 bg-white shadow-sm">
            <button type="button" onClick={() => shiftDay(-1)} className="flex h-10 w-10 items-center justify-center rounded-l-lg text-gray-600 hover:bg-gray-50" aria-label="Previous day">
              <i className="ri-arrow-left-s-line text-lg" aria-hidden="true" />
            </button>
            <label htmlFor={`${uid}-date`} className="sr-only">Day</label>
            <input
              id={`${uid}-date`}
              type="date"
              value={date}
              max={maxDate}
              onChange={(e) => e.target.value && e.target.value <= maxDate && setDate(e.target.value)}
              className="h-10 border-x border-gray-300 px-2 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={() => shiftDay(1)}
              disabled={date >= maxDate}
              className="flex h-10 w-10 items-center justify-center rounded-r-lg text-gray-600 hover:bg-gray-50 disabled:opacity-30"
              aria-label="Next day"
            >
              <i className="ri-arrow-right-s-line text-lg" aria-hidden="true" />
            </button>
          </div>
          {!isToday && (
            <button type="button" onClick={() => setDate(maxDate)} className={btnSecondary}>
              Today
            </button>
          )}
          <button type="button" onClick={() => load(date)} className={btnSecondary} aria-label="Refresh figures">
            <i className={`ri-refresh-line ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button type="button" onClick={exportCsv} disabled={!summary} className={btnSecondary}>
            <i className="ri-download-2-line" aria-hidden="true" />
            CSV
          </button>
          <button type="button" onClick={() => window.print()} disabled={!summary} className={btnSecondary}>
            <i className="ri-printer-line" aria-hidden="true" />
            Print
          </button>
        </div>
      </div>

      <div className="no-print space-y-3">
        <Flash message={flash} onDone={() => setFlash('')} />
        {error && <ErrorBanner message={error} onRetry={() => load(date)} />}
      </div>

      {loading && !data ? (
        <>
          <SkeletonBlock className="h-14 w-full" />
          <SkeletonStats />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <SkeletonBlock className="h-72 lg:col-span-2" />
            <SkeletonBlock className="h-72" />
          </div>
        </>
      ) : !data || !summary || !expenses ? null : (
        <div className={`space-y-6 ${loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}`}>
          {/* Day status */}
          <DayStatus
            date={data.date}
            isToday={isToday}
            report={report}
            canReopen={data.canReopen}
            onReopen={() => setConfirmReopen(true)}
          />
          {liveChanged && (
            <div className="no-print flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <i className="ri-error-warning-line mt-0.5 text-lg text-amber-600" aria-hidden="true" />
              <p>
                Figures changed after this day was closed. Paid orders now come to{' '}
                <span className="font-semibold tabular-nums">{cedis(data.live.summary.collected)}</span> ({data.live.summary.ordersCount} orders), against{' '}
                <span className="font-semibold tabular-nums">{cedis(summary.collected)}</span> when it was closed.
                {data.canReopen ? ' Reopen the day and close it again to save the new figures.' : ' Ask the owner to reopen the day if the close needs updating.'}
              </p>
            </div>
          )}

          {/* Headline numbers */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat emphasis label="Collected" icon="ri-safe-2-line" value={cedis(summary.collected)} hint={`${summary.ordersCount} paid ${summary.ordersCount === 1 ? 'order' : 'orders'}`} />
            <Stat label="Website" icon="ri-global-line" tone="brand" value={cedis(summary.web.collected)} hint={`${summary.web.orders} ${summary.web.orders === 1 ? 'order' : 'orders'} · Mobile Money online`} />
            <Stat label="POS" icon="ri-store-3-line" tone="brand" value={cedis(summary.pos.collected)} hint={`${summary.pos.orders} in-store ${summary.pos.orders === 1 ? 'sale' : 'sales'}`} />
            <Stat
              label="Items sold"
              icon="ri-shopping-bag-3-line"
              value={summary.itemsSold.toLocaleString('en-GH')}
              hint={summary.ordersCount ? `Average order ${cedis(summary.averageOrder)}` : 'No paid orders yet'}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Payment methods */}
            <Panel className="lg:col-span-2" title="Payment methods" subtitle="Money from paid orders only, by where it was taken">
              <div className="-mx-4 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
                <table className="w-full min-w-[420px] text-sm">
                  <thead>
                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      <th className="pb-2 pr-3">Method</th>
                      <th className="pb-2 pr-3 text-right">Website</th>
                      <th className="pb-2 pr-3 text-right">POS</th>
                      <th className="pb-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {PAYMENT_BUCKETS.map((b) => {
                      const total = summary.byMethod[b];
                      const share = summary.collected > 0 ? total / summary.collected : 0;
                      return (
                        <tr key={b}>
                          <td className="py-3 pr-3">
                            <div className="flex items-center gap-2 font-medium text-gray-900">
                              <i className={`${BUCKET_META[b].icon} text-blue-700`} aria-hidden="true" />
                              {BUCKET_META[b].label}
                            </div>
                            <div className="mt-1.5 h-1.5 w-full max-w-[10rem] overflow-hidden rounded-full bg-gray-100">
                              <div className="h-full rounded-full bg-blue-700" style={{ width: `${share * 100}%` }} />
                            </div>
                          </td>
                          <td className={`whitespace-nowrap py-3 pr-3 text-right tabular-nums ${summary.web.byMethod[b] ? 'text-gray-900' : 'text-gray-300'}`}>{cedis(summary.web.byMethod[b])}</td>
                          <td className={`whitespace-nowrap py-3 pr-3 text-right tabular-nums ${summary.pos.byMethod[b] ? 'text-gray-900' : 'text-gray-300'}`}>{cedis(summary.pos.byMethod[b])}</td>
                          <td className="whitespace-nowrap py-3 text-right font-semibold tabular-nums text-gray-900">
                            {cedis(total)}
                            <p className="text-xs font-normal text-gray-400">{Math.round(share * 100)}%</p>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 font-bold text-gray-900">
                      <td className="pt-3 pr-3">Total</td>
                      <td className="whitespace-nowrap pt-3 pr-3 text-right tabular-nums">{cedis(summary.web.collected)}</td>
                      <td className="whitespace-nowrap pt-3 pr-3 text-right tabular-nums">{cedis(summary.pos.collected)}</td>
                      <td className="whitespace-nowrap pt-3 text-right tabular-nums">{cedis(summary.collected)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <MiniFact label="Discounts given" value={cedis(summary.discounts)} />
                <MiniFact label="Delivery fees" value={cedis(summary.deliveryFees)} />
                <MiniFact
                  label="Not paid yet"
                  value={cedis(summary.awaiting.total)}
                  note={`${summary.awaiting.count} ${summary.awaiting.count === 1 ? 'order' : 'orders'}, not counted`}
                  tone={summary.awaiting.count ? 'warn' : undefined}
                />
                <MiniFact
                  label="Cancelled or failed"
                  value={String(summary.voided.count + summary.failed.count)}
                  note={summary.voided.count + summary.failed.count ? cedis(summary.voided.total + summary.failed.total) : 'None'}
                />
              </dl>
              {summary.paidFromEarlierDays.count > 0 && (
                <p className="mt-3 text-xs text-gray-500">
                  Includes {summary.paidFromEarlierDays.count} {summary.paidFromEarlierDays.count === 1 ? 'order' : 'orders'} placed on an earlier day and paid today (
                  {cedis(summary.paidFromEarlierDays.total)}).
                </p>
              )}
            </Panel>

            {/* Cash drawer */}
            <Panel
              title="Cash drawer"
              subtitle={closed ? 'Saved with the close' : 'Count the drawer at closing time'}
              className={closed ? '' : 'ring-1 ring-blue-200'}
            >
              <div className="space-y-4">
                {closed ? (
                  <dl className="space-y-2.5 text-sm">
                    <DrawerRow label="Opening cash" value={cedis(cash.opening)} />
                  </dl>
                ) : (
                  <div>
                    <label htmlFor={`${uid}-opening`} className={labelBase}>Opening cash</label>
                    <MoneyInput
                      id={`${uid}-opening`}
                      value={openingText}
                      onChange={(v) => {
                        setOpeningText(v);
                        setFieldErrors((f) => ({ ...f, openingCash: undefined }));
                      }}
                      invalid={Boolean(fieldErrors.openingCash)}
                      describedBy={`${uid}-opening-hint`}
                    />
                    <FieldError id={`${uid}-opening-err`} message={fieldErrors.openingCash} />
                    <p id={`${uid}-opening-hint`} className="mt-1.5 text-xs text-gray-500">
                      The float in the drawer when the day started.
                      {data.previous && (
                        <>
                          {' '}
                          {formatDay(data.previous.report_date, 'short')} closed with{' '}
                          <button
                            type="button"
                            onClick={() => setOpeningText(String(data.previous!.counted_cash))}
                            className="font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-800"
                          >
                            {cedis(data.previous.counted_cash)}
                          </button>
                          .
                        </>
                      )}
                    </p>
                  </div>
                )}

                <dl className="space-y-2.5 border-t border-gray-100 pt-4 text-sm">
                  <DrawerRow label="POS cash sales" value={`+ ${cedis(summary.cashSales)}`} />
                  {expenses.approvedTotal > 0 && (
                    <div>
                      {closed ? (
                        <DrawerRow label="Expenses paid from drawer" value={cash.expensesFromDrawer ? `− ${cedis(expenses.approvedTotal)}` : 'None'} />
                      ) : (
                        <label className="flex cursor-pointer items-start justify-between gap-3">
                          <span className="flex items-start gap-2 text-gray-600">
                            <input
                              type="checkbox"
                              checked={fromDrawer}
                              onChange={(e) => setFromDrawer(e.target.checked)}
                              className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-blue-700"
                            />
                            Approved expenses were paid from the drawer
                          </span>
                          <span className={`shrink-0 whitespace-nowrap font-medium tabular-nums ${fromDrawer ? 'text-gray-900' : 'text-gray-300'}`}>− {cedis(expenses.approvedTotal)}</span>
                        </label>
                      )}
                    </div>
                  )}
                  <div className="flex items-center justify-between border-t border-dashed border-gray-200 pt-2.5">
                    <dt className="font-semibold text-gray-900">Expected in drawer</dt>
                    <dd className="whitespace-nowrap font-bold text-gray-900 tabular-nums">{cedis(cash.expected)}</dd>
                  </div>
                </dl>

                {closed ? (
                  <dl className="space-y-2.5 text-sm">
                    <DrawerRow label="Counted" value={cash.counted == null ? '—' : cedis(cash.counted)} strong />
                  </dl>
                ) : (
                  <div>
                    <label htmlFor={`${uid}-counted`} className={labelBase}>Cash counted</label>
                    <MoneyInput
                      id={`${uid}-counted`}
                      value={countedText}
                      onChange={(v) => {
                        setCountedText(v);
                        setFieldErrors((f) => ({ ...f, countedCash: undefined }));
                      }}
                      placeholder="Count the drawer"
                      invalid={Boolean(fieldErrors.countedCash)}
                      describedBy={fieldErrors.countedCash ? `${uid}-counted-err` : undefined}
                    />
                    <FieldError id={`${uid}-counted-err`} message={fieldErrors.countedCash} />
                  </div>
                )}

                <VarianceCard variance={cash.variance} />

                {closed ? (
                  report?.notes ? (
                    <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
                      <p className="mb-1 text-xs font-semibold text-gray-500">Notes</p>
                      <p className="whitespace-pre-wrap break-words">{report.notes}</p>
                    </div>
                  ) : null
                ) : (
                  <div>
                    <label htmlFor={`${uid}-notes`} className={labelBase}>
                      Notes <span className="font-normal text-gray-400">(optional)</span>
                    </label>
                    <textarea
                      id={`${uid}-notes`}
                      rows={3}
                      maxLength={1000}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder={cash.variance != null && cash.variance !== 0 ? 'Explain the difference, e.g. change given from personal cash' : 'Anything the owner should know about today'}
                      className={`${inputBase} resize-none`}
                    />
                  </div>
                )}

                {!closed && (
                  <button
                    type="button"
                    onClick={() => validate() && setConfirmClose(true)}
                    className={`${btnPrimary} no-print w-full py-3`}
                  >
                    <i className="ri-lock-line" aria-hidden="true" />
                    {report ? 'Close the day again' : 'Close the day'}
                  </button>
                )}
                {!closed && isToday && (
                  <p className="no-print text-center text-xs text-gray-500">Close after the last sale. Staff cannot change a day once it is closed.</p>
                )}
              </div>
            </Panel>
          </div>

          {/* Through the day + top products */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            <Panel className="lg:col-span-3" title="Through the day" subtitle="Paid orders by hour">
              {summary.collected > 0 ? (
                <HourlyChart summary={summary} />
              ) : (
                <EmptyState compact icon="ri-time-line" title="No paid orders yet" body={isToday ? 'Sales show here as they are paid.' : 'Nothing was paid on this day.'} />
              )}
            </Panel>
            <Panel className="lg:col-span-2" title="Top products" subtitle="By money taken" flush>
              {summary.topProducts.length === 0 ? (
                <EmptyState compact icon="ri-shopping-bag-3-line" title="No items sold" />
              ) : (
                <ol className="divide-y divide-gray-100">
                  {summary.topProducts.map((p, i) => (
                    <li key={p.key} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums ${i < 3 ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'}`}>{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900" title={p.name}>{p.name}</p>
                        <p className="text-xs text-gray-500 tabular-nums">{p.qty} sold</p>
                      </div>
                      <p className="shrink-0 text-sm font-semibold text-gray-900 tabular-nums">{cedis(p.revenue)}</p>
                    </li>
                  ))}
                </ol>
              )}
            </Panel>
          </div>

          {/* Expenses + recent closes */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            <Panel
              className="lg:col-span-3"
              title="Staff expenses for the day"
              subtitle="Dated this day in Expenses"
              flush
              actions={
                <Link href="/admin/expenses" className="no-print text-sm font-semibold text-blue-700 hover:text-blue-800">
                  Open expenses <i className="ri-arrow-right-line" aria-hidden="true" />
                </Link>
              }
            >
              {expenses.items.length === 0 ? (
                <EmptyState compact icon="ri-bill-line" title="No expenses for this day" />
              ) : (
                <ul className="divide-y divide-gray-100">
                  {expenses.items.map((x) => (
                    <li key={x.id} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                      <div className="min-w-0 flex-1">
                        <p className="break-words text-sm font-medium text-gray-900">{x.description}</p>
                        <p className="text-xs text-gray-500">
                          {categoryOf(x.category)}
                          {x.staff_name && ` · ${x.staff_name}`}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold text-gray-900 tabular-nums">{cedis(x.amount)}</p>
                        <span className={`text-xs font-semibold ${x.status === 'approved' ? 'text-green-700' : 'text-amber-700'}`}>
                          {x.status === 'approved' ? 'Approved' : 'Waiting for review'}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <dl className="grid grid-cols-3 gap-px border-t border-gray-100 bg-gray-100 text-sm">
                <div className="bg-gray-50 px-4 py-3 sm:px-5">
                  <dt className="text-xs text-gray-500">Approved</dt>
                  <dd className="font-semibold text-gray-900 tabular-nums">{cedis(expenses.approvedTotal)}</dd>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-5">
                  <dt className="text-xs text-gray-500">Waiting</dt>
                  <dd className="font-semibold text-amber-700 tabular-nums">{cedis(expenses.pendingTotal)}</dd>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-5">
                  <dt className="text-xs text-gray-500">Takings after expenses</dt>
                  <dd className="font-bold text-gray-900 tabular-nums">{cedis(summary.collected - expenses.approvedTotal)}</dd>
                </div>
              </dl>
            </Panel>

            <Panel className="no-print lg:col-span-2" title="Recent closes" flush>
              {data.history.length === 0 ? (
                <EmptyState compact icon="ri-calendar-check-line" title="No days closed yet" body="Closed days show here with their cash difference." />
              ) : (
                <ul className="divide-y divide-gray-100">
                  {data.history.map((h) => {
                    const active = h.report_date === date;
                    return (
                      <li key={h.report_date}>
                        <button
                          type="button"
                          onClick={() => setDate(h.report_date)}
                          aria-current={active ? 'date' : undefined}
                          className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors sm:px-5 ${active ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900">{formatDay(h.report_date)}</p>
                            <p className="text-xs text-gray-500">
                              {h.closed_at ? `Closed by ${h.closed_by_name || 'staff'}` : 'Reopened, not closed'}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-semibold text-gray-900 tabular-nums">{cedis(h.collected)}</p>
                            <VarianceTag variance={h.variance} />
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          </div>

          {/* Orders */}
          <Panel
            flush
            title="Orders"
            subtitle="Placed or paid on this day"
            actions={
              <div className="no-print -mx-1 flex gap-1 overflow-x-auto px-1" role="group" aria-label="Show orders">
                {(
                  [
                    ['all', 'All', orders.length],
                    ['collected', 'Paid', orders.filter((o) => o.state === 'collected').length],
                    ['unpaid', 'Not paid', orders.filter((o) => o.state === 'awaiting' || o.state === 'failed').length],
                    ['other', 'Other', orders.filter((o) => o.state === 'void' || o.state === 'paid_other_day').length],
                  ] as [OrderFilter, string, number][]
                ).map(([key, label, count]) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={orderFilter === key}
                    onClick={() => setOrderFilter(key)}
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                      orderFilter === key ? 'bg-blue-800 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {label} <span className="tabular-nums opacity-70">{count}</span>
                  </button>
                ))}
              </div>
            }
          >
            {visibleOrders.length === 0 ? (
              <EmptyState compact icon="ri-shopping-bag-line" title={orders.length ? 'No orders in this view' : 'No orders on this day'} />
            ) : (
              <>
                <div className="hidden overflow-x-auto md:block print:block">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-4 py-3">Time</th>
                        <th className="px-4 py-3">Order</th>
                        <th className="px-4 py-3">Customer</th>
                        <th className="px-4 py-3">Channel</th>
                        <th className="px-4 py-3">Method</th>
                        <th className="px-4 py-3">Payment</th>
                        <th className="px-4 py-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {visibleOrders.map((o) => (
                        <tr key={o.id} className={o.state === 'collected' ? '' : 'text-gray-500'}>
                          <td className="whitespace-nowrap px-4 py-3 tabular-nums">
                            {formatTime(o.state === 'collected' ? o.paid_at || o.created_at : o.created_at)}
                            {o.created_earlier && <p className="text-xs text-gray-400">Placed {formatDay(o.created_at.slice(0, 10), 'short')}</p>}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <Link href={`/admin/orders/${o.id}`} className="font-medium text-blue-700 hover:text-blue-800">{o.order_number}</Link>
                            <p className="text-xs text-gray-400">{itemCount(o)}</p>
                          </td>
                          <td className="max-w-[14rem] truncate px-4 py-3" title={o.customer}>{o.customer}</td>
                          <td className="px-4 py-3"><SourceTag source={o.source} /></td>
                          <td className="whitespace-nowrap px-4 py-3">{BUCKET_META[o.bucket].label}</td>
                          <td className="px-4 py-3">
                            <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${ORDER_STATE_META[o.state].badge}`}>{ORDER_STATE_META[o.state].label}</span>
                          </td>
                          <td className={`whitespace-nowrap px-4 py-3 text-right tabular-nums ${o.state === 'collected' ? 'font-semibold text-gray-900' : 'line-through decoration-gray-300'}`}>
                            {cedis(o.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <ul className="divide-y divide-gray-100 md:hidden print:hidden">
                  {visibleOrders.map((o) => (
                    <li key={o.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Link href={`/admin/orders/${o.id}`} className="text-sm font-medium text-blue-700">{o.order_number}</Link>
                          <p className="truncate text-xs text-gray-500">
                            {formatTime(o.state === 'collected' ? o.paid_at || o.created_at : o.created_at)} · {o.customer}
                          </p>
                        </div>
                        <p className={`shrink-0 text-sm tabular-nums ${o.state === 'collected' ? 'font-semibold text-gray-900' : 'text-gray-400 line-through'}`}>{cedis(o.total)}</p>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <SourceTag source={o.source} />
                        <span className="text-xs text-gray-600">{BUCKET_META[o.bucket].label}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ORDER_STATE_META[o.state].badge}`}>{ORDER_STATE_META[o.state].label}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Panel>
        </div>
      )}

      <ConfirmDialog
        open={confirmClose}
        tone="primary"
        title={`Close ${formatDay(date)}?`}
        body={
          <div className="space-y-2">
            <p>
              This saves today&apos;s figures as they are now: <span className="font-semibold text-gray-900 tabular-nums">{cedis(summary?.collected)}</span> collected,{' '}
              <span className="font-semibold text-gray-900 tabular-nums">{cedis(cash.counted)}</span> counted in the drawer.
            </p>
            <p className={cash.variance === 0 ? 'text-green-700' : 'font-semibold text-red-700'}>
              {cash.variance == null ? '' : cash.variance === 0 ? 'The drawer balances.' : cash.variance > 0 ? `The drawer is over by ${cedis(cash.variance)}.` : `The drawer is short by ${cedis(Math.abs(cash.variance))}.`}
            </p>
            <p>Only the owner can reopen a closed day.</p>
          </div>
        }
        confirmLabel="Close the day"
        busy={saving}
        onCancel={() => setConfirmClose(false)}
        onConfirm={closeDay}
      />
      <ConfirmDialog
        open={confirmReopen}
        tone="primary"
        title={`Reopen ${formatDay(date)}?`}
        body="The saved figures stay until the day is closed again. Staff with End of Day access can then update the count and close it."
        confirmLabel="Reopen day"
        busy={saving}
        onCancel={() => setConfirmReopen(false)}
        onConfirm={reopenDay}
      />
    </div>
  );
}

function DayStatus({
  date,
  isToday,
  report,
  canReopen,
  onReopen,
}: {
  date: string;
  isToday: boolean;
  report: SavedReport | null;
  canReopen: boolean;
  onReopen: () => void;
}) {
  if (report?.closed_at) {
    const reopenedCount = report.snapshot?.reopened?.length ?? 0;
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-600 text-white">
            <i className="ri-lock-line" aria-hidden="true" />
          </span>
          <div className="text-sm">
            <p className="font-semibold text-green-900">{formatDay(date, 'weekday')} is closed</p>
            <p className="text-green-800">
              Closed by {report.closed_by_name || 'staff'} on {formatDateTime(report.closed_at)}. These are the figures saved at closing.
              {reopenedCount > 0 && ` Reopened ${reopenedCount} ${reopenedCount === 1 ? 'time' : 'times'} before.`}
            </p>
          </div>
        </div>
        {canReopen && (
          <button type="button" onClick={onReopen} className={`${btnSecondary} no-print shrink-0`}>
            <i className="ri-lock-unlock-line" aria-hidden="true" />
            Reopen day
          </button>
        )}
      </div>
    );
  }
  if (report) {
    const last = report.snapshot?.reopened?.slice(-1)[0];
    return (
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
        <i className="ri-lock-unlock-line mt-0.5 text-lg text-amber-600" aria-hidden="true" />
        <p className="text-amber-900">
          <span className="font-semibold">Reopened{last?.by ? ` by ${last.by}` : ''}.</span> The figures below are live. Check the count and close the day again.
        </p>
      </div>
    );
  }
  return (
    <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${isToday ? 'border-blue-200 bg-blue-50 text-blue-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
      <i className={`${isToday ? 'ri-pulse-line text-blue-600' : 'ri-error-warning-line text-amber-600'} mt-0.5 text-lg`} aria-hidden="true" />
      <p>
        <span className="font-semibold">{isToday ? 'Today is still open.' : `${formatDay(date, 'weekday')} was never closed.`}</span>{' '}
        {isToday ? 'Figures update as orders are paid. Refresh before you count the drawer.' : 'These are the live figures for that day. Count and close it to keep a record.'}
      </p>
    </div>
  );
}

function itemCount(o: DayOrder): string {
  const n = o.items.reduce((s, i) => s + i.quantity, 0);
  return `${n} ${n === 1 ? 'item' : 'items'}`;
}

function MiniFact({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: 'warn' }) {
  return (
    <div className="rounded-lg bg-gray-50 p-3">
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className={`mt-0.5 font-semibold tabular-nums ${tone === 'warn' ? 'text-amber-700' : 'text-gray-900'}`}>{value}</dd>
      {note && <dd className="mt-0.5 text-xs text-gray-500">{note}</dd>}
    </div>
  );
}

function DrawerRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className={strong ? 'font-semibold text-gray-900' : 'text-gray-600'}>{label}</dt>
      <dd className={`shrink-0 whitespace-nowrap tabular-nums ${strong ? 'font-bold text-gray-900' : 'font-medium text-gray-900'}`}>{value}</dd>
    </div>
  );
}

function VarianceCard({ variance }: { variance: number | null }) {
  if (variance == null) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 px-4 py-3 text-center text-sm text-gray-500">
        Enter the counted cash to see the difference.
      </div>
    );
  }
  const balanced = Math.abs(variance) < 0.005;
  const over = variance > 0;
  return (
    <div
      role="status"
      className={`rounded-lg px-4 py-3 ${balanced ? 'bg-green-50 text-green-800' : over ? 'bg-amber-50 text-amber-900' : 'bg-red-50 text-red-800'}`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide opacity-80">Difference</p>
      <p className="mt-0.5 flex items-baseline justify-between gap-3">
        <span className="font-semibold">{balanced ? 'Drawer balances' : over ? 'Over' : 'Short'}</span>
        <span className="whitespace-nowrap text-xl font-bold tabular-nums">
          {balanced ? cedis(0) : `${over ? '+' : '−'} ${cedis(Math.abs(variance))}`}
        </span>
      </p>
    </div>
  );
}

function VarianceTag({ variance }: { variance: number | null }) {
  if (variance == null) return <span className="text-xs text-gray-400">No count</span>;
  if (Math.abs(variance) < 0.005) return <span className="text-xs font-semibold text-green-700">Balanced</span>;
  return (
    <span className={`text-xs font-semibold tabular-nums ${variance > 0 ? 'text-amber-700' : 'text-red-700'}`}>
      {variance > 0 ? 'Over' : 'Short'} {cedis(Math.abs(variance))}
    </span>
  );
}

function SourceTag({ source }: { source: 'web' | 'pos' }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-xs font-semibold ${source === 'pos' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700'}`}>
      <i className={source === 'pos' ? 'ri-store-3-line' : 'ri-global-line'} aria-hidden="true" />
      {source === 'pos' ? 'POS' : 'Website'}
    </span>
  );
}

function HourlyChart({ summary }: { summary: DaySummary }) {
  const active = summary.byHour.filter((h) => h.web + h.pos > 0).map((h) => h.hour);
  const first = Math.max(0, Math.min(8, ...active));
  const last = Math.min(23, Math.max(20, ...active));
  const points = summary.byHour
    .filter((h) => h.hour >= first && h.hour <= last)
    .map((h) => ({ ...h, label: `${String(h.hour).padStart(2, '0')}:00` }));
  return (
    <div className="h-60 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={points} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} interval="preserveStartEnd" minTickGap={10} />
          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} width={56} tickFormatter={(v) => `₵${Number(v) >= 1000 ? `${(Number(v) / 1000).toFixed(1)}k` : v}`} />
          <Tooltip
            cursor={{ fill: '#F5EDE4' }}
            contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
            formatter={(v, name) => [cedis(Number(v)), name === 'pos' ? 'POS' : 'Website']}
          />
          <Legend formatter={(v) => (v === 'pos' ? 'POS' : 'Website')} iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="web" stackId="a" fill="#C89B3C" maxBarSize={28} isAnimationActive={false} />
          <Bar dataKey="pos" stackId="a" fill="#6B4F3A" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
