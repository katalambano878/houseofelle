'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useRecaptcha } from '@/hooks/useRecaptcha';

interface SessionUser {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
}

export default function PrivacySettingsPage() {
  const router = useRouter();
  const { getRawToken } = useRecaptcha();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleteRequested, setDeleteRequested] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return;
      if (!session?.user) {
        router.replace('/auth/login?redirect=/account/privacy');
        return;
      }
      setUser(session.user as SessionUser);
      setChecking(false);
    });
    return () => {
      active = false;
    };
  }, [router]);

  const handleExportData = async () => {
    if (!user) return;
    setExporting(true);
    setExportMessage(null);
    try {
      const [profileRes, addressesRes, ordersRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
        supabase.from('addresses').select('*').eq('user_id', user.id).order('created_at', { ascending: true }),
        supabase
          .from('orders')
          .select('*, order_items(*)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
      ]);
      if (profileRes.error || addressesRes.error || ordersRes.error) {
        throw new Error('export failed');
      }

      const exportData = {
        exported_at: new Date().toISOString(),
        account: {
          id: user.id,
          email: user.email || null,
          details: user.user_metadata || {},
        },
        profile: profileRes.data || null,
        addresses: addressesRes.data || [],
        orders: ordersRes.data || [],
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `house-of-elle-my-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setExportMessage({ type: 'success', text: 'Your data has been downloaded.' });
    } catch {
      setExportMessage({ type: 'error', text: 'We could not prepare your data. Please try again.' });
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user || deleteConfirmText !== 'DELETE') return;
    setDeleting(true);
    setDeleteError('');

    const recaptchaToken = await getRawToken('contact');
    if (recaptchaToken === null) {
      setDeleteError('Security check failed. Please refresh the page and try again.');
      setDeleting(false);
      return;
    }

    const meta = user.user_metadata || {};
    const name =
      (typeof meta.full_name === 'string' && meta.full_name) ||
      [meta.first_name, meta.last_name].filter((v) => typeof v === 'string' && v).join(' ') ||
      user.email ||
      'Customer';

    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'contact',
          recaptchaToken,
          payload: {
            name,
            email: user.email || '',
            subject: 'Account deletion request',
            message: [
              'A customer has asked for their House of Elle account to be deleted.',
              '',
              `Email: ${user.email || '(none)'}`,
              `Account ID: ${user.id}`,
              `Requested: ${new Date().toISOString()}`,
            ].join('\n'),
          },
        }),
      });
      if (!res.ok) throw new Error('request failed');
      setDeleteRequested(true);
      setShowDeleteConfirm(false);
      setDeleteConfirmText('');
    } catch {
      setDeleteError('We could not send your request. Please try again or contact us directly.');
    } finally {
      setDeleting(false);
    }
  };

  if (checking) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#F1E8DC]" aria-busy="true">
        <i className="ri-loader-4-line animate-spin motion-reduce:animate-none text-3xl text-[#2B0B12]" aria-label="Loading"></i>
      </main>
    );
  }

  const card = 'flex flex-col gap-5 p-6 md:p-8 rounded-[24px] bg-[#FBF6EF] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.1)]';
  const outlineBtn =
    'inline-flex items-center justify-center gap-2 min-h-[48px] px-6 rounded-full shadow-[inset_0_0_0_1px_rgba(31,17,21,0.22)] text-[14px] font-semibold hover:bg-white transition-colors motion-reduce:transition-none disabled:opacity-50';
  const included = [
    'Personal information (name, email, phone)',
    'Order history and transaction details',
    'Saved addresses',
    'Account preferences',
  ];
  const rights = [
    { icon: 'ri-eye-line', title: 'Right to access', text: 'You can download your profile, addresses and orders at any time.' },
    { icon: 'ri-edit-line', title: 'Right to rectification', text: 'You can update your name and phone number in your account settings.' },
    { icon: 'ri-delete-bin-line', title: 'Right to erasure', text: 'You can ask us to delete your account.' },
    { icon: 'ri-file-shield-line', title: 'Right to data portability', text: 'Export your data in a structured, machine-readable format.' },
  ];

  return (
    <main className="min-h-screen bg-[#F1E8DC] text-[#1F1115]">
      <section className="max-w-[1280px] mx-auto px-5 sm:px-8 lg:px-12 pt-8 md:pt-12 pb-7 md:pb-10 flex flex-col gap-4">
        <Link href="/account?tab=security" className="self-start inline-flex items-center gap-2 min-h-[44px] text-[14px] font-semibold text-[#4D3A3F] hover:text-[#1F1115]">
          <i className="ri-arrow-left-line" aria-hidden="true"></i>
          Back to your account
        </Link>
        <div className="flex flex-col gap-2.5">
          <h1 className="font-serif text-[40px] md:text-[56px] leading-[0.95] tracking-[-0.02em]">Privacy and <em>data</em></h1>
          <p className="text-[15px] leading-relaxed text-[#6B565B] max-w-[560px]">
            We only use your details to process your orders and look after your account. You can download a copy or ask us to delete your account below.
          </p>
        </div>
      </section>

      <section className="max-w-[1280px] mx-auto px-5 sm:px-8 lg:px-12 pb-24 md:pb-28 grid lg:grid-cols-[1.4fr_1fr] gap-4 items-start">
        <div className="flex flex-col gap-4">
          <div className={card}>
            <div className="flex flex-col gap-1.5">
              <h2 className="font-serif text-[28px] md:text-[30px] leading-none">Download your data</h2>
              <p className="text-[15px] text-[#6B565B]">Download a copy of your profile, saved addresses and orders in JSON format.</p>
            </div>
            <ul className="flex flex-col gap-2 text-[14px] text-[#4D3A3F]">
              {included.map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <i className="ri-check-line text-[#2F6B3A] leading-5" aria-hidden="true"></i>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={handleExportData}
              disabled={exporting}
              className="self-start inline-flex items-center gap-2 min-h-[52px] px-7 rounded-full bg-[#2B0B12] text-[#F6EDE3] text-[15px] font-bold hover:bg-[#4A1520] transition-colors motion-reduce:transition-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exporting ? (
                <>
                  <i className="ri-loader-4-line animate-spin motion-reduce:animate-none" aria-hidden="true"></i>
                  Preparing export…
                </>
              ) : (
                <>
                  <i className="ri-download-line" aria-hidden="true"></i>
                  Export my data
                </>
              )}
            </button>
            {exportMessage && (
              <p
                role={exportMessage.type === 'success' ? 'status' : 'alert'}
                className={`rounded-2xl px-4 py-3 text-sm ${exportMessage.type === 'success' ? 'bg-[#DDE7D6] text-[#244A2C]' : 'bg-[#F6DCD7] text-[#7A1F2E]'}`}
              >
                {exportMessage.text}
              </p>
            )}
          </div>

          <div className={card}>
            <div className="flex flex-col gap-1.5">
              <h2 className="font-serif text-[28px] md:text-[30px] leading-none">Delete your account</h2>
              <p className="text-[15px] text-[#6B565B]">Ask us to delete your account. We&apos;ll review your request and confirm by email.</p>
            </div>

            {deleteRequested ? (
              <p role="status" className="flex items-start gap-2 rounded-2xl bg-[#DDE7D6] text-[#244A2C] px-4 py-3 text-sm">
                <i className="ri-checkbox-circle-line text-base leading-5" aria-hidden="true"></i>
                <span>We&apos;ve received your request and will confirm by email.</span>
              </p>
            ) : !showDeleteConfirm ? (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="self-start inline-flex items-center gap-2 min-h-[48px] px-6 rounded-full text-[#7A1F2E] text-[14px] font-semibold shadow-[inset_0_0_0_1px_rgba(122,31,46,0.4)] hover:bg-[#F6DCD7] transition-colors motion-reduce:transition-none"
              >
                <i className="ri-delete-bin-line" aria-hidden="true"></i>
                Request account deletion
              </button>
            ) : (
              <div className="flex flex-col gap-4 p-5 rounded-[18px] bg-white shadow-[inset_0_0_0_1px_rgba(122,31,46,0.3)]">
                <h3 className="text-[15px] font-bold text-[#7A1F2E]">Before you continue</h3>
                <ul className="flex flex-col gap-2 text-[14px] text-[#4D3A3F]">
                  <li className="flex items-start gap-2">
                    <i className="ri-information-line text-[#7A1F2E] leading-5" aria-hidden="true"></i>
                    <span>Download your data first if you want to keep a copy of your orders.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <i className="ri-information-line text-[#7A1F2E] leading-5" aria-hidden="true"></i>
                    <span>Once your account is deleted you won&apos;t be able to sign in with it again.</span>
                  </li>
                </ul>

                <div className="flex flex-col gap-2">
                  <label htmlFor="delete-confirm" className="text-[14px] font-semibold">
                    Type <span className="font-bold">DELETE</span> to confirm
                  </label>
                  <input
                    id="delete-confirm"
                    type="text"
                    autoComplete="off"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder="DELETE"
                    className="w-full h-[52px] px-4 rounded-[14px] bg-white text-[16px] outline-none shadow-[inset_0_0_0_1px_rgba(31,17,21,0.16)] focus:shadow-[inset_0_0_0_1.5px_#7A1F2E] transition-shadow motion-reduce:transition-none"
                  />
                </div>

                {deleteError && <p role="alert" className="text-[13px] text-[#7A1F2E]">{deleteError}</p>}

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeleteConfirmText('');
                    }}
                    className={outlineBtn}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteAccount}
                    disabled={deleteConfirmText !== 'DELETE' || deleting}
                    className="inline-flex items-center justify-center gap-2 min-h-[48px] px-6 rounded-full bg-[#7A1F2E] text-[#F6EDE3] text-[14px] font-bold hover:bg-[#4A1520] transition-colors motion-reduce:transition-none disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deleting ? (
                      <>
                        <i className="ri-loader-4-line animate-spin motion-reduce:animate-none" aria-hidden="true"></i>
                        Sending…
                      </>
                    ) : (
                      'Send deletion request'
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <aside className="flex flex-col gap-5 p-6 md:p-8 rounded-[24px] bg-[#2B0B12] text-[#F6EDE3]">
          <h2 className="font-serif text-[26px] md:text-[28px] leading-none">Your privacy rights</h2>
          <ul className="flex flex-col gap-4">
            {rights.map((r) => (
              <li key={r.title} className="flex gap-3">
                <i className={`${r.icon} text-lg leading-6 text-[#D9A441]`} aria-hidden="true"></i>
                <span className="flex flex-col gap-0.5">
                  <span className="text-[15px] font-semibold">{r.title}</span>
                  <span className="text-[14px] leading-relaxed text-[#E3CFC7]">{r.text}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="pt-4 border-t border-[#F6EDE3]/15 text-[14px] text-[#E3CFC7]">
            Questions about privacy? Read our{' '}
            <Link href="/privacy" className="font-semibold text-[#F6EDE3] underline underline-offset-[3px]">Privacy Policy</Link>
            {' '}or{' '}
            <Link href="/contact" className="font-semibold text-[#F6EDE3] underline underline-offset-[3px]">contact us</Link>.
          </p>
        </aside>
      </section>
    </main>
  );
}
