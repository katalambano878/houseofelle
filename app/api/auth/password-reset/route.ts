import { NextResponse } from 'next/server';
import { createPasswordResetToken } from '@/lib/db/auth';
import { isPlainPostgres } from '@/lib/db/mode';
import { emailLayout, sendEmail } from '@/lib/notifications';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';
import { verifyRecaptcha } from '@/lib/recaptcha';
import { escapeHtml } from '@/lib/sanitize';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Emails a one-hour reset link. Always answers the same way so it can't be used to find accounts. */
export async function POST(request: Request) {
  const limit = checkRateLimit(`reset:${getClientIdentifier(request)}`, RATE_LIMITS.passwordReset);
  if (!limit.success) {
    return NextResponse.json({ error: 'Too many reset requests. Try again later.' }, { status: 429 });
  }
  if (!isPlainPostgres()) {
    return NextResponse.json({ error: 'Password reset is not available right now.' }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }

  const captcha = await verifyRecaptcha(String(body?.recaptchaToken || ''), 'forgot_password');
  if (!captcha.success) {
    return NextResponse.json({ error: 'Security check failed. Please try again.' }, { status: 403 });
  }

  try {
    const reset = await createPasswordResetToken(email);
    if (reset) {
      const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin).replace(/\/+$/, '');
      const link = `${baseUrl}/auth/reset-password?token=${encodeURIComponent(reset.token)}`;
      const name = reset.name ? escapeHtml(reset.name) : 'there';
      await sendEmail({
        to: reset.email,
        subject: 'Reset your password',
        html: emailLayout(
          `<h2 style="margin:0 0 16px;color:#111827;font-size:22px;">Reset your password</h2>
<p style="color:#374151;font-size:14px;line-height:1.7;">Hi ${name}, we got a request to reset the password on your account.</p>
<p style="margin:24px 0;"><a href="${link}" style="background:#111827;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Choose a new password</a></p>
<p style="color:#6b7280;font-size:13px;line-height:1.6;">The link works once and expires in 1 hour. If you didn't ask for this, you can ignore this email.</p>`,
          'Reset your password'
        ),
      });
    }
  } catch (err) {
    console.error('[Password reset] Failed to start reset:', err instanceof Error ? err.message : err);
  }

  return NextResponse.json({ success: true });
}
