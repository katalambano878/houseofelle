'use client';

import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import PasswordStrengthMeter from '@/components/PasswordStrengthMeter';

const field =
  'w-full h-[54px] px-[18px] rounded-[16px] bg-white text-[16px] text-[#1F1115] outline-none shadow-[inset_0_0_0_1px_rgba(31,17,21,0.18)] focus:shadow-[inset_0_0_0_1.5px_#2B0B12] transition-shadow motion-reduce:transition-none';
const primary =
  'inline-flex items-center justify-center min-h-[56px] px-7 rounded-full bg-[#2B0B12] text-[#F6EDE3] text-[16px] font-bold hover:bg-[#4A1520] transition-colors motion-reduce:transition-none disabled:opacity-50 disabled:cursor-not-allowed';
const card = 'flex flex-col items-start gap-5 p-7 md:p-9 rounded-[24px] bg-[#FBF6EF] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.1)]';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/password-reset/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(result.error || 'Could not reset your password. Request a new link.');
        return;
      }
      setDone(true);
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className={card}>
        <h1 className="font-serif text-[34px] md:text-[40px] leading-none tracking-[-0.02em]">Reset link <em>missing</em></h1>
        <p className="text-[15px] leading-relaxed text-[#4D3A3F]">Open the link from your email again, or request a new one.</p>
        <Link href="/auth/forgot-password" className={primary}>Request a new link</Link>
      </div>
    );
  }

  if (done) {
    return (
      <div role="status" className={card}>
        <span className="w-14 h-14 rounded-full bg-[#DDE7D6] text-[#244A2C] inline-flex items-center justify-center">
          <i className="ri-check-line text-2xl" aria-hidden="true"></i>
        </span>
        <h1 className="font-serif text-[34px] md:text-[40px] leading-none tracking-[-0.02em]">Password <em>updated</em></h1>
        <p className="text-[15px] leading-relaxed text-[#4D3A3F]">You can now sign in with your new password.</p>
        <Link href="/auth/login" className={primary}>Sign in</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-serif text-[40px] md:text-[48px] leading-none tracking-[-0.02em]">Choose a new <em>password</em></h1>
        <p className="text-[15px] text-[#6B565B]">Use at least 8 characters.</p>
      </div>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5 p-6 md:p-8 rounded-[24px] bg-[#FBF6EF] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.1)]">
        <div className="flex flex-col gap-2">
          <label htmlFor="new-password" className="text-[14px] font-semibold">New password</label>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={field}
          />
          <PasswordStrengthMeter password={password} />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="confirm-password" className="text-[14px] font-semibold">Confirm new password</label>
          <input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={field}
          />
        </div>
        {error && <p role="alert" className="rounded-2xl bg-[#F6DCD7] text-[#7A1F2E] px-4 py-3 text-sm">{error}</p>}
        <button type="submit" disabled={isLoading} className={primary}>
          {isLoading ? 'Saving…' : 'Save new password'}
        </button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="min-h-[calc(100vh-80px)] bg-[#F1E8DC] text-[#1F1115] flex items-center justify-center px-5 sm:px-8 py-14 md:py-20">
      <div className="w-full max-w-[460px]">
        <Suspense fallback={<p className="text-center text-[15px] text-[#6B565B]">Loading…</p>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </main>
  );
}
