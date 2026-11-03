'use client';

import { useState, useTransition } from 'react';
import { testSmsAction } from './actions';
import { supabase } from '@/lib/supabase';

type TestResult = Awaited<ReturnType<typeof testSmsAction>>;

export default function TestSmsPage() {
    const [isPending, startTransition] = useTransition();
    const [result, setResult] = useState<TestResult | null>(null);
    const [phone, setPhone] = useState('');
    const [message, setMessage] = useState('Test message from House of Elle admin');

    const handleSend = () => {
        setResult(null);
        startTransition(async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                const token = session?.access_token || '';
                if (!token) {
                    setResult({ success: false, error: 'Your admin session has expired. Sign in again.' });
                    return;
                }
                setResult(await testSmsAction(phone, message, token));
            } catch (err: any) {
                setResult({ success: false, error: err?.message || 'Request failed' });
            }
        });
    };

    const canSend = phone.replace(/\D/g, '').length >= 9 && message.trim().length > 0;
    const segments = message.length <= 160 ? 1 : Math.ceil(message.length / 153);

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-6">Test SMS Integration</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-lg shadow border border-gray-100">
                    <h2 className="text-lg font-semibold mb-4">Send Test Request</h2>

                    <div className="space-y-4">
                        <div>
                            <label htmlFor="test-sms-phone" className="block text-sm font-medium text-gray-700 mb-1">
                                Phone Number
                            </label>
                            <input
                                id="test-sms-phone"
                                type="tel"
                                inputMode="tel"
                                autoComplete="off"
                                className="w-full border rounded-md p-2 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="e.g. 024XXXXXXX"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Local format (024...) is converted to +23324... before sending.
                            </p>
                        </div>

                        <div>
                            <label htmlFor="test-sms-message" className="block text-sm font-medium text-gray-700 mb-1">
                                Message
                            </label>
                            <textarea
                                id="test-sms-message"
                                maxLength={1000}
                                className="w-full border rounded-md p-2 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none h-24"
                                placeholder="Type your message..."
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                {message.length} characters · {segments} SMS credit{segments === 1 ? '' : 's'}
                            </p>
                        </div>

                        <button
                            onClick={handleSend}
                            disabled={isPending || !canSend}
                            className={`w-full py-2 px-4 rounded-md text-white font-medium transition-colors ${isPending || !canSend
                                    ? 'bg-gray-400 cursor-not-allowed'
                                    : 'bg-blue-600 hover:bg-blue-700'
                                }`}
                        >
                            {isPending ? 'Sending...' : 'Send SMS'}
                        </button>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow border border-gray-100">
                    <h2 className="text-lg font-semibold mb-4">Response & Debug Log</h2>

                    {result ? (
                        <div className="space-y-3">
                        <div className={`rounded-md p-3 text-sm font-medium ${result.success ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>
                            {result.success
                                ? `Sent${'provider' in result && result.provider ? ` via ${result.provider}` : ''}${'formattedPhone' in result && result.formattedPhone ? ` to ${result.formattedPhone}` : ''}.`
                                : ('error' in result && result.error) || 'The provider did not accept the message. See the response below.'}
                        </div>
                        <div className="bg-gray-900 text-gray-100 p-4 rounded-md font-mono text-sm overflow-auto max-h-[500px]">
                            <pre>{JSON.stringify(result, null, 2)}</pre>
                        </div>
                        </div>
                    ) : (
                        <div className="h-full flex items-center justify-center text-gray-400 border-2 border-dashed rounded-md min-h-[200px]">
                            Waiting for response...
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
