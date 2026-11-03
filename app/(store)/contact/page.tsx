"use client";

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useCMS } from '@/context/CMSContext';
import { supabase } from '@/lib/supabase';
import PageHero from '@/components/PageHero';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useRecaptcha } from '@/hooks/useRecaptcha';

const MAP_QUERY = 'Spintex%20Lashibi%20Shalom%20Spot%20Junction%20Accra';

/** Prefills subject/message from ?subject= and ?order= (e.g. "Get Help" on an order). */
function ContactPrefill({ onPrefill }: { onPrefill: (subject: string, message: string) => void }) {
  const searchParams = useSearchParams();
  const subject = (searchParams.get('subject') || '').slice(0, 150);
  const order = (searchParams.get('order') || '').slice(0, 40);

  useEffect(() => {
    if (!subject && !order) return;
    onPrefill(
      subject || (order ? `Order ${order}` : ''),
      order ? `Order number: ${order}\n\n` : ''
    );
    // Run once per distinct query; onPrefill is a stable state updater wrapper.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject, order]);

  return null;
}

export default function ContactPage() {
  usePageTitle('Contact Us');
  const { getSetting } = useCMS();
  const [pageContent, setPageContent] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const { getRawToken, verifying } = useRecaptcha();

  const applyPrefill = (subject: string, message: string) => {
    setFormData((prev) => ({
      ...prev,
      subject: prev.subject || subject,
      message: prev.message || message,
    }));
  };

  useEffect(() => {
    async function fetchContactContent() {
      const { data } = await supabase
        .from('cms_content')
        .select('*')
        .eq('section', 'contact')
        .eq('block_key', 'main')
        .single();

      if (data) {
        setPageContent(data);
      }
    }
    fetchContactContent();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus('idle');

    // reCAPTCHA verification
    const recaptchaToken = await getRawToken('contact');
    if (recaptchaToken === null) {
      setSubmitStatus('error');
      setIsSubmitting(false);
      return;
    }

    try {
      // Store in Supabase
      const { error } = await supabase
        .from('contact_submissions')
        .insert({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          subject: formData.subject,
          message: formData.message,
        });

      if (error) {
        // Table might not exist, still show success
        console.log('Note: contact_submissions table may not exist');
      }

      // Send Contact Notification (the server checks the reCAPTCHA token)
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'contact',
          recaptchaToken,
          payload: formData
        })
      });
      if (!res.ok && error) throw new Error('Message not delivered');

      setSubmitStatus('success');
      setFormData({ name: '', email: '', phone: '', subject: '', message: '' });
    } catch (error) {
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get contact details from CMS settings
  const contactEmail = getSetting('contact_email') || 'support@houseofelle.com';
  const contactPhone = getSetting('contact_phone') || '0553347531';
  const contactWhatsapp = getSetting('contact_whatsapp') || '0553347531';
  const contactAddress = getSetting('contact_address') || 'Spintex Lashibi, Shalom Spot Junction, Accra, Ghana';

  const heroTitle = pageContent?.title || 'Contact House of Elle';
  const heroSubtitle = pageContent?.subtitle || 'Need help with products or wholesale orders?';
  const heroContent = pageContent?.content || 'We are happy to help with perfume recommendations, gift sets, and bulk enquiries.';

  const waNumber = contactWhatsapp.replace(/[^0-9]/g, '');
  const waLink = waNumber.startsWith('0') ? `https://wa.me/233${waNumber.slice(1)}` : `https://wa.me/${waNumber}`;
  const telNumber = contactPhone.replace(/\s/g, '');
  const telLink = telNumber.startsWith('0') ? `tel:+233${telNumber.slice(1)}` : `tel:${telNumber}`;

  const contactMethods = [
    {
      icon: 'ri-phone-line',
      title: 'Call Us',
      value: contactPhone,
      link: telLink,
      description: 'Mon-Sat, 9am-6pm'
    },
    {
      icon: 'ri-mail-line',
      title: 'Email Us',
      value: contactEmail,
      link: `mailto:${contactEmail}`,
      description: 'We respond within 24 hours'
    },
    {
      icon: 'ri-whatsapp-line',
      title: 'WhatsApp',
      value: contactWhatsapp,
      link: waLink,
      description: 'Chat with us instantly'
    },
    {
      icon: 'ri-map-pin-line',
      title: 'Visit Us',
      value: contactAddress,
      link: `https://www.google.com/maps?q=${MAP_QUERY}`,
      description: 'Spintex Lashibi, Shalom Spot Junction, Accra, Ghana'
    }
  ];

  const faqs = [
    {
      question: 'What are your delivery times?',
      answer: 'Standard delivery takes 2-5 business days within Ghana. We package every order with care so your fragrances arrive in great condition.'
    },
    {
      question: 'Do you offer international shipping?',
      answer: 'We currently serve customers within Ghana from our Spintex Lashibi location.'
    },
    {
      question: 'What payment methods do you accept?',
      answer: 'We accept MOMO, Instant Bank Transfer, Cash (in store only), and Visa Card. Please note we do not accept payment on delivery.'
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      <Suspense fallback={null}>
        <ContactPrefill onPrefill={applyPrefill} />
      </Suspense>
      <PageHero
        eyebrow="Get In Touch"
        title="Contact House of Elle"
        subtitle="For personal orders, wholesale enquiries, or product guidance, our team is ready to help you choose the right scent."
        backgroundImage="/Whisk_835b10a10eab0caa2c7419d4a6e01102dr.jpeg"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {contactMethods.map((method, index) => (
            <a
              key={index}
              href={method.link}
              target={method.link.startsWith('http') ? '_blank' : '_self'}
              rel={method.link.startsWith('http') ? 'noopener noreferrer' : ''}
              className="bg-white border border-gray-200 p-6 rounded-2xl hover:shadow-lg hover:border-blue-200 transition-all cursor-pointer"
            >
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <i className={`${method.icon} text-2xl text-blue-700`}></i>
              </div>
              <h3 className="font-bold text-gray-900 mb-2">{method.title}</h3>
              <p className="text-blue-700 font-medium mb-1">{method.value}</p>
              <p className="text-sm text-gray-500">{method.description}</p>
            </a>
          ))}
        </div>


        <div className="grid lg:grid-cols-2 gap-12">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">Send Us a Message</h2>
            <p className="text-gray-600 mb-8">
              Fill out the form below and our team will get back to you as soon as possible.
            </p>

            <form id="contactForm" onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name *
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address *
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="+233 XX XXX XXXX"
                />
              </div>

              <div>
                <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-2">
                  Subject *
                </label>
                <input
                  type="text"
                  id="subject"
                  name="subject"
                  required
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="Order inquiry, product question, etc."
                />
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                  Message *
                </label>
                <textarea
                  id="message"
                  name="message"
                  required
                  rows={6}
                  maxLength={500}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
                  placeholder="Tell us how we can help you..."
                ></textarea>
                <p className="text-xs text-gray-500 mt-1">{formData.message.length}/500 characters</p>
              </div>

              {submitStatus === 'success' && (
                <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-xl">
                  <i className="ri-check-line mr-2"></i>
                  Message sent successfully! We’ll get back to you shortly.
                </div>
              )}

              {submitStatus === 'error' && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl">
                  <i className="ri-error-warning-line mr-2"></i>
                  We could not send your message right now. Please try again or contact us directly.
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || verifying}
                className="w-full bg-blue-700 text-white py-4 rounded-xl font-medium hover:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
              >
                {isSubmitting || verifying ? (verifying ? 'Verifying...' : 'Sending...') : 'Send Message'}
              </button>
            </form>
          </div>

          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">Quick Answers</h2>
            <p className="text-gray-600 mb-8">
              Quick answers for orders, delivery, wholesale, and payments
            </p>

            <div className="space-y-4 mb-12">
              {faqs.map((faq, index) => (
                <details key={index} className="bg-gray-50 rounded-xl overflow-hidden">
                  <summary className="px-6 py-4 font-medium text-gray-900 cursor-pointer hover:bg-gray-100 transition-colors">
                    {faq.question}
                  </summary>
                  <div className="px-6 pb-4 text-gray-600 leading-relaxed">
                    {faq.answer}
                  </div>
                </details>
              ))}
            </div>

            <div className="bg-gradient-to-br from-blue-700 to-blue-900 p-8 rounded-2xl text-white">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mb-4">
                <i className="ri-customer-service-2-line text-2xl"></i>
              </div>
              <h3 className="text-2xl font-bold mb-3">Need Immediate Help?</h3>
              <p className="text-blue-100 mb-6 leading-relaxed">
                Our House of Elle support team is available Mon-Sat, 9am-6pm. For urgent enquiries, reach us directly on WhatsApp.
              </p>
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-white text-blue-700 px-6 py-3 rounded-full font-medium hover:bg-blue-50 transition-colors whitespace-nowrap"
              >
                <i className="ri-whatsapp-line text-xl"></i>
                Chat on WhatsApp
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">Visit Our Store</h2>
            <p className="text-gray-600 mb-6 leading-relaxed">
              Prefer to shop in person? Visit House of Elle at Spintex Lashibi, Shalom Spot Junction, Accra, Ghana. Come and try our perfumes, body mists and candles in person, or ask us about wholesale.
            </p>
            <div className="flex flex-wrap justify-center gap-4 text-gray-600">
              <div className="flex items-center gap-2">
                <i className="ri-map-pin-2-line text-blue-700"></i>
                <span>{contactAddress}</span>
              </div>
              <div className="flex items-center gap-2">
                <i className="ri-time-line text-blue-700"></i>
                <span>Mon-Sat: 9am-6pm</span>
              </div>
            </div>
            <div className="mt-8 rounded-2xl overflow-hidden border border-brand-gold/20 shadow-md">
              <iframe
                title="House of Elle Location - Spintex Lashibi, Accra"
                src={`https://www.google.com/maps?q=${MAP_QUERY}&output=embed`}
                width="100%"
                height="320"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="w-full"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
