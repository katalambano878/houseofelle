'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useRecaptcha } from '@/hooks/useRecaptcha';

/** Only same-site paths ("/account", not "//evil.com" or "https://…") are allowed. */
function safeRedirect(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return '/account';
  return value;
}

const fieldBase =
  'w-full h-[54px] px-[18px] rounded-[16px] bg-[#FBF6EF] text-[16px] text-[#1F1115] placeholder:text-[#8A7479] outline-none transition-shadow motion-reduce:transition-none';
const field = `${fieldBase} shadow-[inset_0_0_0_1px_rgba(31,17,21,0.18)] focus:shadow-[inset_0_0_0_1.5px_#2B0B12]`;
const fieldBad = `${fieldBase} shadow-[inset_0_0_0_1.5px_#7A1F2E]`;

export default function LoginPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [redirectTo, setRedirectTo] = useState('/account');

  useEffect(() => {
    // Read on the client to avoid a Suspense boundary for useSearchParams.
    setRedirectTo(safeRedirect(new URLSearchParams(window.location.search).get('redirect')));
  }, []);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<any>({});
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const { getToken, verifying } = useRecaptcha();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setAuthError('');
    setIsLoading(true);

    // Validation
    const newErrors: any = {};
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }
    if (!formData.password) {
      newErrors.password = 'Password is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setIsLoading(false);
      return;
    }

    // reCAPTCHA verification
    const isHuman = await getToken('login');
    if (!isHuman) {
      setAuthError('Security verification failed. Please try again.');
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (error) {
        throw error;
      }

      if (data.session) {
        router.push(redirectTo);
        router.refresh(); // Refresh to update auth state in other components
      }
    } catch (error: any) {
      console.error('Login error:', error);
      setAuthError(error.message || 'Failed to sign in. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="grid lg:grid-cols-2 min-h-[calc(100vh-80px)] bg-[#F1E8DC] text-[#1F1115]">
      <div className="relative overflow-hidden bg-[#2B0B12] min-h-[260px] sm:min-h-[320px] lg:min-h-0">
        <Image
          src="/Whisk_a23750058b309cf9155424b5e8ea85dcdr.jpeg"
          alt="Amber perfume bottles lit from behind"
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-cover opacity-85"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#2B0B12]/80 via-transparent to-[#2B0B12]/30" aria-hidden="true" />
        <Link href="/" aria-label="House of Elle home" className="absolute top-6 left-5 sm:top-10 sm:left-12 inline-flex min-h-[44px] items-center">
          <Image src="/house-of-elle-logo.png" alt="House of Elle" width={368} height={137} className="h-9 sm:h-[46px] w-auto brightness-0 invert-[.94] sepia-[.2]" />
        </Link>
        <p className="absolute left-5 right-5 bottom-8 sm:left-12 sm:right-12 sm:bottom-14 font-serif text-[30px] sm:text-[40px] leading-none text-[#F6EDE3] text-balance">
          Luxury fragrances for <em className="text-[#E5B65A]">everyone.</em>
        </p>
      </div>

      <div className="flex items-center justify-center px-5 sm:px-8 lg:px-12 py-12 md:py-16">
        <div className="w-full max-w-[420px] flex flex-col gap-[22px]">
          <div className="flex flex-col gap-2">
            <h1 className="font-serif text-[40px] md:text-[48px] leading-none tracking-[-0.02em]">Welcome <em>back</em></h1>
            <p className="text-[15px] text-[#6B565B]">Sign in to track orders and see saved scents.</p>
          </div>

          {authError && (
            <p role="alert" className="rounded-2xl bg-[#F6DCD7] text-[#7A1F2E] px-4 py-3 text-sm">
              {authError}
            </p>
          )}

          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-[22px]">
            <div className="flex flex-col gap-2">
              <label htmlFor="login-email" className="text-[14px] font-semibold">Email</label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? 'login-email-error' : undefined}
                className={`${errors.email ? fieldBad : field}`}
                placeholder="you@example.com"
              />
              {errors.email && <p id="login-email-error" className="text-[13px] text-[#7A1F2E]">{errors.email}</p>}
            </div>

            <div className="flex flex-col gap-2">
              <span className="flex items-baseline justify-between gap-4">
                <label htmlFor="login-password" className="text-[14px] font-semibold">Password</label>
                <Link href="/auth/forgot-password" className="inline-flex items-center min-h-[44px] -my-3 text-[13px] text-[#6B565B] underline underline-offset-[3px] hover:text-[#1F1115]">
                  Forgot it?
                </Link>
              </span>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? 'login-password-error' : undefined}
                  className={`${errors.password ? fieldBad : field} pr-14`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  className="absolute right-1 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full inline-flex items-center justify-center text-[#6B565B] hover:text-[#1F1115]"
                >
                  <i className={`${showPassword ? 'ri-eye-off-line' : 'ri-eye-line'} text-xl`} aria-hidden="true"></i>
                </button>
              </div>
              {errors.password && <p id="login-password-error" className="text-[13px] text-[#7A1F2E]">{errors.password}</p>}
            </div>

            <button
              type="submit"
              disabled={isLoading || verifying}
              className="min-h-[56px] rounded-full bg-[#2B0B12] text-[#F6EDE3] text-[16px] font-bold hover:bg-[#4A1520] transition-colors motion-reduce:transition-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading || verifying ? (
                <span className="flex items-center justify-center gap-2">
                  <i className="ri-loader-4-line animate-spin motion-reduce:animate-none" aria-hidden="true"></i> {verifying ? 'Verifying…' : 'Signing in…'}
                </span>
              ) : 'Sign in'}
            </button>
          </form>

          <p className="text-center text-[14px] text-[#6B565B]">
            New here?{' '}
            <Link href={redirectTo === '/account' ? '/auth/signup' : `/auth/signup?redirect=${encodeURIComponent(redirectTo)}`} className="font-bold text-[#1F1115] underline underline-offset-[3px]">
              Create an account
            </Link>
          </p>

          <div className="mt-3 flex flex-col gap-2.5 p-5 rounded-[18px] bg-[#FBF6EF] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.1)]">
            <span className="font-serif text-[20px]">No account needed</span>
            <span className="text-[14px] leading-[1.55] text-[#4D3A3F]">You can check out as a guest, and track any order with the number we send by SMS.</span>
            <Link href="/order-tracking" className="self-start inline-flex items-center min-h-[44px] text-[14px] font-bold">
              <span className="shadow-[inset_0_-1px_0_currentColor] pb-0.5">Track an order</span>
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
