'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

const LOVES = [
  { label: 'Sweet', search: 'vanilla' },
  { label: 'Woody', search: 'wood' },
  { label: 'Floral', search: 'rose' },
  { label: 'Fresh', search: 'citrus' },
  { label: 'Smoky', search: 'oud' },
];
const FOR = [
  { label: 'Me', category: '' },
  { label: 'Her', category: 'body-care-essentials' },
  { label: 'Him', category: 'perfume' },
  { label: 'A gift', category: 'gift-sets-bundles' },
];
const BUDGET = [
  { label: 'Under GH₵300', max: 300 },
  { label: 'Up to GH₵500', max: 500 },
  { label: 'Any price', max: 0 },
];

/** Three quick questions that open the shop filtered to matching bottles. */
export default function ScentQuiz() {
  const router = useRouter();
  const [love, setLove] = useState(0);
  const [who, setWho] = useState(0);
  const [budget, setBudget] = useState(2);

  const go = () => {
    const q = new URLSearchParams({ search: LOVES[love].search });
    if (FOR[who].category) q.set('category', FOR[who].category);
    if (BUDGET[budget].max) q.set('max', String(BUDGET[budget].max));
    router.push(`/shop?${q.toString()}`);
  };

  const questions = [
    { title: 'Which do you love most?', opts: LOVES.map((x) => x.label), value: love, set: setLove },
    { title: 'Who is it for?', opts: FOR.map((x) => x.label), value: who, set: setWho },
    { title: "What's your budget?", opts: BUDGET.map((x) => x.label), value: budget, set: setBudget },
  ];

  return (
    <section id="finder" aria-labelledby="finder-title" className="bg-[#4A1520] text-[#F6EDE3] scroll-mt-24">
      <div className="max-w-[1360px] mx-auto px-5 sm:px-8 lg:px-12 py-16 md:py-28 flex flex-col gap-9 md:gap-12">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <h2 id="finder-title" className="font-serif text-[32px] md:text-[43px] leading-[0.98] tracking-[-0.02em] max-w-[720px]">
            Find your signature in <em className="text-[#E5B65A]">three questions</em>
          </h2>
          <p className="text-[15px] leading-relaxed text-[#E3CFC7] max-w-[340px]">Answer three quick questions and we show you the bottles that fit.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-4 md:gap-5">
          {questions.map((q) => (
            <fieldset key={q.title} className="flex flex-col gap-5 p-6 md:p-8 rounded-[24px] bg-[#F6EDE3]/[0.06] shadow-[inset_0_0_0_1px_rgba(246,237,227,0.14)]">
              <legend className="sr-only">{q.title}</legend>
              <p aria-hidden="true" className="font-serif text-[21px] md:text-[22px] leading-tight">{q.title}</p>
              <div className="flex flex-wrap gap-2">
                {q.opts.map((o, i) => (
                  <button
                    key={o}
                    type="button"
                    aria-pressed={q.value === i}
                    onClick={() => q.set(i)}
                    className={`h-11 px-4 rounded-full text-sm font-semibold transition-colors ${
                      q.value === i ? 'bg-[#F6EDE3] text-[#2B0B12]' : 'shadow-[inset_0_0_0_1px_rgba(246,237,227,0.3)] hover:bg-[#F6EDE3]/10'
                    }`}
                  >
                    {o}
                  </button>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <button type="button" onClick={go} className="inline-flex items-center justify-center min-h-[54px] px-8 rounded-full bg-[#D9A441] text-[#2B0B12] font-semibold hover:bg-[#E5B65A] active:scale-[0.98] transition-[background-color,transform] motion-reduce:active:scale-100">
            Show my matches
          </button>
          <span className="text-sm text-[#E3CFC7]" aria-live="polite">
            {LOVES[love].label} · For {FOR[who].label.toLowerCase()} · {BUDGET[budget].label}
          </span>
        </div>
      </div>
    </section>
  );
}
