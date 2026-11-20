'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import MiniCart from './MiniCart';
import { useCart } from '@/context/CartContext';
import { supabase } from '@/lib/supabase';
import { useWishlist } from '@/context/WishlistContext';
import { useCMS } from '@/context/CMSContext';
import AnnouncementBar from './AnnouncementBar';
import { usePromo } from '@/hooks/usePromo';

export default function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { wishlistCount } = useWishlist();
  const [user, setUser] = useState<any>(null);

  const { cartCount, isCartOpen, setIsCartOpen } = useCart();
  const { getSetting } = useCMS();
  const promo = usePromo();
  // A live sale with products gets its own menu link.
  const saleLink = promo?.live && promo.product_count > 0 ? [{ label: 'Sale', href: '/sale' }] : [];

  const pathname = usePathname();
  // The home page opens on a dark photograph, so its header is dark too.
  const dark = pathname === '/';
  const navLinks = [
    { label: 'Home', href: '/' },
    { label: 'Shop', href: '/shop' },
    ...saleLink,
    { label: 'Categories', href: '/categories' },
    { label: 'About', href: '/about' },
    { label: 'Contact', href: '/contact' },
  ];

  const siteName = getSetting('site_name') || 'House of Elle';
  const whatsappDigits = (getSetting('contact_whatsapp') || '0570551050').replace(/\D/g, '');
  const whatsappIntl = whatsappDigits.startsWith('0') ? `233${whatsappDigits.slice(1)}` : whatsappDigits;
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

      <header
        className={`sticky top-0 z-50 transition-colors duration-300 ${
          dark
            ? 'bg-[#14100D] text-[#F5EDE4] border-b border-[#F5EDE4]/10'
            : 'bg-[#F5EDE4]/95 text-[#221B16] backdrop-blur-md border-b border-[#221B16]/10'
        }`}
      >
        <div className="safe-area-top" />
        <nav aria-label="Main navigation" className="relative">
          <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-12">
            <div className="h-[72px] lg:h-[88px] grid grid-cols-[1fr_auto_1fr] lg:grid-cols-[auto_1fr_auto] items-center gap-4">
              <div className="flex items-center gap-2">
                <button
                  className="lg:hidden w-11 h-11 -ml-2 inline-flex items-center justify-center rounded-full"
                  onClick={() => setIsMobileMenuOpen(true)}
                  aria-label="Open menu"
                >
                  <i className="ri-menu-2-line text-2xl" aria-hidden="true"></i>
                </button>
                <Link href="/" className="hidden lg:flex items-center select-none" aria-label="Go to homepage">
                  <img src={headerLogo} alt={siteName} className={`h-11 w-auto object-contain ${dark ? 'brightness-0 invert-[.93] sepia-[.15]' : ''}`} />
                </Link>
              </div>

              <Link href="/" className="lg:hidden flex items-center justify-center select-none" aria-label="Go to homepage">
                <img src={headerLogo} alt={siteName} className={`h-9 w-auto object-contain ${dark ? 'brightness-0 invert-[.93] sepia-[.15]' : ''}`} />
              </Link>

              <div className="hidden lg:flex items-center justify-center gap-8 text-sm font-medium">
                {navLinks.map((link) => {
                  const active = link.href === '/' ? pathname === '/' : pathname?.startsWith(link.href);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      aria-current={active ? 'page' : undefined}
                      className={`relative py-2.5 transition-colors ${
                        link.href === '/sale' ? (dark ? 'text-[#E2BE72]' : 'text-[#8A6420]') : ''
                      } ${active ? 'shadow-[inset_0_-1.5px_0_currentColor]' : dark ? 'hover:text-[#E2BE72]' : 'hover:text-[#6B4F3A]'}`}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </div>

              <div className="flex items-center justify-end gap-1">
                <button
                  className="w-11 h-11 inline-flex items-center justify-center rounded-full"
                  onClick={() => setIsSearchOpen(true)}
                  aria-label="Search"
                >
                  <i className="ri-search-line text-xl" aria-hidden="true"></i>
                </button>
                <Link
                  href="/wishlist"
                  className="relative hidden sm:inline-flex w-11 h-11 items-center justify-center rounded-full"
                  aria-label={`Wishlist${wishlistCount ? `, ${wishlistCount} items` : ''}`}
                >
                  <i className="ri-heart-line text-xl" aria-hidden="true"></i>
                  {wishlistCount > 0 && (
                    <span className="absolute top-1.5 right-1 min-w-4 h-4 px-1 rounded-full bg-[#C89B3C] text-[10px] font-bold text-[#14100D] inline-flex items-center justify-center">
                      {wishlistCount}
                    </span>
                  )}
                </Link>
                <Link
                  href={user ? '/account' : '/auth/login'}
                  className="hidden sm:inline-flex w-11 h-11 items-center justify-center rounded-full"
                  aria-label={user ? 'Account' : 'Sign in'}
                >
                  <i className="ri-user-line text-xl" aria-hidden="true"></i>
                </Link>
                <div className="relative">
                  <button
                    className={`inline-flex items-center gap-2 h-11 pl-3 pr-4 rounded-full text-sm font-semibold ${
                      dark ? 'shadow-[inset_0_0_0_1px_rgba(245,237,228,0.25)]' : 'shadow-[inset_0_0_0_1px_rgba(34,27,22,0.18)]'
                    }`}
                    onClick={() => setIsCartOpen(!isCartOpen)}
                    aria-label={`Bag, ${cartCount} items`}
                  >
                    <i className="ri-shopping-bag-line text-xl" aria-hidden="true"></i>
                    <span className="tabular-nums">{cartCount}</span>
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
          <div className="absolute inset-y-0 left-0 w-full max-w-sm bg-[#14100D] text-[#F5EDE4] shadow-xl flex flex-col animate-in slide-in-from-left duration-300">
            <div className="h-16 px-4 flex items-center justify-between">
              <Link href="/" onClick={() => setIsMobileMenuOpen(false)}>
                <img src={headerLogo} alt={siteName} className="h-9 w-auto object-contain brightness-0 invert-[.93] sepia-[.15]" />
              </Link>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="w-11 h-11 -mr-1 inline-flex items-center justify-center rounded-full"
                aria-label="Close menu"
              >
                <i className="ri-close-line text-2xl"></i>
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-6 pt-4 pb-8">
              {[
                { label: 'Home', href: '/' },
                { label: 'Shop', href: '/shop' },
                ...saleLink,
                { label: 'Categories', href: '/categories' },
                { label: 'About', href: '/about' },
                { label: 'Contact', href: '/contact' },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center justify-between min-h-16 border-b border-[#F5EDE4]/10 font-serif text-[28px] ${link.href === '/sale' ? 'text-[#E2BE72]' : ''}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {link.label}
                  <i className="ri-arrow-right-s-line text-xl opacity-60" aria-hidden="true"></i>
                </Link>
              ))}
              <div className="flex flex-wrap gap-2 pt-6">
              {[
                { label: 'Track Order', href: '/order-tracking' },
                { label: 'Wishlist', href: '/wishlist' },
                { label: 'My Account', href: '/account' },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="inline-flex items-center h-11 px-4 rounded-full text-sm shadow-[inset_0_0_0_1px_rgba(245,237,228,0.25)]"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              </div>
            </nav>

            <div className="p-6 flex flex-col gap-3">
              <a href={`https://wa.me/${whatsappIntl}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 h-14 rounded-full bg-[#C89B3C] text-[#14100D] font-semibold">
                <i className="ri-whatsapp-line text-lg" aria-hidden="true"></i>WhatsApp us
              </a>
              <p className="text-center text-[13px] text-[#BFAF9F]">Spintex Lashibi, Shalom Spot Junction, Accra</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}