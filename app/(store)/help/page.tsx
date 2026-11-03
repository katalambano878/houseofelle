'use client';

import { useState } from 'react';
import Link from 'next/link';

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

  return (
      <main className="min-h-screen bg-gray-50">
        <div className="bg-gradient-to-br from-blue-700 to-blue-900 text-white py-16">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <h1 className="text-4xl font-bold mb-4">How can we help you?</h1>
            <p className="text-blue-100 mb-8 text-lg">Search our help center or browse by category</p>
            
            <div className="relative max-w-2xl mx-auto">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for articles..."
                className="w-full px-6 py-4 pl-14 rounded-xl text-gray-900 text-lg focus:outline-none focus:ring-4 focus:ring-blue-300"
              />
              <i className="ri-search-line absolute left-5 top-1/2 -translate-y-1/2 text-2xl text-gray-400"></i>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-5 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600"
                >
                  <i className="ri-close-line text-xl"></i>
                </button>
              )}
            </div>

            {searchQuery && filteredArticles.length > 0 && (
              <div className="mt-4 bg-white rounded-xl shadow-lg text-left max-w-2xl mx-auto max-h-96 overflow-y-auto">
                {filteredArticles.map((article) => (
                  <Link
                    key={article.id}
                    href={`/help/article/${article.id}`}
                    className="block p-4 hover:bg-gray-50 border-b border-gray-200 last:border-0"
                  >
                    <p className="font-semibold text-gray-900">{article.title}</p>
                    <p className="text-sm text-gray-600 mt-1">
                      {article.category}
                    </p>
                  </Link>
                ))}
              </div>
            )}

            {searchQuery && filteredArticles.length === 0 && (
              <div className="mt-4 bg-white rounded-xl shadow-lg p-6 text-center max-w-2xl mx-auto">
                <i className="ri-file-search-line text-4xl text-gray-400 mb-2"></i>
                <p className="text-gray-900 font-semibold">No results found</p>
                <p className="text-sm text-gray-600 mt-1">Try different keywords or browse categories below</p>
              </div>
            )}
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="mb-8 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">Browse by Category</h2>
            {selectedCategory && (
              <button
                onClick={() => setSelectedCategory(null)}
                className="text-blue-700 hover:text-blue-900 font-semibold whitespace-nowrap"
              >
                <i className="ri-arrow-left-line mr-2"></i>
                All Categories
              </button>
            )}
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {filteredCategories.map((category) => (
              <div
                key={category.id}
                className={`bg-white rounded-xl shadow-sm p-6 text-left hover:shadow-lg transition-all border-2 ${selectedCategory === category.id ? 'border-blue-700' : 'border-transparent hover:border-blue-700'}`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedCategory(selectedCategory === category.id ? null : category.id)}
                  aria-expanded={selectedCategory === category.id}
                  className="w-full text-left"
                >
                  <div className="w-14 h-14 flex items-center justify-center bg-blue-100 rounded-xl mb-4">
                    <i className={`${category.icon} text-3xl text-blue-700`}></i>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{category.title}</h3>
                  <p className="text-gray-600">
                    {category.articles.length} {category.articles.length === 1 ? 'article' : 'articles'}
                  </p>
                </button>

                {selectedCategory === category.id && (
                  <div className="mt-6 pt-6 border-t border-gray-200 space-y-3">
                    {category.articles.map((article) => (
                      <Link
                        key={article.id}
                        href={`/help/article/${article.id}`}
                        className="block text-sm text-gray-700 hover:text-blue-700 font-medium"
                      >
                        • {article.title}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl shadow-sm p-8 mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Popular Articles</h2>
            <div className="space-y-4">
              {popularArticles.map((article, index) => (
                <Link
                  key={article.id}
                  href={`/help/article/${article.id}`}
                  className="flex items-center justify-between p-4 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 flex items-center justify-center bg-blue-100 text-blue-700 rounded-full font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{article.title}</p>
                      <p className="text-sm text-gray-600">{article.category}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <i className="ri-arrow-right-s-line text-2xl text-gray-400"></i>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <Link
              href="/support/ticket"
              className="bg-white rounded-xl shadow-sm p-6 hover:shadow-lg transition-all text-center"
            >
              <div className="w-16 h-16 flex items-center justify-center bg-blue-100 rounded-full mx-auto mb-4">
                <i className="ri-customer-service-2-line text-3xl text-blue-700"></i>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Contact Support</h3>
              <p className="text-gray-600 text-sm mb-4">Get help from our support team</p>
              <span className="text-blue-700 font-semibold whitespace-nowrap">Create Ticket →</span>
            </Link>

            <Link
              href="/returns"
              className="bg-white rounded-xl shadow-sm p-6 hover:shadow-lg transition-all text-center"
            >
              <div className="w-16 h-16 flex items-center justify-center bg-purple-100 rounded-full mx-auto mb-4">
                <i className="ri-arrow-left-right-line text-3xl text-purple-700"></i>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Start a Return</h3>
              <p className="text-gray-600 text-sm mb-4">Report a damaged, leaking or wrong item</p>
              <span className="text-purple-700 font-semibold whitespace-nowrap">Start a Return →</span>
            </Link>

            <Link
              href="/order-tracking"
              className="bg-white rounded-xl shadow-sm p-6 hover:shadow-lg transition-all text-center"
            >
              <div className="w-16 h-16 flex items-center justify-center bg-amber-100 rounded-full mx-auto mb-4">
                <i className="ri-map-pin-line text-3xl text-amber-700"></i>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Track Order</h3>
              <p className="text-gray-600 text-sm mb-4">Check your order status</p>
              <span className="text-amber-700 font-semibold whitespace-nowrap">Track Now →</span>
            </Link>
          </div>
        </div>
      </main>
  );
}
