'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import PasswordStrengthMeter from '@/components/PasswordStrengthMeter';
import { supabase } from '@/lib/supabase';
import { useRecaptcha } from '@/hooks/useRecaptcha';

function getFriendlyError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('email rate limit exceeded') || lower.includes('over_email_send_rate_limit')) {
    return 'Our system is experiencing high demand. Please wait a few minutes and try again, or contact us for help.';
  }
  if (lower.includes('user already registered') || lower.includes('already been registered')) {
    return 'An account with this email already exists. Try signing in instead.';
  }
  if (lower.includes('password') && lower.includes('weak')) {
    return 'Your password is too weak. Please use at least 8 characters with a mix of letters, numbers, and symbols.';
  }
  if (lower.includes('invalid email')) {
    return 'Please enter a valid email address.';
  }
  if (lower.includes('network') || lower.includes('fetch')) {
    return 'Connection error. Please check your internet and try again.';
  }
  return message;
}

/** Only same-site paths ("/account", not "//evil.com" or "https://…") are allowed. */
function safeRedirect(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return '/account';
  return value;
}

const fieldBase =
  'w-full h-[54px] px-[18px] rounded-[16px] bg-[#FBF6EF] text-[16px] text-[#1F1115] placeholder:text-[#8A7479] outline-none transition-shadow motion-reduce:transition-none';
const field = `${fieldBase} shadow-[inset_0_0_0_1px_rgba(31,17,21,0.18)] focus:shadow-[inset_0_0_0_1.5px_#2B0B12]`;
const fieldBad = `${fieldBase} shadow-[inset_0_0_0_1.5px_#7A1F2E]`;
const label = 'text-[14px] font-semibold';
const errText = 'text-[13px] text-[#7A1F2E]';
const eyeBtn = 'absolute right-1 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full inline-flex items-center justify-center text-[#6B565B] hover:text-[#1F1115]';

export default function SignupPage() {
  const router = useRouter();
  const errorRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    acceptTerms: false,
    newsletter: false
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<any>({});
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [success, setSuccess] = useState(false);
  const [redirectTo, setRedirectTo] = useState('/account');
  const { getToken, verifying } = useRecaptcha();

  useEffect(() => {
    // Read on the client to avoid a Suspense boundary for useSearchParams.
    setRedirectTo(safeRedirect(new URLSearchParams(window.location.search).get('redirect')));
  }, []);

  // Auto-scroll to error when it appears
  useEffect(() => {
    if (authError && errorRef.current) {
      errorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [authError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setAuthError('');
    setIsLoading(true);

    const newErrors: any = {};
    if (!formData.firstName) newErrors.firstName = 'First name is required';
    if (!formData.lastName) newErrors.lastName = 'Last name is required';
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }
    if (!formData.phone) {
      newErrors.phone = 'Phone number is required';
    }
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    if (!formData.acceptTerms) {
      newErrors.acceptTerms = 'You must accept the terms and conditions';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setIsLoading(false);
      return;
    }

    // reCAPTCHA verification
    const isHuman = await getToken('signup');
    if (!isHuman) {
      setAuthError('Security verification failed. Please try again.');
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            first_name: formData.firstName,
            last_name: formData.lastName,
            phone: formData.phone,
            newsletter: formData.newsletter
          }
        }
      });

      if (error) throw error;

      if (data.user) {
        // Send Welcome Notification
        fetch('/api/notifications', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(data.session?.access_token && { 'Authorization': `Bearer ${data.session.access_token}` })
          },
          body: JSON.stringify({
            type: 'welcome',
            payload: {
              email: formData.email,
              firstName: formData.firstName,
              phone: formData.phone
            }
          })
        }).catch(err => console.error('Welcome notification error:', err));
        // If Supabase confirms via email, data.session might be null initially
        if (!data.session) {
          setSuccess(true);
        } else {
          // Auto-login success (if email confirming is off)
          router.push(redirectTo);
          router.refresh();
        }
      }
    } catch (err: any) {
      console.error('Signup error:', err);
      setAuthError(getFriendlyError(err.message || 'Failed to sign up. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  };

  const loginHref = redirectTo === '/account' ? '/auth/login' : `/auth/login?redirect=${encodeURIComponent(redirectTo)}`;

  const photoPanel = (
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
  );

  if (success) {
    return (
      <main className="grid lg:grid-cols-2 min-h-[calc(100vh-80px)] bg-[#F1E8DC] text-[#1F1115]">
        {photoPanel}
        <div className="flex items-center justify-center px-5 sm:px-8 lg:px-12 py-12 md:py-16">
          <div className="w-full max-w-[420px] flex flex-col items-start gap-5" role="status">
            <span className="w-14 h-14 rounded-full bg-[#2B0B12] text-[#D9A441] inline-flex items-center justify-center">
              <i className="ri-mail-send-line text-2xl" aria-hidden="true"></i>
            </span>
            <h1 className="font-serif text-[40px] md:text-[48px] leading-none tracking-[-0.02em]">Check your <em>email</em></h1>
            <p className="text-[15px] leading-relaxed text-[#6B565B]">
              We've sent a confirmation link to <strong className="text-[#1F1115]">{formData.email}</strong>. Open it to activate your account.
            </p>
            <Link href={loginHref} className="inline-flex items-center min-h-[52px] px-7 rounded-full bg-[#2B0B12] text-[#F6EDE3] font-bold hover:bg-[#4A1520] transition-colors motion-reduce:transition-none">
              Back to sign in
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="grid lg:grid-cols-2 min-h-[calc(100vh-80px)] bg-[#F1E8DC] text-[#1F1115]">
      {photoPanel}

      <div className="flex items-center justify-center px-5 sm:px-8 lg:px-12 py-12 md:py-16">
        <div className="w-full max-w-[460px] flex flex-col gap-[22px]">
          <div className="flex flex-col gap-2">
            <h1 className="font-serif text-[40px] md:text-[48px] leading-none tracking-[-0.02em]">Create an <em>account</em></h1>
            <p className="text-[15px] text-[#6B565B]">Track your orders and keep the scents you love in one place.</p>
          </div>

          {authError && (
            <div ref={errorRef} role="alert" className="rounded-2xl bg-[#F6DCD7] text-[#7A1F2E] px-4 py-3 text-sm flex items-start gap-3">
              <i className="ri-error-warning-line text-lg flex-shrink-0 leading-none mt-0.5" aria-hidden="true"></i>
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label htmlFor="su-first" className={label}>First name</label>
                <input
                  id="su-first"
                  type="text"
                  autoComplete="given-name"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  aria-invalid={!!errors.firstName}
                  className={`${errors.firstName ? fieldBad : field}`}
                />
                {errors.firstName && <p className={errText}>{errors.firstName}</p>}
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="su-last" className={label}>Last name</label>
                <input
                  id="su-last"
                  type="text"
                  autoComplete="family-name"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  aria-invalid={!!errors.lastName}
                  className={`${errors.lastName ? fieldBad : field}`}
                />
                {errors.lastName && <p className={errText}>{errors.lastName}</p>}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="su-email" className={label}>Email</label>
              <input
                id="su-email"
                type="email"
                autoComplete="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                aria-invalid={!!errors.email}
                className={`${errors.email ? fieldBad : field}`}
                placeholder="you@example.com"
              />
              {errors.email && <p className={errText}>{errors.email}</p>}
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="su-phone" className={label}>Phone number</label>
              <input
                id="su-phone"
                type="tel"
                autoComplete="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                aria-invalid={!!errors.phone}
                className={`${errors.phone ? fieldBad : field}`}
                placeholder="+233 XX XXX XXXX"
              />
              {errors.phone && <p className={errText}>{errors.phone}</p>}
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="su-password" className={label}>Password</label>
              <div className="relative">
                <input
                  id="su-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  aria-invalid={!!errors.password}
                  className={`${errors.password ? fieldBad : field} pr-14`}
                  placeholder="At least 8 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  className={eyeBtn}
                >
                  <i className={`${showPassword ? 'ri-eye-off-line' : 'ri-eye-line'} text-xl`} aria-hidden="true"></i>
                </button>
              </div>
              <PasswordStrengthMeter password={formData.password} />
              {errors.password && <p className={errText}>{errors.password}</p>}
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="su-confirm" className={label}>Confirm password</label>
              <div className="relative">
                <input
                  id="su-confirm"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  aria-invalid={!!errors.confirmPassword}
                  className={`${errors.confirmPassword ? fieldBad : field} pr-14`}
                  placeholder="Type it again"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showConfirmPassword}
                  className={eyeBtn}
                >
                  <i className={`${showConfirmPassword ? 'ri-eye-off-line' : 'ri-eye-line'} text-xl`} aria-hidden="true"></i>
                </button>
              </div>
              {errors.confirmPassword && <p className={errText}>{errors.confirmPassword}</p>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="flex items-start gap-3 min-h-[44px] py-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.acceptTerms}
                  onChange={(e) => setFormData({ ...formData, acceptTerms: e.target.checked })}
                  aria-invalid={!!errors.acceptTerms}
                  className="w-5 h-5 mt-0.5 flex-none rounded accent-[#2B0B12]"
                />
                <span className="text-[14px] leading-relaxed text-[#4D3A3F]">
                  I agree to the{' '}
                  <Link href="/terms" className="font-semibold text-[#1F1115] underline underline-offset-[3px]">Terms and Conditions</Link>
                  {' '}and{' '}
                  <Link href="/privacy" className="font-semibold text-[#1F1115] underline underline-offset-[3px]">Privacy Policy</Link>
                </span>
              </label>
              {errors.acceptTerms && <p className={errText}>{errors.acceptTerms}</p>}
            </div>

            <button
              type="submit"
              disabled={isLoading || verifying}
              className="min-h-[56px] rounded-full bg-[#2B0B12] text-[#F6EDE3] text-[16px] font-bold hover:bg-[#4A1520] transition-colors motion-reduce:transition-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading || verifying ? (
                <span className="flex items-center justify-center gap-2">
                  <i className="ri-loader-4-line animate-spin motion-reduce:animate-none" aria-hidden="true"></i> {verifying ? 'Verifying…' : 'Creating account…'}
                </span>
              ) : 'Create account'}
            </button>
          </form>

          <p className="text-center text-[14px] text-[#6B565B]">
            Already have an account?{' '}
            <Link href={loginHref} className="font-bold text-[#1F1115] underline underline-offset-[3px]">Sign in</Link>
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
