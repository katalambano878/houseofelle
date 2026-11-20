"use client";

import Link from 'next/link';
import { useState } from 'react';
import { useCMS } from '@/context/CMSContext';

function FooterSection({ title, children }: { title: string, children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-[#F5EDE4]/10 lg:border-none last:border-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-4 text-left lg:py-0 lg:cursor-default lg:mb-6"
      >
        <h4 className="font-bold text-lg text-white">{title}</h4>
        <i className={`ri-arrow-down-s-line text-[#E2BE72] text-xl transition-transform duration-300 lg:hidden ${isOpen ? 'rotate-180' : ''}`}></i>
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-96 pb-6' : 'max-h-0 lg:max-h-full lg:overflow-visible'}`}>
        {children}
      </div>
    </div>
  );
}

export default function Footer() {
  const { getSetting } = useCMS();

  const siteName = getSetting('site_name') || 'House of Elle';
  const siteTagline = getSetting('site_tagline') || 'Luxury fragrances for everyone.';
  const contactEmail = getSetting('contact_email') || 'support@houseofelle.com';
  const contactPhone = getSetting('contact_phone') || '0570551050';
  const contactWhatsapp = getSetting('contact_whatsapp') || '0570551050';
  const contactAddress = getSetting('contact_address') || 'Spintex Lashibi, Shalom Spot Junction, Accra, Ghana';
  const siteLogo = getSetting('site_logo') || '/house-of-elle-logo.png';
  const socialFacebook = getSetting('social_facebook') || '';
  const socialInstagram = getSetting('social_instagram') || '';
  const socialTwitter = getSetting('social_twitter') || '';
  const socialTiktok = getSetting('social_tiktok') || '';
  const socialSnapchat = getSetting('social_snapchat') || '';
  const socialYoutube = getSetting('social_youtube') || '';

  return (
    <footer className="relative z-0">

      <div className="absolute inset-0 bg-[#14100D] -z-10" aria-hidden="true" />

      <div className="text-white pt-16 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">

            {/* Brand Column */}
            <div className="lg:col-span-1 space-y-6">
              <Link href="/" className="inline-block group">
                <img src={siteLogo} alt={siteName} className="h-24 w-auto object-contain drop-shadow-lg group-hover:scale-105 transition-transform duration-300" />
              </Link>
              <p className="text-brand-ivory/80 leading-relaxed text-sm">
                {(() => {
                  // The tagline's first word quietly opens the admin sign-in for the owner.
                  const [first, ...rest] = siteTagline.split(' ');
                  return (
                    <>
                      <Link href="/admin/login" className="text-inherit no-underline hover:text-inherit focus-visible:outline-none" aria-label="Staff sign in" prefetch={false}>{first}</Link>
                      {rest.length ? ` ${rest.join(' ')}` : ''}
                    </>
                  );
                })()} {contactAddress}. Call {contactPhone} · WhatsApp {contactWhatsapp}
              </p>

              <div className="flex gap-3 pt-2">
                {[
                  { link: socialInstagram, icon: 'ri-instagram-line' },
                  { link: socialTiktok, icon: 'ri-tiktok-fill' },
                  { link: socialSnapchat, icon: 'ri-snapchat-fill' },
                  { link: socialYoutube, icon: 'ri-youtube-fill' },
                  { link: socialTwitter, icon: 'ri-twitter-x-fill' },
                  { link: socialFacebook, icon: 'ri-facebook-fill' }
                ].map((social, i) => social.link && (
                  <a
                    key={i}
                    href={social.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 bg-black/20 border border-brand-gold/50 rounded-full flex items-center justify-center text-brand-gold hover:bg-brand-gold hover:text-brand-black hover:border-brand-gold transition-all hover:-translate-y-1"
                  >
                    <i className={social.icon}></i>
                  </a>
                ))}
              </div>
            </div>

            {/* Links Sections */}
            <div className="lg:col-span-3 grid md:grid-cols-3 gap-8 lg:gap-12 pl-0 lg:pl-12">

              <div className="space-y-6">
                <h4 className="font-serif text-xl font-bold text-brand-ivory">Shop</h4>
                <ul className="space-y-3 text-brand-ivory/75 text-sm">
                  <li><Link href="/shop" className="hover:text-brand-gold transition-colors">All Products</Link></li>
                  <li><Link href="/categories" className="hover:text-brand-gold transition-colors">Collections</Link></li>
                  <li><Link href="/shop?sort=new" className="hover:text-brand-gold transition-colors">New Arrivals</Link></li>
                  <li><Link href="/shop?sort=popular" className="hover:text-brand-gold transition-colors">Most Popular</Link></li>
                </ul>
              </div>

              <div className="space-y-6">
                <h4 className="font-serif text-xl font-bold text-brand-ivory">Support</h4>
                <ul className="space-y-3 text-brand-ivory/75 text-sm">
                  <li><Link href="/contact" className="hover:text-brand-gold transition-colors">Contact Us</Link></li>
                  <li><Link href="/order-tracking" className="hover:text-brand-gold transition-colors">Track Order</Link></li>
                  <li><Link href="/shipping" className="hover:text-brand-gold transition-colors">Shipping & Delivery</Link></li>
                  <li><Link href="/returns" className="hover:text-brand-gold transition-colors">Returns & Exchange</Link></li>
                </ul>
              </div>

              <div className="space-y-6">
                <h4 className="font-serif text-xl font-bold text-brand-ivory">Company</h4>
                <ul className="space-y-3 text-brand-ivory/75 text-sm">
                  <li><Link href="/about" className="hover:text-brand-gold transition-colors">Our Story</Link></li>
                  <li><Link href="/privacy" className="hover:text-brand-gold transition-colors">Privacy Policy</Link></li>
                  <li><Link href="/terms" className="hover:text-brand-gold transition-colors">Terms of Service</Link></li>
                </ul>
              </div>

            </div>
          </div>

          <div className="border-t border-brand-gold/30 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-brand-ivory/60">
            <p>&copy; {new Date().getFullYear()} {siteName}. All rights reserved.</p>
            <p>
              Powered by{" "}
              <a href="https://doctorbarns.com" target="_blank" rel="noopener" className="text-brand-ivory/60 hover:underline">
                Doctor Barns Tech
              </a>
            </p>
            <p className="flex items-center gap-2 text-brand-gold/80">
              <i className="ri-smartphone-line text-lg" aria-hidden="true"></i>
              Secure Mobile Money payments
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
