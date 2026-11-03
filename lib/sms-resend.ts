// Builds the order texts for Admin → SMS Resend. The wording matches the texts the store sends on its own
// (lib/notifications.ts: order confirmation, status updates and the payment link), so a resent text reads
// exactly like the one the customer should have received.

const STORE_NAME = process.env.NEXT_PUBLIC_STORE_NAME || 'House of Elle';

export function storeBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://houseofelle.store').replace(/\/+$/, '');
}

export type ResendOrder = {
  id: string;
  order_number: string | null;
  status: string;
  payment_status: string;
  total: number | string | null;
  phone: string | null;
  shipping_address: any;
  metadata: any;
};

export type SkipReason = 'no_phone' | 'bad_phone' | 'cancelled' | 'refunded';

export const SKIP_LABELS: Record<SkipReason, string> = {
  no_phone: 'No phone number',
  bad_phone: 'Phone number not valid',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

export type MessageKind = 'payment' | 'confirmed' | 'processing' | 'shipped' | 'delivered';

export const KIND_LABELS: Record<MessageKind, string> = {
  payment: 'Payment reminder (not paid yet)',
  confirmed: 'Order confirmed',
  processing: 'Being processed',
  shipped: 'Packaged / on the way',
  delivered: 'Delivered',
};

/** Customer name the same way lib/notifications.ts finds it. */
export function customerName(order: Pick<ResendOrder, 'shipping_address' | 'metadata'>): string {
  const { shipping_address, metadata } = order;
  if (shipping_address?.full_name) return String(shipping_address.full_name).trim();
  if (shipping_address?.firstName) {
    return shipping_address.lastName
      ? `${shipping_address.firstName} ${shipping_address.lastName}`.trim()
      : String(shipping_address.firstName).trim();
  }
  if (metadata?.first_name) {
    return metadata.last_name ? `${metadata.first_name} ${metadata.last_name}`.trim() : String(metadata.first_name).trim();
  }
  return 'Customer';
}

/**
 * Normalises a Ghana phone number to 233XXXXXXXXX (the form the SMS providers use), so one customer
 * with "024 …" on one order and "+233 24 …" on another gets one notice, not two. Returns null if unusable.
 */
export function normalisePhone(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  let digits = String(raw).replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = `233${digits.slice(1)}`;
  if (digits.length === 9) digits = `233${digits}`;
  if (digits.startsWith('233')) return digits.length === 12 ? digits : null;
  // Other countries: accept a plausible international number as given.
  return digits.length >= 10 && digits.length <= 15 ? digits : null;
}

export function orderPhone(order: Pick<ResendOrder, 'phone' | 'shipping_address'>): string | null {
  return order.phone || order.shipping_address?.phone || null;
}

export function buildOrderMessage(order: ResendOrder): { message: string; kind: MessageKind } | { skip: SkipReason } {
  const raw = orderPhone(order);
  if (!raw) return { skip: 'no_phone' };
  if (!normalisePhone(raw)) return { skip: 'bad_phone' };
  if (order.status === 'cancelled') return { skip: 'cancelled' };
  if (order.status === 'refunded' || order.payment_status === 'refunded' || order.payment_status === 'partially_refunded') {
    return { skip: 'refunded' };
  }

  const base = storeBaseUrl();
  const ref = order.order_number || order.id;
  const name = customerName(order);
  const trackingNumber = order.metadata?.tracking_number || '';
  const trackingUrl = `${base}/order-tracking?order=${ref}`;

  // Not paid yet: the payment-link text (sendPaymentLink).
  if (order.payment_status !== 'paid') {
    const amount = Number(order.total || 0).toFixed(2);
    return {
      kind: 'payment',
      message: `Hi ${name}, complete your order #${ref} (GH₵${amount}) here: ${base}/pay/${order.id}`,
    };
  }

  // Paid: the status texts (sendOrderStatusUpdate) or the confirmation (sendOrderConfirmation).
  if (order.status === 'shipped') {
    return {
      kind: 'shipped',
      message: trackingNumber
        ? `Good news ${name}! Order #${ref} has been packaged. Tracking: ${trackingNumber}. Track: ${trackingUrl}`
        : `Good news ${name}! Order #${ref} has been packaged. Track: ${trackingUrl}`,
    };
  }
  if (order.status === 'delivered') {
    return { kind: 'delivered', message: `Hi ${name}, your order #${ref} has been delivered. Enjoy your purchase!` };
  }
  if (order.status === 'processing') {
    return {
      kind: 'processing',
      message: trackingNumber
        ? `Hi ${name}, your order #${ref} is being processed. Tracking: ${trackingNumber}. Track: ${trackingUrl}`
        : `Hi ${name}, your order #${ref} is being processed. Track: ${trackingUrl}`,
    };
  }
  return {
    kind: 'confirmed',
    message: trackingNumber
      ? `Hi ${name}, your order #${ref} is confirmed! Tracking: ${trackingNumber}. Track here: ${trackingUrl}`
      : `Hi ${name}, your order #${ref} at ${STORE_NAME} is confirmed! Track here: ${trackingUrl}`,
  };
}

export const DEFAULT_NOTICE = `Hi, we are sorry our text updates about your order were delayed. You will now get them on time. Thank you for your patience. - ${STORE_NAME}`;

export const NOTICE_MAX_LENGTH = 459; // three standard SMS parts

const GSM_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM_EXTENDED = '^{}\\[~]|€\f';

/** How many SMS parts a message uses (what the provider charges). */
export function smsParts(message: string): number {
  let units = 0;
  let unicode = false;
  for (const ch of message) {
    if (GSM_BASIC.includes(ch)) units += 1;
    else if (GSM_EXTENDED.includes(ch)) units += 2;
    else {
      unicode = true;
      break;
    }
  }
  if (unicode) {
    const length = Array.from(message).length;
    return length <= 70 ? 1 : Math.ceil(length / 67);
  }
  return units <= 160 ? 1 : Math.ceil(units / 153);
}

export function maskPhone(phone: string): string {
  return phone.length > 6 ? `${phone.slice(0, 5)}•••${phone.slice(-3)}` : phone;
}
