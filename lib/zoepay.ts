import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Zoe Pay (zoepayhub.com): Mobile Money (MTN, Telecel, AirtelTigo) or card on Zoe Pay's hosted page.
 * Test or live is decided by the key (zoe_test_… / zoe_live_…).
 *
 *  - create:  POST {base}/api/v1/payments   amounts in cedis; Zoe adds its fee on top
 *  - status:  GET  {base}/api/v1/payments/{clientReference}
 *  - webhook: X-Zoe-Signature: t=<unix>,v1=<hex HMAC-SHA256 of `${t}.${rawBody}`>
 *
 * The webhook is only a nudge: every payment is re-read from Zoe Pay before an order is marked paid.
 */

export type ZoeStatus = 'created' | 'pending' | 'success' | 'failed' | 'cancelled' | 'expired';
export type ZoePayment = {
  reference: string;
  clientReference: string;
  status: ZoeStatus;
  environment: string;
  currency: string;
  amount: { base: number; fee: number; total: number };
  checkoutUrl: string;
  paymentMethod: string | null;
  paidAt: string | null;
};

export function zoeConfig() {
  const secretKey = process.env.ZOE_SECRET_KEY?.trim();
  if (!secretKey) return null;
  return {
    secretKey,
    webhookSecret: process.env.ZOE_WEBHOOK_SECRET?.trim() || '',
    base: (process.env.ZOE_API_BASE?.trim() || 'https://zoepayhub.com').replace(/\/+$/, ''),
  };
}

export const zoeEnabled = () => zoeConfig() !== null;

type Envelope<T> = { success?: boolean; data?: T; error?: { message?: string } | string | null; message?: string };

async function zoeFetch<T>(path: string, init: RequestInit & { idempotencyKey?: string } = {}) {
  const cfg = zoeConfig();
  if (!cfg) return { ok: false as const, message: 'Zoe Pay is not set up.' };
  const headers: Record<string, string> = { Authorization: `Bearer ${cfg.secretKey}`, Accept: 'application/json' };
  if (init.body) headers['Content-Type'] = 'application/json';
  if (init.idempotencyKey) headers['Idempotency-Key'] = init.idempotencyKey;
  try {
    const res = await fetch(`${cfg.base}${path}`, { ...init, headers, cache: 'no-store', signal: AbortSignal.timeout(20_000) });
    const json = (await res.json().catch(() => ({}))) as Envelope<T>;
    const message = typeof json.error === 'string' ? json.error : json.error?.message || json.message;
    if (res.ok && json.success !== false && json.data) return { ok: true as const, data: json.data };
    return { ok: false as const, message: message || `Zoe Pay answered ${res.status}` };
  } catch (err) {
    console.error('[ZoePay] request failed', path, err instanceof Error ? err.message : err);
    return { ok: false as const, message: 'Could not reach Zoe Pay.' };
  }
}

export function verifyZoeSignature(rawBody: string, header: string | null, secret: string, toleranceSeconds = 300): boolean {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(',').map((p) => p.trim().split('=') as [string, string]));
  const t = Number(parts.t);
  const v1 = parts.v1;
  if (!Number.isFinite(t) || !v1 || !/^[0-9a-f]+$/i.test(v1)) return false;
  if (Math.abs(Date.now() / 1000 - t) > toleranceSeconds) return false;
  const expected = createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(v1, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

/** 233XXXXXXXXX for a Ghana number, or null. */
export function toMsisdn(phone: string | null | undefined): string | null {
  const d = String(phone || '').replace(/\D/g, '');
  if (/^233\d{9}$/.test(d)) return d;
  if (/^0\d{9}$/.test(d)) return `233${d.slice(1)}`;
  if (/^\d{9}$/.test(d)) return `233${d}`;
  return null;
}

export async function createZoePayment(input: {
  clientReference: string;
  amount: number;
  description: string;
  customer: { name: string; email: string; phone: string };
  returnUrl: string;
  cancellationUrl: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
}) {
  return zoeFetch<ZoePayment>('/api/v1/payments', {
    method: 'POST',
    idempotencyKey: input.clientReference,
    body: JSON.stringify({ ...input, currency: 'GHS' }),
  });
}

/**
 * Asks Zoe Pay about one payment attempt. Paid only when Zoe reports success and the base
 * amount (before Zoe's fee) matches the order total.
 */
export async function checkZoePayment(clientReference: string, expectedAmount: number) {
  const res = await zoeFetch<ZoePayment>(`/api/v1/payments/${encodeURIComponent(clientReference)}`, { method: 'GET' });
  if (!res.ok) return { paid: false as const, status: 'unknown' as const, message: res.message };
  const z = res.data;
  const amountOk = Math.abs(Number(z.amount?.base) - expectedAmount) <= 0.01;
  if (z.status === 'success' && !amountOk) {
    console.error(`[ZoePay] amount mismatch for ${clientReference}: expected ${expectedAmount}, got ${z.amount?.base}`);
  }
  return { paid: z.status === 'success' && amountOk, status: z.status, payment: z };
}
