'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useRecaptcha } from '@/hooks/useRecaptcha';

const categories = [
  { value: 'order', label: 'Order Issue', icon: 'ri-shopping-bag-line' },
  { value: 'delivery', label: 'Delivery Problem', icon: 'ri-truck-line' },
  { value: 'return', label: 'Damaged or Wrong Item', icon: 'ri-arrow-left-right-line' },
  { value: 'payment', label: 'Mobile Money Payment', icon: 'ri-smartphone-line' },
  { value: 'product', label: 'Fragrance Question', icon: 'ri-gift-line' },
  { value: 'wholesale', label: 'Wholesale Enquiry', icon: 'ri-store-2-line' },
  { value: 'account', label: 'Account Help', icon: 'ri-user-line' },
  { value: 'other', label: 'Other', icon: 'ri-question-line' },
];

const inputClass =
  'w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500';

export default function SupportTicketPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    orderNumber: '',
    category: 'order',
    subject: '',
    description: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ ticketNumber: number | null } | null>(null);
  const { getRawToken } = useRecaptcha();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user;
      if (!user) return;
      setUserId(user.id);
      const meta = (user.user_metadata || {}) as Record<string, string | undefined>;
      const name = meta.full_name || [meta.first_name, meta.last_name].filter(Boolean).join(' ');
      setFormData((prev) => ({
        ...prev,
        email: prev.email || user.email || '',
        name: prev.name || name || '',
      }));
    });
  }, []);

  const categoryLabel = categories.find((c) => c.value === formData.category)?.label || formData.category;

  const orderLine = () =>
    formData.orderNumber.trim() ? [`Order number: ${formData.orderNumber.trim()}`] : [];

  const buildDescription = () =>
    [formData.description.trim(), '', `Name: ${formData.name.trim()}`, ...orderLine()].join('\n');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!formData.name.trim() || !formData.email.trim() || !formData.subject.trim() || !formData.description.trim()) {
      setError('Please fill in all required fields.');
      return;
    }
    setIsSubmitting(true);

    try {
      if (userId) {
        const { data, error: insertError } = await supabase
          .from('support_tickets')
          .insert({
            email: formData.email.trim(),
            subject: formData.subject.trim(),
            description: buildDescription(),
            category: formData.category,
          })
          .select('ticket_number')
          .single();
        if (insertError) throw insertError;
        setResult({ ticketNumber: (data as { ticket_number?: number } | null)?.ticket_number ?? null });
      } else {
        const recaptchaToken = await getRawToken('contact');
        if (recaptchaToken === null) {
          setError('Security check failed. Please refresh the page and try again.');
          return;
        }
        const res = await fetch('/api/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'contact',
            recaptchaToken,
            payload: {
              name: formData.name.trim(),
              email: formData.email.trim(),
              subject: `Support request: ${formData.subject.trim()}`.slice(0, 200),
              message: [
                `Category: ${categoryLabel}`,
                ...orderLine(),
                '',
                formData.description.trim(),
              ].join('\n'),
            },
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error || 'Request failed');
        }
        setResult({ ticketNumber: null });
      }
    } catch (err) {
      const message = err instanceof Error && err.message.startsWith('Too many') ? err.message : '';
      setError(message || 'We could not send your request. Please try again or contact us directly.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (result) {
    return (
      <main className="min-h-screen bg-[#F1E8DC] flex items-center justify-center py-12">
        <div className="max-w-md mx-auto px-4 text-center">
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="w-20 h-20 flex items-center justify-center bg-blue-100 rounded-full mx-auto mb-6">
              <i className="ri-check-line text-4xl text-blue-700"></i>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {result.ticketNumber ? 'Ticket Created' : 'Request Sent'}
            </h2>
            <p className="text-gray-600 mb-2">
              {result.ticketNumber
                ? 'Your support ticket has been submitted.'
                : 'We have received your message.'}
            </p>
            {result.ticketNumber && (
              <p className="text-sm text-gray-500 mb-6">Ticket #{result.ticketNumber}</p>
            )}
            <div className="space-y-3 mt-6">
              <p className="text-sm text-gray-600">
                We&apos;ll reply to {formData.email} as soon as we can.
              </p>
              {userId && (
                <Link
                  href="/support/tickets"
                  className="block bg-blue-700 hover:bg-blue-800 text-white py-3 rounded-lg font-semibold transition-colors whitespace-nowrap"
                >
                  View My Tickets
                </Link>
              )}
              <Link
                href="/help"
                className="block text-blue-700 hover:text-blue-900 font-semibold whitespace-nowrap"
              >
                Back to Help Center
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F1E8DC] py-12">
      <div className="max-w-4xl mx-auto px-4">
        <Link
          href="/help"
          className="inline-flex items-center text-blue-700 hover:text-blue-900 font-semibold mb-6 whitespace-nowrap"
        >
          <i className="ri-arrow-left-line mr-2"></i>
          Back to Help Center
        </Link>

        <div className="bg-white rounded-xl shadow-sm p-6 sm:p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Support Ticket</h1>
            <p className="text-gray-600">
              Tell us what you need and our team will get back to you by email.
            </p>
            {!userId && (
              <p className="text-sm text-gray-500 mt-2">
                <Link href="/auth/login?redirect=/support/ticket" className="text-blue-700 font-semibold hover:underline">
                  Sign in
                </Link>{' '}
                to keep track of your tickets in your account.
              </p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="ticket-name" className="block text-sm font-semibold text-gray-900 mb-2">
                  Your Name *
                </label>
                <input
                  id="ticket-name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={inputClass}
                  placeholder="Your full name"
                  maxLength={100}
                  required
                />
              </div>

              <div>
                <label htmlFor="ticket-email" className="block text-sm font-semibold text-gray-900 mb-2">
                  Email Address *
                </label>
                <input
                  id="ticket-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className={inputClass}
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="ticket-order" className="block text-sm font-semibold text-gray-900 mb-2">
                Order Number (if applicable)
              </label>
              <input
                id="ticket-order"
                type="text"
                value={formData.orderNumber}
                onChange={(e) => setFormData({ ...formData, orderNumber: e.target.value })}
                className={inputClass}
                placeholder="ORD-…"
              />
            </div>

            <div>
              <p className="block text-sm font-semibold text-gray-900 mb-3">
                What can we help you with? *
              </p>
              <div className="grid md:grid-cols-2 gap-3">
                {categories.map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, category: cat.value })}
                    aria-pressed={formData.category === cat.value}
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                      formData.category === cat.value
                        ? 'border-blue-700 bg-blue-50'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <i className={`${cat.icon} text-2xl ${
                        formData.category === cat.value ? 'text-blue-700' : 'text-gray-400'
                      }`}></i>
                      <span className="font-semibold text-gray-900">{cat.label}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="ticket-subject" className="block text-sm font-semibold text-gray-900 mb-2">
                Subject *
              </label>
              <input
                id="ticket-subject"
                type="text"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                className={inputClass}
                placeholder="Brief description of your issue"
                maxLength={150}
                required
              />
            </div>

            <div>
              <label htmlFor="ticket-description" className="block text-sm font-semibold text-gray-900 mb-2">
                Description *
              </label>
              <textarea
                id="ticket-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className={`${inputClass} h-32 resize-none`}
                placeholder="Please provide as much detail as possible..."
                required
                maxLength={2000}
              />
              <p className="text-sm text-gray-500 mt-1">
                {formData.description.length}/2000 characters
              </p>
            </div>

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
                <i className="ri-error-warning-line mt-0.5"></i>
                <span>{error}</span>
              </div>
            )}

            <div className="flex space-x-4 pt-2">
              <button
                type="button"
                onClick={() => router.push('/help')}
                className="flex-1 py-4 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors whitespace-nowrap"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-4 bg-blue-700 hover:bg-blue-800 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {isSubmitting ? (
                  <>
                    <i className="ri-loader-4-line animate-spin mr-2"></i>
                    Submitting...
                  </>
                ) : (
                  'Submit Ticket'
                )}
              </button>
            </div>
          </form>
        </div>

        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-6">
          <div className="flex items-start space-x-3">
            <i className="ri-information-line text-2xl text-blue-700 mt-0.5"></i>
            <div>
              <p className="font-semibold text-blue-900 mb-2">Before submitting a ticket</p>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Check our <Link href="/help" className="underline hover:text-blue-900">Help Center</Link> for quick answers</li>
                <li>• Include your order number for faster assistance</li>
                <li>• For damaged or leaking items, keep the packaging and mention it in your description</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
