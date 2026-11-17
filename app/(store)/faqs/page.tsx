"use client";

import { useState } from 'react';
import Link from 'next/link';

export default function FAQsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  const categories = [
    { id: 'all', name: 'All Questions', icon: 'ri-question-line' },
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

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-gradient-to-br from-blue-50 via-white to-amber-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
              Frequently Asked Questions
            </h1>
            <p className="text-xl text-gray-600 mb-8 leading-relaxed">
              Find quick answers about ordering, delivery, payment, our fragrances and more.
            </p>

            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for answers..."
                className="w-full pl-12 pr-4 py-4 border border-gray-300 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm shadow-lg"
              />
              <i className="ri-search-line absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 text-xl"></i>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex flex-wrap gap-3 justify-center mb-12">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
              className={`flex items-center gap-2 px-6 py-3 rounded-full font-medium transition-all whitespace-nowrap ${
                activeCategory === category.id
                  ? 'bg-blue-700 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <i className={`${category.icon} text-lg`}></i>
              {category.name}
            </button>
          ))}
        </div>

        {filteredFAQs.length > 0 ? (
          <div className="max-w-4xl mx-auto space-y-4">
            {filteredFAQs.map((faq, index) => (
              <details
                key={index}
                className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-lg transition-shadow"
              >
                <summary className="px-6 py-5 font-medium text-gray-900 cursor-pointer hover:bg-gray-50 transition-colors flex items-center justify-between">
                  <span className="flex-1 pr-4">{faq.question}</span>
                  <i className="ri-arrow-down-s-line text-xl text-gray-400"></i>
                </summary>
                <div className="px-6 pb-5 text-gray-600 leading-relaxed border-t border-gray-100 pt-4">
                  {faq.answer}
                </div>
              </details>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="ri-search-line text-4xl text-gray-400"></i>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No results found</h3>
            <p className="text-gray-600">
              Try adjusting your search or browse different categories
            </p>
          </div>
        )}
      </div>

      <div className="bg-gradient-to-br from-blue-700 to-blue-900 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <i className="ri-customer-service-2-line text-3xl text-white"></i>
          </div>
          <h2 className="text-3xl font-bold text-white mb-4">Still Have Questions?</h2>
          <p className="text-xl text-blue-100 mb-8 leading-relaxed">
            Our House of Elle team is ready to help with product and wholesale enquiries.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 bg-white text-blue-700 px-8 py-4 rounded-full font-medium hover:bg-blue-50 transition-colors whitespace-nowrap"
            >
              <i className="ri-mail-line text-lg"></i>
              Contact Support
            </Link>
            <a
              href="https://wa.me/233570551050"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-8 py-4 rounded-full font-medium hover:bg-blue-500 transition-colors whitespace-nowrap"
            >
              <i className="ri-whatsapp-line text-lg"></i>
              Chat on WhatsApp
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Quick Links</h2>
          <p className="text-gray-600">Explore more helpful resources</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <Link href="/shipping" className="bg-gray-50 p-8 rounded-2xl hover:shadow-lg transition-all cursor-pointer">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <i className="ri-truck-line text-2xl text-blue-700"></i>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Shipping Policy</h3>
            <p className="text-gray-600 leading-relaxed">
              How delivery works and how to track your orders
            </p>
          </Link>

          <Link href="/returns" className="bg-gray-50 p-8 rounded-2xl hover:shadow-lg transition-all cursor-pointer">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <i className="ri-arrow-go-back-line text-2xl text-blue-700"></i>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Returns</h3>
            <p className="text-gray-600 leading-relaxed">
              Report a damaged, leaking or wrong item from your order
            </p>
          </Link>

          <Link href="/privacy" className="bg-gray-50 p-8 rounded-2xl hover:shadow-lg transition-all cursor-pointer">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <i className="ri-shield-check-line text-2xl text-blue-700"></i>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Privacy & Security</h3>
            <p className="text-gray-600 leading-relaxed">
              See how we protect your personal information and data
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}
