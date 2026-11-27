import { NextResponse } from 'next/server';
import { zoeEnabled } from '@/lib/zoepay';

export const dynamic = 'force-dynamic';

/** Which payment options the checkout can offer right now. Zoe Pay shows only once its key is on the server. */
export async function GET() {
  const moolre = !!(process.env.MOOLRE_API_USER && process.env.MOOLRE_API_PUBKEY && process.env.MOOLRE_ACCOUNT_NUMBER);
  return NextResponse.json({ moolre, zoepay: zoeEnabled() });
}
