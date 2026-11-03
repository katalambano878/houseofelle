'use server';

import { verifyAdminToken } from '@/lib/auth';
import { sendSMS } from '@/lib/notifications';

/** Same Ghana formatting the shared sender uses, so the page can show what was dialled. */
function formatGhanaPhone(phone: string): string {
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('0')) cleaned = '233' + cleaned.slice(1);
    if (cleaned.length === 9) cleaned = '233' + cleaned;
    return '+' + cleaned;
}

/**
 * Sends one test SMS through the store's real sender (Taysend first, Moolre fallback),
 * so a passing test means order and campaign messages will go out too.
 */
export async function testSmsAction(phone: string, message: string, authToken: string) {
    const auth = await verifyAdminToken(authToken);
    if (!auth.authenticated) {
        return {
            success: false,
            error: 'Unauthorized: ' + (auth.error || 'Admin access required')
        };
    }
    // Test texts spend the store's SMS credit, and this page is owner-only in the admin menu.
    if (auth.role !== 'admin') {
        return { success: false, error: 'Only the store owner can send test SMS.' };
    }

    if (!phone || typeof phone !== 'string') {
        return { success: false, error: 'Enter a phone number.' };
    }
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 9 || digits.length > 15) {
        return { success: false, error: 'That does not look like a valid phone number.' };
    }
    if (!message || typeof message !== 'string' || !message.trim()) {
        return { success: false, error: 'Enter a message.' };
    }
    if (message.length > 1000) {
        return { success: false, error: 'Message is too long (1000 characters max).' };
    }

    const formattedPhone = formatGhanaPhone(phone);
    try {
        const result: any = await sendSMS({ to: phone, message });
        if (!result) {
            return {
                success: false,
                formattedPhone,
                error: 'No SMS provider is configured, or every provider failed. Check TAYSEND_API_KEY / TAYSEND_SENDER_ID or MOOLRE_SMS_API_KEY, and the server log.'
            };
        }
        return {
            success: result.status === 1,
            provider: result.provider || 'moolre',
            formattedPhone,
            result
        };
    } catch (error: any) {
        console.error('[Test SMS] Error:', error?.message);
        return { success: false, formattedPhone, error: error?.message || 'SMS sending failed' };
    }
}
