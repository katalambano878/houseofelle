'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRecaptcha } from '@/hooks/useRecaptcha';

const field =
  'w-full h-[54px] px-[18px] rounded-[16px] bg-white text-[16px] text-[#1F1115] placeholder:text-[#8A7479] outline-none transition-shadow motion-reduce:transition-none';
const fieldOk = 'shadow-[inset_0_0_0_1px_rgba(31,17,21,0.18)] focus:shadow-[inset_0_0_0_1.5px_#2B0B12]';
const fieldBad = 'shadow-[inset_0_0_0_1.5px_#7A1F2E]';
const primary =
  'inline-flex items-center justify-center min-h-[56px] px-7 rounded-full bg-[#2B0B12] text-[#F6EDE3] text-[16px] font-bold hover:bg-[#4A1520] transition-colors motion-reduce:transition-none disabled:opacity-50 disabled:cursor-not-allowed';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { getRawToken, verifying } = useRecaptcha();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!email) {
      setError('Email is required');
      setIsLoading(false);
      return;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email');
      setIsLoading(false);
      return;
    }

    // reCAPTCHA token is checked by the API route
    const recaptchaToken = await getRawToken('forgot_password');
    if (recaptchaToken === null) {
      setError('Security verification failed. Please try again.');
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, recaptchaToken }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(result.error || 'Could not send the reset email. Please try again.');
        return;
      }
      setIsSubmitted(true);
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <main className="min-h-[calc(100vh-80px)] bg-[#F1E8DC] text-[#1F1115] flex items-center justify-center px-5 sm:px-8 py-14 md:py-20">
        <div role="status" className="w-full max-w-[460px] flex flex-col items-start gap-5 p-7 md:p-9 rounded-[24px] bg-[#FBF6EF] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.1)]">
          <span className="w-14 h-14 rounded-full bg-[#2B0B12] text-[#D9A441] inline-flex items-center justify-center">
            <i className="ri-mail-send-line text-2xl" aria-hidden="true"></i>
          </span>
          <h1 className="font-serif text-[34px] md:text-[40px] leading-none tracking-[-0.02em]">Check your <em>email</em></h1>
          <p className="text-[15px] leading-relaxed text-[#4D3A3F]">
            If an account exists for <strong className="text-[#1F1115]">{email}</strong>, we&apos;ve sent it a link to choose a new password.
          </p>
          <p className="text-[14px] leading-relaxed text-[#6B565B]">
            The link expires in 1 hour. If it doesn&apos;t arrive within a few minutes, check your spam folder.
          </p>
          <Link href="/auth/login" className={primary}>Back to sign in</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-80px)] bg-[#F1E8DC] text-[#1F1115] flex items-center justify-center px-5 sm:px-8 py-14 md:py-20">
      <div className="w-full max-w-[460px] flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="font-serif text-[40px] md:text-[48px] leading-none tracking-[-0.02em]">Forgot your <em>password?</em></h1>
          <p className="text-[15px] text-[#6B565B]">Enter your email and we&apos;ll send you a link to reset it.</p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5 p-6 md:p-8 rounded-[24px] bg-[#FBF6EF] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.1)]">
          <div className="flex flex-col gap-2">
            <label htmlFor="fp-email" className="text-[14px] font-semibold">Email</label>
            <input
              id="fp-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!error}
              aria-describedby={error ? 'fp-email-error' : undefined}
              className={`${field} ${error ? fieldBad : fieldOk}`}
              placeholder="you@example.com"
            />
            {error && <p id="fp-email-error" role="alert" className="text-[13px] text-[#7A1F2E]">{error}</p>}
          </div>

          <button type="submit" disabled={isLoading || verifying} className={primary}>
            {isLoading || verifying ? (verifying ? 'Verifying…' : 'Sending…') : 'Send reset link'}
          </button>
        </form>

        <p className="text-center text-[14px] text-[#6B565B]">
          Remember it?{' '}
          <Link href="/auth/login" className="font-bold text-[#1F1115] underline underline-offset-[3px]">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
