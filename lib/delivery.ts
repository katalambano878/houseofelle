// Delivery options shared by checkout, POS, the order API and every order view,
// so a method saved on an order always shows the same name everywhere.

export type DeliveryMethod = 'pickup' | 'doorstep' | 'outside-accra';

export interface DeliveryOption {
  id: DeliveryMethod;
  label: string;
  description: string;
  /** Shown where a price would go. Doorstep and outside-Accra fees depend on the location. */
  feeLabel: string;
  icon: string;
  needsAddress: boolean;
}

export const DELIVERY_OPTIONS: DeliveryOption[] = [
  {
    id: 'pickup',
    label: 'Store Pickup',
    description: 'Collect from our store at Spintex Lashibi, Accra',
    feeLabel: 'Free',
    icon: 'ri-store-2-line',
    needsAddress: false,
  },
  {
    id: 'doorstep',
    label: 'Doorstep Delivery',
    description: 'Delivered to your address in Accra. We will call you with the delivery fee.',
    feeLabel: 'Delivery fee applies',
    icon: 'ri-truck-line',
    needsAddress: true,
  },
  {
    id: 'outside-accra',
    label: 'Outside Accra Delivery',
    description: 'Sent through a bus station (VIP, OA, STC, etc.). We will call you with the delivery fee.',
    feeLabel: 'Delivery fee applies',
    icon: 'ri-bus-line',
    needsAddress: true,
  },
];

export const DELIVERY_METHOD_IDS = new Set<string>(DELIVERY_OPTIONS.map((o) => o.id));

/** Readable name for a saved shipping_method, including values from older orders. */
export function deliveryLabel(method: string | null | undefined): string {
  const option = DELIVERY_OPTIONS.find((o) => o.id === method);
  if (option) return option.label;
  if (method === 'accra' || method === 'standard' || method === 'express') return 'Doorstep Delivery';
  return method ? method.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Store Pickup';
}

/** Where an order came from: the online store or the in-store POS. */
export function orderSource(order: { metadata?: any; shipping_address?: any } | null | undefined): 'web' | 'pos' {
  if (order?.metadata?.source === 'pos' || order?.metadata?.pos_sale || order?.shipping_address?.pos_sale) return 'pos';
  return 'web';
}
