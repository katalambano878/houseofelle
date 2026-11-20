"use client";

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useCMS } from '@/context/CMSContext';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';
import Link from 'next/link';
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
  const contactPhone = getSetting('contact_phone') || '0570551050';
  const contactWhatsapp = getSetting('contact_whatsapp') || '0570551050';
  const contactAddress = getSetting('contact_address') || 'Spintex Lashibi, Shalom Spot Junction, Accra, Ghana';

  const heroContent = pageContent?.content || 'We are happy to help with perfume recommendations, gift sets, and bulk enquiries.';

  const waNumber = contactWhatsapp.replace(/[^0-9]/g, '');
  const waLink = waNumber.startsWith('0') ? `https://wa.me/233${waNumber.slice(1)}` : `https://wa.me/${waNumber}`;
  const telNumber = contactPhone.replace(/\s/g, '');
  const telLink = telNumber.startsWith('0') ? `tel:+233${telNumber.slice(1)}` : `tel:${telNumber}`;

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

  const hours = getSetting('business_hours') || '';
  const topics = ['A scent or product', 'My order', 'Wholesale', 'Something else'];
  const field = 'h-[50px] px-4 rounded-[14px] bg-white shadow-[inset_0_0_0_1px_rgba(31,17,21,0.16)] text-[15px] text-[#1F1115] outline-none focus:shadow-[inset_0_0_0_1.5px_#2B0B12]';
  const label = 'text-[13px] font-semibold';

  return (
    <main className="min-h-screen bg-[#F1E8DC] text-[#1F1115]">
      <Suspense fallback={null}>
        <ContactPrefill onPrefill={applyPrefill} />
      </Suspense>

      <section className="max-w-[1280px] mx-auto px-5 sm:px-8 lg:px-12 pt-10 md:pt-16 pb-7 md:pb-8 flex flex-wrap items-end justify-between gap-6">
        <div className="flex flex-col gap-2.5">
          <h1 className="font-serif text-[40px] md:text-[56px] leading-[0.95] tracking-[-0.02em]">
            We&apos;re here to <em>help</em>
          </h1>
          <p className="text-[15px] leading-relaxed text-[#6B565B] max-w-[480px]">{heroContent} WhatsApp is usually fastest.</p>
        </div>
        {hours && (
          <span className="inline-flex items-center gap-2 h-9 px-3.5 rounded-full bg-[#FBF6EF] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.12)] text-[13px] text-[#4D3A3F]">
            <span className="w-2 h-2 rounded-full bg-[#2F6B3A]" aria-hidden="true" />
            {hours}
          </span>
        )}
      </section>

      <section className="max-w-[1280px] mx-auto px-5 sm:px-8 lg:px-12 pb-14 md:pb-[72px] grid md:grid-cols-[1.3fr_1fr_1fr] gap-3 md:gap-4">
        <a href={waLink} target="_blank" rel="noopener noreferrer" className="group flex flex-col justify-between gap-10 min-h-[220px] md:min-h-[260px] p-6 md:p-7 rounded-[24px] bg-[#2B0B12] text-[#F6EDE3]">
          <span className="flex items-start justify-between">
            <span className="w-12 h-12 rounded-full bg-[#D9A441] text-[#2B0B12] inline-flex items-center justify-center"><i className="ri-whatsapp-line text-2xl" aria-hidden="true" /></span>
            <span className="text-xs font-semibold px-2.5 py-1.5 rounded-full bg-[#F6EDE3]/10">Fastest reply</span>
          </span>
          <span className="flex flex-col gap-1.5">
            <span className="font-serif text-[26px] md:text-[30px] leading-none">Chat on WhatsApp</span>
            <span className="text-sm text-[#E3CFC7] tabular-nums">{contactWhatsapp} · send a photo of a scent you like</span>
          </span>
        </a>
        <div className="flex flex-col justify-between gap-10 min-h-[200px] md:min-h-[260px] p-6 md:p-7 rounded-[24px] bg-[#FBF6EF] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.1)]">
          <span className="w-12 h-12 rounded-full bg-[#F1E8DC] inline-flex items-center justify-center"><i className="ri-phone-line text-xl" aria-hidden="true" /></span>
          <span className="flex flex-col gap-1.5">
            <a href={telLink} className="font-serif text-[24px] md:text-[26px] leading-none hover:text-[#7A1F2E]">Call us</a>
            <a href={telLink} className="text-sm text-[#6B565B] tabular-nums">{contactPhone}</a>
            <a href={`mailto:${contactEmail}`} className="text-sm text-[#6B565B] underline underline-offset-2">{contactEmail}</a>
          </span>
        </div>
        <a href={`https://www.google.com/maps?q=${MAP_QUERY}`} target="_blank" rel="noopener noreferrer" className="relative flex flex-col justify-end min-h-[200px] md:min-h-[260px] p-6 md:p-7 rounded-[24px] overflow-hidden bg-[#4A1520] text-[#F6EDE3]">
          <Image src="/Whisk_64e2698834d1476801a4b505b30c324bdr.jpeg" alt="" fill sizes="(max-width: 768px) 100vw, 30vw" className="object-cover opacity-45" />
          <span className="relative flex flex-col gap-1.5">
            <span className="font-serif text-[24px] md:text-[26px] leading-none">Visit the store</span>
            <span className="text-sm text-[#F6EDE3]">{contactAddress}</span>
          </span>
        </a>
      </section>

      <section className="bg-[#FBF6EF] border-t border-[#1F1115]/8">
        <div className="max-w-[1280px] mx-auto px-5 sm:px-8 lg:px-12 py-14 md:py-20 grid md:grid-cols-2 gap-12 md:gap-14 items-start">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <h2 className="font-serif text-[30px] md:text-[34px] leading-none mb-1">Or leave a <em>message</em></h2>
            <div role="group" aria-label="What is it about?" className="flex flex-wrap gap-2">
              {topics.map((t) => {
                const on = formData.subject === t;
                return (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setFormData({ ...formData, subject: t })}
                    className={`h-10 px-4 rounded-full text-sm font-semibold transition-colors ${on ? 'bg-[#2B0B12] text-[#F6EDE3]' : 'shadow-[inset_0_0_0_1px_rgba(31,17,21,0.2)] hover:bg-white'}`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5"><span className={label}>Your name</span><input type="text" name="name" required autoComplete="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className={field} /></label>
              <label className="flex flex-col gap-1.5"><span className={label}>Phone or WhatsApp</span><input type="tel" name="phone" autoComplete="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className={field} /></label>
            </div>
            <label className="flex flex-col gap-1.5"><span className={label}>Email</span><input type="email" name="email" required autoComplete="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className={field} /></label>
            {formData.subject && !topics.includes(formData.subject) && (
              <label className="flex flex-col gap-1.5"><span className={label}>Subject</span><input type="text" name="subject" value={formData.subject} onChange={(e) => setFormData({ ...formData, subject: e.target.value })} className={field} /></label>
            )}
            <label className="flex flex-col gap-1.5"><span className={label}>Message</span><textarea name="message" required rows={5} placeholder="Tell us what you're looking for" value={formData.message} onChange={(e) => setFormData({ ...formData, message: e.target.value })} className={`${field} h-auto py-3.5 resize-y`} /></label>
            {submitStatus === 'success' && <p role="status" className="rounded-2xl bg-[#DDE7D6] text-[#244A2C] px-4 py-3 text-sm">Thank you. We got your message and will reply by phone, WhatsApp or email.</p>}
            {submitStatus === 'error' && <p role="alert" className="rounded-2xl bg-[#F6DCD7] text-[#7A1F2E] px-4 py-3 text-sm">Your message didn&apos;t send. Please try again, or WhatsApp us.</p>}
            <div className="flex flex-wrap items-center gap-4">
              <button
                type="submit"
                disabled={isSubmitting || verifying || !formData.subject}
                className="h-[52px] px-7 rounded-full bg-[#2B0B12] text-[#F6EDE3] font-semibold disabled:opacity-50"
              >
                {verifying ? 'Checking…' : isSubmitting ? 'Sending…' : 'Send message'}
              </button>
              <span className="text-[13px] text-[#6B565B]">{formData.subject ? 'We usually reply the same day.' : 'Choose what it is about first.'}</span>
            </div>
          </form>

          <div className="flex flex-col gap-3.5">
            <h2 className="font-serif text-[30px] md:text-[34px] leading-none mb-1">Quick <em>answers</em></h2>
            <div className="border-t border-[#1F1115]/14">
              {faqs.map((faq) => (
                <details key={faq.question} className="group border-b border-[#1F1115]/14">
                  <summary className="flex items-center justify-between gap-4 min-h-[58px] cursor-pointer list-none [&::-webkit-details-marker]:hidden text-[15px] font-semibold">
                    {faq.question}
                    <i className="ri-add-line text-lg text-[#7A1F2E] transition-transform group-open:rotate-45 motion-reduce:transition-none" aria-hidden="true" />
                  </summary>
                  <p className="pb-4 text-sm leading-relaxed text-[#4D3A3F]">{faq.answer}</p>
                </details>
              ))}
            </div>
            <Link href="/order-tracking" className="self-start mt-2 inline-flex items-center gap-2 h-[46px] px-5 rounded-full shadow-[inset_0_0_0_1px_rgba(31,17,21,0.22)] text-sm font-semibold">
              Track an order
              <i className="ri-arrow-right-line" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
