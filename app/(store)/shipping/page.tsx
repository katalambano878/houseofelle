import Link from 'next/link';
import PageHero from '@/components/PageHero';

// Delivery fees vary by location and are agreed after the order, so this page
// states how delivery works rather than a price list (checkout charges no fee).
export default function ShippingPage() {
  const deliveryOptions = [
    {
      type: 'Delivery across Ghana',
      cost: 'Fee confirmed after you order',
      description: 'We contact you after your order to confirm the delivery fee and timing for your location.',
      icon: 'ri-truck-line',
    },
    {
      type: 'Store pickup',
      cost: 'Free',
      description: 'Collect your order from our store at Spintex Lashibi, Shalom Spot Junction, Accra.',
      icon: 'ri-store-2-line',
    },
  ];

  const steps = [
    { title: 'Place your order', text: 'Pay securely with Mobile Money at checkout.', icon: 'ri-shopping-bag-3-line' },
    { title: 'We confirm delivery', text: 'Our team contacts you to confirm the fee and a delivery time.', icon: 'ri-phone-line' },
    { title: 'Track your order', text: 'Follow your order with your order number and email, and get SMS updates.', icon: 'ri-map-pin-time-line' },
  ];

  return (
    <main className="min-h-screen bg-[#F1E8DC] text-[#1F1115]">
      <PageHero
        title="Shipping and delivery"
        subtitle="We deliver across Ghana, and you can also collect your order from our store in Accra."
      />

      <div className="max-w-[1360px] mx-auto px-5 sm:px-8 lg:px-12 py-12 md:py-20">
        <div className="max-w-[720px] mx-auto flex flex-col gap-12 md:gap-16">
          <section aria-labelledby="ship-options" className="flex flex-col gap-5">
            <h2 id="ship-options" className="font-serif text-[28px] md:text-[30px] leading-none">Delivery <em>options</em></h2>
            <ul className="grid sm:grid-cols-2 gap-3">
              {deliveryOptions.map((option, i) => (
                <li
                  key={option.type}
                  className={`flex flex-col gap-5 p-6 rounded-[24px] ${i === 0 ? 'bg-[#2B0B12] text-[#F6EDE3]' : 'bg-[#FBF6EF] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.1)]'}`}
                >
                  <span className={`w-11 h-11 rounded-full inline-flex items-center justify-center ${i === 0 ? 'bg-[#D9A441] text-[#2B0B12]' : 'bg-[#F1E8DC] text-[#7A1F2E]'}`}>
                    <i className={`${option.icon} text-xl`} aria-hidden="true" />
                  </span>
                  <span className="flex flex-col gap-2">
                    <span className="font-serif text-[24px] leading-tight">{option.type}</span>
                    <span className={`text-sm font-semibold ${i === 0 ? 'text-[#E5B65A]' : 'text-[#7A1F2E]'}`}>{option.cost}</span>
                    <span className={`text-[15px] leading-relaxed ${i === 0 ? 'text-[#E3CFC7]' : 'text-[#4D3A3F]'}`}>{option.description}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="ship-how" className="flex flex-col gap-5">
            <h2 id="ship-how" className="font-serif text-[28px] md:text-[30px] leading-none">How it <em>works</em></h2>
            <ol className="border-t border-[#1F1115]/14">
              {steps.map((step) => (
                <li key={step.title} className="flex items-start gap-4 py-5 border-b border-[#1F1115]/14">
                  <span className="flex-none w-11 h-11 rounded-full bg-[#FBF6EF] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.1)] inline-flex items-center justify-center">
                    <i className={`${step.icon} text-xl text-[#7A1F2E]`} aria-hidden="true" />
                  </span>
                  <span className="flex flex-col gap-1 pt-1">
                    <span className="text-base font-semibold">{step.title}</span>
                    <span className="text-[15px] leading-relaxed text-[#4D3A3F]">{step.text}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="ship-questions" className="flex flex-col gap-4 p-6 md:p-8 rounded-[24px] bg-[#E8C5BE] text-[#2B0B12]">
            <h2 id="ship-questions" className="font-serif text-[26px] md:text-[28px] leading-none">Questions about <em>delivery?</em></h2>
            <p className="text-[15px] leading-relaxed">Ask us before you order and we&apos;ll tell you the fee for your area.</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/contact?subject=Delivery%20question" className="inline-flex items-center justify-center min-h-[52px] px-7 rounded-full bg-[#2B0B12] text-[#F6EDE3] font-semibold hover:bg-[#4A1520] transition-colors motion-reduce:transition-none">
                Contact us
              </Link>
              <Link href="/order-tracking" className="inline-flex items-center justify-center min-h-[52px] px-7 rounded-full shadow-[inset_0_0_0_1.5px_#2B0B12] font-semibold hover:bg-[#2B0B12]/5 transition-colors motion-reduce:transition-none">
                Track an order
              </Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
