'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

function ConfirmationContent() {
  const searchParams = useSearchParams();
  const orderNumber = (searchParams.get('order') || '').slice(0, 40);

  const next = [
    { title: 'We review your request', text: 'Our team checks the order and the details you sent.' },
    { title: 'We get in touch', text: "We'll contact you using the details on your order to agree the next steps." },
    { title: 'Keep the item safe', text: "Please keep the item and its packaging until we've been in touch." },
  ];

  return (
    <main className="min-h-screen bg-[#F1E8DC] text-[#1F1115]">
      <div className="max-w-[1360px] mx-auto px-5 sm:px-8 lg:px-12 py-14 md:py-24">
        <div className="max-w-[640px] mx-auto flex flex-col gap-10">
          <div className="flex flex-col items-start gap-5">
            <span className="w-14 h-14 rounded-full bg-[#2B0B12] text-[#E5B65A] inline-flex items-center justify-center" aria-hidden="true">
              <i className="ri-check-line text-3xl" />
            </span>
            <h1 className="font-serif text-[38px] md:text-[52px] leading-[0.95] tracking-[-0.02em]">
              Return request <em>received</em>
            </h1>
            <p className="text-[15px] md:text-base leading-relaxed text-[#4D3A3F]">We&apos;ve received your return request and will contact you.</p>
            {orderNumber && (
              <p className="inline-flex items-center gap-2 h-9 px-3.5 rounded-full bg-[#FBF6EF] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.12)] text-sm">
                Order <span className="font-semibold tabular-nums">{orderNumber}</span>
              </p>
            )}
          </div>

          <section aria-labelledby="return-next" className="flex flex-col gap-4">
            <h2 id="return-next" className="font-serif text-[26px] md:text-[28px] leading-none">What happens <em>next</em></h2>
            <ol className="border-t border-[#1F1115]/14">
              {next.map((step, i) => (
                <li key={step.title} className="flex items-start gap-4 py-5 border-b border-[#1F1115]/14">
                  <span className="flex-none w-9 h-9 rounded-full bg-[#2B0B12] text-[#F6EDE3] inline-flex items-center justify-center text-sm font-semibold tabular-nums">{i + 1}</span>
                  <span className="flex flex-col gap-1">
                    <span className="text-base font-semibold">{step.title}</span>
                    <span className="text-[15px] leading-relaxed text-[#4D3A3F]">{step.text}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/shop"
              className="inline-flex items-center justify-center min-h-[56px] px-8 rounded-full bg-[#2B0B12] text-[#F6EDE3] font-semibold hover:bg-[#4A1520] transition-colors motion-reduce:transition-none whitespace-nowrap"
            >
              Continue shopping
            </Link>
            <Link
              href={orderNumber ? `/contact?order=${encodeURIComponent(orderNumber)}&subject=${encodeURIComponent(`Return request ${orderNumber}`)}` : '/contact'}
              className="inline-flex items-center justify-center min-h-[56px] px-8 rounded-full shadow-[inset_0_0_0_1.5px_#2B0B12] font-semibold hover:bg-[#2B0B12]/5 transition-colors motion-reduce:transition-none whitespace-nowrap"
            >
              Need help? Contact us
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function ReturnConfirmationPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#F1E8DC] flex items-center justify-center">
          <i className="ri-loader-4-line animate-spin motion-reduce:animate-none text-4xl text-[#7A1F2E]" aria-label="Loading" />
        </main>
      }
    >
      <ConfirmationContent />
    </Suspense>
  );
}
