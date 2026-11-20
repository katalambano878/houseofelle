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
  'w-full min-h-[50px] px-4 py-3 rounded-[14px] bg-white shadow-[inset_0_0_0_1px_rgba(31,17,21,0.16)] text-[15px] text-[#1F1115] placeholder:text-[#6B565B] outline-none focus:shadow-[inset_0_0_0_1.5px_#2B0B12]';

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
      <main className="min-h-screen bg-[#F1E8DC] text-[#1F1115] flex items-center justify-center py-12">
        <div className="max-w-md mx-auto px-5 text-center">
          <div className="rounded-[24px] bg-[#FBF6EF] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.1)] p-8">
            <div className="w-14 h-14 flex items-center justify-center bg-[#2B0B12] rounded-full mx-auto mb-6">
              <i className="ri-check-line text-3xl text-[#E5B65A]"></i>
            </div>
            <h2 className="font-serif text-[26px] md:text-[30px] leading-tight mb-4">
              {result.ticketNumber ? 'Ticket Created' : 'Request Sent'}
            </h2>
            <p className="text-[15px] text-[#6B565B] mb-2">
              {result.ticketNumber
                ? 'Your support ticket has been submitted.'
                : 'We have received your message.'}
            </p>
            {result.ticketNumber && (
              <p className="text-sm text-[#6B565B] mb-6">Ticket #{result.ticketNumber}</p>
            )}
            <div className="space-y-3 mt-6">
              <p className="text-sm text-[#6B565B]">
                We&apos;ll reply to {formData.email} as soon as we can.
              </p>
              {userId && (
                <Link
                  href="/support/tickets"
                  className="flex w-full inline-flex items-center justify-center min-h-[52px] px-7 rounded-full bg-[#2B0B12] text-[#F6EDE3] font-semibold hover:bg-[#4A1520] transition-colors motion-reduce:transition-none whitespace-nowrap"
                >
                  View My Tickets
                </Link>
              )}
              <Link
                href="/help"
                className="flex items-center justify-center min-h-[44px] text-[#7A1F2E] font-semibold underline underline-offset-4 whitespace-nowrap"
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
    <main className="min-h-screen bg-[#F1E8DC] text-[#1F1115] py-12 md:py-16">
      <div className="max-w-[720px] mx-auto px-5 sm:px-8">
        <Link
          href="/help"
          className="inline-flex items-center min-h-[44px] text-sm text-[#7A1F2E] font-semibold mb-4 whitespace-nowrap"
        >
          <i className="ri-arrow-left-line mr-2"></i>
          Back to Help Center
        </Link>

        <div className="rounded-[24px] bg-[#FBF6EF] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.1)] p-5 sm:p-8">
          <div className="mb-8">
            <h1 className="font-serif text-[36px] md:text-[48px] leading-[0.95] tracking-[-0.02em] mb-2">Create Support Ticket</h1>
            <p className="text-[15px] text-[#6B565B]">
              Tell us what you need and our team will get back to you by email.
            </p>
            {!userId && (
              <p className="text-sm text-[#6B565B] mt-2">
                <Link href="/auth/login?redirect=/support/ticket" className="text-[#7A1F2E] font-semibold underline underline-offset-4">
                  Sign in
                </Link>{' '}
                to keep track of your tickets in your account.
              </p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="ticket-name" className="block text-[13px] font-semibold mb-1.5">
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
                <label htmlFor="ticket-email" className="block text-[13px] font-semibold mb-1.5">
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
              <label htmlFor="ticket-order" className="block text-[13px] font-semibold mb-1.5">
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
              <p className="block text-[13px] font-semibold mb-2">
                What can we help you with? *
              </p>
              <div className="grid md:grid-cols-2 gap-3">
                {categories.map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, category: cat.value })}
                    aria-pressed={formData.category === cat.value}
                    className={`min-h-[56px] p-4 rounded-[18px] text-left transition-[background-color,box-shadow] motion-reduce:transition-none ${
                      formData.category === cat.value
                        ? 'bg-white shadow-[inset_0_0_0_1.5px_#2B0B12]'
                        : 'bg-white/60 shadow-[inset_0_0_0_1px_rgba(31,17,21,0.16)] hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <i className={`${cat.icon} text-2xl ${
                        formData.category === cat.value ? 'text-[#7A1F2E]' : 'text-[#6B565B]'
                      }`}></i>
                      <span className="font-semibold">{cat.label}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="ticket-subject" className="block text-[13px] font-semibold mb-1.5">
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
              <label htmlFor="ticket-description" className="block text-[13px] font-semibold mb-1.5">
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
              <p className="text-sm text-[#6B565B] mt-1">
                {formData.description.length}/2000 characters
              </p>
            </div>

            {error && (
              <div className="rounded-2xl bg-[#F6DCD7] text-[#7A1F2E] px-4 py-3 text-sm flex items-start gap-2">
                <i className="ri-error-warning-line mt-0.5"></i>
                <span>{error}</span>
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={() => router.push('/help')}
                className="flex-1 inline-flex items-center justify-center min-h-[52px] px-7 rounded-full shadow-[inset_0_0_0_1.5px_rgba(31,17,21,0.3)] font-semibold hover:bg-white transition-colors motion-reduce:transition-none whitespace-nowrap"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 inline-flex items-center justify-center min-h-[52px] px-7 rounded-full bg-[#2B0B12] text-[#F6EDE3] font-semibold hover:bg-[#4A1520] transition-colors motion-reduce:transition-none disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
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

        <div className="mt-8 rounded-[22px] bg-[#2B0B12] text-[#F6EDE3] p-6">
          <div className="flex items-start space-x-3">
            <i className="ri-information-line text-2xl text-[#E5B65A] mt-0.5"></i>
            <div>
              <p className="font-serif text-[20px] leading-tight mb-2">Before submitting a ticket</p>
              <ul className="text-sm text-[#E3CFC7] space-y-1">
                <li>• Check our <Link href="/help" className="underline underline-offset-2 text-[#F6EDE3]">Help Center</Link> for quick answers</li>
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
