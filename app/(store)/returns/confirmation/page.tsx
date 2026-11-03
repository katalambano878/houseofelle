'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

function ConfirmationContent() {
  const searchParams = useSearchParams();
  const orderNumber = (searchParams.get('order') || '').slice(0, 40);

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center py-12">
      <div className="max-w-2xl mx-auto px-4">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="w-20 h-20 flex items-center justify-center bg-blue-100 rounded-full mx-auto mb-6">
            <i className="ri-check-line text-4xl text-blue-700"></i>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-4">Return Request Received</h1>
          <p className="text-gray-600 mb-2">
            We&apos;ve received your return request and will contact you.
          </p>
          {orderNumber && (
            <p className="text-sm text-gray-500 mb-8">
              Order: <span className="font-semibold">{orderNumber}</span>
            </p>
          )}

          <div className="my-8 text-left">
            <h2 className="font-bold text-gray-900 mb-4">What happens next?</h2>
            <div className="space-y-4">
              <div className="flex items-start space-x-4">
                <div className="w-10 h-10 flex items-center justify-center bg-blue-100 rounded-full flex-shrink-0">
                  <span className="font-bold text-blue-700">1</span>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">We review your request</p>
                  <p className="text-sm text-gray-600">Our team checks the order and the details you sent.</p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="w-10 h-10 flex items-center justify-center bg-blue-100 rounded-full flex-shrink-0">
                  <span className="font-bold text-blue-700">2</span>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">We get in touch</p>
                  <p className="text-sm text-gray-600">We&apos;ll contact you using the details on your order to agree the next steps.</p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="w-10 h-10 flex items-center justify-center bg-blue-100 rounded-full flex-shrink-0">
                  <span className="font-bold text-blue-700">3</span>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Keep the item safe</p>
                  <p className="text-sm text-gray-600">Please keep the item and its packaging until we&apos;ve been in touch.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Link
              href="/shop"
              className="block w-full bg-blue-700 hover:bg-blue-800 text-white py-4 rounded-lg font-semibold transition-colors whitespace-nowrap"
            >
              Continue Shopping
            </Link>
            <Link
              href={orderNumber ? `/contact?order=${encodeURIComponent(orderNumber)}&subject=${encodeURIComponent(`Return request ${orderNumber}`)}` : '/contact'}
              className="block text-blue-700 hover:text-blue-900 font-semibold whitespace-nowrap"
            >
              Need Help? Contact Us
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
        <main className="min-h-screen bg-gray-50 flex items-center justify-center">
          <i className="ri-loader-4-line animate-spin text-4xl text-blue-700"></i>
        </main>
      }
    >
      <ConfirmationContent />
    </Suspense>
  );
}
