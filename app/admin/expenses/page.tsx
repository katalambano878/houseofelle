'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { adminFetch, cedis } from '@/lib/admin-fetch';
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_META,
  EXPENSE_STATUS_META,
  MAX_EXPENSE_AMOUNT,
  categoryOf,
  type ExpenseCategory,
  type ExpenseStatus,
} from '@/lib/expenses';
import {
  PERIODS,
  addDays,
  daysBetween,
  formatDateTime,
  formatDay,
  formatMonth,
  periodRange,
  todayInAccra,
  type PeriodKey,
} from '@/lib/report-dates';
import {
  ConfirmDialog,
  EmptyState,
  ErrorBanner,
  FieldError,
  Flash,
  MoneyInput,
  PageHeader,
  Panel,
  SkeletonRows,
  SkeletonStats,
  Stat,
  btnPrimary,
  btnSecondary,
  csvMoney,
  downloadCsv,
  inputBase,
  inputError,
  labelBase,
  parseMoney,
} from '@/components/admin/reports/ReportKit';

type Expense = {
  id: string;
  user_id: string | null;
  staff_name: string | null;
  staff_email: string | null;
  amount: number;
  description: string;
  category: string | null;
  spent_on: string;
  status: ExpenseStatus;
  reviewed_by: string | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  created_at: string;
};

type Totals = {
  byStatus: Record<ExpenseStatus, { amount: number; count: number }>;
  byCategory: Record<string, { approved: number; pending: number; rejected: number; count: number }>;
};

type ListResponse = {
  expenses: Expense[];
  truncated: boolean;
  totals: Totals;
  series: { day: string; amount: number }[];
  staff: { user_id: string; name: string; count: number }[];
  canReview: boolean;
  me: { id: string; name: string };
  today: string;
};

type StatusTab = 'all' | ExpenseStatus;

const STATUS_TABS: { key: StatusTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Waiting' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

export default function ExpensesPage() {
  const [period, setPeriod] = useState<PeriodKey>('month');
  const [customFrom, setCustomFrom] = useState(() => addDays(todayInAccra(), -6));
  const [customTo, setCustomTo] = useState(() => todayInAccra());
  const [staffFilter, setStaffFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'' | ExpenseCategory>('');
  const [statusTab, setStatusTab] = useState<StatusTab>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState(false);
  const pickedDefaultTab = useRef(false);
  const requestSeq = useRef(0);

  const range = useMemo(() => {
    if (period === 'custom') {
      const from = customFrom && customTo && customFrom > customTo ? customTo : customFrom;
      const to = customFrom && customTo && customFrom > customTo ? customFrom : customTo;
      return { from, to };
    }
    return periodRange(period);
  }, [period, customFrom, customTo]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    if (range.from) params.set('from', range.from);
    if (range.to) params.set('to', range.to);
    if (staffFilter) params.set('staff', staffFilter);
    if (categoryFilter) params.set('category', categoryFilter);
    if (debouncedSearch) params.set('q', debouncedSearch);
    try {
      const res = await adminFetch<ListResponse>(`/api/admin/expenses?${params.toString()}`);
      if (seq !== requestSeq.current) return;
      setData(res);
      setSelected(new Set());
      if (!pickedDefaultTab.current) {
        pickedDefaultTab.current = true;
        if (res.canReview && res.totals.byStatus.pending.count > 0) setStatusTab('pending');
      }
    } catch (err) {
      if (seq !== requestSeq.current) return;
      setError(err instanceof Error ? err.message : 'Could not load expenses.');
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [range.from, range.to, staffFilter, categoryFilter, debouncedSearch]);

  useEffect(() => {
    load();
  }, [load]);

  const canReview = data?.canReview ?? false;
  const all = data?.expenses ?? [];
  const visible = useMemo(() => (statusTab === 'all' ? all : all.filter((e) => e.status === statusTab)), [all, statusTab]);
  const byStatus = data?.totals.byStatus;
  const spentTotal = (byStatus?.approved.amount ?? 0) + (byStatus?.pending.amount ?? 0);
  const filtersActive = Boolean(staffFilter || categoryFilter || debouncedSearch);

  const chart = useMemo(() => buildSeries(data?.series ?? [], range.from, range.to, data?.today ?? todayInAccra()), [data, range.from, range.to]);

  const categoryRows = useMemo(() => {
    const totals = data?.totals.byCategory ?? {};
    const rows = EXPENSE_CATEGORIES.map((cat) => {
      const t = totals[cat] ?? { approved: 0, pending: 0, rejected: 0, count: 0 };
      return { cat, approved: t.approved, pending: t.pending, total: t.approved + t.pending, count: t.count };
    }).filter((r) => r.count > 0);
    const max = Math.max(1, ...rows.map((r) => r.total));
    return rows.sort((a, b) => b.total - a.total).map((r) => ({ ...r, share: spentTotal > 0 ? r.total / spentTotal : 0, width: r.total / max }));
  }, [data, spentTotal]);

  const periodLabel = useMemo(() => {
    if (!range.from && !range.to) return 'All time';
    if (range.from === range.to) return formatDay(range.from);
    return `${formatDay(range.from)} – ${formatDay(range.to)}`;
  }, [range]);

  const review = async (ids: string[], status: ExpenseStatus) => {
    if (!ids.length) return;
    setBusyIds((prev) => new Set([...prev, ...ids]));
    setError('');
    try {
      const res = await adminFetch<{ message: string }>('/api/admin/expenses', {
        method: 'PATCH',
        body: JSON.stringify({ ids, status }),
      });
      setFlash(res.message);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the expense.');
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    }
  };

  const remove = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      const res = await adminFetch<{ message: string }>('/api/admin/expenses', {
        method: 'DELETE',
        body: JSON.stringify({ id: confirmDelete.id }),
      });
      setFlash(res.message);
      setConfirmDelete(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the expense.');
      setConfirmDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  const exportCsv = () => {
    const rows: unknown[][] = [
      ['Date spent', 'Staff', 'Staff email', 'Category', 'Description', 'Amount (GHS)', 'Status', 'Reviewed by', 'Reviewed at', 'Logged at'],
      ...visible.map((e) => [
        e.spent_on,
        e.staff_name || '',
        e.staff_email || '',
        categoryOf(e.category),
        e.description,
        csvMoney(e.amount),
        EXPENSE_STATUS_META[e.status]?.label ?? e.status,
        e.reviewed_by_name || '',
        e.reviewed_at ? formatDateTime(e.reviewed_at) : '',
        formatDateTime(e.created_at),
      ]),
      [],
      ['', '', '', '', 'Total shown', csvMoney(visible.reduce((s, e) => s + e.amount, 0))],
    ];
    const stamp = range.from ? `${range.from}_to_${range.to}` : 'all-time';
    downloadCsv(`house-of-elle-expenses-${stamp}.csv`, rows);
  };

  const pendingVisible = visible.filter((e) => e.status === 'pending');
  const allPendingSelected = pendingVisible.length > 0 && pendingVisible.every((e) => selected.has(e.id));
  const toggleAllPending = () => {
    setSelected(allPendingSelected ? new Set() : new Set(pendingVisible.map((e) => e.id)));
  };
  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const selectedIds = [...selected].filter((id) => visible.some((e) => e.id === id && e.status === 'pending'));

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        eyebrow="Reports"
        title="Expenses"
        description={
          canReview
            ? 'Money the team spent for the store. Check each entry, then approve or reject it.'
            : 'Log money you spent for the store. The owner reviews every entry.'
        }
        actions={
          <>
            <button type="button" onClick={exportCsv} disabled={!visible.length} className={btnSecondary}>
              <i className="ri-download-2-line" aria-hidden="true" />
              Export CSV
            </button>
            <button type="button" onClick={() => setFormOpen(true)} className={btnPrimary}>
              <i className="ri-add-line" aria-hidden="true" />
              Log an expense
            </button>
          </>
        }
      />

      <Flash message={flash} onDone={() => setFlash('')} />
      {error && <ErrorBanner message={error} onRetry={load} />}

      {/* Period + filters */}
      <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="group" aria-label="Period">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPeriod(p.key)}
              aria-pressed={period === p.key}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                period === p.key ? 'bg-blue-800 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {period === 'custom' && (
            <>
              <div>
                <label htmlFor="exp-from" className={labelBase}>From</label>
                <input id="exp-from" type="date" value={customFrom} max={customTo || undefined} onChange={(e) => setCustomFrom(e.target.value)} className={inputBase} />
              </div>
              <div>
                <label htmlFor="exp-to" className={labelBase}>To</label>
                <input id="exp-to" type="date" value={customTo} min={customFrom || undefined} max={data?.today} onChange={(e) => setCustomTo(e.target.value)} className={inputBase} />
              </div>
            </>
          )}
          <div className={period === 'custom' ? '' : 'sm:col-span-2 lg:col-span-2'}>
            <label htmlFor="exp-search" className={labelBase}>Search</label>
            <div className="relative">
              <i className="ri-search-line pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
              <input
                id="exp-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={canReview ? 'Description or staff name' : 'Description'}
                className={`${inputBase} pl-9`}
              />
            </div>
          </div>
          <div>
            <label htmlFor="exp-category" className={labelBase}>Category</label>
            <select id="exp-category" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as ExpenseCategory | '')} className={inputBase}>
              <option value="">All categories</option>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          {canReview && (
            <div>
              <label htmlFor="exp-staff" className={labelBase}>Staff</label>
              <select id="exp-staff" value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)} className={inputBase}>
                <option value="">Everyone</option>
                {(data?.staff ?? []).map((s) => (
                  <option key={s.user_id} value={s.user_id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
          <span>
            Showing <span className="font-semibold text-gray-700">{periodLabel}</span>
            {filtersActive && ' with filters'}
          </span>
          {filtersActive && (
            <button
              type="button"
              onClick={() => {
                setStaffFilter('');
                setCategoryFilter('');
                setSearch('');
              }}
              className="font-semibold text-blue-700 hover:text-blue-800"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Totals */}
      {loading && !data ? (
        <SkeletonStats />
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat
            emphasis
            label="Spent"
            icon="ri-wallet-3-line"
            value={cedis(spentTotal)}
            hint={`Approved and waiting · ${entries((byStatus?.approved.count ?? 0) + (byStatus?.pending.count ?? 0))}`}
          />
          <Stat label="Approved" icon="ri-checkbox-circle-line" tone="good" value={cedis(byStatus?.approved.amount)} hint={entries(byStatus?.approved.count)} />
          <Stat
            label="Waiting for review"
            icon="ri-time-line"
            tone="warn"
            value={cedis(byStatus?.pending.amount)}
            hint={entries(byStatus?.pending.count)}
          />
          <Stat label="Rejected" icon="ri-close-circle-line" tone="bad" value={cedis(byStatus?.rejected.amount)} hint={`${entries(byStatus?.rejected.count)} · not counted`} />
        </div>
      )}

      {/* Chart + categories */}
      {data && spentTotal > 0 && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <Panel
            className="lg:col-span-3"
            title="Spending over time"
            subtitle={`${chart.byMonth ? 'By month' : 'By day'} · approved and waiting entries`}
          >
            <div className="h-56 w-full sm:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart.points} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} interval="preserveStartEnd" minTickGap={12} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} width={56} tickFormatter={(v) => `₵${compact(Number(v))}`} />
                  <Tooltip
                    cursor={{ fill: '#F5EDE4' }}
                    contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
                    formatter={(v) => [cedis(Number(v)), 'Spent']}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.title ?? ''}
                  />
                  <Bar dataKey="amount" fill="#6B4F3A" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel className="lg:col-span-2" title="By category" subtitle="Share of money spent in this period">
            <ul className="space-y-3.5">
              {categoryRows.map((r) => (
                <li key={r.cat}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-center gap-2 font-medium text-gray-800">
                      <i className={`${EXPENSE_CATEGORY_META[r.cat].icon} text-blue-700`} aria-hidden="true" />
                      {r.cat}
                      <span className="text-xs font-normal text-gray-400">{Math.round(r.share * 100)}%</span>
                    </span>
                    <span className="font-semibold text-gray-900 tabular-nums">{cedis(r.total)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                    <div className="flex h-full" style={{ width: `${Math.max(2, r.width * 100)}%` }}>
                      <div className="h-full bg-blue-700" style={{ width: `${r.total ? (r.approved / r.total) * 100 : 0}%` }} />
                      <div className="h-full bg-blue-300" style={{ width: `${r.total ? (r.pending / r.total) * 100 : 0}%` }} />
                    </div>
                  </div>
                  {r.pending > 0 && <p className="mt-1 text-xs text-gray-500 tabular-nums">{cedis(r.pending)} waiting for review</p>}
                </li>
              ))}
            </ul>
            <div className="mt-4 flex items-center gap-4 border-t border-gray-100 pt-3 text-xs text-gray-500">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blue-700" />Approved</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blue-300" />Waiting</span>
            </div>
          </Panel>
        </div>
      )}

      {/* List */}
      <Panel flush>
        <div className="flex flex-col gap-3 border-b border-gray-100 px-4 pt-3 sm:flex-row sm:items-end sm:justify-between sm:px-5">
          <div className="-mb-px flex gap-1 overflow-x-auto" role="tablist" aria-label="Status">
            {STATUS_TABS.map((t) => {
              const count = t.key === 'all'
                ? (byStatus ? byStatus.pending.count + byStatus.approved.count + byStatus.rejected.count : 0)
                : byStatus?.[t.key].count ?? 0;
              const active = statusTab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setStatusTab(t.key)}
                  className={`flex shrink-0 items-center gap-2 border-b-2 px-3 pb-3 pt-1 text-sm font-semibold transition-colors ${
                    active ? 'border-blue-700 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {t.label}
                  <span className={`rounded-full px-1.5 py-0.5 text-xs tabular-nums ${active ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'}`}>{count}</span>
                </button>
              );
            })}
          </div>
          {canReview && selectedIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pb-3">
              <span className="text-sm text-gray-600">{selectedIds.length} selected</span>
              <button type="button" onClick={() => review(selectedIds, 'approved')} className={`${btnPrimary} py-1.5`}>
                <i className="ri-check-line" aria-hidden="true" />
                Approve
              </button>
              <button type="button" onClick={() => review(selectedIds, 'rejected')} className={`${btnSecondary} py-1.5`}>
                <i className="ri-close-line" aria-hidden="true" />
                Reject
              </button>
            </div>
          )}
        </div>

        {loading && !data ? (
          <SkeletonRows />
        ) : visible.length === 0 ? (
          <EmptyState
            icon="ri-bill-line"
            title={all.length ? 'Nothing in this tab' : filtersActive ? 'No expenses match these filters' : 'No expenses in this period'}
            body={
              all.length
                ? 'Switch tabs to see the other entries.'
                : canReview
                  ? 'When staff log money they spent, it shows here for you to review.'
                  : 'Spent money on transport, packaging or supplies for the store? Log it so the owner can pay you back.'
            }
            action={
              !all.length && !filtersActive ? (
                <button type="button" onClick={() => setFormOpen(true)} className={btnPrimary}>
                  <i className="ri-add-line" aria-hidden="true" />
                  Log an expense
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <tr>
                    {canReview && (
                      <th className="w-10 px-4 py-3">
                        <input
                          type="checkbox"
                          checked={allPendingSelected}
                          onChange={toggleAllPending}
                          disabled={!pendingVisible.length}
                          aria-label="Select all entries waiting for review"
                          className="h-4 w-4 rounded border-gray-300 accent-blue-700"
                        />
                      </th>
                    )}
                    <th className="px-4 py-3">Date</th>
                    {canReview && <th className="px-4 py-3">Staff</th>}
                    <th className="px-4 py-3">What for</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {visible.map((e) => (
                    <tr key={e.id} className={`align-top hover:bg-gray-50/60 ${selected.has(e.id) ? 'bg-blue-50/50' : ''}`}>
                      {canReview && (
                        <td className="px-4 py-3.5">
                          {e.status === 'pending' && (
                            <input
                              type="checkbox"
                              checked={selected.has(e.id)}
                              onChange={() => toggleOne(e.id)}
                              aria-label={`Select ${e.description}`}
                              className="h-4 w-4 rounded border-gray-300 accent-blue-700"
                            />
                          )}
                        </td>
                      )}
                      <td className="whitespace-nowrap px-4 py-3.5 text-gray-700">{formatDay(e.spent_on)}</td>
                      {canReview && (
                        <td className="px-4 py-3.5">
                          <p className="font-medium text-gray-900">{e.staff_name || 'Staff'}</p>
                          {e.staff_email && <p className="text-xs text-gray-500">{e.staff_email}</p>}
                        </td>
                      )}
                      <td className="max-w-xs px-4 py-3.5">
                        <p className="break-words text-gray-900">{e.description}</p>
                        <CategoryTag category={e.category} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-right font-semibold text-gray-900 tabular-nums">{cedis(e.amount)}</td>
                      <td className="px-4 py-3.5">
                        <StatusBadge expense={e} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-right">
                        <RowActions
                          expense={e}
                          canReview={canReview}
                          mine={e.user_id === data?.me.id}
                          busy={busyIds.has(e.id)}
                          onReview={(s) => review([e.id], s)}
                          onDelete={() => setConfirmDelete(e)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Phone cards */}
            <ul className="divide-y divide-gray-100 md:hidden">
              {visible.map((e) => (
                <li key={e.id} className={`px-4 py-4 ${selected.has(e.id) ? 'bg-blue-50/50' : ''}`}>
                  <div className="flex items-start gap-3">
                    {canReview && e.status === 'pending' && (
                      <input
                        type="checkbox"
                        checked={selected.has(e.id)}
                        onChange={() => toggleOne(e.id)}
                        aria-label={`Select ${e.description}`}
                        className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300 accent-blue-700"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="min-w-0 break-words font-medium text-gray-900">{e.description}</p>
                        <p className="shrink-0 font-bold text-gray-900 tabular-nums">{cedis(e.amount)}</p>
                      </div>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {formatDay(e.spent_on)}
                        {canReview && ` · ${e.staff_name || 'Staff'}`}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <CategoryTag category={e.category} inline />
                        <StatusBadge expense={e} />
                      </div>
                      <div className="mt-3">
                        <RowActions
                          expense={e}
                          canReview={canReview}
                          mine={e.user_id === data?.me.id}
                          busy={busyIds.has(e.id)}
                          onReview={(s) => review([e.id], s)}
                          onDelete={() => setConfirmDelete(e)}
                          stretch
                        />
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 bg-gray-50 px-4 py-3 text-sm sm:px-5">
              <span className="text-gray-600">
                {visible.length} {visible.length === 1 ? 'entry' : 'entries'}
                {data?.truncated && ' (showing the latest 1,000; narrow the period to see older ones)'}
              </span>
              <span className="font-semibold text-gray-900 tabular-nums">Total {cedis(visible.reduce((s, e) => s + e.amount, 0))}</span>
            </div>
          </div>
        )}
      </Panel>

      {formOpen && (
        <ExpenseForm
          today={data?.today ?? todayInAccra()}
          onClose={() => setFormOpen(false)}
          onSaved={(message) => {
            setFormOpen(false);
            setFlash(message);
            load();
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title={canReview ? 'Delete this expense?' : 'Withdraw this expense?'}
        body={
          confirmDelete && (
            <>
              <span className="font-semibold text-gray-900">{confirmDelete.description}</span> · {cedis(confirmDelete.amount)} on{' '}
              {formatDay(confirmDelete.spent_on)}
              {canReview && confirmDelete.staff_name ? ` by ${confirmDelete.staff_name}` : ''}. It will be removed for good.
            </>
          )
        }
        confirmLabel={canReview ? 'Delete expense' : 'Withdraw expense'}
        busy={deleting}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={remove}
      />
    </div>
  );
}

function CategoryTag({ category, inline }: { category: string | null; inline?: boolean }) {
  const cat = categoryOf(category);
  return (
    <span className={`${inline ? '' : 'mt-1'} inline-flex items-center gap-1 rounded-md bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-800`}>
      <i className={EXPENSE_CATEGORY_META[cat].icon} aria-hidden="true" />
      {cat}
    </span>
  );
}

function StatusBadge({ expense }: { expense: Expense }) {
  const meta = EXPENSE_STATUS_META[expense.status] ?? EXPENSE_STATUS_META.pending;
  const reviewed = expense.status !== 'pending' && expense.reviewed_at;
  return (
    <div>
      <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${meta.badge}`}>
        <i className={meta.icon} aria-hidden="true" />
        {expense.status === 'pending' ? 'Waiting' : meta.label}
      </span>
      {reviewed && (
        <p className="mt-1 text-xs text-gray-500">
          {expense.reviewed_by_name ? `${expense.reviewed_by_name}, ` : ''}
          {formatDateTime(expense.reviewed_at)}
        </p>
      )}
    </div>
  );
}

function RowActions({
  expense,
  canReview,
  mine,
  busy,
  onReview,
  onDelete,
  stretch,
}: {
  expense: Expense;
  canReview: boolean;
  mine: boolean;
  busy: boolean;
  onReview: (status: ExpenseStatus) => void;
  onDelete: () => void;
  stretch?: boolean;
}) {
  const small = 'inline-flex items-center justify-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500';
  const wrap = `flex items-center gap-1.5 ${stretch ? 'flex-wrap' : 'justify-end'}`;

  if (!canReview) {
    if (!mine || expense.status !== 'pending') return null;
    return (
      <div className={wrap}>
        <button type="button" onClick={onDelete} className={`${small} text-gray-600 hover:bg-gray-100`}>
          <i className="ri-arrow-go-back-line" aria-hidden="true" />
          Withdraw
        </button>
      </div>
    );
  }

  return (
    <div className={wrap}>
      {busy && <i className="ri-loader-4-line animate-spin text-gray-400" aria-label="Saving" />}
      {expense.status !== 'approved' && (
        <button type="button" disabled={busy} onClick={() => onReview('approved')} className={`${small} bg-green-50 text-green-800 hover:bg-green-100`}>
          <i className="ri-check-line" aria-hidden="true" />
          Approve
        </button>
      )}
      {expense.status !== 'rejected' && (
        <button type="button" disabled={busy} onClick={() => onReview('rejected')} className={`${small} bg-red-50 text-red-700 hover:bg-red-100`}>
          <i className="ri-close-line" aria-hidden="true" />
          Reject
        </button>
      )}
      {expense.status !== 'pending' && (
        <button type="button" disabled={busy} onClick={() => onReview('pending')} className={`${small} text-gray-600 hover:bg-gray-100`} title="Move back to waiting for review">
          <i className="ri-arrow-go-back-line" aria-hidden="true" />
          <span className={stretch ? '' : 'sr-only'}>Undo review</span>
        </button>
      )}
      <button type="button" disabled={busy} onClick={onDelete} className={`${small} text-gray-500 hover:bg-red-50 hover:text-red-700`} aria-label={`Delete ${expense.description}`}>
        <i className="ri-delete-bin-6-line" aria-hidden="true" />
        {stretch && 'Delete'}
      </button>
    </div>
  );
}

type FormErrors = Partial<Record<'amount' | 'category' | 'description' | 'spentOn', string>>;

function ExpenseForm({ today, onClose, onSaved }: { today: string; onClose: () => void; onSaved: (message: string) => void }) {
  const uid = useId();
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseCategory | ''>('');
  const [description, setDescription] = useState('');
  const [spentOn, setSpentOn] = useState(today);
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Partial<Record<keyof FormErrors, boolean>>>({});
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState('');

  const validate = useCallback((): FormErrors => {
    const e: FormErrors = {};
    const n = parseMoney(amount);
    if (n == null || n <= 0) e.amount = 'Enter the amount you spent.';
    else if (n > MAX_EXPENSE_AMOUNT) e.amount = `That is more than ${cedis(MAX_EXPENSE_AMOUNT)}. Check the amount.`;
    if (!category) e.category = 'Pick a category.';
    if (description.trim().length < 3) e.description = 'Say what the money was used for.';
    if (!spentOn) e.spentOn = 'Pick the date you spent it.';
    else if (spentOn > today) e.spentOn = 'The date cannot be in the future.';
    else if (spentOn < addDays(today, -366)) e.spentOn = 'That date is more than a year ago.';
    return e;
  }, [amount, category, description, spentOn, today]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  const live = validate();
  const show = (k: keyof FormErrors) => (touched[k] ? live[k] : undefined) ?? errors[k];

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const e = validate();
    setTouched({ amount: true, category: true, description: true, spentOn: true });
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    setServerError('');
    try {
      const res = await adminFetch<{ message: string }>('/api/admin/expenses', {
        method: 'POST',
        body: JSON.stringify({ amount: parseMoney(amount), category, description: description.trim(), spentOn }),
      });
      onSaved(res.message);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Could not save the expense.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onMouseDown={() => !saving && onClose()}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${uid}-title`}
        onSubmit={submit}
        noValidate
        onMouseDown={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div>
            <h2 id={`${uid}-title`} className="text-lg font-bold text-gray-900">Log an expense</h2>
            <p className="mt-0.5 text-sm text-gray-500">Money you spent for the store. The owner will review it.</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100" aria-label="Close">
            <i className="ri-close-line text-xl" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {serverError && <ErrorBanner message={serverError} />}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={`${uid}-amount`} className={labelBase}>Amount</label>
              <MoneyInput
                id={`${uid}-amount`}
                value={amount}
                onChange={setAmount}
                autoFocus
                invalid={Boolean(show('amount'))}
                describedBy={show('amount') ? `${uid}-amount-err` : undefined}
                onBlur={() => setTouched((t) => ({ ...t, amount: true }))}
              />
              <FieldError id={`${uid}-amount-err`} message={show('amount')} />
            </div>
            <div>
              <label htmlFor={`${uid}-date`} className={labelBase}>Date spent</label>
              <input
                id={`${uid}-date`}
                type="date"
                value={spentOn}
                max={today}
                min={addDays(today, -366)}
                onChange={(e) => setSpentOn(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, spentOn: true }))}
                aria-invalid={Boolean(show('spentOn')) || undefined}
                aria-describedby={show('spentOn') ? `${uid}-date-err` : undefined}
                className={`${inputBase} ${show('spentOn') ? inputError : ''}`}
              />
              <FieldError id={`${uid}-date-err`} message={show('spentOn')} />
            </div>
          </div>

          <fieldset>
            <legend className={labelBase}>Category</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {EXPENSE_CATEGORIES.map((c) => {
                const active = category === c;
                return (
                  <label
                    key={c}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors focus-within:ring-2 focus-within:ring-blue-500 ${
                      active ? 'border-blue-700 bg-blue-50 text-blue-800' : 'border-gray-200 text-gray-700 hover:border-gray-300'
                    }`}
                    title={EXPENSE_CATEGORY_META[c].hint}
                  >
                    <input
                      type="radio"
                      name={`${uid}-category`}
                      value={c}
                      checked={active}
                      onChange={() => {
                        setCategory(c);
                        setTouched((t) => ({ ...t, category: true }));
                      }}
                      className="sr-only"
                    />
                    <i className={`${EXPENSE_CATEGORY_META[c].icon} text-base`} aria-hidden="true" />
                    {c}
                  </label>
                );
              })}
            </div>
            {category && <p className="mt-1.5 text-xs text-gray-500">{EXPENSE_CATEGORY_META[category].hint}</p>}
            <FieldError id={`${uid}-cat-err`} message={show('category')} />
          </fieldset>

          <div>
            <label htmlFor={`${uid}-desc`} className={labelBase}>What was it for?</label>
            <textarea
              id={`${uid}-desc`}
              rows={3}
              maxLength={400}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, description: true }))}
              placeholder="e.g. Rider to deliver 3 orders to East Legon"
              aria-invalid={Boolean(show('description')) || undefined}
              aria-describedby={`${uid}-desc-hint${show('description') ? ` ${uid}-desc-err` : ''}`}
              className={`${inputBase} resize-none ${show('description') ? inputError : ''}`}
            />
            <div className="mt-1 flex justify-between gap-2">
              <FieldError id={`${uid}-desc-err`} message={show('description')} />
              <span id={`${uid}-desc-hint`} className="ml-auto text-xs text-gray-400 tabular-nums">{description.length}/400</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-gray-100 px-5 py-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={saving} className={btnSecondary}>Cancel</button>
          <button type="submit" disabled={saving} className={btnPrimary}>
            {saving ? <i className="ri-loader-4-line animate-spin" aria-hidden="true" /> : <i className="ri-check-line" aria-hidden="true" />}
            {saving ? 'Saving…' : 'Save expense'}
          </button>
        </div>
      </form>
    </div>
  );
}

function entries(n: number | undefined): string {
  const c = n ?? 0;
  return `${c} ${c === 1 ? 'entry' : 'entries'}`;
}

function compact(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return String(Math.round(n));
}

/** Fills gaps so the chart shows every day (or month) in the period. */
function buildSeries(series: { day: string; amount: number }[], from: string, to: string, today: string) {
  const start = from || series[0]?.day || today;
  const end = to || today;
  const span = daysBetween(start, end);
  const byMonth = span > 62;
  const map = new Map<string, number>();
  for (const s of series) {
    const key = byMonth ? s.day.slice(0, 7) : s.day;
    map.set(key, (map.get(key) || 0) + s.amount);
  }
  const points: { key: string; label: string; title: string; amount: number }[] = [];
  if (byMonth) {
    let cursor = start.slice(0, 7);
    const last = end.slice(0, 7);
    let guard = 0;
    while (cursor <= last && guard++ < 240) {
      points.push({ key: cursor, label: formatMonth(cursor), title: formatMonth(cursor), amount: map.get(cursor) || 0 });
      const [y, m] = cursor.split('-').map(Number);
      cursor = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
    }
  } else {
    for (let i = 0; i <= Math.max(0, span); i++) {
      const day = addDays(start, i);
      points.push({ key: day, label: formatDay(day, 'short'), title: formatDay(day), amount: map.get(day) || 0 });
    }
  }
  return { byMonth, points };
}
