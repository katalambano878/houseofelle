import Link from 'next/link';

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
    <div className="min-h-screen bg-[#F1E8DC]">
      <div className="bg-gradient-to-br from-blue-50 via-white to-amber-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-5xl font-bold text-gray-900 mb-6">Shipping & Delivery</h1>
            <p className="text-xl text-gray-600 leading-relaxed">
              We deliver across Ghana, and you can also collect your order from our store in Accra.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">Delivery Options</h2>
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {deliveryOptions.map((option) => (
              <div key={option.type} className="bg-white border-2 border-gray-200 p-8 rounded-2xl">
                <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mb-6">
                  <i className={`${option.icon} text-2xl text-blue-700`} aria-hidden="true"></i>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{option.type}</h3>
                <div className="text-blue-700 font-bold text-lg mb-4">{option.cost}</div>
                <p className="text-gray-600 leading-relaxed">{option.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">How it works</h2>
          <ol className="grid md:grid-cols-3 gap-6">
            {steps.map((step) => (
              <li key={step.title} className="bg-gray-50 rounded-2xl p-6">
                <i className={`${step.icon} text-3xl text-blue-700 mb-4 block`} aria-hidden="true"></i>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-gray-600">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>

        <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-8 text-center">
          <h3 className="text-2xl font-bold text-gray-900 mb-3">Questions about delivery?</h3>
          <p className="text-lg text-gray-600 mb-6">Ask us before you order and we&apos;ll tell you the fee for your area.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/contact?subject=Delivery%20question" className="bg-blue-700 hover:bg-blue-800 text-white px-8 py-3 rounded-lg font-semibold transition-colors">
              Contact us
            </Link>
            <Link href="/order-tracking" className="border-2 border-gray-300 hover:border-gray-400 text-gray-700 px-8 py-3 rounded-lg font-semibold transition-colors">
              Track an order
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
