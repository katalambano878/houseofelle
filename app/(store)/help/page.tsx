'use client';

import { useState } from 'react';
import Link from 'next/link';
import PageHero from '@/components/PageHero';

// Each id must match an article in app/(store)/help/article/[id]/page.tsx.
const categories = [
  {
    id: 'orders',
    title: 'Orders & Delivery',
    icon: 'ri-truck-line',
    articles: [
      { id: 1, title: 'How do I track my order?' },
      { id: 2, title: 'How much is delivery and how long does it take?' },
      { id: 3, title: 'Can I change my delivery address?' },
    ],
  },
  {
    id: 'returns',
    title: 'Returns & Problems',
    icon: 'ri-arrow-left-right-line',
    articles: [
      { id: 6, title: 'My item arrived damaged, leaking or wrong. What do I do?' },
    ],
  },
  {
    id: 'payment',
    title: 'Payment',
    icon: 'ri-smartphone-line',
    articles: [
      { id: 11, title: 'How do I pay?' },
    ],
  },
  {
    id: 'account',
    title: 'Account',
    icon: 'ri-user-line',
    articles: [
      { id: 16, title: 'Creating an account and resetting your password' },
      { id: 19, title: 'Can I download my data or delete my account?' },
      { id: 20, title: 'How do I manage my saved addresses?' },
    ],
  },
  {
    id: 'products',
    title: 'Products & Wholesale',
    icon: 'ri-gift-line',
    articles: [
      { id: 21, title: 'Do you sell wholesale?' },
      { id: 25, title: 'How should I store my perfume?' },
    ],
  },
];

const popularArticles = [
  { id: 1, title: 'How do I track my order?', category: 'Orders & Delivery' },
  { id: 11, title: 'How do I pay?', category: 'Payment' },
  { id: 2, title: 'How much is delivery and how long does it take?', category: 'Orders & Delivery' },
  { id: 6, title: 'My item arrived damaged, leaking or wrong. What do I do?', category: 'Returns & Problems' },
  { id: 21, title: 'Do you sell wholesale?', category: 'Products & Wholesale' },
];

export default function HelpCenterPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filteredCategories = selectedCategory
    ? categories.filter(cat => cat.id === selectedCategory)
    : categories;

  const filteredArticles = searchQuery
    ? categories.flatMap(cat => 
        cat.articles.filter(article => 
          article.title.toLowerCase().includes(searchQuery.toLowerCase())
        ).map(article => ({ ...article, category: cat.title }))
      )
    : [];

  const actions = [
    { href: '/support/ticket', title: 'Contact support', text: 'Get help from our support team', cta: 'Create a ticket', icon: 'ri-customer-service-2-line' },
    { href: '/returns', title: 'Start a return', text: 'Report a damaged, leaking or wrong item', cta: 'Start a return', icon: 'ri-arrow-left-right-line' },
    { href: '/order-tracking', title: 'Track an order', text: 'Check your order status', cta: 'Track now', icon: 'ri-map-pin-line' },
  ];

  return (
    <main className="min-h-screen bg-[#F1E8DC] text-[#1F1115]">
      <PageHero title="How can we help?" subtitle="Search our help centre or browse by topic." />

      <div className="max-w-[1360px] mx-auto px-5 sm:px-8 lg:px-12 py-12 md:py-20">
        <div className="max-w-[720px] mx-auto flex flex-col gap-12 md:gap-16">
          <div className="flex flex-col gap-3">
            <label className="relative block">
              <span className="sr-only">Search help articles</span>
              <i className="ri-search-line absolute left-5 top-1/2 -translate-y-1/2 text-lg text-[#6B565B]" aria-hidden="true" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for articles"
                className="w-full h-[54px] pl-12 pr-14 rounded-full bg-[#FBF6EF] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.16)] text-[15px] text-[#1F1115] placeholder:text-[#6B565B] outline-none focus:shadow-[inset_0_0_0_1.5px_#2B0B12]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full inline-flex items-center justify-center text-[#6B565B] hover:text-[#1F1115] hover:bg-[#F1E8DC]"
                >
                  <i className="ri-close-line text-xl" aria-hidden="true" />
                </button>
              )}
            </label>

            {searchQuery && (
              <div aria-live="polite">
                {filteredArticles.length > 0 ? (
                  <ul className="rounded-[22px] bg-[#FBF6EF] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.1)] divide-y divide-[#1F1115]/10 overflow-hidden">
                    {filteredArticles.map((article) => (
                      <li key={article.id}>
                        <Link href={`/help/article/${article.id}`} className="flex flex-col gap-0.5 px-5 py-4 hover:bg-white transition-colors motion-reduce:transition-none">
                          <span className="text-[15px] font-semibold">{article.title}</span>
                          <span className="text-sm text-[#6B565B]">{article.category}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="rounded-[22px] bg-[#FBF6EF] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.1)] px-5 py-6 text-center">
                    <p className="font-serif text-[22px] leading-tight">No articles match that</p>
                    <p className="mt-1 text-sm text-[#6B565B]">Try different words, or browse the topics below.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <section aria-labelledby="help-topics" className="flex flex-col gap-5">
            <div className="flex items-end justify-between gap-4">
              <h2 id="help-topics" className="font-serif text-[28px] md:text-[30px] leading-none">Browse by <em>topic</em></h2>
              {selectedCategory && (
                <button
                  type="button"
                  onClick={() => setSelectedCategory(null)}
                  className="inline-flex items-center gap-1.5 min-h-[44px] text-sm font-semibold text-[#7A1F2E] whitespace-nowrap"
                >
                  <i className="ri-arrow-left-line" aria-hidden="true" />
                  All topics
                </button>
              )}
            </div>
            <ul className="border-t border-[#1F1115]/14">
              {filteredCategories.map((category) => {
                const open = selectedCategory === category.id;
                return (
                  <li key={category.id} className="border-b border-[#1F1115]/14">
                    <button
                      type="button"
                      onClick={() => setSelectedCategory(open ? null : category.id)}
                      aria-expanded={open}
                      className="w-full flex items-center gap-4 min-h-[68px] py-4 text-left"
                    >
                      <span className="flex-none w-11 h-11 rounded-full bg-[#FBF6EF] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.1)] inline-flex items-center justify-center">
                        <i className={`${category.icon} text-xl text-[#7A1F2E]`} aria-hidden="true" />
                      </span>
                      <span className="flex-1 flex flex-col gap-0.5">
                        <span className="font-serif text-[21px] md:text-[22px] leading-tight">{category.title.replace(' & ', ' and ')}</span>
                        <span className="text-sm text-[#6B565B]">
                          {category.articles.length} {category.articles.length === 1 ? 'article' : 'articles'}
                        </span>
                      </span>
                      <i className={`ri-add-line flex-none text-xl text-[#7A1F2E] transition-transform motion-reduce:transition-none ${open ? 'rotate-45' : ''}`} aria-hidden="true" />
                    </button>
                    {open && (
                      <ul className="pb-4 pl-[60px] flex flex-col">
                        {category.articles.map((article) => (
                          <li key={article.id}>
                            <Link
                              href={`/help/article/${article.id}`}
                              className="group flex items-center justify-between gap-3 min-h-[44px] py-2 text-[15px] text-[#4D3A3F] hover:text-[#7A1F2E]"
                            >
                              {article.title}
                              <i className="ri-arrow-right-line flex-none" aria-hidden="true" />
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          <section aria-labelledby="help-popular" className="flex flex-col gap-5">
            <h2 id="help-popular" className="font-serif text-[28px] md:text-[30px] leading-none">Popular <em>questions</em></h2>
            <ul className="border-t border-[#1F1115]/14">
              {popularArticles.map((article) => (
                <li key={article.id} className="border-b border-[#1F1115]/14">
                  <Link href={`/help/article/${article.id}`} className="group flex items-center justify-between gap-4 min-h-[64px] py-4">
                    <span className="flex flex-col gap-0.5">
                      <span className="text-[15px] md:text-base font-semibold">{article.title}</span>
                      <span className="text-sm text-[#6B565B]">{article.category.replace(' & ', ' and ')}</span>
                    </span>
                    <i className="ri-arrow-right-line flex-none text-xl transition-transform group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <ul className="mt-14 md:mt-20 grid md:grid-cols-3 gap-3 md:gap-4 max-w-[1100px] mx-auto">
          {actions.map((a, i) => (
            <li key={a.href}>
              <Link
                href={a.href}
                className={`flex h-full flex-col justify-between gap-8 min-h-[190px] p-6 md:p-7 rounded-[24px] ${
                  i === 0 ? 'bg-[#2B0B12] text-[#F6EDE3]' : 'bg-[#FBF6EF] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.1)]'
                }`}
              >
                <span className={`w-12 h-12 rounded-full inline-flex items-center justify-center ${i === 0 ? 'bg-[#D9A441] text-[#2B0B12]' : 'bg-[#F1E8DC] text-[#7A1F2E]'}`}>
                  <i className={`${a.icon} text-xl`} aria-hidden="true" />
                </span>
                <span className="flex flex-col gap-1.5">
                  <span className="font-serif text-[24px] md:text-[26px] leading-none">{a.title}</span>
                  <span className={`text-sm ${i === 0 ? 'text-[#E3CFC7]' : 'text-[#6B565B]'}`}>{a.text}</span>
                  <span className="mt-2 inline-flex items-center gap-2 text-sm font-semibold">
                    {a.cta}
                    <i className="ri-arrow-right-line" aria-hidden="true" />
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
