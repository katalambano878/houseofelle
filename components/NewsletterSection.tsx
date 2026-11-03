"use client";

import { useState } from 'react';

// Newsletter Component
export default function NewsletterSection() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus('idle');

    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error('Signup failed');
      setSubmitStatus('success');
      setEmail('');
    } catch {
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 mb-12">
      <div className="bg-gradient-to-br from-[#1a1410] via-brand-brown to-[#19130f] rounded-[2rem] overflow-hidden shadow-2xl relative">

        {/* Background Image / Texture */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-brand-gold rounded-full blur-[100px] opacity-30"></div>
          <div className="absolute top-40 -left-20 w-72 h-72 bg-brand-champagne rounded-full blur-[100px] opacity-24"></div>
        </div>

        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between p-8 md:p-10 lg:p-12 gap-8">

          {/* Left Content */}
          <div className="text-center lg:text-left max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/30 border border-brand-gold/40 text-brand-champagne text-xs font-bold tracking-widest uppercase mb-4 animate-pulse-glow">
              <span className="w-2 h-2 rounded-full bg-brand-gold"></span>
              The Insider Club
            </div>

            <h3 className="text-3xl md:text-4xl font-serif text-white mb-4 leading-tight">
              Get First Access to <br /> New Fragrances
            </h3>

            <p className="text-brand-ivory/80 text-base leading-relaxed">
              Be the first to discover new arrivals, restocks, and exclusive picks.
              Stay ahead - smell better before everyone else.
            </p>
          </div>

          {/* Right Form */}
          <div className="w-full max-w-md bg-black/22 backdrop-blur-md p-1.5 rounded-2xl border border-brand-gold/25 pwa-submit-form">
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="flex-1 bg-transparent border-none text-white placeholder-white/40 px-5 py-3 focus:ring-0 text-base"
              />
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-brand-gold hover:bg-brand-champagne text-brand-black font-bold px-6 py-3 rounded-xl transition-all hover:scale-105 active:scale-95 disabled:opacity-75 disabled:cursor-not-allowed shadow-lg whitespace-nowrap text-sm"
              >
                {isSubmitting ? (
                  <i className="ri-loader-4-line animate-spin text-lg"></i>
                ) : (
                  <span className="flex items-center gap-2">
                    Join <i className="ri-arrow-right-line"></i>
                  </span>
                )}
              </button>
            </form>
          </div>

        </div>

        {submitStatus === 'success' && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-brand-gold text-brand-black px-6 py-2 rounded-full font-bold shadow-lg animate-in fade-in slide-in-from-bottom-2">
            <i className="ri-checkbox-circle-line mr-2"></i> Welcome to the club!
          </div>
        )}
        {submitStatus === 'error' && (
          <div role="alert" className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white text-red-700 px-6 py-2 rounded-full font-semibold shadow-lg">
            <i className="ri-error-warning-line mr-2"></i> Couldn&apos;t sign you up. Please try again.
          </div>
        )}
      </div>
    </div>
  );
}
