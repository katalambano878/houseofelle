import { timingSafeEqual } from 'crypto';

/** Constant-time string compare for webhook secrets. */
export function secretsMatch(given: unknown, expected: string): boolean {
  if (typeof given !== 'string' || !expected) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Asks Moolre whether a payment reference was paid in full.
 * Returns true only on an explicit success (with a matching amount when Moolre reports one).
 */
export async function confirmMoolrePayment(externalref: string, expectedAmount: number): Promise<boolean> {
  if (!process.env.MOOLRE_API_USER || !process.env.MOOLRE_API_PUBKEY || !externalref) return false;
  try {
    const res = await fetch('https://api.moolre.com/embed/status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-USER': process.env.MOOLRE_API_USER,
        'X-API-PUBKEY': process.env.MOOLRE_API_PUBKEY,
      },
      body: JSON.stringify({ externalref }),
      cache: 'no-store',
    });
    const result = await res.json().catch(() => null);
    const status = String(result?.data?.status || '').toLowerCase();
    const paid =
      result?.status === 1 &&
      ['success', 'successful', 'completed', 'paid'].includes(status);
    if (!paid) return false;
    // The reference was created server-side for exactly this order total, so a
    // missing amount is acceptable; a different amount is not.
    const amount = parseFloat(result?.data?.amount);
    return !Number.isFinite(amount) || Math.abs(amount - expectedAmount) <= 0.01;
  } catch (err) {
    console.warn('[Moolre] Status check failed:', err instanceof Error ? err.message : err);
    return false;
  }
}
