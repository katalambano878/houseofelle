'use client';

import { useEffect, useState, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { asNumber, money } from '@/lib/format-money';
import { deliveryLabel } from '@/lib/delivery';

const ghs = (value: unknown) => `GH₵${money(value)}`;

// Print only the invoice: hide the store header, footer, nav and floating widgets.
const PRINT_CSS = `
@media print {
  header, footer, nav { display: none !important; }
  body * { visibility: hidden !important; }
  #invoice-print, #invoice-print * { visibility: visible !important; }
  #invoice-print { position: absolute; left: 0; top: 0; width: 100%; }
  @page { margin: 16mm; }
}
`;

function InvoiceContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = String(params?.id || '');
  const autoPrint = searchParams.get('print') === 'true';

  const [order, setOrder] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          setError('Please sign in to view this invoice.');
          return;
        }

        const { data, error: qError } = await supabase
          .from('orders')
          .select('*, order_items (*)')
          .eq('id', id)
          .eq('user_id', session.user.id)
          .single();

        if (qError || !data) {
          setError('Invoice not found or you do not have access to this order.');
          return;
        }
        setOrder(data);
      } catch {
        setError('Could not load invoice.');
      } finally {
        setLoading(false);
      }
    }
    if (id) load();
  }, [id]);

  useEffect(() => {
    if (order && autoPrint) {
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
  }, [order, autoPrint]);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#F1E8DC]">
        <i className="ri-loader-4-line animate-spin motion-reduce:animate-none text-3xl text-[#2B0B12]" aria-label="Loading" />
      </main>
    );
  }

  if (error || !order) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-3 px-5 text-center bg-[#F1E8DC] text-[#1F1115]">
        <h1 className="font-serif text-[34px] md:text-[40px] leading-none tracking-[-0.02em]">Invoice <em>unavailable</em></h1>
        <p className="text-[15px] text-[#6B565B] mb-3">{error || 'Order not found'}</p>
        <Link href="/account?tab=orders" className="inline-flex items-center min-h-[52px] px-7 rounded-full bg-[#2B0B12] text-[#F6EDE3] text-[15px] font-bold hover:bg-[#4A1520] transition-colors motion-reduce:transition-none">
          Back to orders
        </Link>
      </main>
    );
  }

  const shipping = order.shipping_address || {};
  const items = order.order_items || [];
  const total = asNumber(order.total);
  const itemsTotal = items.reduce(
    (sum: number, item: any) => sum + asNumber(item.total_price, asNumber(item.unit_price) * asNumber(item.quantity)),
    0
  );
  const subtotal = order.subtotal != null ? asNumber(order.subtotal) : itemsTotal;
  const discount = asNumber(order.discount_total);
  const delivery = asNumber(order.shipping_total);
  const tax = asNumber(order.tax_total);

  return (
    <main className="min-h-screen bg-[#F1E8DC] text-[#1F1115] py-8 md:py-12 px-5 sm:px-8 print:py-0 print:bg-white">
      <style>{PRINT_CSS}</style>
      <div className="max-w-3xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6 print:hidden">
          <Link href="/account?tab=orders" className="inline-flex items-center gap-2 min-h-[44px] text-[14px] font-semibold text-[#4D3A3F] hover:text-[#1F1115]">
            <i className="ri-arrow-left-line" aria-hidden="true"></i>
            Back to orders
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center min-h-[48px] px-6 rounded-full bg-[#2B0B12] text-[#F6EDE3] text-[14px] font-bold hover:bg-[#4A1520] transition-colors motion-reduce:transition-none"
          >
            Print / Save PDF
          </button>
        </div>

        <div id="invoice-print" className="rounded-[24px] bg-[#FBF6EF] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.1)] p-6 sm:p-8 print:bg-white print:shadow-none print:rounded-none print:p-0">
          <div className="flex items-start justify-between gap-4 mb-8">
            <div>
              <p className="font-serif text-[28px] leading-none mb-1.5">House of Elle</p>
              <p className="text-sm text-[#6B565B]">Fragrance &amp; body care · Accra</p>
            </div>
            <div className="text-right text-sm">
              <p className="font-serif text-[22px] leading-none mb-1">Invoice</p>
              <p>{order.order_number}</p>
              <p className="text-[#6B565B]">
                {new Date(order.created_at).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-6 mb-8 text-sm">
            <div>
              <p className="font-semibold mb-1">Bill to</p>
              <p>
                {shipping.firstName || shipping.full_name || ''} {shipping.lastName || ''}
              </p>
              <p>{order.email}</p>
              <p>{shipping.phone || order.phone}</p>
            </div>
            <div>
              <p className="font-semibold mb-1">Ship to</p>
              <p>{shipping.address || shipping.address_line1 || '—'}</p>
              <p>
                {[shipping.city, shipping.region || shipping.state].filter(Boolean).join(', ')}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto -mx-1 px-1 mb-8"><table className="w-full min-w-[420px] text-sm tabular-nums">
            <thead>
              <tr className="border-b border-[#1F1115]/20 text-left text-[13px] text-[#6B565B]">
                <th scope="col" className="py-2 pr-2 font-semibold">Item</th>
                <th scope="col" className="py-2 pr-2 font-semibold">Qty</th>
                <th scope="col" className="py-2 pr-2 font-semibold">Price</th>
                <th scope="col" className="py-2 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item: any) => (
                <tr key={item.id} className="border-b border-[#1F1115]/10">
                  <td className="py-3 pr-2">
                    <p className="font-medium">{item.product_name}</p>
                    {item.variant_name ? (
                      <p className="text-[#6B565B] text-xs">{item.variant_name}</p>
                    ) : null}
                  </td>
                  <td className="py-3 pr-2">{item.quantity}</td>
                  <td className="py-3 pr-2">{ghs(item.unit_price)}</td>
                  <td className="py-3 text-right">
                    {ghs(item.total_price ?? asNumber(item.unit_price) * item.quantity)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>

          <div className="flex justify-end">
            <div className="w-full sm:w-64 space-y-2 text-sm tabular-nums">
              <div className="flex justify-between">
                <span className="text-[#6B565B]">Subtotal</span>
                <span>{ghs(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between">
                  <span className="text-[#6B565B]">Discount</span>
                  <span>−{ghs(discount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-[#6B565B]">{deliveryLabel(order.shipping_method)}</span>
                <span>{delivery > 0 ? ghs(delivery) : order.shipping_method === 'pickup' ? 'Free' : 'Confirmed separately'}</span>
              </div>
              {tax > 0 && (
                <div className="flex justify-between">
                  <span className="text-[#6B565B]">Tax</span>
                  <span>{ghs(tax)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base border-t border-[#1F1115]/20 pt-3">
                <span>Total</span>
                <span>{ghs(total)}</span>
              </div>
              <p className="text-xs text-[#6B565B] capitalize">
                Status: {order.status} · Payment: {order.payment_status}
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function AccountInvoicePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center bg-[#F1E8DC]">
          <i className="ri-loader-4-line animate-spin motion-reduce:animate-none text-3xl text-[#2B0B12]" aria-label="Loading" />
        </main>
      }
    >
      <InvoiceContent />
    </Suspense>
  );
}
