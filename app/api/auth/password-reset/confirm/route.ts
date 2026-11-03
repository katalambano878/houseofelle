import { NextResponse } from 'next/server';
import { resetPasswordWithToken } from '@/lib/db/auth';
import { isPlainPostgres } from '@/lib/db/mode';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  const limit = checkRateLimit(`reset-confirm:${getClientIdentifier(request)}`, RATE_LIMITS.login);
  if (!limit.success) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  }
  if (!isPlainPostgres()) {
    return NextResponse.json({ error: 'Password reset is not available right now.' }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const token = typeof body?.token === 'string' ? body.token : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!token) {
    return NextResponse.json({ error: 'This reset link is incomplete. Request a new one.' }, { status: 400 });
  }
  if (password.length < 8 || password.length > 200) {
    return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
  }

  const result = await resetPasswordWithToken(token, password);
  if (!result.ok) {
    return NextResponse.json({ error: result.error || 'Could not reset your password.' }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
