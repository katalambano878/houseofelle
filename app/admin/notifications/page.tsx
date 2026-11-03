'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

type Audience = 'all' | 'newsletter' | 'buyers' | 'vip';

const AUDIENCE_LABELS: Record<Audience, string> = {
    all: 'All Customers',
    newsletter: 'Newsletter Subscribers',
    buyers: 'Customers who have ordered',
    vip: 'VIP Customers',
};

/** Real mailbox only: skips POS placeholder addresses like 0241234567@pos.local. */
const isMailable = (email: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !email.endsWith('.local');

const hasTag = (tags: unknown, tag: string) =>
    Array.isArray(tags) && tags.some((t) => String(t).toLowerCase() === tag);

export default function NotificationsPage() {
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState('');
    const [error, setError] = useState('');

    const [form, setForm] = useState({
        subject: '',
        message: '',
        channels: { email: true, sms: false },
        audience: 'all' as Audience
    });

    const smsSegments = form.message.length <= 160 ? 1 : Math.ceil(form.message.length / 153);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');

        try {
            // 1. Get auth token for admin verification
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
                throw new Error('You must be logged in as admin to send campaigns');
            }

            // 2. Fetch Recipients from the customers table (includes secondary contacts)
            const { data: customers, error: fetchError } = await supabase
                .from('customers')
                .select('email, phone, full_name, secondary_phone, secondary_email, tags, total_orders');

            if (fetchError) throw fetchError;

            const audience = (customers || []).filter((c: any) => {
                if (form.audience === 'newsletter') return hasTag(c.tags, 'newsletter');
                if (form.audience === 'vip') return hasTag(c.tags, 'vip');
                if (form.audience === 'buyers') return (Number(c.total_orders) || 0) > 0;
                return true;
            });

            // Build recipients with deduplication
            const seenPhones = new Set<string>();
            const seenEmails = new Set<string>();

            const normalizePhone = (p: string) => p.replace(/[\s\-\(\)\.]+/g, '').replace(/^00/, '+');

            const recipients: any[] = [];
            for (const c of audience as any[]) {
                const phones = [c.phone, c.secondary_phone].filter(Boolean).map((p: string) => normalizePhone(p));
                const emails = [c.email, c.secondary_email]
                    .filter(Boolean)
                    .map((e: string) => e.toLowerCase().trim())
                    .filter(isMailable);

                // Pick first unique phone for this customer
                const uniquePhone = phones.find(p => !seenPhones.has(p)) || null;
                if (uniquePhone) seenPhones.add(uniquePhone);

                // Pick first unique email for this customer
                const uniqueEmail = emails.find(e => !seenEmails.has(e)) || null;
                if (uniqueEmail) seenEmails.add(uniqueEmail);

                // Also mark all their contact info as seen to avoid duplicates from other customers
                phones.forEach(p => seenPhones.add(p));
                emails.forEach(e => seenEmails.add(e));

                // Only send on the channels that were picked.
                const recipient = {
                    email: form.channels.email ? uniqueEmail : null,
                    phone: form.channels.sms ? uniquePhone : null,
                    name: c.full_name
                };
                if (!recipient.email && !recipient.phone) continue;

                recipients.push(recipient);
            }

            if (recipients.length === 0) {
                throw new Error(`No ${AUDIENCE_LABELS[form.audience].toLowerCase()} have a ${form.channels.email && form.channels.sms ? 'valid email or phone' : form.channels.email ? 'valid email' : 'phone number'}.`);
            }

            // Confirm before sending
            const smsCount = recipients.filter(r => r.phone).length;
            const emailCount = recipients.filter(r => r.email).length;
            const summary = [];
            if (form.channels.sms) summary.push(`${smsCount} SMS (deduplicated)`);
            if (form.channels.email) summary.push(`${emailCount} emails`);

            if (!window.confirm(`This will send ${summary.join(' and ')} to ${AUDIENCE_LABELS[form.audience]}. Continue?`)) {
                setLoading(false);
                return;
            }

            // 3. Send in batches to avoid API timeout
            const BATCH_SIZE = 50;
            let totalEmail = 0;
            let totalSms = 0;
            let totalErrors = 0;

            for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
                const batch = recipients.slice(i, i + BATCH_SIZE);

                const res = await fetch('/api/notifications', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`
                    },
                    body: JSON.stringify({
                        type: 'campaign',
                        payload: {
                            recipients: batch,
                            // The API needs a subject even for SMS-only sends; it is not part of the SMS text.
                            subject: form.channels.email ? form.subject : (form.subject.trim() || 'Message from House of Elle'),
                            message: form.message,
                            channels: form.channels,
                        }
                    })
                });

                // Handle non-JSON responses (e.g. timeouts, server errors)
                let data;
                const contentType = res.headers.get('content-type') || '';
                if (contentType.includes('application/json')) {
                    data = await res.json();
                } else {
                    const text = await res.text();
                    throw new Error(`Server error (batch ${Math.floor(i / BATCH_SIZE) + 1}): ${text.slice(0, 100)}`);
                }

                if (!res.ok) throw new Error(data.error || 'Failed to send');

                // Parse results from response
                const msg = data.message || '';
                const emailMatch = msg.match(/(\d+) emails/);
                const smsMatch = msg.match(/(\d+) SMS/);
                const errorMatch = msg.match(/(\d+) failed/);
                if (emailMatch) totalEmail += parseInt(emailMatch[1]);
                if (smsMatch) totalSms += parseInt(smsMatch[1]);
                if (errorMatch) totalErrors += parseInt(errorMatch[1]);
            }

            const resultParts = [];
            if (totalEmail > 0) resultParts.push(`${totalEmail} emails`);
            if (totalSms > 0) resultParts.push(`${totalSms} SMS`);
            const errorNote = totalErrors > 0 ? ` (${totalErrors} failed)` : '';
            setSuccess(`Campaign sent successfully! ${resultParts.join(', ')} sent.${errorNote}`);
            setForm(prev => ({ ...prev, subject: '', message: '' }));
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold text-gray-900 mb-6">Marketing & Notifications</h1>

            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
                <h2 className="text-xl font-semibold mb-6">Send New Campaign</h2>

                {success && <div className="bg-blue-50 text-blue-700 p-4 rounded-lg mb-4">{success}</div>}
                {error && <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-4">{error}</div>}

                <form onSubmit={handleSend} className="space-y-6">
                    <div>
                        <label htmlFor="campaign-audience" className="block text-sm font-semibold text-gray-700 mb-2">Audience</label>
                        <select
                            id="campaign-audience"
                            value={form.audience}
                            onChange={e => setForm({ ...form, audience: e.target.value as Audience })}
                            className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            {(Object.keys(AUDIENCE_LABELS) as Audience[]).map((a) => (
                                <option key={a} value={a}>{AUDIENCE_LABELS[a]}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex gap-6 p-4 bg-gray-50 rounded-lg border border-gray-100">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={form.channels.email}
                                onChange={e => setForm({ ...form, channels: { ...form.channels, email: e.target.checked } })}
                                className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                            />
                            <span className="font-medium text-gray-900">Send Email</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={form.channels.sms}
                                onChange={e => setForm({ ...form, channels: { ...form.channels, sms: e.target.checked } })}
                                className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                            />
                            <span className="font-medium text-gray-900">Send SMS</span>
                        </label>
                    </div>

                    {form.channels.email && (
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Email Subject</label>
                            <input
                                type="text"
                                value={form.subject}
                                onChange={e => setForm({ ...form, subject: e.target.value })}
                                className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="e.g., Summer Sale Starts Now!"
                                required={form.channels.email}
                            />
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Message Content</label>
                        <textarea
                            value={form.message}
                            onChange={e => setForm({ ...form, message: e.target.value })}
                            className="w-full p-3 border border-gray-300 rounded-lg h-40 outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Write your message here... For emails, this supports plain text."
                            required
                        />
                        <p className="text-sm text-gray-500 mt-1">
                            This message will be used for the email body (wrapped in a template) and SMS content (if selected).
                            {form.channels.sms && ` ${form.message.length} characters · ${smsSegments} SMS credit${smsSegments === 1 ? '' : 's'} per recipient.`}
                        </p>
                    </div>

                    <button
                        type="submit"
                        disabled={loading || (!form.channels.email && !form.channels.sms)}
                        className="w-full bg-blue-700 text-white py-4 rounded-lg font-bold text-lg hover:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                        {loading ? (
                            <span className="flex items-center justify-center">
                                <i className="ri-loader-4-line animate-spin mr-2"></i> Sending...
                            </span>
                        ) : 'Send Campaign'}
                    </button>
                </form>
            </div>
        </div>
    );
}
