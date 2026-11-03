'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import AdminOrderBell from '@/components/admin/AdminOrderBell';
import {
  ADMIN_GROUPS,
  ADMIN_SCREENS,
  canOpen,
  canOpenPath,
  firstAllowedPath,
  type StaffPermissions,
} from '@/lib/admin-permissions';

/** Fired by the Modules page after a toggle, so the sidebar refreshes without a reload. */
const MODULES_CHANGED_EVENT = 'store-modules-changed';

type Member = { id: string; role: 'admin' | 'staff'; name: string; email: string; screens: StaffPermissions };

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [member, setMember] = useState<Member | null>(null);
  const [enabledModules, setEnabledModules] = useState<string[]>([]);
  // Paid orders still waiting to be packed or delivered.
  const [openOrders, setOpenOrders] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function checkAuth() {
      if (pathname === '/admin/login') {
        setIsLoading(false);
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/admin/login');
        return;
      }

      // Ensure auth cookie is set (in case user already had a session from before)
      document.cookie = `sb-access-token=${session.access_token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax; Secure`;

      let me: Member | null = null;
      try {
        const res = await fetch('/api/admin/me', {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: 'no-store',
        });
        if (res.ok) me = await res.json();
      } catch {
        me = null;
      }
      if (cancelled) return;

      if (!me) {
        document.cookie = 'sb-access-token=; path=/; max-age=0; SameSite=Lax; Secure';
        await supabase.auth.signOut();
        router.push('/admin/login?error=unauthorized');
        return;
      }

      setMember(me);
      // Staff who open a screen they were not given land on their first allowed one.
      if (!canOpenPath(me.role, pathname, me.screens)) {
        router.replace(firstAllowedPath(me.role, me.screens));
        return;
      }
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

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
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

  // Open-order count for the Orders menu badge, refreshed on navigation.
  useEffect(() => {
    if (!member) return;
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
  }, [member, pathname]);

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

  // Special layout for Login Page
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  if (isLoading || !member) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">Loading Admin...</div>;
  }

  const sections = ADMIN_GROUPS.map((group) => ({
    group,
    items: ADMIN_SCREENS.filter(
      (s) =>
        s.group === group &&
        canOpen(member.role, s, member.screens) &&
        (!s.moduleId || enabledModules.includes(s.moduleId))
    ),
  })).filter((s) => s.items.length > 0);

  const initials = (member.name || member.email || 'A')
    .split(/\s+/)
    .map((w) => w.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();

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
        <div className="h-full px-3 py-6 overflow-y-auto overscroll-contain">
          <Link href="/admin" className="flex items-center mb-6 px-3 cursor-pointer">
            <span className="text-xl font-['Pacifico'] text-blue-700">House of Elle</span>
            <span className="ml-3 text-sm font-semibold text-gray-500">ADMIN</span>
          </Link>

          <nav className="space-y-5" aria-label="Admin">
            {sections.map(({ group, items }) => (
              <div key={group}>
                <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">{group}</p>
                <div className="space-y-0.5">
                  {items.map((item) => {
                    const isActive = item.exact
                      ? pathname === item.path
                      : pathname === item.path || pathname.startsWith(`${item.path}/`);
                    const badge = item.key === 'orders' && openOrders > 0 ? String(openOrders) : '';
                    return (
                      <Link
                        key={item.path}
                        href={item.path}
                        onClick={() => window.innerWidth < 1024 && setIsSidebarOpen(false)}
                        aria-current={isActive ? 'page' : undefined}
                        className={`flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors cursor-pointer ${isActive
                          ? 'bg-blue-50 text-blue-700 font-semibold'
                          : 'text-gray-700 hover:bg-gray-50'
                          }`}
                      >
                        <span className="flex items-center gap-3">
                          <i className={`${item.icon} text-lg w-5 h-5 flex items-center justify-center`} aria-hidden="true"></i>
                          <span className="text-sm">{item.title}</span>
                        </span>
                        {badge && (
                          <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">
                            {badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <Link
              href="/"
              target="_blank"
              onClick={() => window.innerWidth < 1024 && setIsSidebarOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer"
            >
              <i className="ri-external-link-line text-lg w-5 h-5 flex items-center justify-center" aria-hidden="true"></i>
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
              {canOpen(member.role, ADMIN_SCREENS.find((s) => s.key === 'orders'), member.screens) && <AdminOrderBell />}

              <div className="relative user-menu-container">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center space-x-2 lg:space-x-3 px-2 lg:px-3 py-2 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                >
                  <div className="w-8 h-8 lg:w-9 lg:h-9 flex items-center justify-center bg-blue-100 text-blue-700 rounded-full font-semibold text-sm">
                    {initials}
                  </div>
                  <div className="text-left hidden md:block">
                    <p className="text-sm font-semibold text-gray-900 max-w-[140px] truncate">{member.name}</p>
                    <p className="text-xs text-gray-500">{member.role === 'admin' ? 'Owner' : 'Staff'}</p>
                  </div>
                  <i className="ri-arrow-down-s-line text-gray-600"></i>
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-20">
                    <div className="px-4 py-3">
                      <p className="text-sm font-semibold text-gray-900 truncate">{member.name}</p>
                      <p className="text-xs text-gray-500 truncate">{member.email}</p>
                    </div>
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
