import { supabaseAdmin } from '@/lib/supabase-admin';
import { sendOrderConfirmation } from '@/lib/notifications';

/**
 * Marks an order paid once a payment provider has confirmed it, then updates the customer's
 * stats and sends the confirmation SMS and email. mark_order_paid only reduces stock once,
 * so calling this twice for the same order is safe.
 */
export async function settlePaidOrder(orderNumber: string, providerRef: string) {
  const { data: orderJson, error } = await supabaseAdmin.rpc('mark_order_paid', {
    order_ref: orderNumber,
    moolre_ref: providerRef,
  });
  if (error) throw new Error(error.message);
  if (!orderJson) return null;

  if (orderJson.email) {
    try {
      await supabaseAdmin.rpc('update_customer_stats', { p_customer_email: orderJson.email, p_order_total: orderJson.total });
    } catch (err: any) {
      console.error('[Settle] Customer stats failed:', err?.message);
    }
  }
  try {
    await sendOrderConfirmation(orderJson);
  } catch (err: any) {
    console.error('[Settle] Notification failed:', err?.message);
  }
  return orderJson;
}
