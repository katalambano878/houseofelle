"use client";

import { useState } from 'react';
import Link from 'next/link';
import PageHero from '@/components/PageHero';

export default function FAQsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  const categories = [
    { id: 'all', name: 'All', icon: 'ri-question-line' },
    { id: 'orders', name: 'Orders', icon: 'ri-shopping-bag-line' },
    { id: 'shipping', name: 'Delivery', icon: 'ri-truck-line' },
    { id: 'returns', name: 'Returns', icon: 'ri-arrow-go-back-line' },
    { id: 'payment', name: 'Payment', icon: 'ri-smartphone-line' },
    { id: 'products', name: 'Products & Wholesale', icon: 'ri-gift-line' },
    { id: 'account', name: 'Account', icon: 'ri-user-line' }
  ];

  const faqs = [
    {
      category: 'orders',
      question: 'How do I place an order?',
      answer: 'Browse our perfumes, body mists, scented candles and body care, add items to your cart and go to checkout. Enter your delivery details, then pay with Mobile Money. You\'ll see an order confirmation with your order number once your payment is confirmed.'
    },
    {
      category: 'orders',
      question: 'Can I change or cancel my order?',
      answer: 'Contact us as soon as possible with your order number via WhatsApp or call 0570551050, or use our contact form. We\'ll do our best to help, but once an order has been packed or sent out, changes may not be possible.'
    },
    {
      category: 'orders',
      question: 'How do I track my order?',
      answer: 'Visit our Order Tracking page and enter your order number and the email you used at checkout. If you have an account, you can also see your orders and their status under Account → Order History.'
    },
    {
      category: 'orders',
      question: 'What if I receive the wrong item?',
      answer: 'We\'re sorry! Contact us as soon as possible, ideally with photos of the item you received, or report it on our Returns page. Please keep the item and its packaging and we\'ll arrange the next steps with you.'
    },
    {
      category: 'shipping',
      question: 'Where do you deliver?',
      answer: 'We deliver within Ghana from our shop at Spintex Lashibi, Shalom Spot Junction, Accra.'
    },
    {
      category: 'shipping',
      question: 'How much does delivery cost and how long does it take?',
      answer: 'Delivery fees depend on your location and are confirmed after you order — checkout does not charge a delivery fee. We\'ll contact you to confirm the fee and the expected delivery time before your order goes out.'
    },
    {
      category: 'shipping',
      question: 'Do you ship outside Ghana?',
      answer: 'We currently serve customers within Ghana. If you are outside Ghana, contact us and we\'ll let you know what\'s possible.'
    },
    {
      category: 'returns',
      question: 'My perfume arrived damaged or leaking. What do I do?',
      answer: 'Contact us as soon as possible. Go to our Returns page, enter your order number and email, choose the affected items and tell us what happened. Keep the bottle and packaging, and send photos if you can — we\'ll get back to you to sort it out.'
    },
    {
      category: 'returns',
      question: 'What is your return policy?',
      answer: 'If something is wrong with your order — damaged, leaking, wrong or missing items — contact us as soon as possible or report it on our Returns page and we\'ll review it with you. For any other return question, please get in touch before sending anything back.'
    },
    {
      category: 'payment',
      question: 'What payment methods do you accept?',
      answer: 'We accept Mobile Money. At checkout you\'re taken to Moolre\'s secure payment page to approve the payment. Prices are in Ghana cedis (GH₵). Payment must be completed before your order is sent out.'
    },
    {
      category: 'payment',
      question: 'Is it safe to pay on your site?',
      answer: 'Yes. Our site uses an encrypted (HTTPS) connection and payments are processed by Moolre on their secure payment page, so we never see or store your Mobile Money PIN.'
    },
    {
      category: 'payment',
      question: 'My payment didn\'t go through. What should I do?',
      answer: 'Check that you approved the prompt and have enough balance, then try again. If money left your wallet but your order still shows as awaiting payment, contact us with your order number and we\'ll check it for you.'
    },
    {
      category: 'payment',
      question: 'How do refunds work?',
      answer: 'If we agree a refund with you — for example when an item is out of stock or arrived damaged — we\'ll confirm the amount and how you\'ll receive it. Contact us if you have a question about a refund.'
    },
    {
      category: 'products',
      question: 'What do you sell?',
      answer: 'House of Elle is a fragrance and body care destination: curated perfumes, body mists, scented candles and body care products, available for retail and wholesale.'
    },
    {
      category: 'products',
      question: 'Do you sell wholesale?',
      answer: 'Yes. Where a minimum order quantity applies, it\'s shown on the product page. For bulk orders or business enquiries, contact us and tell us what you need.'
    },
    {
      category: 'products',
      question: 'How should I store my perfume?',
      answer: 'Keep bottles in a cool, dry place away from direct sunlight, avoid hot cars and steamy bathrooms, and close the cap tightly after use. This helps your fragrance last longer.'
    },
    {
      category: 'products',
      question: 'Can you help me choose a fragrance or a gift?',
      answer: 'Of course. Message us on WhatsApp or use our contact form, tell us the scents you like or who the gift is for, and we\'ll suggest options.'
    },
    {
      category: 'account',
      question: 'Do I need an account to place an order?',
      answer: 'No, you can check out as a guest. An account lets you see your order history, save delivery addresses, keep a wishlist and track your support requests.'
    },
    {
      category: 'account',
      question: 'How do I reset my password?',
      answer: 'Select "Forgot Password" on the login page and enter your email address. We\'ll email you a link to choose a new password. If you don\'t receive it, check your spam folder or contact us.'
    },
    {
      category: 'account',
      question: 'Can I save more than one delivery address?',
      answer: 'Yes. Go to Account → Addresses to add, edit or delete saved addresses and choose your default.'
    },
    {
      category: 'account',
      question: 'How do I update my account information?',
      answer: 'Sign in and open your Account. On the Profile tab you can update your name and phone number and change your password. Your sign-in email can\'t be changed there — contact us if you need help with it.'
    }
  ];

  const filteredFAQs = faqs.filter(faq => {
    const matchesCategory = activeCategory === 'all' || faq.category === activeCategory;
    const matchesSearch = searchQuery === '' || 
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const links = [
    { href: '/shipping', title: 'Delivery', text: 'How delivery works and how to track your orders' },
    { href: '/returns', title: 'Returns', text: 'Report a damaged, leaking or wrong item from your order' },
    { href: '/privacy', title: 'Privacy and security', text: 'See how we protect your personal information and data' },
  ];

  return (
    <main className="min-h-screen bg-[#F1E8DC] text-[#1F1115]">
      <PageHero
        title="Questions, answered"
        subtitle="Find quick answers about ordering, delivery, payment, our fragrances and more."
      />

      <div className="max-w-[1360px] mx-auto px-5 sm:px-8 lg:px-12 py-12 md:py-20">
        <div className="max-w-[720px] mx-auto flex flex-col gap-8 md:gap-10">
          <div className="flex flex-col gap-4">
            <label className="relative block">
              <span className="sr-only">Search the questions</span>
              <i className="ri-search-line absolute left-5 top-1/2 -translate-y-1/2 text-lg text-[#6B565B]" aria-hidden="true" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for answers"
                className="w-full h-[54px] pl-12 pr-5 rounded-full bg-[#FBF6EF] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.16)] text-[15px] text-[#1F1115] placeholder:text-[#6B565B] outline-none focus:shadow-[inset_0_0_0_1.5px_#2B0B12]"
              />
            </label>
            <div role="group" aria-label="Filter by topic" className="flex gap-2 overflow-x-auto pb-1 -mx-5 px-5 sm:mx-0 sm:px-0 sm:flex-wrap">
              {categories.map((category) => {
                const on = activeCategory === category.id;
                return (
                  <button
                    key={category.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setActiveCategory(category.id)}
                    className={`shrink-0 min-h-[44px] px-4 rounded-full text-sm font-semibold whitespace-nowrap transition-colors motion-reduce:transition-none ${
                      on ? 'bg-[#2B0B12] text-[#F6EDE3]' : 'shadow-[inset_0_0_0_1px_rgba(31,17,21,0.2)] hover:bg-[#FBF6EF]'
                    }`}
                  >
                    {category.name}
                  </button>
                );
              })}
            </div>
          </div>

          {filteredFAQs.length > 0 ? (
            <div className="border-t border-[#1F1115]/14" aria-live="polite">
              {filteredFAQs.map((faq) => (
                <details key={faq.question} className="group border-b border-[#1F1115]/14">
                  <summary className="flex items-center justify-between gap-4 min-h-[64px] py-4 cursor-pointer list-none [&::-webkit-details-marker]:hidden text-[15px] md:text-base font-semibold">
                    {faq.question}
                    <i className="ri-add-line flex-none text-xl text-[#7A1F2E] transition-transform group-open:rotate-45 motion-reduce:transition-none" aria-hidden="true" />
                  </summary>
                  <p className="pb-5 pr-8 text-[15px] leading-[1.7] text-[#4D3A3F]">{faq.answer}</p>
                </details>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-center py-12" role="status">
              <p className="font-serif text-[26px] leading-tight">No answers match that</p>
              <p className="text-[15px] text-[#6B565B]">Try other words, or pick a different topic.</p>
            </div>
          )}

          <section aria-labelledby="still-questions" className="mt-4 flex flex-col gap-5 p-6 md:p-8 rounded-[24px] bg-[#2B0B12] text-[#F6EDE3]">
            <h2 id="still-questions" className="font-serif text-[28px] md:text-[30px] leading-none">Still have a <em className="text-[#E5B65A]">question?</em></h2>
            <p className="text-[15px] leading-relaxed text-[#E3CFC7] max-w-[480px]">Our House of Elle team is ready to help with product and wholesale enquiries.</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href="https://wa.me/233570551050"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 min-h-[52px] px-7 rounded-full bg-[#D9A441] text-[#2B0B12] font-semibold hover:bg-[#E5B65A] transition-colors motion-reduce:transition-none"
              >
                <i className="ri-whatsapp-line text-lg" aria-hidden="true" />
                Chat on WhatsApp
              </a>
              <Link
                href="/contact"
                className="inline-flex items-center justify-center gap-2 min-h-[52px] px-7 rounded-full shadow-[inset_0_0_0_1.5px_rgba(246,237,227,0.5)] font-semibold hover:bg-[#F6EDE3]/10 transition-colors motion-reduce:transition-none"
              >
                Contact us
              </Link>
            </div>
          </section>

          <nav aria-label="More help" className="border-t border-[#1F1115]/14">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="group flex items-center justify-between gap-4 py-5 border-b border-[#1F1115]/14">
                <span className="flex flex-col gap-1">
                  <span className="font-serif text-[22px] leading-tight">{l.title}</span>
                  <span className="text-sm text-[#6B565B]">{l.text}</span>
                </span>
                <i className="ri-arrow-right-line text-xl transition-transform group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0" aria-hidden="true" />
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </main>
  );
}
