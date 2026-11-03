'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { adminFetch, cedis } from '@/lib/admin-fetch';
import { DEFAULT_NOTICE, NOTICE_MAX_LENGTH, smsParts } from '@/lib/sms-resend';

type Phase = 'orders' | 'apology';
type Source = 'all' | 'web' | 'pos';
type Counts = Record<string, number>;
type Batch = { counts: Record<Phase, Counts>; lastAttemptAt: string | null; exists: boolean };

type Overview = {
  ok: true;
  batchId: string;
  configured: boolean;
  truncated: boolean;
  balance: { known: boolean; smsLeft: number | null; costPerSms: number | null; currency: string; error?: string };
  orders: {
    considered: number;
    toSend: number;
    parts: number;
    kinds: { kind: string; label: string; count: number; example: string }[];
    skipped: { reason: string; label: string; count: number }[];
  };
  notice: { customers: number; partsEach: number; parts: number };
  batch: Batch;
};

type RunResult = {
  ok: boolean;
  stopped?: 'insufficient_balance' | 'not_configured' | null;
  error?: string;
  sent: number;
  failed: number;
  processed: number;
  remaining?: number;
  done: boolean;
  smsLeft?: number;
  batch?: Batch;
};

type Message = {
  id: string;
  phone: string;
  message: string;
  status: string;
  error_message: string | null;
  attempts: number;
  last_attempted_at: string | null;
  order_number: string | null;
};

type Progress = { phase: Phase; retry: boolean; sent: number; failed: number; total: number; state: 'running' | 'paused' | 'done' | 'stopped' };
type Notice = { kind: 'ok' | 'error' | 'warn'; text: string; action?: { href: string; label: string } } | null;
type Confirm = { phase: Phase; retry: boolean; count: number; customers: number; parts: number } | null;

const API = '/api/admin/sms/resend-window';
const RUN_BATCH = 10;
const PAGE_SIZE = 50;

const STATUS_STYLE: Record<string, { label: string; cls: string; icon: string }> = {
  pending: { label: 'Waiting', cls: 'border-gray-200 bg-gray-50 text-gray-700', icon: 'ri-time-line' },
  sent: { label: 'Sent', cls: 'border-green-200 bg-green-50 text-green-800', icon: 'ri-check-line' },
  failed: { label: 'Failed', cls: 'border-red-200 bg-red-50 text-red-800', icon: 'ri-close-line' },
  insufficient_balance: { label: 'No credit', cls: 'border-amber-200 bg-amber-50 text-amber-800', icon: 'ri-wallet-3-line' },
  skipped: { label: 'Skipped', cls: 'border-gray-200 bg-gray-50 text-gray-500', icon: 'ri-skip-forward-line' },
};

const FILTERS: { value: string | null; label: string }[] = [
  { value: null, label: 'All' },
  { value: 'pending', label: 'Waiting' },
  { value: 'sent', label: 'Sent' },
  { value: 'failed', label: 'Failed' },
  { value: 'insufficient_balance', label: 'No credit' },
];

const SOURCES: { value: Source; label: string }[] = [
  { value: 'all', label: 'All orders' },
  { value: 'web', label: 'Website' },
  { value: 'pos', label: 'POS' },
];

const card = 'rounded-xl border border-gray-200 bg-white shadow-sm';
const inputCls =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm';
const primaryBtn =
  'inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-blue-700 px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
const secondaryBtn =
  'inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

/** Local calendar day, YYYY-MM-DD. Ghana is on UTC, which is what the server uses. */
function dayKey(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const PRESETS = [
  { label: 'Today', from: 0, to: 0 },
  { label: 'Yesterday', from: 1, to: 1 },
  { label: 'Last 3 days', from: 2, to: 0 },
  { label: 'Last 7 days', from: 6, to: 0 },
];

const num = (n: number) => n.toLocaleString('en-GH');

function when(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleString('en-GH', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

function formatPhone(digits: string): string {
  if (digits.startsWith('233') && digits.length === 12) return `0${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  return `+${digits}`;
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.pending;
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${s.cls}`}>
      <i className={s.icon} aria-hidden />
      {s.label}
    </span>
  );
}

function Stat({ label, value, tone = 'gray' }: { label: string; value: string; tone?: 'gray' | 'green' | 'red' | 'amber' }) {
  const toneCls = { gray: 'text-gray-900', green: 'text-green-700', red: 'text-red-700', amber: 'text-amber-700' }[tone];
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`mt-0.5 text-xl font-bold tabular-nums ${toneCls}`}>{value}</p>
    </div>
  );
}

function ProgressBar({ sent, failed, total }: { sent: number; failed: number; total: number }) {
  const pct = (n: number) => (total > 0 ? Math.min(100, (n / total) * 100) : 0);
  return (
    <div
      className="flex h-2.5 w-full overflow-hidden rounded-full bg-gray-100"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={sent + failed}
      aria-label="Sending progress"
    >
      <div className="h-full bg-green-600 transition-[width] duration-300" style={{ width: `${pct(sent)}%` }} />
      <div className="h-full bg-red-500 transition-[width] duration-300" style={{ width: `${pct(failed)}%` }} />
    </div>
  );
}

export default function SmsResendPage() {
  const [from, setFrom] = useState(dayKey(6));
  const [to, setTo] = useState(dayKey(0));
  const [source, setSource] = useState<Source>('all');
  const [noticeText, setNoticeText] = useState(DEFAULT_NOTICE);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [openKind, setOpenKind] = useState<string | null>(null);

  const [progress, setProgress] = useState<Progress | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const pauseRef = useRef(false);

  const [testPhone, setTestPhone] = useState('');
  const [testKind, setTestKind] = useState<'order' | 'notice'>('order');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);

  const [listPhase, setListPhase] = useState<Phase>('orders');
  const [listFilter, setListFilter] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesTotal, setMessagesTotal] = useState(0);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [listTick, setListTick] = useState(0);

  const running = progress?.state === 'running';
  const range = useMemo(() => ({ from, to, source }), [from, to, source]);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await adminFetch<Overview>(API, {
        method: 'POST',
        body: JSON.stringify({ action: 'overview', ...range, notice: noticeText }),
      });
      setOverview(data);
    } catch (err) {
      setOverview(null);
      setLoadError(err instanceof Error ? err.message : 'Could not load the orders.');
    } finally {
      setLoading(false);
    }
    // The notice only changes the credit estimate, which is worked out in the browser below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  useEffect(() => {
    if (running) return;
    const t = setTimeout(loadOverview, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadOverview]);

  const loadMessages = useCallback(async () => {
    if (!overview?.batch.exists) {
      setMessages([]);
      setMessagesTotal(0);
      return;
    }
    setMessagesLoading(true);
    try {
      const data = await adminFetch<{ messages: Message[]; total: number }>(API, {
        method: 'POST',
        body: JSON.stringify({ action: 'messages', ...range, phase: listPhase, status: listFilter, offset: page * PAGE_SIZE, limit: PAGE_SIZE }),
      });
      setMessages(data.messages);
      setMessagesTotal(data.total);
    } catch {
      // The list is secondary; the counts above still show where things stand.
    } finally {
      setMessagesLoading(false);
    }
    // listTick refreshes the list after every group that is sent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overview?.batch.exists, range, listPhase, listFilter, page, listTick]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    setPage(0);
  }, [listPhase, listFilter, range]);

  useEffect(() => {
    if (!confirm) return;
    const close = (e: KeyboardEvent) => e.key === 'Escape' && setConfirm(null);
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [confirm]);

  useEffect(() => {
    if (!running) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [running]);

  const counts = overview?.batch.counts;
  const orderCounts = counts?.orders || {};
  const noticeCounts = counts?.apology || {};
  const noticeParts = smsParts(noticeText.trim() || DEFAULT_NOTICE);
  const noticeTooLong = noticeText.trim().length > NOTICE_MAX_LENGTH;
  const balance = overview?.balance;
  const configured = overview?.configured ?? true;

  const ordersOutstanding = overview ? Math.max(0, overview.orders.toSend - (orderCounts.sent || 0)) : 0;
  const noticeOutstanding = overview ? Math.max(0, overview.notice.customers - (noticeCounts.sent || 0)) : 0;
  const ordersFailed = (orderCounts.failed || 0) + (orderCounts.insufficient_balance || 0);
  const noticeFailed = (noticeCounts.failed || 0) + (noticeCounts.insufficient_balance || 0);
  const avgOrderParts = overview && overview.orders.toSend > 0 ? overview.orders.parts / overview.orders.toSend : 1;

  function estimate(parts: number): string {
    const cost = balance?.costPerSms ? ` (about ${cedis(parts * balance.costPerSms)})` : '';
    return `${num(parts)} SMS credit${parts === 1 ? '' : 's'}${cost}`;
  }

  function askToSend(phase: Phase, retry: boolean) {
    if (!overview) return;
    setNotice(null);
    if (phase === 'orders') {
      const count = retry ? ordersFailed : ordersOutstanding;
      setConfirm({ phase, retry, count, customers: overview.notice.customers, parts: Math.ceil(count * avgOrderParts) });
    } else {
      const count = retry ? noticeFailed : noticeOutstanding;
      setConfirm({ phase, retry, count, customers: count, parts: count * noticeParts });
    }
  }

  async function post<T>(body: Record<string, unknown>): Promise<T> {
    return adminFetch<T>(API, { method: 'POST', body: JSON.stringify({ ...range, ...body }) });
  }

  async function startSending(phase: Phase, retry: boolean, total: number) {
    setConfirm(null);
    pauseRef.current = false;
    setListPhase(phase);
    setProgress({ phase, retry, sent: 0, failed: 0, total, state: 'running' });
    let sent = 0;
    let failed = 0;
    const since = new Date().toISOString();

    try {
      if (!retry) {
        await post({ action: 'seed', phase, notice: noticeText.trim() || DEFAULT_NOTICE });
      }
      for (let i = 0; i < 1000; i++) {
        if (pauseRef.current) {
          setProgress((p) => (p ? { ...p, state: 'paused' } : p));
          setNotice({ kind: 'warn', text: `Paused after ${num(sent)} sent. Press Continue to send the rest.` });
          break;
        }
        const res = await post<RunResult>({ action: 'run', phase, limit: RUN_BATCH, includeFailed: retry, since });
        sent += res.sent || 0;
        failed += res.failed || 0;
        setProgress((p) => (p ? { ...p, sent, failed } : p));
        if (res.batch) setOverview((o) => (o ? { ...o, batch: res.batch! } : o));
        setListTick((n) => n + 1);

        if (res.stopped === 'insufficient_balance') {
          setProgress((p) => (p ? { ...p, state: 'stopped' } : p));
          setNotice({
            kind: 'error',
            text: `${res.error || 'The SMS balance ran out.'} ${num(sent)} sent before it stopped; the rest are waiting and will not be sent twice.`,
            action: { href: '/admin/sms-credit', label: 'Buy SMS' },
          });
          break;
        }
        if (res.stopped === 'not_configured') {
          setProgress((p) => (p ? { ...p, state: 'stopped' } : p));
          setNotice({ kind: 'error', text: res.error || 'SMS sending is not set up on this server.' });
          break;
        }
        if (res.done) {
          setProgress((p) => (p ? { ...p, state: 'done' } : p));
          setNotice(
            failed > 0
              ? { kind: 'warn', text: `Finished. ${num(sent)} sent, ${num(failed)} failed. You can retry the failed ones.` }
              : { kind: 'ok', text: sent > 0 ? `Finished. All ${num(sent)} texts were sent.` : 'Nothing left to send.' }
          );
          break;
        }
      }
    } catch (err) {
      setProgress((p) => (p ? { ...p, state: 'stopped' } : p));
      setNotice({
        kind: 'error',
        text: `${err instanceof Error ? err.message : 'Sending stopped.'} Messages already sent will not be sent again.`,
      });
    } finally {
      loadOverview();
    }
  }

  async function sendTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await post<{ ok: boolean; message?: string; error?: string }>({
        action: 'test',
        phone: testPhone,
        kind: testKind,
        notice: noticeText.trim() || DEFAULT_NOTICE,
      });
      setTestResult({ ok: res.ok, text: res.ok ? res.message || 'Test sent.' : res.error || 'The test was not sent.' });
    } catch (err) {
      setTestResult({ ok: false, text: err instanceof Error ? err.message : 'The test was not sent.' });
    } finally {
      setTesting(false);
    }
  }

  const presetActive = (p: (typeof PRESETS)[number]) => from === dayKey(p.from) && to === dayKey(p.to);

  // ------------------------------------------------------------------------------------------- render

  const phaseCard = (phase: Phase) => {
    const isOrders = phase === 'orders';
    const c = isOrders ? orderCounts : noticeCounts;
    const outstanding = isOrders ? ordersOutstanding : noticeOutstanding;
    const failedCount = isOrders ? ordersFailed : noticeFailed;
    const total = isOrders ? overview?.orders.toSend || 0 : overview?.notice.customers || 0;
    const mine = progress?.phase === phase ? progress : null;
    const busyElsewhere = running && !mine;
    const disabledReason = !configured
      ? 'SMS is not set up on this server.'
      : !isOrders && noticeTooLong
        ? 'The notice is too long.'
        : null;

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label={isOrders ? 'Texts to send' : 'Customers'} value={num(total)} />
          <Stat label="Sent" value={num(c.sent || 0)} tone="green" />
          <Stat label="Failed" value={num(failedCount)} tone={failedCount ? 'red' : 'gray'} />
          <Stat label="Still to send" value={num(outstanding)} tone={outstanding ? 'amber' : 'gray'} />
        </div>

        {mine && (
          <div className="rounded-lg border border-gray-200 p-3" aria-live="polite">
            <div className="mb-2 flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-gray-800">
                {mine.state === 'running' && (
                  <>
                    <i className="ri-loader-4-line mr-1 animate-spin text-blue-700" aria-hidden />
                    {mine.retry ? 'Retrying failed texts…' : 'Sending…'}
                  </>
                )}
                {mine.state === 'paused' && 'Paused'}
                {mine.state === 'done' && 'Finished'}
                {mine.state === 'stopped' && 'Stopped'}
              </span>
              <span className="tabular-nums text-gray-600">
                {num(mine.sent)} sent{mine.failed ? ` · ${num(mine.failed)} failed` : ''} of {num(mine.total)}
              </span>
            </div>
            <ProgressBar sent={mine.sent} failed={mine.failed} total={mine.total} />
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          {mine?.state === 'running' ? (
            <button type="button" onClick={() => (pauseRef.current = true)} className={secondaryBtn}>
              <i className="ri-pause-line" aria-hidden /> Pause after this group
            </button>
          ) : (
            <button
              type="button"
              disabled={!overview || outstanding === 0 || busyElsewhere || !!disabledReason || loading}
              onClick={() => askToSend(phase, false)}
              className={primaryBtn}
            >
              <i className="ri-send-plane-2-line" aria-hidden />
              {outstanding === 0
                ? total === 0
                  ? isOrders
                    ? 'No order texts to send'
                    : 'No customers to text'
                  : 'All sent'
                : mine?.state === 'paused' || mine?.state === 'stopped'
                  ? `Continue (${num(outstanding)} left)`
                  : isOrders
                    ? `Send ${num(outstanding)} order text${outstanding === 1 ? '' : 's'}`
                    : `Send notice to ${num(outstanding)} customer${outstanding === 1 ? '' : 's'}`}
            </button>
          )}
          {failedCount > 0 && mine?.state !== 'running' && (
            <button
              type="button"
              disabled={busyElsewhere || !!disabledReason}
              onClick={() => askToSend(phase, true)}
              className={secondaryBtn}
            >
              <i className="ri-restart-line" aria-hidden /> Retry {num(failedCount)} failed
            </button>
          )}
          {disabledReason && <p className="text-xs text-gray-500">{disabledReason}</p>}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">SMS Resend</h1>
          <p className="mt-1 max-w-2xl text-gray-600">
            Send order texts again for a range of dates, for example after an SMS outage. Each text goes out once: running it again
            only sends what has not gone out yet.
          </p>
        </div>
        <Link
          href="/admin/sms-credit"
          className="inline-flex items-center gap-2 self-start rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm hover:border-gray-300"
        >
          <i className="ri-message-3-line text-blue-700" aria-hidden />
          {balance?.known && balance.smsLeft !== null ? (
            <span>
              <span className="font-semibold tabular-nums text-gray-900">{num(balance.smsLeft)}</span>
              <span className="text-gray-500"> SMS left</span>
            </span>
          ) : (
            <span className="text-gray-600">{loading && !overview ? 'Checking balance…' : 'SMS balance'}</span>
          )}
          <i className="ri-arrow-right-s-line text-gray-400" aria-hidden />
        </Link>
      </div>

      {overview && !overview.configured && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <i className="ri-error-warning-line mt-0.5 text-lg text-amber-600" aria-hidden />
          <p>
            SMS sending is not set up on this server, so nothing can be sent from here. You can still check which orders would get a
            text.
          </p>
        </div>
      )}

      {notice && (
        <div
          role={notice.kind === 'error' ? 'alert' : 'status'}
          className={`flex flex-col gap-3 rounded-xl border p-4 text-sm sm:flex-row sm:items-center ${
            notice.kind === 'ok'
              ? 'border-green-100 bg-green-50 text-green-800'
              : notice.kind === 'warn'
                ? 'border-amber-200 bg-amber-50 text-amber-900'
                : 'border-red-100 bg-red-50 text-red-800'
          }`}
        >
          <i
            className={`text-lg ${
              notice.kind === 'ok' ? 'ri-checkbox-circle-fill text-green-600' : notice.kind === 'warn' ? 'ri-information-fill text-amber-600' : 'ri-error-warning-fill text-red-600'
            } hidden sm:block`}
            aria-hidden
          />
          <p className="flex-1">{notice.text}</p>
          {notice.action && (
            <Link href={notice.action.href} className="inline-flex h-9 items-center rounded-lg bg-blue-700 px-3 text-sm font-semibold text-white hover:bg-blue-800">
              {notice.action.label}
            </Link>
          )}
          <button type="button" onClick={() => setNotice(null)} className="self-end text-current opacity-60 hover:opacity-100 sm:self-auto" aria-label="Dismiss">
            <i className="ri-close-line" aria-hidden />
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          {/* 1. Range */}
          <section className={`${card} p-4 sm:p-5`}>
            <h2 className="font-semibold text-gray-900">1. Choose the orders</h2>
            <p className="mt-0.5 text-sm text-gray-500">Orders placed between these dates, up to 31 days.</p>

            <div className="mt-4 flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  disabled={running}
                  onClick={() => {
                    setFrom(dayKey(p.from));
                    setTo(dayKey(p.to));
                  }}
                  aria-pressed={presetActive(p)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
                    presetActive(p) ? 'border-blue-700 bg-blue-700 text-white' : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <label className="block text-sm font-medium text-gray-700">
                From
                <input type="date" className={`${inputCls} mt-1`} value={from} max={to} disabled={running} onChange={(e) => e.target.value && setFrom(e.target.value)} />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                To
                <input type="date" className={`${inputCls} mt-1`} value={to} min={from} max={dayKey(0)} disabled={running} onChange={(e) => e.target.value && setTo(e.target.value)} />
              </label>
              <div>
                <p className="text-sm font-medium text-gray-700">Orders from</p>
                <div className="mt-1 inline-flex w-full rounded-lg border border-gray-300 bg-gray-50 p-0.5 sm:w-auto" role="group" aria-label="Orders from">
                  {SOURCES.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      disabled={running}
                      onClick={() => setSource(s.value)}
                      aria-pressed={source === s.value}
                      className={`flex-1 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 sm:flex-none ${
                        source === s.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 border-t border-gray-100 pt-5">
              {loading && !overview ? (
                <div className="grid animate-pulse grid-cols-2 gap-2 sm:grid-cols-4" aria-busy="true" aria-label="Loading orders">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="h-16 rounded-lg bg-gray-100" />
                  ))}
                </div>
              ) : loadError ? (
                <div className="flex flex-col items-start gap-3 rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-800 sm:flex-row sm:items-center">
                  <p className="flex-1">{loadError}</p>
                  <button type="button" onClick={loadOverview} className="rounded-lg border border-red-200 bg-white px-3 py-1.5 font-medium text-red-800 hover:bg-red-50">
                    Try again
                  </button>
                </div>
              ) : overview ? (
                <div className={`space-y-4 transition-opacity ${loading ? 'opacity-60' : ''}`}>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Stat label="Orders in range" value={num(overview.orders.considered)} />
                    <Stat label="Will get a text" value={num(overview.orders.toSend)} />
                    <Stat label="Customers" value={num(overview.notice.customers)} />
                    <Stat label="Left out" value={num(overview.orders.skipped.reduce((s, k) => s + k.count, 0))} />
                  </div>

                  {overview.truncated && (
                    <p className="text-xs text-amber-800">Only the first 5,000 orders in this range are included. Choose a shorter range.</p>
                  )}

                  {overview.orders.considered === 0 ? (
                    <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center">
                      <i className="ri-inbox-line text-2xl text-gray-300" aria-hidden />
                      <p className="mt-1 text-sm font-medium text-gray-700">No orders in these dates</p>
                      <p className="text-xs text-gray-500">Pick a wider range or another order type.</p>
                    </div>
                  ) : (
                    <>
                      {overview.orders.kinds.length > 0 && (
                        <div>
                          <p className="mb-2 text-sm font-medium text-gray-700">Each customer gets the text for where their order is now</p>
                          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
                            {overview.orders.kinds.map((k) => (
                              <li key={k.kind}>
                                <button
                                  type="button"
                                  onClick={() => setOpenKind(openKind === k.kind ? null : k.kind)}
                                  aria-expanded={openKind === k.kind}
                                  className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-gray-50"
                                >
                                  <span className="text-gray-800">{k.label}</span>
                                  <span className="flex items-center gap-2">
                                    <span className="tabular-nums font-semibold text-gray-900">{num(k.count)}</span>
                                    <i className={`ri-arrow-down-s-line text-gray-400 transition-transform ${openKind === k.kind ? 'rotate-180' : ''}`} aria-hidden />
                                  </span>
                                </button>
                                {openKind === k.kind && (
                                  <div className="px-3 pb-3">
                                    <p className="rounded-lg bg-blue-50 p-3 text-sm leading-relaxed text-gray-800">{k.example}</p>
                                    <p className="mt-1 text-xs text-gray-500">Example. Each customer sees their own name and order number.</p>
                                  </div>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {overview.orders.skipped.length > 0 && (
                        <p className="text-xs text-gray-500">
                          Left out: {overview.orders.skipped.map((s) => `${s.label.toLowerCase()} (${num(s.count)})`).join(', ')}.
                        </p>
                      )}
                    </>
                  )}

                  {overview.batch.exists && (
                    <p className="flex items-start gap-2 rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
                      <i className="ri-history-line mt-px" aria-hidden />
                      <span>
                        You have sent texts for these dates before
                        {overview.batch.lastAttemptAt ? ` (last ${when(overview.batch.lastAttemptAt)})` : ''}. Sending again only sends the
                        ones that have not gone out.
                      </span>
                    </p>
                  )}
                </div>
              ) : null}
            </div>
          </section>

          {/* 2. Order texts */}
          <section className={`${card} p-4 sm:p-5`}>
            <h2 className="font-semibold text-gray-900">2. Send the order texts</h2>
            <p className="mb-4 mt-0.5 text-sm text-gray-500">
              {overview && overview.orders.toSend > 0
                ? `Uses about ${estimate(Math.ceil(ordersOutstanding * avgOrderParts))} for the ${num(ordersOutstanding)} still to send.`
                : 'One text per order, sent in small groups.'}
            </p>
            {phaseCard('orders')}
          </section>

          {/* 3. Notice */}
          <section className={`${card} p-4 sm:p-5`}>
            <h2 className="font-semibold text-gray-900">3. Send a notice to customers (optional)</h2>
            <p className="mt-0.5 text-sm text-gray-500">
              One text to each customer in this range, for example an apology for late updates. Customers with several orders get it once.
            </p>
            <div className="mt-4">
              <div className="flex items-baseline justify-between">
                <label htmlFor="notice" className="text-sm font-medium text-gray-700">
                  Notice text
                </label>
                <span className={`text-xs tabular-nums ${noticeTooLong ? 'text-red-700' : 'text-gray-400'}`}>
                  {noticeText.trim().length}/{NOTICE_MAX_LENGTH} · {noticeParts} SMS part{noticeParts === 1 ? '' : 's'} each
                </span>
              </div>
              <textarea
                id="notice"
                rows={4}
                className={`${inputCls} mt-1 resize-y`}
                value={noticeText}
                disabled={running}
                onChange={(e) => setNoticeText(e.target.value)}
              />
              <div className="mt-1 flex flex-wrap justify-between gap-2 text-xs text-gray-500">
                <span>
                  {noticeParts > 1
                    ? 'Over 160 letters, or special signs like ₵ or emoji, make a text use more than one SMS credit.'
                    : 'Fits in one SMS.'}
                </span>
                {noticeText !== DEFAULT_NOTICE && !running && (
                  <button type="button" onClick={() => setNoticeText(DEFAULT_NOTICE)} className="font-medium text-blue-700 hover:underline">
                    Reset to the standard text
                  </button>
                )}
              </div>
            </div>
            <div className="mt-4">{phaseCard('apology')}</div>
          </section>

          {/* Message list */}
          {overview?.batch.exists && (
            <section className={card}>
              <div className="flex flex-col gap-3 border-b border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                <h2 className="font-semibold text-gray-900">Every text</h2>
                <div className="inline-flex rounded-lg border border-gray-300 bg-gray-50 p-0.5" role="group" aria-label="Which texts">
                  {(['orders', 'apology'] as Phase[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setListPhase(p)}
                      aria-pressed={listPhase === p}
                      className={`rounded-md px-3 py-1.5 text-sm font-medium ${listPhase === p ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                    >
                      {p === 'orders' ? 'Order texts' : 'Notice'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 overflow-x-auto px-4 pt-3 sm:px-5" role="group" aria-label="Filter by status">
                {FILTERS.map((f) => {
                  const c = (listPhase === 'orders' ? orderCounts : noticeCounts) as Counts;
                  const n = f.value ? c[f.value] || 0 : Object.values(c).reduce((s, v) => s + v, 0);
                  return (
                    <button
                      key={f.label}
                      type="button"
                      onClick={() => setListFilter(f.value)}
                      aria-pressed={listFilter === f.value}
                      className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${
                        listFilter === f.value ? 'border-blue-700 bg-blue-700 text-white' : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      {f.label} <span className="tabular-nums opacity-75">{num(n)}</span>
                    </button>
                  );
                })}
              </div>

              <ul className={`mt-3 divide-y divide-gray-100 border-t border-gray-100 ${messagesLoading && messages.length ? 'opacity-70' : ''}`}>
                {messages.length === 0 ? (
                  <li className="px-5 py-10 text-center text-sm text-gray-500">
                    {messagesLoading ? 'Loading texts…' : listPhase === 'apology' && !Object.keys(noticeCounts).length ? 'No notice sent for these dates yet.' : 'No texts here.'}
                  </li>
                ) : (
                  messages.map((m) => (
                    <li key={m.id} className="px-4 py-3 sm:px-5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2 text-sm">
                          {m.order_number && <span className="font-semibold text-gray-900">#{m.order_number}</span>}
                          <span className="tabular-nums text-gray-600">{formatPhone(m.phone)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {m.attempts > 1 && <span className="text-xs text-gray-400">{m.attempts} tries</span>}
                          <StatusBadge status={m.status} />
                        </div>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-gray-500" title={m.message}>
                        {m.message}
                      </p>
                      {m.error_message && m.status !== 'sent' && <p className="mt-1 text-xs text-red-700">{m.error_message}</p>}
                    </li>
                  ))
                )}
              </ul>

              {messagesTotal > PAGE_SIZE && (
                <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-sm sm:px-5">
                  <span className="text-gray-500">
                    {num(page * PAGE_SIZE + 1)}–{num(Math.min(messagesTotal, (page + 1) * PAGE_SIZE))} of {num(messagesTotal)}
                  </span>
                  <div className="flex gap-2">
                    <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-gray-300 px-3 py-1.5 disabled:opacity-40">
                      Previous
                    </button>
                    <button
                      type="button"
                      disabled={(page + 1) * PAGE_SIZE >= messagesTotal}
                      onClick={() => setPage((p) => p + 1)}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>

        {/* Side: test + balance */}
        <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <section className={`${card} p-4 sm:p-5`}>
            <h2 className="font-semibold text-gray-900">Test on your phone</h2>
            <p className="mt-0.5 text-sm text-gray-500">Send one text to your own phone to check the wording.</p>
            <div className="mt-4 grid grid-cols-2 gap-1 rounded-lg border border-gray-300 bg-gray-50 p-0.5" role="group" aria-label="Which text to test">
              {(['order', 'notice'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setTestKind(k)}
                  aria-pressed={testKind === k}
                  className={`rounded-md px-3 py-2 text-sm font-medium ${testKind === k ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  {k === 'order' ? 'Order text' : 'Notice'}
                </button>
              ))}
            </div>
            <label htmlFor="test-phone" className="mt-3 block text-sm font-medium text-gray-700">
              Phone number
            </label>
            <input
              id="test-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="024 123 4567"
              className={`${inputCls} mt-1`}
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && testPhone.trim() && !testing && sendTest()}
            />
            <button
              type="button"
              disabled={!testPhone.trim() || testing || (testKind === 'order' && !overview?.orders.toSend) || (testKind === 'notice' && noticeTooLong)}
              onClick={sendTest}
              className={`${secondaryBtn} mt-3 w-full`}
            >
              <i className={testing ? 'ri-loader-4-line animate-spin' : 'ri-smartphone-line'} aria-hidden />
              {testing ? 'Sending test…' : 'Send test'}
            </button>
            {testKind === 'order' && overview && overview.orders.toSend === 0 && (
              <p className="mt-2 text-xs text-gray-500">There is no order text in this range to test with.</p>
            )}
            {testResult && (
              <p
                role="status"
                className={`mt-3 flex gap-2 rounded-lg p-3 text-sm ${testResult.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}
              >
                <i className={testResult.ok ? 'ri-check-line' : 'ri-error-warning-line'} aria-hidden />
                {testResult.text}
              </p>
            )}
          </section>

          <section className={`${card} p-4 text-sm text-gray-600 sm:p-5`}>
            <h2 className="font-semibold text-gray-900">How it works</h2>
            <ul className="mt-2 space-y-2">
              <li className="flex gap-2">
                <i className="ri-shield-check-line mt-0.5 text-blue-700" aria-hidden />
                Each order and each customer is texted at most once for these dates, even if you press send again.
              </li>
              <li className="flex gap-2">
                <i className="ri-stack-line mt-0.5 text-blue-700" aria-hidden />
                Texts go out {RUN_BATCH} at a time. You can pause and continue later.
              </li>
              <li className="flex gap-2">
                <i className="ri-wallet-3-line mt-0.5 text-blue-700" aria-hidden />
                Sending stops by itself if the SMS balance runs out. Nothing is lost; continue after buying more.
              </li>
            </ul>
            {balance?.error && <p className="mt-3 text-xs text-amber-800">Could not read the SMS balance: {balance.error}</p>}
          </section>
        </aside>
      </div>

      {/* Confirm */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <div className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl sm:p-6" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
            <h3 id="confirm-title" className="text-lg font-bold text-gray-900">
              {confirm.retry
                ? `Retry ${num(confirm.count)} failed text${confirm.count === 1 ? '' : 's'}?`
                : confirm.phase === 'orders'
                  ? `Send ${num(confirm.count)} order text${confirm.count === 1 ? '' : 's'}?`
                  : `Send the notice to ${num(confirm.count)} customer${confirm.count === 1 ? '' : 's'}?`}
            </h3>
            <dl className="mt-4 space-y-2 rounded-lg bg-gray-50 p-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-gray-600">Dates</dt>
                <dd className="text-right font-medium text-gray-900">
                  {from === to ? from : `${from} to ${to}`}
                  {source !== 'all' ? ` · ${source === 'pos' ? 'POS' : 'Website'}` : ''}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-gray-600">Texts</dt>
                <dd className="font-medium tabular-nums text-gray-900">{num(confirm.count)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-gray-600">Uses about</dt>
                <dd className="text-right font-medium text-gray-900">{estimate(confirm.parts)}</dd>
              </div>
              {balance?.known && balance.smsLeft !== null && (
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-600">Balance</dt>
                  <dd className={`font-medium tabular-nums ${balance.smsLeft < confirm.parts ? 'text-red-700' : 'text-gray-900'}`}>{num(balance.smsLeft)} SMS</dd>
                </div>
              )}
            </dl>
            {balance?.known && balance.smsLeft !== null && balance.smsLeft < confirm.parts && (
              <p className="mt-3 flex gap-2 text-sm text-amber-900">
                <i className="ri-error-warning-line mt-0.5 text-amber-600" aria-hidden />
                Your balance is not enough for all of them. Sending will stop when it runs out, and you can continue after buying more.
              </p>
            )}
            {confirm.phase === 'apology' && !confirm.retry && (
              <p className="mt-3 rounded-lg border border-gray-200 p-3 text-sm text-gray-700">{noticeText.trim() || DEFAULT_NOTICE}</p>
            )}
            <p className="mt-3 text-xs text-gray-500">Texts cannot be taken back once sent. Keep this page open until it finishes.</p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setConfirm(null)} className={secondaryBtn}>
                Cancel
              </button>
              <button type="button" onClick={() => startSending(confirm.phase, confirm.retry, confirm.count)} className={primaryBtn} autoFocus>
                <i className="ri-send-plane-2-line" aria-hidden />
                Yes, send {num(confirm.count)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
