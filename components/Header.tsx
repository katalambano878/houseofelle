'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import MiniCart from './MiniCart';
import { useCart } from '@/context/CartContext';
import { supabase } from '@/lib/supabase';
import { useWishlist } from '@/context/WishlistContext';
import { useCMS } from '@/context/CMSContext';
import AnnouncementBar from './AnnouncementBar';

export default function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { wishlistCount } = useWishlist();
  const [user, setUser] = useState<any>(null);

  const { cartCount, isCartOpen, setIsCartOpen } = useCart();
  const { getSetting } = useCMS();

  const siteName = getSetting('site_name') || 'House of Elle';
  const headerLogo = getSetting('site_logo') || '/house-of-elle-logo.png';

  useEffect(() => {
    // Auth logic
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
    };

    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/shop?search=${encodeURIComponent(searchQuery)}`;
    }
  };

  return (
    <>
      <AnnouncementBar />

      <header className="bg-brand-ivory/95 backdrop-blur-md sticky top-0 z-50 border-b border-brand-gold/20 transition-all duration-300 shadow-[0_8px_30px_rgba(10,10,10,0.06)]">
        <div className="safe-area-top" />
        <nav aria-label="Main navigation" className="relative">
          <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
            <div className="h-20 grid grid-cols-[auto_1fr_auto] items-center gap-4">

              {/* Left: Mobile Menu Trigger (Mobile) & Logo */}
              <div className="flex items-center gap-4">
                <button
                  className="lg:hidden p-2 -ml-2 text-brand-black hover:text-brand-gold transition-colors"
                  onClick={() => setIsMobileMenuOpen(true)}
                  aria-label="Open menu"
                >
                  <i className="ri-menu-line text-2xl"></i>
                </button>
                <Link
                  href="/"
                  className="flex items-center select-none rounded-md"
                  aria-label="Go to homepage"
                >
                  <img src={headerLogo} alt={siteName} className="h-10 sm:h-11 md:h-12 w-auto object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.1)]" />
                </Link>
              </div>

              {/* Center: Navigation Links (Desktop) */}
              <div className="hidden lg:flex items-center justify-center">
                <div className="flex items-center rounded-full border border-brand-gold/25 bg-white/70 px-5 py-2 shadow-sm">
                {[
                  { label: 'Home', href: '/' },
                  { label: 'Shop', href: '/shop' },
                  { label: 'Categories', href: '/categories' },
                  { label: 'About', href: '/about' },
                  { label: 'Contact', href: '/contact' },
                ].map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="group relative px-4 py-2 text-xs uppercase tracking-[0.2em] font-semibold text-brand-black transition-colors hover:text-brand-gold"
                  >
                    {link.label}
                    <span className="absolute left-4 right-4 -bottom-0.5 h-[2px] scale-x-0 bg-brand-gold transition-transform duration-300 ease-out group-hover:scale-x-100" />
                  </Link>
                ))}
                </div>
              </div>

              {/* Right: Icons */}
              <div className="flex items-center justify-end space-x-2 sm:space-x-4">
                <button
                  className="h-9 w-9 rounded-full border border-transparent bg-transparent text-brand-black hover:text-brand-gold hover:border-brand-gold/35 hover:bg-white/70 transition-all"
                  onClick={() => setIsSearchOpen(true)}
                  aria-label="Search"
                >
                  <i className="ri-search-line text-xl"></i>
                </button>

                <Link
                  href="/wishlist"
                  className="h-9 w-9 rounded-full border border-transparent bg-transparent text-brand-black hover:text-brand-gold hover:border-brand-gold/35 hover:bg-white/70 transition-all relative hidden sm:flex items-center justify-center"
                  aria-label="Wishlist"
                >
                  <i className="ri-heart-line text-xl"></i>
                  {wishlistCount > 0 && (
                    <span className="absolute top-1 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-brand-gold text-[10px] font-bold text-brand-black">
                      {wishlistCount}
                    </span>
                  )}
                </Link>

                {user ? (
                  <Link
                    href="/account"
                    className="h-9 w-9 rounded-full border border-transparent bg-transparent text-brand-black hover:text-brand-gold hover:border-brand-gold/35 hover:bg-white/70 transition-all hidden sm:flex items-center justify-center"
                    aria-label="Account"
                  >
                    <i className="ri-user-line text-xl"></i>
                  </Link>
                ) : (
                  <Link
                    href="/auth/login"
                    className="h-9 w-9 rounded-full border border-transparent bg-transparent text-brand-black hover:text-brand-gold hover:border-brand-gold/35 hover:bg-white/70 transition-all hidden sm:flex items-center justify-center"
                    aria-label="Login"
                  >
                    <i className="ri-user-line text-xl"></i>
                  </Link>
                )}

                <div className="relative">
                  <button
                    className="h-9 w-9 rounded-full border border-transparent bg-transparent text-brand-black hover:text-brand-gold hover:border-brand-gold/35 hover:bg-white/70 transition-all"
                    onClick={() => setIsCartOpen(!isCartOpen)}
                    aria-label="Cart"
                  >
                    <i className="ri-shopping-bag-line text-xl"></i>
                    {cartCount > 0 && (
                      <span className="absolute top-1 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-brand-gold text-[10px] font-bold text-brand-black">
                        {cartCount}
                      </span>
                    )}
                  </button>
                  <MiniCart isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
                </div>
              </div>

            </div>
          </div>
        </nav>
      </header>

      {isSearchOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-24">
          <div className="bg-white rounded-lg w-full max-w-2xl mx-4 shadow-2xl">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-900">Search Products</h3>
                <button
                  onClick={() => setIsSearchOpen(false)}
                  className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-700"
                >
                  <i className="ri-close-line text-2xl"></i>
                </button>
              </div>
              <form onSubmit={handleSearch}>
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search for products..."
                    className="w-full px-4 py-3 pr-12 border border-brand-gold/30 rounded-lg focus:ring-2 focus:ring-brand-gold focus:border-brand-gold text-base"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-brand-brown hover:text-brand-gold"
                  >
                    <i className="ri-search-line text-xl"></i>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )
      }

      {/* Mobile Menu Drawer */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[100] lg:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute top-0 left-0 bottom-0 w-4/5 max-w-xs bg-brand-ivory shadow-xl flex flex-col animate-in slide-in-from-left duration-300">
            <div className="p-4 border-b border-brand-gold/20 flex items-center justify-between">
              <Link href="/" onClick={() => setIsMobileMenuOpen(false)}>
                <img src={headerLogo} alt={siteName} className="h-9 w-auto object-contain drop-shadow-sm" />
              </Link>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 -mr-2 text-brand-brown hover:text-brand-black"
                aria-label="Close menu"
              >
                <i className="ri-close-line text-2xl"></i>
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-6 py-8 space-y-3">
              {[
                { label: 'Home', href: '/' },
                { label: 'Shop', href: '/shop' },
                { label: 'Categories', href: '/categories' },
                { label: 'About', href: '/about' },
                { label: 'Contact', href: '/contact' },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="block py-3 text-sm uppercase tracking-[0.2em] font-semibold text-brand-black hover:text-brand-gold transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <div className="h-px bg-brand-gold/20 my-6"></div>
              {[
                { label: 'Track Order', href: '/order-tracking' },
                { label: 'Wishlist', href: '/wishlist' },
                { label: 'My Account', href: '/account' },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="block py-3 text-sm font-medium text-brand-brown hover:text-brand-black transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="p-4 border-t border-brand-gold/20">
              <p className="text-xs text-brand-brown text-center">
                &copy; {new Date().getFullYear()} {siteName}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}