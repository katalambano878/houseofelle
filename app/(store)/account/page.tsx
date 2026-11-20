'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import OrderHistory from './OrderHistory';
import AddressBook from './AddressBook';
import { supabase } from '@/lib/supabase';
import { useWishlist } from '@/context/WishlistContext';
import { money } from '@/lib/format-money';

const TABS = ['profile', 'orders', 'addresses', 'security'];

function AccountContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const initialTab = requestedTab && TABS.includes(requestedTab) ? requestedTab : 'orders';

  const [activeTab, setActiveTab] = useState(initialTab);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { wishlist, wishlistCount } = useWishlist();

  // Update active tab when URL param changes
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && TABS.includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  // Profile Form States
  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: ''
  });
  const [profileMessage, setProfileMessage] = useState({ type: '', text: '' });
  const [profileLoading, setProfileLoading] = useState(false);

  // Password Form States
  const [passwordData, setPasswordData] = useState({
    password: '',
    confirmPassword: ''
  });
  const [passwordMessage, setPasswordMessage] = useState({ type: '', text: '' });
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => {
    async function checkUser() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        const tab = searchParams.get('tab');
        const back = tab && TABS.includes(tab) ? `/account?tab=${tab}` : '/account';
        router.push(`/auth/login?redirect=${encodeURIComponent(back)}`);
        return;
      }

      setUser(session.user);
      setProfileData({
        firstName: session.user.user_metadata?.first_name || '',
        lastName: session.user.user_metadata?.last_name || '',
        email: session.user.email || '',
        phone: session.user.user_metadata?.phone || session.user.phone || ''
      });
      setLoading(false);
    }
    checkUser();
    // Only run on mount; tab changes are handled above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const selectTab = (tab: string) => {
    setActiveTab(tab);
    router.replace(tab === 'orders' ? '/account' : `/account?tab=${tab}`, { scroll: false });
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileMessage({ type: '', text: '' });

    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          first_name: profileData.firstName.trim(),
          last_name: profileData.lastName.trim(),
          full_name: [profileData.firstName.trim(), profileData.lastName.trim()].filter(Boolean).join(' '),
          phone: profileData.phone.trim()
        }
      });

      if (error) throw error;
      setProfileMessage({ type: 'success', text: 'Profile updated successfully!' });
    } catch (err: any) {
      setProfileMessage({ type: 'error', text: err.message });
    } finally {
      setProfileLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.password !== passwordData.confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }
    if (passwordData.password.length < 8) {
      setPasswordMessage({ type: 'error', text: 'Password must be at least 8 characters' });
      return;
    }

    setPasswordLoading(true);
    setPasswordMessage({ type: '', text: '' });

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.password
      });
      if (error) throw error;
      setPasswordMessage({ type: 'success', text: 'Password updated successfully!' });
      setPasswordData({ password: '', confirmPassword: '' });
    } catch (err: any) {
      setPasswordMessage({ type: 'error', text: err.message });
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/auth/login');
    router.refresh();
  };

  if (loading) {
    return <AccountLoading />;
  }

  const field =
    'w-full h-[52px] px-4 rounded-[14px] bg-white text-[16px] text-[#1F1115] placeholder:text-[#8A7479] outline-none shadow-[inset_0_0_0_1px_rgba(31,17,21,0.16)] focus:shadow-[inset_0_0_0_1.5px_#2B0B12] transition-shadow motion-reduce:transition-none';
  const label = 'text-[14px] font-semibold';
  const card = 'flex flex-col gap-6 p-6 md:p-8 rounded-[24px] bg-[#FBF6EF] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.1)]';
  const primary =
    'self-start inline-flex items-center justify-center min-h-[52px] px-7 rounded-full bg-[#2B0B12] text-[#F6EDE3] text-[15px] font-bold hover:bg-[#4A1520] transition-colors motion-reduce:transition-none disabled:opacity-50';

  const message = (m: { type: string; text: string }) =>
    m.text ? (
      <p
        role={m.type === 'success' ? 'status' : 'alert'}
        className={`flex items-start gap-2.5 rounded-2xl px-4 py-3 text-sm ${m.type === 'success' ? 'bg-[#DDE7D6] text-[#244A2C]' : 'bg-[#F6DCD7] text-[#7A1F2E]'}`}
      >
        <i className={`text-base leading-5 ${m.type === 'success' ? 'ri-checkbox-circle-line' : 'ri-error-warning-line'}`} aria-hidden="true"></i>
        <span>{m.text}</span>
      </p>
    ) : null;

  const menu: { id: string; label: string; count?: number; href?: string }[] = [
    { id: 'orders', label: 'Orders' },
    { id: 'saved', label: 'Saved items', count: wishlistCount, href: '/wishlist' },
    { id: 'addresses', label: 'Addresses' },
    { id: 'profile', label: 'Details and password' },
    { id: 'security', label: 'Privacy and security' },
    { id: 'help', label: 'Help', href: '/contact' },
  ];
  const menuItem = (on: boolean) =>
    `flex items-center justify-between gap-3 min-h-[48px] px-4 rounded-[14px] text-[15px] text-left transition-colors motion-reduce:transition-none ${
      on ? 'bg-[#2B0B12] text-[#F6EDE3] font-bold' : 'font-medium hover:bg-[#FBF6EF]'
    }`;

  const saved = wishlist.slice(0, 3);

  return (
    <main className="min-h-screen bg-[#F1E8DC] text-[#1F1115]">
      <section className="max-w-[1280px] mx-auto px-5 sm:px-8 lg:px-12 pt-10 md:pt-14 pb-24 md:pb-28 flex flex-col gap-8 md:gap-10">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex flex-col gap-1.5 min-w-0">
            <span className="text-[14px] text-[#6B565B] break-all">{user?.email}</span>
            <h1 className="font-serif text-[40px] md:text-[56px] leading-[0.95] tracking-[-0.02em]">
              {profileData.firstName ? <>Welcome back, <em>{profileData.firstName}</em></> : <>Welcome <em>back</em></>}
            </h1>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex items-center gap-2 min-h-[44px] text-[14px] font-semibold"
          >
            <i className="ri-logout-box-r-line" aria-hidden="true"></i>
            <span className="shadow-[inset_0_-1px_0_currentColor] pb-0.5">Sign out</span>
          </button>
        </div>

        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-start">
          <nav aria-label="Account" className="w-full lg:w-[240px] lg:flex-none lg:sticky lg:top-28">
            <ul className="grid grid-cols-2 lg:grid-cols-1 gap-1">
              {menu.map((item) => {
                const on = activeTab === item.id;
                const inner = (
                  <>
                    <span>{item.label}</span>
                    {item.count ? <span className="text-[13px] opacity-75 tabular-nums">{item.count}</span> : null}
                  </>
                );
                return (
                  <li key={item.id}>
                    {item.href ? (
                      <Link href={item.href} className={`${menuItem(false)} w-full`}>{inner}</Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => selectTab(item.id)}
                        aria-current={on ? 'page' : undefined}
                        className={`${menuItem(on)} w-full`}
                      >
                        {inner}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="flex-1 min-w-0 w-full flex flex-col gap-10">
            {activeTab === 'orders' && (
              <>
                <OrderHistory />

                {saved.length > 0 && (
                  <section className="flex flex-col gap-4" aria-labelledby="saved-title">
                    <div className="flex items-baseline justify-between gap-4">
                      <h2 id="saved-title" className="font-serif text-[28px] md:text-[30px] leading-none">Saved for later</h2>
                      <Link href="/wishlist" className="inline-flex items-center min-h-[44px] text-[14px] font-semibold">
                        <span className="shadow-[inset_0_-1px_0_currentColor] pb-0.5">See all</span>
                      </Link>
                    </div>
                    <ul className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-6 sm:gap-x-5">
                      {saved.map((item) => (
                        <li key={item.id}>
                          <Link href={`/product/${item.slug || item.id}`} className="group flex flex-col gap-3">
                            <span className="flex items-center justify-center aspect-[4/5] rounded-[18px] sm:rounded-[22px] bg-[#FBF6EF] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.1)] overflow-hidden">
                              <img
                                src={item.image || '/placeholder-product.svg'}
                                alt=""
                                className="w-[84%] h-[84%] object-contain mix-blend-multiply transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-105 motion-reduce:transition-none"
                              />
                            </span>
                            <span className="flex flex-col gap-0.5">
                              <span className="font-serif text-[18px] leading-tight line-clamp-2">{item.name}</span>
                              <span className="text-[15px] font-semibold tabular-nums">GH₵{money(item.price)}</span>
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </>
            )}

            {activeTab === 'addresses' && <AddressBook />}

            {activeTab === 'profile' && (
              <>
                <section className={card} aria-labelledby="details-title">
                  <div className="flex flex-col gap-1.5">
                    <h2 id="details-title" className="font-serif text-[28px] md:text-[30px] leading-none">Your details</h2>
                    <p className="text-[15px] text-[#6B565B]">Update your name and phone number.</p>
                  </div>

                  {message(profileMessage)}

                  <form onSubmit={handleUpdateProfile} className="flex flex-col gap-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-2">
                        <label htmlFor="acc-first" className={label}>First name</label>
                        <input
                          id="acc-first"
                          type="text"
                          autoComplete="given-name"
                          value={profileData.firstName}
                          onChange={e => setProfileData({ ...profileData, firstName: e.target.value })}
                          className={field}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label htmlFor="acc-last" className={label}>Last name</label>
                        <input
                          id="acc-last"
                          type="text"
                          autoComplete="family-name"
                          value={profileData.lastName}
                          onChange={e => setProfileData({ ...profileData, lastName: e.target.value })}
                          className={field}
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <label htmlFor="acc-email" className={label}>Email</label>
                      <input
                        id="acc-email"
                        type="email"
                        value={profileData.email}
                        disabled
                        aria-describedby="acc-email-note"
                        className="w-full h-[52px] px-4 rounded-[14px] bg-[#F1E8DC] text-[16px] text-[#6B565B] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.1)] cursor-not-allowed"
                      />
                      <p id="acc-email-note" className="text-[13px] text-[#6B565B]">Your sign-in email can&apos;t be changed here.</p>
                    </div>

                    <div className="flex flex-col gap-2">
                      <label htmlFor="acc-phone" className={label}>Phone number</label>
                      <input
                        id="acc-phone"
                        type="tel"
                        autoComplete="tel"
                        value={profileData.phone}
                        onChange={e => setProfileData({ ...profileData, phone: e.target.value })}
                        placeholder="+233 XX XXX XXXX"
                        className={field}
                      />
                    </div>

                    <button type="submit" disabled={profileLoading} className={primary}>
                      {profileLoading ? 'Saving…' : 'Save details'}
                    </button>
                  </form>
                </section>

                <section className={card} aria-labelledby="password-title">
                  <div className="flex flex-col gap-1.5">
                    <h2 id="password-title" className="font-serif text-[28px] md:text-[30px] leading-none">Change password</h2>
                    <p className="text-[15px] text-[#6B565B]">Use a strong password you don&apos;t use anywhere else.</p>
                  </div>

                  {message(passwordMessage)}

                  <form onSubmit={handleChangePassword} className="flex flex-col gap-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-2">
                        <label htmlFor="acc-new-pass" className={label}>New password</label>
                        <input
                          id="acc-new-pass"
                          type="password"
                          autoComplete="new-password"
                          value={passwordData.password}
                          onChange={e => setPasswordData({ ...passwordData, password: e.target.value })}
                          className={field}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label htmlFor="acc-confirm-pass" className={label}>Confirm password</label>
                        <input
                          id="acc-confirm-pass"
                          type="password"
                          autoComplete="new-password"
                          value={passwordData.confirmPassword}
                          onChange={e => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                          className={field}
                        />
                      </div>
                    </div>
                    <button type="submit" disabled={passwordLoading} className={primary}>
                      {passwordLoading ? 'Updating…' : 'Update password'}
                    </button>
                  </form>
                </section>
              </>
            )}

            {activeTab === 'security' && (
              <section className="flex flex-col gap-4" aria-labelledby="security-title">
                <h2 id="security-title" className="font-serif text-[28px] md:text-[30px] leading-none">Privacy and security</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex items-center gap-4 p-5 rounded-[20px] bg-[#FBF6EF] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.1)] min-w-0">
                    <span className="w-12 h-12 flex-none rounded-full bg-[#F1E8DC] inline-flex items-center justify-center">
                      <i className="ri-mail-line text-xl" aria-hidden="true"></i>
                    </span>
                    <span className="flex flex-col gap-0.5 min-w-0">
                      <span className="text-[15px] font-semibold">Sign-in email</span>
                      <span className="text-[14px] text-[#6B565B] truncate">{user?.email}</span>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => selectTab('profile')}
                    className="group flex items-center justify-between gap-4 p-5 rounded-[20px] bg-[#FBF6EF] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.1)] hover:shadow-[inset_0_0_0_1.5px_#2B0B12] text-left transition-shadow motion-reduce:transition-none"
                  >
                    <span className="flex items-center gap-4 min-w-0">
                      <span className="w-12 h-12 flex-none rounded-full bg-[#F1E8DC] inline-flex items-center justify-center">
                        <i className="ri-lock-password-line text-xl" aria-hidden="true"></i>
                      </span>
                      <span className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-[15px] font-semibold">Password</span>
                        <span className="text-[14px] text-[#6B565B]">Change your password</span>
                      </span>
                    </span>
                    <i className="ri-arrow-right-line text-lg text-[#7A1F2E]" aria-hidden="true"></i>
                  </button>
                  <Link
                    href="/account/privacy"
                    className="group flex items-center justify-between gap-4 p-5 rounded-[20px] bg-[#FBF6EF] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.1)] hover:shadow-[inset_0_0_0_1.5px_#2B0B12] transition-shadow motion-reduce:transition-none md:col-span-2"
                  >
                    <span className="flex items-center gap-4 min-w-0">
                      <span className="w-12 h-12 flex-none rounded-full bg-[#F1E8DC] inline-flex items-center justify-center">
                        <i className="ri-shield-user-line text-xl" aria-hidden="true"></i>
                      </span>
                      <span className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-[15px] font-semibold">Privacy and data</span>
                        <span className="text-[14px] text-[#6B565B]">Download your data or request account deletion</span>
                      </span>
                    </span>
                    <i className="ri-arrow-right-line text-lg text-[#7A1F2E]" aria-hidden="true"></i>
                  </Link>
                </div>
              </section>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function AccountLoading() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#F1E8DC]" aria-busy="true">
      <i className="ri-loader-4-line animate-spin motion-reduce:animate-none text-3xl text-[#2B0B12]" aria-label="Loading your account"></i>
    </main>
  );
}

export default function AccountPage() {
  return (
    <Suspense fallback={<AccountLoading />}>
      <AccountContent />
    </Suspense>
  );
}
