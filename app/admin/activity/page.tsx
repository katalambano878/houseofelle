'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { adminFetch, cedis } from '@/lib/admin-fetch';

const TZ = 'Africa/Accra';

type Person = { id: string; name: string; role: string };
type Entry = {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, any> | null;
  ip_address: string | null;
  created_at: string;
  who: string;
  role: string | null;
};
type ActivityData = {
  team: Person[];
  actions: { action: string; count: number }[];
  entries: Entry[];
  total: number;
  page: number;
  pageSize: number;
};
type Group = {
  sold_by_id: string | null;
  name: string | null;
  role: string | null;
  sales: number;
  revenue: number;
  items: number;
  pending: number;
  pending_total: number;
  cancelled: number;
  cash: number;
  card: number;
  momo: number;
  last_sale_at: string | null;
};
type Sale = {
  id: string;
  order_number: string;
  created_at: string;
  total: number;
  status: string;
  payment_status: string;
  payment_method: string | null;
  sold_by_id: string | null;
  sold_by: string | null;
  items: { name: string; variant: string | null; qty: number }[];
};
type SalesData = {
  team: Person[];
  from: string;
  to: string;
  groups: Group[];
  sales: Sale[];
  total: number;
  page: number;
  pageSize: number;
};

// ---------- wording ----------

const STATUS: Record<string, string> = {
  pending: 'Pending',
  awaiting_payment: 'Awaiting payment',
  processing: 'Processing',
  shipped: 'Packaged',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

const PAYMENT: Record<string, string> = { cash: 'cash', card: 'card', momo: 'mobile money', moolre: 'mobile money' };

const THINGS: Record<string, string> = {
  orders: 'order',
  order_items: 'order item',
  products: 'product',
  product_variants: 'product option',
  product_images: 'product photo',
  categories: 'category',
  coupons: 'coupon',
  customers: 'customer',
  reviews: 'review',
  site_settings: 'store setting',
  store_modules: 'module',
  blog_posts: 'journal post',
  staff: 'team member',
  roles: 'staff access',
  discounts: 'discount',
  discount_campaigns: 'sale campaign',
  discount_campaign: 'sale campaign',
  discount_products: 'discounted products',
  notifications: 'notification',
  staff_expenses: 'expense',
  expenses: 'expense',
  end_of_day_reports: 'end-of-day report',
  end_of_day: 'end-of-day report',
  sms: 'SMS',
  inventory: 'stock',
};

const ACTION_LABELS: Record<string, string> = {
  pos_sale: 'POS sales',
  status_change: 'Order status changes',
  create: 'Things added',
  update: 'Things changed',
  delete: 'Things deleted',
  invite: 'Team members added',
  promote: 'Customers given access',
  remove: 'Team members removed',
};

/** Last word of compound actions such as discount_campaign_start. */
const VERB_WORDS: Record<string, { word: string; tone: 'green' | 'red' | 'brand' | 'gray' | 'amber'; icon: string }> = {
  create: { word: 'added', tone: 'green', icon: 'ri-add-line' },
  update: { word: 'changed', tone: 'brand', icon: 'ri-edit-line' },
  delete: { word: 'deleted', tone: 'red', icon: 'ri-delete-bin-line' },
  start: { word: 'started', tone: 'green', icon: 'ri-play-circle-line' },
  end: { word: 'ended', tone: 'gray', icon: 'ri-stop-circle-line' },
  set: { word: 'updated', tone: 'brand', icon: 'ri-edit-line' },
  approve: { word: 'approved', tone: 'green', icon: 'ri-check-line' },
  reject: { word: 'rejected', tone: 'red', icon: 'ri-close-line' },
  close: { word: 'closed', tone: 'brand', icon: 'ri-lock-line' },
  reopen: { word: 'reopened', tone: 'amber', icon: 'ri-lock-unlock-line' },
  send: { word: 'sent', tone: 'brand', icon: 'ri-send-plane-line' },
  resend: { word: 'resent', tone: 'brand', icon: 'ri-send-plane-line' },
  apply: { word: 'applied', tone: 'brand', icon: 'ri-percent-line' },
  restore: { word: 'restored', tone: 'gray', icon: 'ri-arrow-go-back-line' },
};

function splitAction(action: string): { subject: string; verb: string } | null {
  const i = action.lastIndexOf('_');
  if (i <= 0) return null;
  const verb = action.slice(i + 1);
  return VERB_WORDS[verb] ? { subject: action.slice(0, i), verb } : null;
}

function actionLabel(action: string) {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];
  const split = splitAction(action);
  if (split) {
    const subject = THINGS[split.subject] || humanise(split.subject);
    return `${subject.charAt(0).toUpperCase()}${subject.slice(1)}: ${VERB_WORDS[split.verb].word}`;
  }
  return humanise(action);
}

const HIDDEN_DETAIL_KEYS = new Set(['label', 'name', 'changes', 'bulk', 'from', 'actor_email', 'actor_name', 'actor_role']);

/** Short scalar details (counts, flags) for actions this page has no special wording for. */
function scalarDetails(d: Record<string, any>) {
  return Object.entries(d)
    .filter(([k, v]) => !HIDDEN_DETAIL_KEYS.has(k) && (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean' || (Array.isArray(v) && v.length > 0)))
    .slice(0, 5)
    .map(([k, v]) => `${humanise(k)}: ${Array.isArray(v) ? v.join(', ') : typeof v === 'boolean' ? (v ? 'yes' : 'no') : String(v)}`)
    .join(' · ');
}

type Tone = 'green' | 'red' | 'brand' | 'gray' | 'amber';
const TONES: Record<Tone, string> = {
  green: 'bg-green-50 text-green-700',
  red: 'bg-red-50 text-red-700',
  brand: 'bg-blue-50 text-blue-700',
  gray: 'bg-gray-100 text-gray-600',
  amber: 'bg-amber-50 text-amber-700',
};

function humanise(s: string) {
  return s.replace(/_/g, ' ');
}

function quoted(label: unknown) {
  return label ? ` “${String(label)}”` : '';
}

function statusWord(s: unknown) {
  return STATUS[String(s)] || humanise(String(s));
}

/** Turns one audit row into a sentence after the person's name, plus an icon, tone and detail line. */
function describe(entry: Entry): { text: string; icon: string; tone: Tone; extra: string } {
  const d = entry.details || {};
  const label = (d.label ?? d.name) as string | undefined;
  const changes = (d.changes || {}) as Record<string, unknown>;
  const thing = THINGS[entry.entity_type] || humanise(entry.entity_type);
  const changeLine = Object.entries(changes)
    .filter(([k]) => !(entry.action === 'status_change' && k === 'status'))
    .map(([k, v]) => {
      if (k === 'screens_added') return `can now open ${v}`;
      if (k === 'screens_removed') return `can no longer open ${v}`;
      if (k === 'password') return 'password reset';
      if (k === 'role') return `role: ${v}`;
      if (k === 'tracking_number') return `tracking number: ${v}`;
      return `${humanise(k)}: ${String(v)}`;
    })
    .join(' · ');
  const bulk = d.bulk ? 'Bulk update' : '';
  const join = (...parts: string[]) => parts.filter(Boolean).join(' · ');

  switch (entry.action) {
    case 'pos_sale': {
      const items = Number(d.items) || 0;
      const how = PAYMENT[String(d.payment_method)] || (d.payment_method ? String(d.payment_method) : '');
      return {
        text: `rang up sale ${label || ''} for ${cedis(Number(d.total))}`,
        icon: 'ri-store-3-line',
        tone: 'green',
        extra: join(items ? `${items} item${items === 1 ? '' : 's'}` : '', how ? `paid by ${how}` : ''),
      };
    }
    case 'status_change':
      return {
        text: `marked order ${label || ''} as ${statusWord(changes.status)}`,
        icon: changes.status === 'cancelled' ? 'ri-close-circle-line' : 'ri-truck-line',
        tone: changes.status === 'cancelled' || changes.status === 'refunded' ? 'red' : 'brand',
        extra: join(d.from ? `was ${statusWord(d.from)}` : '', changeLine, bulk),
      };
    case 'invite':
      return {
        text: `added ${label || 'someone'} to the team as ${changes.role === 'admin' ? 'an admin' : 'staff'}`,
        icon: 'ri-user-add-line',
        tone: 'green',
        extra: '',
      };
    case 'promote':
      return {
        text: `gave ${label || 'a customer'} ${changes.role === 'admin' ? 'admin' : 'staff'} access`,
        icon: 'ri-user-star-line',
        tone: 'green',
        extra: 'Used their existing customer account',
      };
    case 'remove':
      return {
        text: entry.entity_type === 'staff' ? `removed ${label || 'someone'} from the team` : `removed ${thing}${quoted(label)}`,
        icon: 'ri-user-unfollow-line',
        tone: 'red',
        extra: entry.entity_type === 'staff' ? 'Admin access ended; their records stay' : changeLine,
      };
    case 'create':
      return { text: `added ${thing}${quoted(label)}`, icon: 'ri-add-line', tone: 'green', extra: join(changeLine, bulk) };
    case 'delete':
      return { text: `deleted ${thing}${quoted(label)}`, icon: 'ri-delete-bin-line', tone: 'red', extra: join(changeLine, bulk) };
    case 'update':
      if (entry.entity_type === 'roles') {
        return { text: 'changed the default staff screens', icon: 'ri-shield-user-line', tone: 'amber', extra: changeLine };
      }
      if (entry.entity_type === 'staff') {
        return { text: `changed ${label || 'a team member'}’s access`, icon: 'ri-shield-user-line', tone: 'amber', extra: changeLine };
      }
      return { text: `changed ${thing}${quoted(label)}`, icon: 'ri-edit-line', tone: 'brand', extra: join(changeLine, scalarDetails(d), bulk) };
    default: {
      const split = splitAction(entry.action);
      if (split) {
        const verb = VERB_WORDS[split.verb];
        const subject = THINGS[split.subject] || humanise(split.subject);
        return { text: `${verb.word} ${subject}${quoted(label)}`, icon: verb.icon, tone: verb.tone, extra: join(changeLine, scalarDetails(d), bulk) };
      }
      return {
        text: `${humanise(entry.action)} ${thing}${quoted(label)}`,
        icon: 'ri-flashlight-line',
        tone: 'gray',
        extra: join(changeLine, scalarDetails(d), bulk),
      };
    }
  }
}

function linkFor(entry: Entry): string | null {
  if (!entry.entity_id) return null;
  if (entry.entity_type === 'orders') return `/admin/orders/${entry.entity_id}`;
  if (entry.entity_type === 'products' && entry.action !== 'delete') return `/admin/products/${entry.entity_id}`;
  if (entry.entity_type === 'staff') return `/admin/activity?user=${entry.entity_id}`;
  return null;
}

// ---------- dates (all in Accra time) ----------

function accraDay(d: Date | string) {
  return new Date(d).toLocaleDateString('en-CA', { timeZone: TZ });
}
function shiftDay(day: string, by: number) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + by);
  return d.toISOString().slice(0, 10);
}
function dayHeading(day: string) {
  const today = accraDay(new Date());
  if (day === today) return 'Today';
  if (day === shiftDay(today, -1)) return 'Yesterday';
  return new Date(`${day}T12:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: day.slice(0, 4) === today.slice(0, 4) ? undefined : 'numeric',
    timeZone: 'UTC',
  });
}
function timeOf(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
}
function dateTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: TZ });
}
function prettyRange(from: string, to: string) {
  const f = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  return from === to ? f(from) : `${f(from)} – ${f(to)}`;
}

const PRESETS = [
  { key: 'today', label: 'Today', range: (t: string) => [t, t] },
  { key: '7', label: '7 days', range: (t: string) => [shiftDay(t, -6), t] },
  { key: '30', label: '30 days', range: (t: string) => [shiftDay(t, -29), t] },
  { key: 'month', label: 'This month', range: (t: string) => [`${t.slice(0, 8)}01`, t] },
] as const;

// ---------- shared bits ----------

const selectClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30';

function ErrorBox({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between">
      <span className="flex items-center gap-2">
        <i className="ri-error-warning-line text-lg" aria-hidden="true" /> {message}
      </span>
      <button type="button" onClick={onRetry} className="self-start rounded-lg border border-red-300 bg-white px-4 py-2 font-semibold text-red-700 hover:bg-red-100 sm:self-auto">
        Try again
      </button>
    </div>
  );
}

function Pager({ page, pageSize, total, onPage, noun }: { page: number; pageSize: number; total: number; onPage: (p: number) => void; noun: string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);
  return (
    <nav aria-label={`${noun} pages`} className="flex flex-col gap-3 border-t border-gray-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <p className="text-sm text-gray-600">
        Showing <span className="font-medium tabular-nums text-gray-900">{first}–{last}</span> of{' '}
        <span className="font-medium tabular-nums text-gray-900">{total}</span> {noun}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <i className="ri-arrow-left-s-line" aria-hidden="true" /> Newer
        </button>
        <span className="px-1 text-sm tabular-nums text-gray-600">
          Page {page} of {pages}
        </span>
        <button
          type="button"
          onClick={() => onPage(page + 1)}
          disabled={page >= pages}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Older <i className="ri-arrow-right-s-line" aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}

function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <ul className="divide-y divide-gray-100" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex animate-pulse items-start gap-4 px-4 py-4 sm:px-6">
          <span className="h-9 w-9 shrink-0 rounded-full bg-gray-100" />
          <span className="flex-1 space-y-2 pt-1">
            <span className="block h-3.5 w-3/4 max-w-md rounded bg-gray-100" />
            <span className="block h-3 w-1/3 max-w-xs rounded bg-gray-100" />
          </span>
          <span className="h-3 w-10 rounded bg-gray-100" />
        </li>
      ))}
    </ul>
  );
}

// ---------- page ----------

function ActivityView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const view = params.get('view') === 'sales' ? 'sales' : 'timeline';

  const setParams = useCallback(
    (next: Record<string, string | null>) => {
      const qs = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(next)) {
        if (v) qs.set(k, v);
        else qs.delete(k);
      }
      const s = qs.toString();
      router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
    },
    [params, pathname, router]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Staff activity</h1>
        <p className="mt-1 text-gray-600">What each person did in the admin, and who sold what on the POS. Times are Accra time.</p>
      </div>

      <div role="tablist" aria-label="Activity views" className="flex border-b border-gray-200">
        {[
          { key: 'timeline', label: 'Timeline', icon: 'ri-history-line' },
          { key: 'sales', label: 'Who sold what', icon: 'ri-store-3-line' },
        ].map((tab) => {
          const active = view === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`panel-${tab.key}`}
              id={`tab-${tab.key}`}
              onClick={() =>
                setParams({
                  view: tab.key === 'timeline' ? null : tab.key,
                  page: null,
                  action: null,
                  ...(tab.key === 'sales' ? {} : { from: null, to: null }),
                  ...(params.get('user') === 'unassigned' ? { user: null } : {}),
                })
              }
              className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors sm:px-6 ${
                active ? 'border-blue-700 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <i className={tab.icon} aria-hidden="true" /> {tab.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`panel-${view}`} aria-labelledby={`tab-${view}`}>
        {view === 'timeline' ? <Timeline params={params} setParams={setParams} /> : <SalesByStaff params={params} setParams={setParams} />}
      </div>
    </div>
  );
}

type ViewProps = {
  params: URLSearchParams | ReturnType<typeof useSearchParams>;
  setParams: (next: Record<string, string | null>) => void;
};

function DateFilters({ from, to, setParams, today }: { from: string; to: string; setParams: ViewProps['setParams']; today: string }) {
  const active = PRESETS.find((p) => {
    const [f, t] = p.range(today);
    return f === from && t === to;
  })?.key;
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Quick periods">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            aria-pressed={active === p.key}
            onClick={() => {
              const [f, t] = p.range(today);
              setParams({ from: f, to: t, page: null });
            }}
            className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              active === p.key ? 'border-blue-700 bg-blue-50 text-blue-700' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:items-end">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-600">From</span>
          <input
            type="date"
            value={from}
            max={to || today}
            onChange={(e) => setParams({ from: e.target.value || null, page: null })}
            className={selectClass}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-600">To</span>
          <input
            type="date"
            value={to}
            min={from || undefined}
            max={today}
            onChange={(e) => setParams({ to: e.target.value || null, page: null })}
            className={selectClass}
          />
        </label>
      </div>
    </div>
  );
}

function Timeline({ params, setParams }: ViewProps) {
  const user = params.get('user') || '';
  const action = params.get('action') || '';
  const from = params.get('from') || '';
  const to = params.get('to') || '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const today = accraDay(new Date());

  const [data, setData] = useState<ActivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams({ page: String(page) });
      if (user) qs.set('user', user);
      if (action) qs.set('action', action);
      if (from) qs.set('from', from);
      if (to) qs.set('to', to);
      setData(await adminFetch<ActivityData>(`/api/admin/activity?${qs}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load activity.');
    } finally {
      setLoading(false);
    }
  }, [user, action, from, to, page]);

  useEffect(() => {
    load();
  }, [load]);

  const byDay = useMemo(() => {
    const out: { day: string; entries: Entry[] }[] = [];
    for (const entry of data?.entries || []) {
      const day = accraDay(entry.created_at);
      const last = out[out.length - 1];
      if (last?.day === day) last.entries.push(entry);
      else out.push({ day, entries: [entry] });
    }
    return out;
  }, [data]);

  const filtered = Boolean(user || action || from || to);
  const actionOptions = data?.actions || [];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600">Person</span>
            <select value={user} onChange={(e) => setParams({ user: e.target.value || null, page: null })} className={selectClass}>
              <option value="">Everyone</option>
              {(data?.team || []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {m.role === 'admin' ? ' (admin)' : m.role === 'staff' ? '' : ' (no longer on the team)'}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600">What they did</span>
            <select value={action} onChange={(e) => setParams({ action: e.target.value || null, page: null })} className={selectClass}>
              <option value="">Everything</option>
              {actionOptions.map((a) => (
                <option key={a.action} value={a.action}>
                  {actionLabel(a.action)} ({a.count})
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <DateFilters from={from} to={to} setParams={setParams} today={today} />
          {filtered && (
            <button
              type="button"
              onClick={() => setParams({ user: null, action: null, from: null, to: null, page: null })}
              className="self-start rounded-lg px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 lg:self-auto"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {error ? (
        <ErrorBox message={error} onRetry={load} />
      ) : (
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm" aria-busy={loading}>
          {loading && !data ? (
            <ListSkeleton />
          ) : data && data.entries.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <i className="ri-history-line text-3xl text-gray-400" aria-hidden="true" />
              <p className="mt-2 font-semibold text-gray-900">{filtered ? 'Nothing matches these filters' : 'No activity yet'}</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-gray-600">
                {filtered
                  ? 'Try a longer period or a different person.'
                  : 'POS sales, order status changes, product deletions and team changes will show here as they happen.'}
              </p>
            </div>
          ) : (
            <div className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
              {byDay.map(({ day, entries }) => (
                <div key={day}>
                  <h2 className="border-b border-gray-100 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700 sm:px-6">
                    {dayHeading(day)}
                  </h2>
                  <ol className="divide-y divide-gray-100">
                    {entries.map((entry) => {
                      const { text, icon, tone, extra } = describe(entry);
                      const href = linkFor(entry);
                      return (
                        <li key={entry.id} className="flex gap-3 px-4 py-4 sm:gap-4 sm:px-6">
                          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${TONES[tone]}`} aria-hidden="true">
                            <i className={icon} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm leading-6 text-gray-900">
                              {entry.user_id ? (
                                <button
                                  type="button"
                                  onClick={() => setParams({ user: entry.user_id, page: null })}
                                  className="font-semibold hover:underline"
                                >
                                  {entry.who}
                                </button>
                              ) : (
                                <span className="font-semibold">{entry.who}</span>
                              )}
                              {entry.role === 'admin' && <span className="ml-1.5 rounded bg-blue-50 px-1.5 py-0.5 text-[11px] font-semibold text-blue-700">Admin</span>}{' '}
                              {href ? (
                                <Link href={href} className="break-words text-gray-900 underline decoration-gray-300 underline-offset-2 hover:decoration-blue-700">
                                  {text}
                                </Link>
                              ) : (
                                <span className="break-words">{text}</span>
                              )}
                            </p>
                            {extra && <p className="mt-0.5 break-words text-sm text-gray-500">{extra}</p>}
                          </div>
                          <time dateTime={entry.created_at} title={dateTime(entry.created_at)} className="shrink-0 pt-0.5 text-xs tabular-nums text-gray-500">
                            {timeOf(entry.created_at)}
                          </time>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              ))}
            </div>
          )}
          {data && <Pager page={page} pageSize={data.pageSize} total={data.total} onPage={(p) => setParams({ page: p > 1 ? String(p) : null })} noun="entries" />}
        </section>
      )}
    </div>
  );
}

function SalesByStaff({ params, setParams }: ViewProps) {
  const today = accraDay(new Date());
  const from = params.get('from') || shiftDay(today, -6);
  const to = params.get('to') || today;
  const user = params.get('user') || '';
  const page = Math.max(1, Number(params.get('page')) || 1);

  const [data, setData] = useState<SalesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams({ view: 'sales', from, to, page: String(page) });
      if (user) qs.set('user', user);
      setData(await adminFetch<SalesData>(`/api/admin/activity?${qs}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load sales.');
    } finally {
      setLoading(false);
    }
  }, [from, to, user, page]);

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(() => {
    const g = data?.groups || [];
    return {
      sales: g.reduce((s, r) => s + r.sales, 0),
      revenue: g.reduce((s, r) => s + r.revenue, 0),
      items: g.reduce((s, r) => s + r.items, 0),
      pending: g.reduce((s, r) => s + r.pending, 0),
      pendingTotal: g.reduce((s, r) => s + r.pending_total, 0),
    };
  }, [data]);

  const groupKey = (g: Group) => g.sold_by_id || 'unassigned';
  const selectedName =
    user === 'unassigned'
      ? 'sales with no seller recorded'
      : data?.groups.find((g) => g.sold_by_id === user)?.name || data?.team.find((m) => m.id === user)?.name || '';

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
        <DateFilters from={from} to={to} setParams={setParams} today={today} />
      </div>

      {error ? (
        <ErrorBox message={error} onRetry={load} />
      ) : (
        <>
          <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm" aria-labelledby="by-staff" aria-busy={loading}>
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-gray-200 px-4 py-4 sm:px-6">
              <h2 id="by-staff" className="text-lg font-bold text-gray-900">
                POS sales by person, {prettyRange(from, to)}
              </h2>
              {data && data.groups.length > 0 && (
                <p className="text-sm text-gray-600">
                  <span className="font-semibold tabular-nums text-gray-900">{cedis(totals.revenue)}</span> from {totals.sales} sale
                  {totals.sales === 1 ? '' : 's'}
                </p>
              )}
            </div>

            {loading && !data ? (
              <ListSkeleton rows={3} />
            ) : data && data.groups.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <i className="ri-store-3-line text-3xl text-gray-400" aria-hidden="true" />
                <p className="mt-2 font-semibold text-gray-900">No POS sales in this period</p>
                <p className="mx-auto mt-1 max-w-md text-sm text-gray-600">
                  Sales rung up on the POS are recorded under the person who was signed in. Try a longer period.
                </p>
              </div>
            ) : (
              <ul className={`divide-y divide-gray-100 ${loading ? 'opacity-60' : ''}`}>
                {(data?.groups || []).map((g) => {
                  const key = groupKey(g);
                  const selected = user === key;
                  const share = totals.revenue > 0 ? Math.round((g.revenue / totals.revenue) * 100) : 0;
                  const name = g.sold_by_id ? g.name || 'Unknown person' : 'No seller recorded';
                  return (
                    <li key={key}>
                      <button
                        type="button"
                        onClick={() => setParams({ user: selected ? null : key, page: null })}
                        aria-pressed={selected}
                        className={`block w-full px-4 py-4 text-left transition-colors focus:outline-none focus-visible:bg-blue-50 sm:px-6 ${
                          selected ? 'bg-blue-50' : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-center">
                          <div className="min-w-0 md:w-56 md:shrink-0">
                            <p className="flex items-center gap-2 font-semibold text-gray-900">
                              <span className="truncate">{name}</span>
                              {g.role === 'admin' && <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[11px] font-semibold text-blue-700">Admin</span>}
                              {g.sold_by_id && g.role === 'customer' && <span className="text-xs font-normal text-gray-500">(left the team)</span>}
                            </p>
                            <p className="text-xs text-gray-500">
                              {g.last_sale_at ? `Last sale ${dateTime(g.last_sale_at)}` : 'No completed sales'}
                            </p>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-3">
                              <span className="font-semibold tabular-nums text-gray-900">{cedis(g.revenue)}</span>
                              <span className="text-xs tabular-nums text-gray-500">{share}% of takings</span>
                            </div>
                            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-100" aria-hidden="true">
                              <div className="h-full rounded-full bg-blue-500" style={{ width: `${share}%` }} />
                            </div>
                          </div>
                          <dl className="grid grid-cols-3 gap-3 text-sm md:w-72 md:shrink-0">
                            <div>
                              <dt className="text-xs text-gray-500">Sales</dt>
                              <dd className="font-semibold tabular-nums text-gray-900">{g.sales}</dd>
                            </div>
                            <div>
                              <dt className="text-xs text-gray-500">Items</dt>
                              <dd className="font-semibold tabular-nums text-gray-900">{g.items}</dd>
                            </div>
                            <div>
                              <dt className="text-xs text-gray-500">Unpaid</dt>
                              <dd className={`font-semibold tabular-nums ${g.pending ? 'text-amber-700' : 'text-gray-900'}`}>{g.pending}</dd>
                            </div>
                          </dl>
                        </div>
                        <p className="mt-2 text-xs text-gray-500">
                          Cash {cedis(g.cash)} · Card {cedis(g.card)} · Mobile money {cedis(g.momo)}
                          {g.pending ? ` · ${cedis(g.pending_total)} awaiting payment` : ''}
                          {g.cancelled ? ` · ${g.cancelled} cancelled or refunded` : ''}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {data && data.groups.length > 0 && (
              <p className="border-t border-gray-100 bg-gray-50 px-4 py-3 text-xs text-gray-500 sm:px-6">
                Takings count paid sales that were not cancelled or refunded. Unpaid means mobile-money sales still waiting for
                payment. Select a person to see only their sales below.
              </p>
            )}
          </section>

          {data && data.groups.length > 0 && (
            <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm" aria-labelledby="sale-list">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-4 py-4 sm:px-6">
                <h2 id="sale-list" className="text-lg font-bold text-gray-900">
                  {user ? `Sales: ${selectedName}` : 'Every POS sale'}
                </h2>
                {user && (
                  <button type="button" onClick={() => setParams({ user: null, page: null })} className="rounded-lg px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50">
                    Show everyone
                  </button>
                )}
              </div>

              {data.sales.length === 0 ? (
                <p className="px-6 py-10 text-center text-sm text-gray-600">No sales for this person in this period.</p>
              ) : (
                <div className={loading ? 'opacity-60' : ''}>
                  {/* Phones: one card per sale. */}
                  <ul className="divide-y divide-gray-100 md:hidden">
                    {data.sales.map((sale) => (
                      <li key={sale.id} className="px-4 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <Link href={`/admin/orders/${sale.id}`} className="font-semibold text-blue-700 hover:underline">
                            {sale.order_number}
                          </Link>
                          <span className="font-semibold tabular-nums text-gray-900">{cedis(sale.total)}</span>
                        </div>
                        <p className="mt-1 text-sm text-gray-700">{itemSummary(sale.items)}</p>
                        <p className="mt-1 text-xs text-gray-500">
                          {dateTime(sale.created_at)} · {sale.sold_by || 'No seller recorded'} · {paymentLabel(sale)}
                        </p>
                        <SaleBadge sale={sale} />
                      </li>
                    ))}
                  </ul>
                  {/* Wider screens: a table that scrolls inside its own box if needed. */}
                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full min-w-[720px] text-sm">
                      <thead className="border-b border-gray-200 bg-gray-50 text-left">
                        <tr>
                          <th scope="col" className="px-6 py-3 font-semibold text-gray-700">When</th>
                          <th scope="col" className="px-4 py-3 font-semibold text-gray-700">Order</th>
                          <th scope="col" className="px-4 py-3 font-semibold text-gray-700">Items</th>
                          <th scope="col" className="px-4 py-3 font-semibold text-gray-700">Sold by</th>
                          <th scope="col" className="px-4 py-3 font-semibold text-gray-700">Payment</th>
                          <th scope="col" className="px-6 py-3 text-right font-semibold text-gray-700">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {data.sales.map((sale) => (
                          <tr key={sale.id} className="align-top hover:bg-gray-50">
                            <td className="whitespace-nowrap px-6 py-3 tabular-nums text-gray-600">{dateTime(sale.created_at)}</td>
                            <td className="whitespace-nowrap px-4 py-3">
                              <Link href={`/admin/orders/${sale.id}`} className="font-medium text-blue-700 hover:underline">
                                {sale.order_number}
                              </Link>
                            </td>
                            <td className="max-w-xs px-4 py-3 text-gray-700">{itemSummary(sale.items)}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-gray-700">{sale.sold_by || <span className="text-gray-400">Not recorded</span>}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                              {paymentLabel(sale)}
                              <SaleBadge sale={sale} />
                            </td>
                            <td className="whitespace-nowrap px-6 py-3 text-right font-semibold tabular-nums text-gray-900">{cedis(sale.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              <Pager page={page} pageSize={data.pageSize} total={data.total} onPage={(p) => setParams({ page: p > 1 ? String(p) : null })} noun="sales" />
            </section>
          )}
        </>
      )}
    </div>
  );
}

function itemSummary(items: Sale['items']) {
  if (!items.length) return 'No items';
  return items.map((i) => `${i.qty} × ${i.name}${i.variant ? ` (${i.variant})` : ''}`).join(', ');
}

function paymentLabel(sale: Sale) {
  const m = sale.payment_method || '';
  return m === 'cash' ? 'Cash' : m === 'card' ? 'Card' : m === 'moolre' || m === 'momo' ? 'Mobile money' : m || 'Not recorded';
}

function SaleBadge({ sale }: { sale: Sale }) {
  if (sale.status === 'cancelled' || sale.status === 'refunded') {
    return <span className="ml-2 inline-block rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">{STATUS[sale.status]}</span>;
  }
  if (sale.payment_status !== 'paid') {
    return <span className="ml-2 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">Awaiting payment</span>;
  }
  return null;
}

export default function ActivityPage() {
  return (
    <Suspense fallback={<div className="h-40 animate-pulse rounded-xl border border-gray-200 bg-white" />}>
      <ActivityView />
    </Suspense>
  );
}
