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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <i className="ri-loader-4-line animate-spin text-4xl text-blue-700"></i>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F1E8DC]">
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Link href="/account" className="w-9 h-9 flex items-center justify-center hover:bg-gray-100 rounded-lg transition-colors">
              <i className="ri-arrow-left-line text-xl"></i>
            </Link>
            <div>
              <h1 className="text-xl font-bold">Privacy & Data</h1>
              <p className="text-sm text-gray-600">Manage your personal information</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-6">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex gap-3">
            <i className="ri-shield-check-line text-xl text-blue-600 flex-shrink-0 mt-0.5"></i>
            <div>
              <h3 className="font-semibold text-blue-900 mb-1">Your Privacy Matters</h3>
              <p className="text-sm text-blue-800">
                We only use your details to process your orders and look after your account. You can download a copy or ask us to delete your account below.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border p-6 space-y-6">
          <div>
            <h2 className="text-lg font-bold mb-4">Data Export</h2>
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <i className="ri-download-cloud-line text-lg"></i>
                Download Your Data
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Download a copy of your profile, saved addresses and orders in JSON format.
              </p>
              <button
                onClick={handleExportData}
                disabled={exporting}
                className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-medium whitespace-nowrap"
              >
                {exporting ? (
                  <>
                    <i className="ri-loader-4-line animate-spin mr-2"></i>
                    Preparing Export...
                  </>
                ) : (
                  <>
                    <i className="ri-download-line mr-2"></i>
                    Export My Data
                  </>
                )}
              </button>
              {exportMessage && (
                <p className={`mt-3 text-sm ${exportMessage.type === 'success' ? 'text-green-700' : 'text-red-600'}`}>
                  {exportMessage.text}
                </p>
              )}
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold mb-2">What&apos;s Included?</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <i className="ri-check-line text-green-600 mt-0.5 flex-shrink-0"></i>
                  <span>Personal information (name, email, phone)</span>
                </li>
                <li className="flex items-start gap-2">
                  <i className="ri-check-line text-green-600 mt-0.5 flex-shrink-0"></i>
                  <span>Order history and transaction details</span>
                </li>
                <li className="flex items-start gap-2">
                  <i className="ri-check-line text-green-600 mt-0.5 flex-shrink-0"></i>
                  <span>Saved addresses</span>
                </li>
                <li className="flex items-start gap-2">
                  <i className="ri-check-line text-green-600 mt-0.5 flex-shrink-0"></i>
                  <span>Account preferences</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t pt-6">
            <h2 className="text-lg font-bold mb-4 text-red-600">Danger Zone</h2>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="font-semibold text-red-900 mb-2 flex items-center gap-2">
                <i className="ri-delete-bin-line text-lg"></i>
                Delete Account
              </h3>
              <p className="text-sm text-red-800 mb-4">
                Ask us to delete your account. We&apos;ll review your request and confirm by email.
              </p>

              {deleteRequested ? (
                <div className="bg-white rounded-lg p-4 border border-green-200 text-sm text-green-800 flex items-start gap-2">
                  <i className="ri-checkbox-circle-line text-lg flex-shrink-0"></i>
                  <span>We&apos;ve received your request and will confirm by email.</span>
                </div>
              ) : !showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium whitespace-nowrap"
                >
                  Request Account Deletion
                </button>
              ) : (
                <div className="space-y-4">
                  <div className="bg-white rounded-lg p-4 border border-red-300">
                    <h4 className="font-semibold text-red-900 mb-2 flex items-center gap-2">
                      <i className="ri-alert-line text-red-600"></i>
                      Before you continue
                    </h4>
                    <ul className="space-y-2 text-sm text-gray-700 mb-4">
                      <li className="flex items-start gap-2">
                        <i className="ri-information-line text-red-600 mt-0.5 flex-shrink-0"></i>
                        <span>Download your data first if you want to keep a copy of your orders.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <i className="ri-information-line text-red-600 mt-0.5 flex-shrink-0"></i>
                        <span>Once your account is deleted you won&apos;t be able to sign in with it again.</span>
                      </li>
                    </ul>

                    <div className="mb-4">
                      <label className="block text-sm font-medium mb-2 text-gray-900">
                        Type <span className="font-bold">DELETE</span> to confirm:
                      </label>
                      <input
                        type="text"
                        value={deleteConfirmText}
                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                        placeholder="DELETE"
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      />
                    </div>

                    {deleteError && (
                      <p className="mb-4 text-sm text-red-600">{deleteError}</p>
                    )}

                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setShowDeleteConfirm(false);
                          setDeleteConfirmText('');
                        }}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium whitespace-nowrap"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDeleteAccount}
                        disabled={deleteConfirmText !== 'DELETE' || deleting}
                        className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-medium whitespace-nowrap"
                      >
                        {deleting ? (
                          <>
                            <i className="ri-loader-4-line animate-spin mr-2"></i>
                            Sending...
                          </>
                        ) : (
                          'Send Deletion Request'
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-bold mb-4">Your Privacy Rights</h2>
          <div className="space-y-4 text-sm text-gray-700">
            <div className="flex gap-3">
              <i className="ri-eye-line text-lg text-gray-400 flex-shrink-0"></i>
              <div>
                <h3 className="font-semibold mb-1">Right to Access</h3>
                <p className="text-gray-600">You can download your profile, addresses and orders at any time.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <i className="ri-edit-line text-lg text-gray-400 flex-shrink-0"></i>
              <div>
                <h3 className="font-semibold mb-1">Right to Rectification</h3>
                <p className="text-gray-600">You can update your name and phone number in your account settings.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <i className="ri-delete-bin-line text-lg text-gray-400 flex-shrink-0"></i>
              <div>
                <h3 className="font-semibold mb-1">Right to Erasure</h3>
                <p className="text-gray-600">You can ask us to delete your account.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <i className="ri-file-shield-line text-lg text-gray-400 flex-shrink-0"></i>
              <div>
                <h3 className="font-semibold mb-1">Right to Data Portability</h3>
                <p className="text-gray-600">Export your data in a structured, machine-readable format.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-100 rounded-xl p-4">
          <p className="text-sm text-gray-600 text-center">
            Questions about privacy? Read our{' '}
            <Link href="/privacy" className="text-black font-medium hover:underline">
              Privacy Policy
            </Link>
            {' '}or{' '}
            <Link href="/contact" className="text-black font-medium hover:underline">
              contact support
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
