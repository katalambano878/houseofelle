"use client";

import Link from 'next/link';
import { useState } from 'react';
import { useCMS } from '@/context/CMSContext';

function FooterSection({ title, children }: { title: string, children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-[#F6EDE3]/10 lg:border-none last:border-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-4 text-left lg:py-0 lg:cursor-default lg:mb-6"
      >
        <h4 className="font-bold text-lg text-white">{title}</h4>
        <i className={`ri-arrow-down-s-line text-[#E5B65A] text-xl transition-transform duration-300 lg:hidden ${isOpen ? 'rotate-180' : ''}`}></i>
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

  const [first, ...rest] = siteTagline.replace(/\.$/, '').split(' ');
  const socials = [
    { link: socialInstagram, icon: 'ri-instagram-line', label: 'Instagram' },
    { link: socialTiktok, icon: 'ri-tiktok-fill', label: 'TikTok' },
    { link: socialSnapchat, icon: 'ri-snapchat-fill', label: 'Snapchat' },
    { link: socialYoutube, icon: 'ri-youtube-fill', label: 'YouTube' },
    { link: socialTwitter, icon: 'ri-twitter-x-fill', label: 'X' },
    { link: socialFacebook, icon: 'ri-facebook-fill', label: 'Facebook' },
  ].filter((x) => x.link);
  const col = 'flex flex-col gap-3.5 text-[15px] text-[#E3CFC7]';
  const head = 'font-serif italic text-lg text-[#E5B65A] mb-1';
  const lnk = 'hover:text-[#F6EDE3] transition-colors';

  return (
    <footer className="relative z-0 bg-[#2B0B12] text-[#F6EDE3] overflow-hidden">
      <div className="max-w-[1360px] mx-auto px-5 sm:px-8 lg:px-12 pt-16 md:pt-24">
        <div className="grid grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr] gap-x-8 gap-y-12">
          <div className="col-span-2 lg:col-span-1 flex flex-col gap-6">
            <p className="font-serif text-[28px] leading-[1.1] max-w-[440px]">
              {/* The tagline's first word quietly opens the admin sign-in for the owner. */}
              <Link href="/admin/login" className="text-inherit no-underline hover:text-inherit" aria-label="Staff sign in" prefetch={false}>{first}</Link>
              {rest.length > 1 ? (
                <>
                  {' '}{rest.slice(0, -1).join(' ')} <em className="text-[#E5B65A]">{rest[rest.length - 1]}.</em>
                </>
              ) : rest.length ? ` ${rest.join(' ')}.` : ''}
            </p>
            {socials.length > 0 && (
              <div className="flex gap-2.5">
                {socials.map((s2) => (
                  <a key={s2.icon} href={s2.link} target="_blank" rel="noopener noreferrer" aria-label={s2.label} className="w-11 h-11 rounded-full inline-flex items-center justify-center shadow-[inset_0_0_0_1px_rgba(246,237,227,0.25)] hover:bg-[#D9A441] hover:text-[#2B0B12] hover:shadow-none transition-colors">
                    <i className={`${s2.icon} text-lg`} aria-hidden="true"></i>
                  </a>
                ))}
              </div>
            )}
          </div>
          <div className={col}>
            <span className={head}>Shop</span>
            <Link href="/shop" className={lnk}>All fragrances</Link>
            <Link href="/categories" className={lnk}>Collections</Link>
            <Link href="/shop?sort=new" className={lnk}>New in</Link>
            <Link href="/sale" className={lnk}>Sale</Link>
          </div>
          <div className={col}>
            <span className={head}>Help</span>
            <Link href="/order-tracking" className={lnk}>Track an order</Link>
            <Link href="/shipping" className={lnk}>Delivery</Link>
            <Link href="/returns" className={lnk}>Returns</Link>
            <Link href="/faqs" className={lnk}>FAQs</Link>
            <Link href="/contact" className={lnk}>Contact us</Link>
          </div>
          <div className={`${col} col-span-2 sm:col-span-1 leading-relaxed`}>
            <span className={head}>Visit</span>
            <span>{contactAddress}</span>
            <a href={`tel:${contactPhone.replace(/\s/g, '')}`} className={`${lnk} tabular-nums`}>{contactPhone}</a>
            <a href={`mailto:${contactEmail}`} className={lnk}>{contactEmail}</a>
            <Link href="/about" className={lnk}>Our story</Link>
          </div>
        </div>

        <div className="mt-14 md:mt-20 py-5 border-t border-[#F6EDE3]/15 flex flex-col md:flex-row justify-between gap-3 text-[13px] text-[#CDB5AD]">
          <p>
            &copy; {new Date().getFullYear()} {siteName} · <Link href="/privacy" className={lnk}>Privacy</Link> · <Link href="/terms" className={lnk}>Terms</Link>
          </p>
          <p>
            Pay with MTN, Telecel or AT Mobile Money · Site by{' '}
            <a href="https://doctorbarns.com" target="_blank" rel="noopener" className={`${lnk} underline underline-offset-2`}>Doctor Barns Tech</a>
          </p>
        </div>
      </div>
      <p aria-hidden="true" className="font-serif text-center whitespace-nowrap leading-[0.78] tracking-[-0.04em] text-[#4A1520] text-[19vw] lg:text-[130px] translate-y-[14%] px-4 select-none">
        {siteName.replace(/ Elle$/, '')} <em>Elle</em>
      </p>
    </footer>
  );
}
