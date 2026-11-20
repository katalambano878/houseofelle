import { money } from '@/lib/format-money';
import { DELIVERY_OPTIONS } from '@/lib/delivery';
interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
  variant?: string;
}

interface OrderSummaryProps {
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  discount?: number;
  couponCode?: string;
  deliveryMethod?: string;
}

export default function OrderSummary({ items, subtotal, shipping, tax, total, discount = 0, couponCode, deliveryMethod }: OrderSummaryProps) {
  const delivery = DELIVERY_OPTIONS.find((o) => o.id === deliveryMethod);
  return (
    <aside aria-label="Your order" className="lg:sticky lg:top-[112px] flex flex-col gap-5 p-6 sm:p-8 rounded-[28px] bg-[#FBF6EF] text-[#1F1115] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.1)]">
      <h2 className="font-serif text-[26px] leading-none">Your order</h2>

      <ul className="flex flex-col gap-4 list-none m-0 p-0">
        {items.map((item) => (
          <li key={`${item.id}-${item.variant || 'novar'}`} className="grid grid-cols-[64px_minmax(0,1fr)_auto] sm:grid-cols-[72px_minmax(0,1fr)_auto] gap-4 items-center">
            <span className="relative flex items-center justify-center w-16 h-20 sm:w-[72px] sm:h-[88px] rounded-[14px] bg-white">
              <img
                src={item.image}
                alt={item.name}
                className="w-[76%] h-[76%] object-contain"
              />
              <span className="absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] px-1 rounded-full bg-[#2B0B12] text-[#F6EDE3] text-[11px] font-bold inline-flex items-center justify-center tabular-nums">
                <span className="sr-only">Quantity </span>{item.quantity}
              </span>
            </span>
            <span className="flex flex-col gap-0.5 min-w-0">
              <span className="font-serif text-[17px] sm:text-[18px] leading-tight line-clamp-2">{item.name}</span>
              {item.variant && <span className="text-[13px] text-[#6B565B]">{item.variant}</span>}
              {item.quantity > 1 && <span className="text-[13px] text-[#6B565B] tabular-nums">GH₵ {money(item.price)} each</span>}
            </span>
            <span className="font-semibold tabular-nums whitespace-nowrap">GH₵ {money(item.price * item.quantity)}</span>
          </li>
        ))}
      </ul>

      <dl className="m-0 flex flex-col gap-3 pt-5 border-t border-[#1F1115]/12 text-[15px]">
        <div className="flex justify-between gap-4">
          <dt className="text-[#4D3A3F]">Subtotal</dt>
          <dd className="m-0 tabular-nums">GH₵ {money(subtotal)}</dd>
        </div>
        {discount > 0 && (
          <div className="flex justify-between gap-4">
            <dt className="text-[#2F6B3A]">Coupon{couponCode ? ` (${couponCode})` : ''}</dt>
            <dd className="m-0 text-[#2F6B3A] tabular-nums">-GH₵ {money(discount)}</dd>
          </div>
        )}
        <div className="flex justify-between gap-4">
          <dt className="text-[#4D3A3F]">{delivery ? delivery.label : 'Delivery'}</dt>
          <dd className="m-0 text-right text-[#4D3A3F]">
            {shipping > 0 ? `GH₵ ${money(shipping)}` : delivery ? (delivery.id === 'pickup' ? 'Free' : 'Fee confirmed by phone') : 'Chosen at the next step'}
          </dd>
        </div>
        {tax > 0 && (
          <div className="flex justify-between gap-4">
            <dt className="text-[#4D3A3F]">Tax</dt>
            <dd className="m-0 tabular-nums">GH₵ {money(tax)}</dd>
          </div>
        )}
        <div className="flex justify-between items-baseline gap-4 pt-3.5 border-t border-[#1F1115]/12">
          <dt className="font-serif text-[19px]">Total</dt>
          <dd className="m-0 text-[22px] font-semibold tabular-nums">GH₵ {money(total)}</dd>
        </div>
      </dl>

      <p className="m-0 flex gap-2.5 text-[13px] leading-relaxed text-[#6B565B]">
        <i className="ri-lock-line text-base text-[#2F6B3A] leading-none mt-0.5" aria-hidden="true"></i>
        Secure checkout. Payments are processed by Moolre.
      </p>
    </aside>
  );
}
