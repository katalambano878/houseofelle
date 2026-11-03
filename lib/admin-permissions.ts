// Admin screens and which team members may open them. Safe to import on the client.
//
// Two roles: the owner (admin) opens everything; staff open the screens granted
// to them. Grants live in site_settings, which only the owner can write, so a
// staff member cannot widen their own access.

export type AdminGroup = 'Sell' | 'Catalog' | 'Customers' | 'Reports' | 'Team' | 'Store';

export type AdminScreen = {
  key: string;
  title: string;
  icon: string;
  path: string;
  description: string;
  exact?: boolean;
  moduleId?: string;
  /** Owner-only screens are never granted to staff. */
  adminOnly?: boolean;
  group: AdminGroup;
};

export const ADMIN_SCREENS: AdminScreen[] = [
  { key: 'dashboard', title: 'Dashboard', icon: 'ri-dashboard-line', path: '/admin', exact: true, group: 'Sell', description: 'Store overview and key numbers' },
  { key: 'orders', title: 'Orders', icon: 'ri-shopping-bag-line', path: '/admin/orders', group: 'Sell', description: 'View and update customer orders' },
  { key: 'pos', title: 'POS System', icon: 'ri-store-3-line', path: '/admin/pos', group: 'Sell', description: 'Ring up in-store sales' },
  { key: 'end_of_day', title: 'End of Day', icon: 'ri-calendar-check-line', path: '/admin/end-of-day', group: 'Sell', description: 'Daily close: takings, cash count, website vs POS' },
  { key: 'sms_credit', title: 'Buy SMS', icon: 'ri-message-2-line', path: '/admin/sms-credit', adminOnly: true, group: 'Sell', description: 'Top up the store SMS balance' },
  { key: 'products', title: 'Products', icon: 'ri-box-3-line', path: '/admin/products', group: 'Catalog', description: 'Add and edit products' },
  { key: 'categories', title: 'Categories', icon: 'ri-folder-line', path: '/admin/categories', group: 'Catalog', description: 'Organise the catalogue' },
  { key: 'inventory', title: 'Inventory', icon: 'ri-stack-line', path: '/admin/inventory', group: 'Catalog', description: 'Stock levels' },
  { key: 'discounts', title: 'Discounts & Sales', icon: 'ri-price-tag-3-line', path: '/admin/discounts', group: 'Catalog', description: 'Sale campaigns, product discounts, banner and popup' },
  { key: 'coupons', title: 'Coupons', icon: 'ri-coupon-2-line', path: '/admin/coupons', group: 'Catalog', description: 'Checkout discount codes' },
  { key: 'customers', title: 'Customers', icon: 'ri-group-line', path: '/admin/customers', group: 'Customers', description: 'Customer records' },
  { key: 'reviews', title: 'Reviews', icon: 'ri-chat-smile-2-line', path: '/admin/reviews', group: 'Customers', description: 'Approve product reviews' },
  { key: 'customer_insights', title: 'Customer Insights', icon: 'ri-user-search-line', path: '/admin/customer-insights', moduleId: 'customer-insights', group: 'Customers', description: 'Buying patterns' },
  { key: 'notifications', title: 'Notifications', icon: 'ri-notification-3-line', path: '/admin/notifications', moduleId: 'notifications', group: 'Customers', description: 'Messages and campaigns to customers' },
  { key: 'analytics', title: 'Analytics', icon: 'ri-bar-chart-line', path: '/admin/analytics', group: 'Reports', description: 'Sales reports' },
  { key: 'expenses', title: 'Expenses', icon: 'ri-bill-line', path: '/admin/expenses', group: 'Reports', description: 'Money staff spent, for the owner to check' },
  { key: 'profit', title: 'Profit margins', icon: 'ri-scales-3-line', path: '/admin/profit', adminOnly: true, group: 'Reports', description: 'Cost price and margin per product' },
  { key: 'activity', title: 'Staff activity', icon: 'ri-history-line', path: '/admin/activity', adminOnly: true, group: 'Team', description: 'Everything staff did, and who sold what' },
  { key: 'staff', title: 'Staff', icon: 'ri-team-line', path: '/admin/staff', adminOnly: true, group: 'Team', description: 'Add and remove team members' },
  { key: 'roles', title: 'Roles & access', icon: 'ri-shield-user-line', path: '/admin/roles', adminOnly: true, group: 'Team', description: 'Which screens staff can open' },
  { key: 'blog', title: 'Blog', icon: 'ri-article-line', path: '/admin/blog', moduleId: 'blog', group: 'Store', description: 'Journal posts' },
  { key: 'sms_debugger', title: 'SMS Debugger', icon: 'ri-bug-line', path: '/admin/test-sms', adminOnly: true, group: 'Store', description: 'Send a test SMS' },
  { key: 'sms_resend', title: 'SMS Resend', icon: 'ri-refresh-line', path: '/admin/sms-resend', adminOnly: true, group: 'Store', description: 'Resend order SMS for a date range' },
  { key: 'watermark', title: 'Image watermark', icon: 'ri-copyright-line', path: '/admin/watermark', adminOnly: true, group: 'Store', description: 'Put the store logo or name on product photos' },
  { key: 'modules', title: 'Modules', icon: 'ri-puzzle-line', path: '/admin/modules', adminOnly: true, group: 'Store', description: 'Turn store features on or off' },
];

export const ADMIN_GROUPS: AdminGroup[] = ['Sell', 'Catalog', 'Customers', 'Reports', 'Team', 'Store'];

/** site_settings key: the screens every staff member gets unless set per person. */
export const STAFF_PERMISSIONS_KEY = 'staff_permissions';
/** site_settings key: per-person screen grants, { [userId]: { [screenKey]: boolean } }. */
export const STAFF_SCREENS_KEY = 'staff_screens';

export const DEFAULT_STAFF_PERMISSIONS: Record<string, boolean> = {
  dashboard: true,
  orders: true,
  pos: true,
  products: true,
  inventory: true,
  expenses: true,
};

export type StaffPermissions = Record<string, boolean>;

export const STAFF_GRANTABLE = ADMIN_SCREENS.filter((s) => !s.adminOnly);

/** Reads a stored grant map, filling gaps from the defaults and dropping owner-only screens. */
export function parseStaffPermissions(value: unknown, fallback: StaffPermissions = DEFAULT_STAFF_PERMISSIONS): StaffPermissions {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  const out: StaffPermissions = {};
  for (const screen of STAFF_GRANTABLE) {
    const stored = raw?.[screen.key];
    out[screen.key] = stored === undefined ? fallback[screen.key] === true : stored === true;
  }
  return out;
}

export function screenForPath(pathname: string): AdminScreen | undefined {
  const matches = ADMIN_SCREENS.filter((s) =>
    s.exact ? pathname === s.path : pathname === s.path || pathname.startsWith(`${s.path}/`)
  );
  return matches.sort((a, b) => b.path.length - a.path.length)[0];
}

export function canOpen(role: string | null | undefined, screen: AdminScreen | undefined, permissions: StaffPermissions): boolean {
  if (role === 'admin') return true;
  if (role !== 'staff' || !screen || screen.adminOnly) return false;
  return permissions[screen.key] === true;
}

export function canOpenPath(role: string | null | undefined, pathname: string, permissions: StaffPermissions): boolean {
  if (pathname === '/admin/login') return true;
  return canOpen(role, screenForPath(pathname), permissions);
}

export function firstAllowedPath(role: string | null | undefined, permissions: StaffPermissions): string {
  const first = ADMIN_SCREENS.find((s) => canOpen(role, s, permissions));
  return first?.path ?? '/admin/login';
}
