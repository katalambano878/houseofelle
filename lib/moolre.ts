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
 * Uses Moolre's Payment Status API (POST /open/transact/status, idtype 1 = our externalref).
 * Returns true only when Moolre reports txstatus 1 (successful) with a matching amount.
 */
export async function confirmMoolrePayment(externalref: string, expectedAmount: number): Promise<boolean> {
  if (!process.env.MOOLRE_API_USER || !process.env.MOOLRE_API_PUBKEY || !process.env.MOOLRE_ACCOUNT_NUMBER || !externalref) return false;
  try {
    const res = await fetch('https://api.moolre.com/open/transact/status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-USER': process.env.MOOLRE_API_USER,
        'X-API-PUBKEY': process.env.MOOLRE_API_PUBKEY,
      },
      body: JSON.stringify({ type: 1, idtype: '1', id: externalref, accountnumber: process.env.MOOLRE_ACCOUNT_NUMBER }),
      cache: 'no-store',
    });
    const result = await res.json().catch(() => null);
    // txstatus: 1 = successful, 0 = pending, 2 = failed (3 = no such transaction).
    const paid = String(result?.status) === '1' && String(result?.data?.txstatus) === '1';
    if (!paid) return false;
    const amount = parseFloat(result?.data?.amount);
    return Number.isFinite(amount) && Math.abs(amount - expectedAmount) <= 0.01;
  } catch (err) {
    console.warn('[Moolre] Status check failed:', err instanceof Error ? err.message : err);
    return false;
  }
}
