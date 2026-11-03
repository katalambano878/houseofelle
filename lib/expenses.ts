// Staff expense categories and statuses. Safe on client and server.

export const EXPENSE_CATEGORIES = ['Transport', 'Packaging', 'Supplies', 'Utilities', 'Marketing', 'Other'] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_CATEGORY_META: Record<ExpenseCategory, { icon: string; hint: string }> = {
  Transport: { icon: 'ri-taxi-line', hint: 'Delivery riders, trotro, taxi, fuel' },
  Packaging: { icon: 'ri-gift-line', hint: 'Boxes, bags, tissue, tape, labels' },
  Supplies: { icon: 'ri-shopping-basket-line', hint: 'Shop supplies, cleaning, stationery' },
  Utilities: { icon: 'ri-flashlight-line', hint: 'Electricity, water, data, airtime' },
  Marketing: { icon: 'ri-megaphone-line', hint: 'Ads, printing, influencer fees' },
  Other: { icon: 'ri-more-2-line', hint: 'Anything else' },
};

export function isExpenseCategory(value: unknown): value is ExpenseCategory {
  return typeof value === 'string' && (EXPENSE_CATEGORIES as readonly string[]).includes(value);
}

/** Older rows may have no category; they count as Other. */
export function categoryOf(value: string | null | undefined): ExpenseCategory {
  return isExpenseCategory(value) ? value : 'Other';
}

export const EXPENSE_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];

export function isExpenseStatus(value: unknown): value is ExpenseStatus {
  return typeof value === 'string' && (EXPENSE_STATUSES as readonly string[]).includes(value);
}

export const EXPENSE_STATUS_META: Record<ExpenseStatus, { label: string; badge: string; icon: string }> = {
  pending: { label: 'Waiting for review', badge: 'bg-amber-100 text-amber-800', icon: 'ri-time-line' },
  approved: { label: 'Approved', badge: 'bg-green-100 text-green-800', icon: 'ri-check-line' },
  rejected: { label: 'Rejected', badge: 'bg-red-100 text-red-700', icon: 'ri-close-line' },
};

export const MAX_EXPENSE_AMOUNT = 100_000;
/** How far back a staff member may date an expense. */
export const MAX_EXPENSE_AGE_DAYS = 366;
