import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkRateLimit, getClientIdentifier } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Newsletter signup. Subscribers are kept as customers tagged 'newsletter',
 * so Admin → Notifications can reach them with the "Newsletter Subscribers" audience.
 */
export async function POST(request: Request) {
  const limit = checkRateLimit(`newsletter:${getClientIdentifier(request)}`, { maxRequests: 5, windowSeconds: 3600 });
  if (!limit.success) {
    return NextResponse.json({ error: 'Too many sign-ups. Please try again later.' }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }

  const { data: existing, error: findError } = await supabaseAdmin
    .from('customers')
    .select('id, tags')
    .eq('email', email)
    .maybeSingle();
  if (findError) {
    console.error('[Newsletter] Lookup failed:', findError.message);
    return NextResponse.json({ error: 'Could not sign you up right now. Please try again.' }, { status: 500 });
  }

  const result = existing
    ? (existing.tags || []).includes('newsletter')
      ? { error: null }
      : await supabaseAdmin
          .from('customers')
          .update({ tags: [...(existing.tags || []), 'newsletter'], updated_at: new Date().toISOString() })
          .eq('id', existing.id)
    : await supabaseAdmin.from('customers').insert({ email, tags: ['newsletter'] });

  if (result.error) {
    console.error('[Newsletter] Save failed:', result.error.message);
    return NextResponse.json({ error: 'Could not sign you up right now. Please try again.' }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
