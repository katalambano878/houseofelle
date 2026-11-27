'use client';

import { useEffect, useState } from 'react';

export type PaymentGateway = 'moolre' | 'zoepay';

const OPTIONS: { id: PaymentGateway; label: string; icon: string; description: string }[] = [
  {
    id: 'moolre',
    label: 'Mobile Money',
    icon: 'ri-smartphone-line',
    description: "Pay with MTN, Telecel or AirtelTigo on Moolre's secure page.",
  },
  {
    id: 'zoepay',
    label: 'Card or Mobile Money',
    icon: 'ri-bank-card-line',
    description: "Pay by Visa, Mastercard or Mobile Money on Zoe Pay's secure page. Zoe Pay adds its small fee there.",
  },
];

/** The gateways the server can take right now. Mobile Money through Moolre until the answer arrives. */
export function usePaymentGateways() {
  const [available, setAvailable] = useState<PaymentGateway[]>(['moolre']);
  useEffect(() => {
    let alive = true;
    fetch('/api/payment/methods', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => {
        if (!alive || !m) return;
        const list = OPTIONS.map((o) => o.id).filter((id) => m[id]);
        if (list.length) setAvailable(list);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return available;
}

/** Where the start-payment request goes for each gateway. */
export const paymentEndpoint = (g: PaymentGateway) => (g === 'zoepay' ? '/api/payment/zoepay' : '/api/payment/moolre');

export default function PaymentChoice({
  available,
  value,
  onChange,
  name = 'payment',
}: {
  available: PaymentGateway[];
  value: PaymentGateway;
  onChange: (g: PaymentGateway) => void;
  name?: string;
}) {
  const options = OPTIONS.filter((o) => available.includes(o.id));

  if (options.length === 1) {
    const o = options[0];
    return (
      <div className="flex flex-col gap-3 p-6 rounded-[22px] bg-[#FBF6EF] shadow-[inset_0_0_0_2px_#2B0B12]">
        <span className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-full bg-[#2B0B12] text-[#E5B65A] inline-flex items-center justify-center flex-none">
            <i className={`${o.icon} text-lg`} aria-hidden="true"></i>
          </span>
          <span className="font-semibold text-[15px]">{o.label}</span>
        </span>
        <p className="m-0 text-sm leading-relaxed text-[#4D3A3F]">When you tap pay, we save your order and take you to the secure page. {o.description}</p>
      </div>
    );
  }

  return (
    <fieldset className="border-0 m-0 p-0 min-w-0 flex flex-col gap-3">
      <legend className="sr-only">How would you like to pay?</legend>
      {options.map((o) => {
        const selected = value === o.id;
        return (
          <label
            key={o.id}
            className={`flex items-start gap-3.5 p-5 rounded-[18px] bg-[#FBF6EF] cursor-pointer transition-shadow motion-reduce:transition-none focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#7A1F2E] ${selected ? 'shadow-[inset_0_0_0_2px_#2B0B12]' : 'shadow-[inset_0_0_0_1px_rgba(31,17,21,0.16)] hover:shadow-[inset_0_0_0_1px_rgba(31,17,21,0.4)]'}`}
          >
            <input
              type="radio"
              name={name}
              value={o.id}
              checked={selected}
              onChange={() => onChange(o.id)}
              className="flex-none mt-0.5 w-[18px] h-[18px] accent-[#2B0B12] focus:outline-none"
            />
            <span className="flex-1 min-w-0 flex flex-col gap-1">
              <span className="inline-flex items-center gap-2 font-semibold">
                <i className={`${o.icon} text-lg text-[#7A1F2E]`} aria-hidden="true"></i>
                {o.label}
              </span>
              <span className="text-sm leading-relaxed text-[#6B565B]">{o.description}</span>
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
