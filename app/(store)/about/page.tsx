'use client';

import Link from 'next/link';
import { useCMS } from '@/context/CMSContext';
import PageHero from '@/components/PageHero';
import { usePageTitle } from '@/hooks/usePageTitle';

export default function AboutPage() {
  usePageTitle('Our Story');
  const { getSetting } = useCMS();

  const siteName = getSetting('site_name') || 'House of Elle';

  const values = [
    {
      icon: 'ri-verified-badge-line',
      title: 'Verified Quality',
      description: 'Every item is selected with care to deliver quality, consistency, and a luxurious experience at every price point.'
    },
    {
      icon: 'ri-money-dollar-circle-line',
      title: 'Unbeatable Prices',
      description: 'We offer fair, competitive pricing for both wholesale buyers and retail shoppers without compromising on quality.'
    },
    {
      icon: 'ri-global-line',
      title: 'Curated Fragrances',
      description: 'Perfumes, splashes, diffusers, scented candles, kids perfumes, body sprays, body butters, scented body lotions, and gift sets.'
    },
    {
      icon: 'ri-truck-line',
      title: 'Nationwide Delivery',
      description: 'Based in Spintex Lashibi, Accra, we deliver quickly and reliably across Ghana for personal and business orders.'
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      <PageHero
        eyebrow="Our Story"
        title="The House of Elle Story"
        subtitle="From Spintex Lashibi to fragrance lovers across Ghana, we curate scents and body care with elegance, value, and consistency."
        backgroundImage="/Whisk_743db4f33bd7ec08b0f46aec28e929cfdr.jpeg"
      />

      {/* Who We Are - Hero section */}
      <section className="py-20 bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-serif text-gray-900 mb-6">Who We Are</h2>
              <div className="space-y-4 text-lg text-gray-600 leading-relaxed">
                <p>
                  <strong>House of Elle</strong> is a fragrance and body-care destination built for people who love quality, elegance, and value. We serve both retail shoppers and wholesale buyers from our store at Spintex Lashibi, Shalom Spot Junction, Accra.
                </p>
                <p>
                  We curate perfumes, splashes, diffusers, scented candles, kids perfumes, body sprays, body butters, scented body lotions, and gift sets for everyday luxury.
                </p>
                <div className="pt-4">
                  <Link
                    href="#our-story"
                    className="inline-flex items-center text-blue-800 font-medium hover:text-blue-900 transition-colors group"
                  >
                    <span className="border-b border-transparent group-hover:border-blue-900 transition-colors">Read Our Story</span>
                    <i className="ri-arrow-right-line ml-2 transition-transform group-hover:translate-x-1"></i>
                  </Link>
                </div>
              </div>
            </div>
            <div className="relative mt-8 lg:mt-0">
              <div className="aspect-[4/3] rounded-2xl overflow-hidden shadow-2xl relative">
                <img
                  src="/Whisk_743db4f33bd7ec08b0f46aec28e929cfdr.jpeg"
                  alt="House of Elle — Premium perfumes"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute -bottom-6 left-4 right-4 sm:right-auto sm:-left-6 bg-white p-5 sm:p-6 rounded-xl shadow-xl border border-gray-100 z-10">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-brand-gold/15 rounded-full flex items-center justify-center text-brand-gold">
                    <i className="ri-medal-line text-xl sm:text-2xl"></i>
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-sm sm:text-base">Curated Luxury</p>
                    <p className="text-xs sm:text-sm text-gray-500">For retail & wholesale</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="our-story" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-12">
          <span className="inline-block text-brand-gold text-xs tracking-[0.24em] uppercase font-bold mb-3">Our Mission</span>
          <h2 className="text-3xl md:text-4xl font-serif text-gray-900">What Drives House of Elle</h2>
        </div>
        <div className="grid md:grid-cols-2 gap-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-brand-ivory p-10 rounded-3xl border border-brand-gold/20">
            <div className="w-16 h-16 bg-brand-gold rounded-2xl flex items-center justify-center mb-8 shadow-lg">
              <i className="ri-store-2-line text-3xl text-brand-black"></i>
            </div>
            <h3 className="text-3xl font-bold text-gray-900 mb-4">Luxury That Feels Personal</h3>
            <p className="text-gray-600 text-lg leading-relaxed">
              We help customers discover scents and body-care products that match their personality, mood, and budget with a warm, premium experience.
            </p>
          </div>
          <div className="bg-brand-champagne/25 p-10 rounded-3xl border border-brand-gold/25">
            <div className="w-16 h-16 bg-brand-brown rounded-2xl flex items-center justify-center mb-8 shadow-lg">
              <i className="ri-hand-heart-line text-3xl text-brand-ivory"></i>
            </div>
            <h3 className="text-3xl font-bold text-gray-900 mb-4">Built for Retail & Wholesale</h3>
            <p className="text-gray-600 text-lg leading-relaxed">
              We support entrepreneurs and resellers with dependable stock options and competitive wholesale pricing while serving everyday retail shoppers.
            </p>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <div className="bg-gray-50 py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Why Customers Choose House of Elle</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">Trusted for quality products, fair pricing, and reliable service.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {values.map((value, index) => (
              <div key={index} className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border border-brand-gold/10">
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-brand-gold/15 rounded-full flex items-center justify-center mb-5 sm:mb-6">
                  <i className={`${value.icon} text-xl sm:text-2xl text-brand-gold drop-shadow-sm`}></i>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2 sm:mb-3">{value.title}</h3>
                <p className="text-sm sm:text-base text-gray-600 leading-relaxed">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="bg-gradient-to-br from-brand-ivory via-white to-brand-ivory py-24 border-y border-brand-gold/20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-900">
          <h2 className="text-4xl md:text-5xl font-serif mb-8">Ready to Build Your Signature Scent Wardrobe?</h2>
          <p className="text-xl text-brand-brown mb-10 leading-relaxed max-w-2xl mx-auto">
            Explore perfumes, body care, diffusers, candles, and gift sets. For orders, call or WhatsApp 0570551050.
          </p>
          <Link
            href="/shop"
            className="inline-flex items-center gap-3 btn-gold px-10 py-5 rounded-full font-bold text-lg transition-colors shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all"
          >
            Start Shopping
            <i className="ri-arrow-right-line"></i>
          </Link>
        </div>
      </div>
    </div>
  );
}
