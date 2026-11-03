'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

/** Fired by the Modules page after a toggle, so the sidebar refreshes without a reload. */
const MODULES_CHANGED_EVENT = 'store-modules-changed';

type MenuItem = {
  title: string;
  icon: string;
  path: string;
  exact?: boolean;
  badge?: string;
  /** Hidden unless this store module is enabled. */
  moduleId?: string;
  /** Hidden from staff. */
  adminOnly?: boolean;
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  // Module Filtering State
  const [enabledModules, setEnabledModules] = useState<string[]>([]);
  // Paid orders still waiting to be packed or delivered.
  const [openOrders, setOpenOrders] = useState(0);

  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();

      if (pathname === '/admin/login') {
        setIsLoading(false);
        return;
      }

      if (!session) {
        router.push('/admin/login');
        return;
      }

      // Ensure auth cookie is set (in case user already had a session from before)
      document.cookie = `sb-access-token=${session.access_token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax; Secure`;

      // Check user role from profiles table
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (profileError || !profile) {
        console.error('Failed to fetch user profile');
        router.push('/admin/login');
        return;
      }

      // Only allow admin and staff roles
      if (profile.role !== 'admin' && profile.role !== 'staff') {
        console.warn('User does not have admin/staff role');
        document.cookie = 'sb-access-token=; path=/; max-age=0; SameSite=Lax; Secure';
        await supabase.auth.signOut();
        router.push('/admin/login?error=unauthorized');
        return;
      }

      setUser(session.user);
      setUserRole(profile.role);
      setIsAuthenticated(true);
      setIsLoading(false);
    }

    checkAuth();

    // Keep cookie in sync when session refreshes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED' && session) {
        document.cookie = `sb-access-token=${session.access_token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax; Secure`;
      }
      if (event === 'SIGNED_OUT') {
        document.cookie = 'sb-access-token=; path=/; max-age=0; SameSite=Lax; Secure';
        document.cookie = 'sb-refresh-token=; path=/; max-age=0; SameSite=Lax; Secure';
      }
    });

    return () => subscription.unsubscribe();
  }, [pathname, router]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showUserMenu && !target.closest('.user-menu-container')) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showUserMenu]);

  // Fetch Modules Effect (and again whenever the Modules page changes one)
  useEffect(() => {
    async function fetchModules() {
      try {
        const { data, error } = await supabase.from('store_modules').select('id, enabled');
        if (error) {
          console.warn('Error fetching modules:', error);
          return;
        }
        if (data) {
          setEnabledModules(data.filter((m: any) => m.enabled).map((m: any) => m.id));
        }
      } catch (err) {
        console.warn('Fetch modules failed:', err);
      }
    }
    fetchModules();
    window.addEventListener(MODULES_CHANGED_EVENT, fetchModules);
    return () => window.removeEventListener(MODULES_CHANGED_EVENT, fetchModules);
  }, []);

  // Open-order count for the header bell, refreshed on navigation.
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('payment_status', 'paid')
      .in('status', ['pending', 'processing'])
      .then(({ count, error }) => {
        if (!cancelled && !error) setOpenOrders(count ?? 0);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, pathname]);

  // Start with the sidebar closed on small screens.
  useEffect(() => {
    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  }, []);

  const handleLogout = async () => {
    // Clear auth cookies set during login
    document.cookie = 'sb-access-token=; path=/; max-age=0; SameSite=Lax; Secure';
    document.cookie = 'sb-refresh-token=; path=/; max-age=0; SameSite=Lax; Secure';
    await supabase.auth.signOut();
    router.push('/admin/login');
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">Loading Admin...</div>;
  }

  const menuItems: MenuItem[] = [
    {
      title: 'Dashboard',
      icon: 'ri-dashboard-line',
      path: '/admin',
      exact: true
    },
    {
      title: 'Orders',
      icon: 'ri-shopping-bag-line',
      path: '/admin/orders',
      badge: openOrders > 0 ? String(openOrders) : ''
    },
    {
      title: 'POS System',
      icon: 'ri-store-3-line',
      path: '/admin/pos'
    },
    {
      title: 'Buy SMS',
      icon: 'ri-message-2-line',
      path: '/admin/sms-credit',
      adminOnly: true
    },
    {
      title: 'Products',
      icon: 'ri-box-3-line',
      path: '/admin/products'
    },
    {
      title: 'Categories',
      icon: 'ri-folder-line',
      path: '/admin/categories'
    },
    {
      title: 'Customers',
      icon: 'ri-group-line',
      path: '/admin/customers'
    },
    {
      title: 'Reviews',
      icon: 'ri-chat-smile-2-line',
      path: '/admin/reviews'
    },
    {
      title: 'Inventory',
      icon: 'ri-stack-line',
      path: '/admin/inventory'
    },
    {
      title: 'Analytics',
      icon: 'ri-bar-chart-line',
      path: '/admin/analytics'
    },
    {
      title: 'Coupons',
      icon: 'ri-coupon-2-line',
      path: '/admin/coupons'
    },
    {
      title: 'Customer Insights',
      icon: 'ri-user-search-line',
      path: '/admin/customer-insights',
      moduleId: 'customer-insights'
    },
    {
      title: 'Notifications',
      icon: 'ri-notification-3-line',
      path: '/admin/notifications',
      moduleId: 'notifications'
    },
    {
      title: 'SMS Debugger',
      icon: 'ri-bug-line',
      path: '/admin/test-sms',
      adminOnly: true
    },
    {
      title: 'Blog',
      icon: 'ri-article-line',
      path: '/admin/blog',
      moduleId: 'blog'
    },
    {
      title: 'Modules',
      icon: 'ri-puzzle-line',
      path: '/admin/modules'
    },
  ];

  const visibleMenuItems = menuItems.filter(item => {
    if (item.adminOnly && userRole !== 'admin') return false;
    if (!item.moduleId) return true;
    return enabledModules.includes(item.moduleId);
  });

  // Special layout for Login Page
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden glass-overlay"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Mobile: Transform / Desktop: Width transition */}
      <aside
        className={`fixed top-0 left-0 z-40 h-screen bg-white border-r border-gray-200 transition-all duration-300
          w-64
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} 
          ${isSidebarOpen ? 'lg:w-64' : 'lg:w-0 lg:overflow-hidden'}
          lg:translate-x-0
        `}
      >
        <div className="h-full px-4 py-6 overflow-y-auto">
          <Link href="/admin" className="flex items-center mb-8 px-2 cursor-pointer">
            <span className="text-xl font-['Pacifico'] text-blue-700">House of Elle</span>
            <span className="ml-3 text-sm font-semibold text-gray-500">ADMIN</span>
          </Link>

          <nav className="space-y-1">
            {visibleMenuItems.map((item) => {
              const isActive = item.exact ? pathname === item.path : pathname.startsWith(item.path);
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  onClick={() => window.innerWidth < 1024 && setIsSidebarOpen(false)} // Close on mobile click
                  className={`flex items-center justify-between px-4 py-3 rounded-lg transition-colors cursor-pointer ${isActive
                    ? 'bg-blue-50 text-blue-700 font-semibold'
                    : 'text-gray-700 hover:bg-gray-50'
                    }`}
                >
                  <div className="flex items-center space-x-3">
                    <i className={`${item.icon} text-xl w-5 h-5 flex items-center justify-center`}></i>
                    <span>{item.title}</span>
                  </div>
                  {item.badge && (
                    <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="mt-8 pt-8 border-t border-gray-200">
            <Link
              href="/"
              target="_blank"
              onClick={() => window.innerWidth < 1024 && setIsSidebarOpen(false)}
              className="flex items-center space-x-3 px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer"
            >
              <i className="ri-external-link-line text-xl w-5 h-5 flex items-center justify-center"></i>
              <span>View Store</span>
            </Link>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className={`transition-all duration-300 ml-0 ${isSidebarOpen ? 'lg:ml-64' : 'lg:ml-0'}`}>
        <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
          <div className="px-4 py-4 lg:px-6 flex items-center justify-between">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              aria-label={isSidebarOpen ? 'Collapse menu' : 'Expand menu'}
              className="w-10 h-10 flex items-center justify-center text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
            >
              <i className={`${isSidebarOpen ? 'ri-menu-fold-line' : 'ri-menu-unfold-line'} text-xl`}></i>
            </button>

            <div className="flex items-center space-x-2 lg:space-x-4">
              <Link
                href="/admin/orders"
                aria-label={openOrders > 0 ? `${openOrders} paid orders to fulfil` : 'No paid orders waiting'}
                title={openOrders > 0 ? `${openOrders} paid order${openOrders === 1 ? '' : 's'} to fulfil` : 'No paid orders waiting'}
                className="relative w-10 h-10 flex items-center justify-center text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
              >
                <i className="ri-notification-3-line text-xl"></i>
                {openOrders > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {openOrders > 99 ? '99+' : openOrders}
                  </span>
                )}
              </Link>

              <div className="relative user-menu-container">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center space-x-2 lg:space-x-3 px-2 lg:px-3 py-2 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                >
                  <div className="w-8 h-8 lg:w-9 lg:h-9 flex items-center justify-center bg-blue-100 text-blue-700 rounded-full font-semibold">
                    {user?.email?.charAt(0).toUpperCase() || 'A'}
                  </div>
                  <div className="text-left hidden md:block">
                    <p className="text-sm font-semibold text-gray-900 capitalize">{userRole || 'Admin'}</p>
                    <p className="text-xs text-gray-500 max-w-[100px] truncate">{user?.email}</p>
                  </div>
                  <i className="ri-arrow-down-s-line text-gray-600"></i>
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-20">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center space-x-3 px-4 py-3 hover:bg-gray-50 transition-colors border-t border-gray-200 text-left cursor-pointer"
                    >
                      <i className="ri-logout-box-line text-red-600 w-5 h-5 flex items-center justify-center"></i>
                      <span className="text-red-600">Logout</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
