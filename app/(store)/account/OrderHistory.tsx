'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { money, asNumber } from '@/lib/format-money';
import { supabase } from '@/lib/supabase';
import { useCart } from '@/context/CartContext';
import { deliveryLabel } from '@/lib/delivery';

interface OrderItem {
  id: string;
  productId: string | null;
  name: string;
  image: string;
  quantity: number;
  price: number;
  variant?: string | null;
  variantId?: string | null;
  slug?: string;
}

interface Order {
  id: string;
  orderNumber: string;
  email: string;
  date: string;
  status: string;
  total: number;
  delivery: string;
  paymentStatus: string;
  items: OrderItem[];
}

export default function OrderHistory() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState('');
  const [reorderingId, setReorderingId] = useState<string | null>(null);
  const [reorderNotice, setReorderNotice] = useState<{ orderId: string; text: string } | null>(null);
  const { addToCart, setIsCartOpen } = useCart();
  const router = useRouter();

  useEffect(() => {
    async function fetchOrders() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        if (session.user.email) setUserEmail(session.user.email);

        const { data, error } = await supabase
          .from('orders')
          .select(`*, order_items (*)`)
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        if (data) {
          const formattedOrders = data.map((order: any) => ({
            id: order.id,
            orderNumber: order.order_number,
            email: order.email || session.user.email || '',
            date: order.created_at,
            delivery: deliveryLabel(order.shipping_method),
            status: order.status,
            paymentStatus: order.payment_status || 'pending',
            total: asNumber(order.total),
            items: order.order_items.map((item: any) => ({
              id: item.id,
              productId: item.product_id || null,
              name: item.product_name,
              image: item.metadata?.image || '/placeholder-product.svg',
              quantity: item.quantity,
              price: asNumber(item.unit_price),
              variant: item.variant_name || null,
              variantId: item.variant_id || null,
              slug: item.metadata?.slug || '',
            })),
          }));
          setOrders(formattedOrders);
        }
      } catch (err) {
        console.error('Error fetching orders:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchOrders();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'bg-[#DDE7D6] text-[#244A2C]';
      case 'shipped':
        return 'bg-[#F3E2BD] text-[#5A3E08]';
      case 'processing':
        return 'bg-[#E8C5BE] text-[#2B0B12]';
      case 'cancelled':
        return 'bg-[#F6DCD7] text-[#7A1F2E]';
      default:
        return 'bg-[#EADFD2] text-[#4D3A3F]';
    }
  };

  const statusLabel = (status: string) =>
    status === 'shipped' ? 'Packaged' : status.replace('_', ' ').replace(/^\w/, (c: string) => c.toUpperCase());

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  const handleReorder = async (order: Order) => {
    setReorderingId(order.id);
    setReorderNotice(null);
    const skipped: string[] = [];
    let added = 0;
    try {
      for (const item of order.items) {
        if (!item.productId) {
          skipped.push(item.name);
          continue;
        }
        // Only active products are visible to customers, so a missing row means
        // the product is no longer for sale.
        const { data: product, error } = await supabase
          .from('products')
          .select('id, slug, name, price, quantity, moq, status, product_images(url), product_variants(id, name, price, quantity)')
          .eq('id', item.productId)
          .maybeSingle();
        if (error || !product || product.status !== 'active') {
          skipped.push(item.name);
          continue;
        }

        const variants = ((product as { product_variants?: { id: string; name: string; price: unknown; quantity: unknown }[] })
          .product_variants) || [];
        const variant = item.variantId
          ? variants.find((v) => v.id === item.variantId)
          : item.variant
            ? variants.find((v) => v.name === item.variant)
            : undefined;

        // The ordered option no longer exists, or the product now needs an option chosen.
        if ((item.variantId || item.variant) && !variant && variants.length > 0) {
          skipped.push(item.variant ? `${item.name} (${item.variant})` : item.name);
          continue;
        }
        if (!item.variantId && !item.variant && variants.length > 0) {
          skipped.push(item.name);
          continue;
        }

        const stock = variant ? asNumber(variant.quantity) : asNumber(product.quantity);
        if (stock <= 0) {
          skipped.push(item.variant ? `${item.name} (${item.variant})` : item.name);
          continue;
        }
        const images = (product as { product_images?: { url: string }[] }).product_images;
        const image =
          images?.[0]?.url ||
          item.image ||
          '/placeholder-product.svg';
        const moq = asNumber(product.moq, 1) || 1;

        addToCart({
          id: product.id,
          name: product.name || item.name,
          price: variant ? asNumber(variant.price, item.price) : asNumber(product.price, item.price),
          image,
          quantity: Math.min(Math.max(1, item.quantity, moq), stock),
          variant: item.variant || variant?.name || undefined,
          variantId: variant?.id,
          slug: product.slug || item.slug || product.id,
          maxStock: stock,
          moq,
        });
        added += 1;
      }

      if (added === 0) {
        setReorderNotice({
          orderId: order.id,
          text: 'None of the items from this order are available to reorder right now.',
        });
        return;
      }
      if (skipped.length > 0) {
        setReorderNotice({
          orderId: order.id,
          text: `Added ${added} item${added === 1 ? '' : 's'} to your cart. Not available right now: ${skipped.join(', ')}.`,
        });
        setIsCartOpen(true);
        return;
      }
      setIsCartOpen(true);
      router.push('/cart');
    } finally {
      setReorderingId(null);
    }
  };

  const handleDownloadInvoice = (orderId: string) => {
    router.push(`/account/invoice/${orderId}?print=true`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-[15px] text-[#6B565B]" role="status">
        <i className="ri-loader-4-line animate-spin motion-reduce:animate-none text-2xl text-[#2B0B12]" aria-hidden="true"></i>
        Loading orders…
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center text-center gap-3 px-6 py-14 rounded-[24px] bg-[#FBF6EF] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.1)]">
        <span className="w-14 h-14 rounded-full bg-[#F1E8DC] text-[#7A1F2E] inline-flex items-center justify-center">
          <i className="ri-shopping-bag-3-line text-2xl" aria-hidden="true"></i>
        </span>
        <h2 className="font-serif text-[28px] md:text-[30px] leading-none">No orders <em>yet</em></h2>
        <p className="text-[15px] text-[#6B565B]">Start shopping to see your orders here.</p>
        <Link href="/shop" className="mt-2 inline-flex items-center min-h-[52px] px-7 rounded-full bg-[#2B0B12] text-[#F6EDE3] text-[15px] font-bold hover:bg-[#4A1520] transition-colors motion-reduce:transition-none">
          Browse the shop
        </Link>
      </div>
    );
  }

  const linksFor = (order: Order) => {
    const trackEmail = order.email || userEmail;
    return {
      trackHref: `/order-tracking?order=${encodeURIComponent(order.orderNumber)}&email=${encodeURIComponent(trackEmail)}`,
      helpHref: `/contact?order=${encodeURIComponent(order.orderNumber)}&subject=${encodeURIComponent(`Help with order ${order.orderNumber}`)}`,
    };
  };

  // The newest order that is still on its way gets the wine card.
  const activeOrder = orders.find((o) => o.status !== 'delivered' && o.status !== 'cancelled');

  const stepsFor = (order: Order) => {
    const statusOrder = ['pending', 'processing', 'shipped', 'delivered'];
    const idx = statusOrder.indexOf(order.status);
    const paid = order.paymentStatus === 'paid';
    return [
      { key: 'paid', title: 'Paid', description: paid ? 'Payment confirmed' : 'Awaiting payment', done: paid, active: false },
      { key: 'processing', title: 'Processing', description: 'Being prepared', done: idx >= 1, active: idx === 0 && paid },
      { key: 'packaged', title: 'Packaged', description: 'Ready to send', done: idx >= 2, active: idx === 1 },
      { key: 'delivered', title: 'Delivered', description: 'With you', done: idx >= 3, active: idx === 2 },
    ];
  };

  const outlineDark =
    'inline-flex items-center gap-2 min-h-[44px] px-5 rounded-full shadow-[inset_0_0_0_1px_rgba(31,17,21,0.22)] text-[14px] font-semibold hover:bg-white transition-colors motion-reduce:transition-none disabled:opacity-50';

  const notice = (order: Order, onDark = false) =>
    reorderNotice?.orderId === order.id ? (
      <p
        role="status"
        className={`flex items-start gap-2 rounded-2xl px-4 py-3 text-sm ${onDark ? 'bg-[#F6EDE3]/10 text-[#F6EDE3]' : 'bg-[#FBF6EF] text-[#4D3A3F] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.12)]'}`}
      >
        <i className="ri-information-line text-base leading-5" aria-hidden="true"></i>
        <span>{reorderNotice.text}</span>
      </p>
    ) : null;

  return (
    <div className="flex flex-col gap-10">
      {activeOrder && (() => {
        const { trackHref, helpHref } = linksFor(activeOrder);
        const steps = stepsFor(activeOrder);
        const thumbs = activeOrder.items.slice(0, 3);
        const count = activeOrder.items.length;
        return (
          <article className="flex flex-col gap-7 p-6 md:p-8 rounded-[24px] bg-[#2B0B12] text-[#F6EDE3]" aria-labelledby="active-order-title">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div className="flex flex-col gap-1.5 min-w-0">
                <span className="text-[13px] text-[#CDB5AD]">Order in progress</span>
                <h2 id="active-order-title" className="font-serif text-[28px] md:text-[32px] leading-none break-all">{activeOrder.orderNumber}</h2>
                <span className="text-[14px] text-[#E3CFC7] tabular-nums">
                  Placed {formatDate(activeOrder.date)} · {count} item{count === 1 ? '' : 's'} · GH₵{money(activeOrder.total)}
                </span>
              </div>
              <div className="flex gap-2" aria-hidden="true">
                {thumbs.map((item) => (
                  <span key={item.id} className="flex items-center justify-center w-[54px] h-16 rounded-[12px] bg-[#F6EDE3]">
                    <img src={item.image} alt="" className="w-[78%] h-[78%] object-contain mix-blend-multiply" />
                  </span>
                ))}
              </div>
            </div>

            <ol aria-label="Order progress" className="grid grid-cols-2 md:grid-cols-4 gap-y-5">
              {steps.map((step, index) => (
                <li key={step.key} className="flex flex-col gap-2.5" aria-current={step.active ? 'step' : undefined}>
                  <span className="flex items-center" aria-hidden="true">
                    <span
                      className={`w-3.5 h-3.5 flex-none rounded-full ${
                        step.done
                          ? 'bg-[#D9A441] shadow-[0_0_0_4px_rgba(217,164,65,0.25)]'
                          : step.active
                          ? 'bg-[#2B0B12] shadow-[inset_0_0_0_2px_#D9A441,0_0_0_4px_rgba(217,164,65,0.25)]'
                          : 'bg-[#F6EDE3]/30'
                      }`}
                    />
                    <span className={`flex-1 h-0.5 ml-2.5 ${index === steps.length - 1 ? 'bg-transparent' : step.done ? 'bg-[#D9A441]' : 'bg-[#F6EDE3]/[0.18]'}`} />
                  </span>
                  <span className="flex flex-col gap-0.5 pr-3">
                    <span className={`text-[15px] font-bold ${!step.done && !step.active ? 'text-[#CDB5AD]' : ''}`}>
                      {step.title}
                      <span className="sr-only">: {step.done ? 'done' : step.active ? 'in progress' : 'not yet'}</span>
                    </span>
                    <span className="text-[13px] text-[#CDB5AD]">{step.description}</span>
                  </span>
                </li>
              ))}
            </ol>

            {notice(activeOrder, true)}

            <div className="flex flex-wrap gap-2.5">
              <Link href={trackHref} className="inline-flex items-center min-h-[48px] px-[22px] rounded-full bg-[#D9A441] text-[#2B0B12] text-[14px] font-bold hover:bg-[#E5B65A] transition-colors motion-reduce:transition-none">
                Track this order
              </Link>
              <button
                type="button"
                onClick={() => handleDownloadInvoice(activeOrder.id)}
                className="inline-flex items-center min-h-[48px] px-[22px] rounded-full shadow-[inset_0_0_0_1px_rgba(246,237,227,0.35)] text-[14px] font-semibold hover:bg-[#F6EDE3]/10 transition-colors motion-reduce:transition-none"
              >
                View receipt
              </button>
              <Link href={helpHref} className="inline-flex items-center min-h-[48px] px-[22px] rounded-full shadow-[inset_0_0_0_1px_rgba(246,237,227,0.35)] text-[14px] font-semibold hover:bg-[#F6EDE3]/10 transition-colors motion-reduce:transition-none">
                Ask about this order
              </Link>
            </div>
          </article>
        );
      })()}

      <section className="flex flex-col gap-4" aria-labelledby="all-orders-title">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="all-orders-title" className="font-serif text-[28px] md:text-[30px] leading-none">Your orders</h2>
          <span className="text-[14px] text-[#6B565B] tabular-nums">{orders.length} in total</span>
        </div>

        <div className="hidden md:grid grid-cols-[1.4fr_1fr_1fr_auto_44px] gap-4 pb-3 text-[13px] font-semibold text-[#6B565B]" aria-hidden="true">
          <span>Order</span>
          <span>Date</span>
          <span>Status</span>
          <span className="text-right">Total</span>
          <span />
        </div>

        <ul className="border-t border-[#1F1115]/[0.12] -mt-4 md:mt-0">
          {orders.map((order) => {
            const { trackHref, helpHref } = linksFor(order);
            return (
              <li key={order.id} className="border-b border-[#1F1115]/[0.12]">
                <details className="group">
                  <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer grid grid-cols-[1fr_auto_44px] md:grid-cols-[1.4fr_1fr_1fr_auto_44px] items-center gap-x-4 gap-y-1 min-h-[64px] py-3 text-[15px]">
                    <span className="font-semibold break-all">{order.orderNumber}</span>
                    <span className="order-3 md:order-none col-start-1 md:col-start-auto text-[14px] md:text-[15px] text-[#6B565B] tabular-nums">
                      {formatDate(order.date)}
                      <span className="md:hidden"> · GH₵{money(order.total)}</span>
                    </span>
                    <span className="order-2 md:order-none justify-self-end md:justify-self-start">
                      <span className={`inline-flex items-center h-7 px-3 rounded-full text-[13px] font-semibold whitespace-nowrap ${getStatusColor(order.status)}`}>
                        {statusLabel(order.status)}
                      </span>
                    </span>
                    <span className="hidden md:block text-right font-semibold tabular-nums">GH₵{money(order.total)}</span>
                    <span className="order-2 md:order-none row-span-2 md:row-span-1 w-11 h-11 inline-flex items-center justify-center rounded-full text-[#6B565B] group-hover:bg-[#FBF6EF]" aria-hidden="true">
                      <i className="ri-arrow-down-s-line text-xl transition-transform group-open:rotate-180 motion-reduce:transition-none"></i>
                    </span>
                    <span className="sr-only">Show order details</span>
                  </summary>

                  <div className="flex flex-col gap-4 pb-6 pt-1">
                    <p className="text-[14px] text-[#6B565B]">Delivery: <span className="font-semibold text-[#1F1115]">{order.delivery}</span></p>
                    <ul className="flex flex-col gap-3">
                      {order.items.map((item) => (
                        <li key={item.id} className="flex items-center gap-4">
                          <span className="flex-none flex items-center justify-center w-16 h-20 rounded-[14px] bg-[#FBF6EF] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.1)] overflow-hidden">
                            <img src={item.image} alt={item.name} className="w-[84%] h-[84%] object-contain mix-blend-multiply" />
                          </span>
                          <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                            <span className="font-serif text-[18px] leading-tight">{item.name}</span>
                            {item.variant && <span className="text-[13px] text-[#6B565B]">{item.variant}</span>}
                            <span className="text-[13px] text-[#6B565B]">Quantity: {item.quantity}</span>
                          </span>
                          <span className="text-[15px] font-semibold tabular-nums">GH₵{money(item.price)}</span>
                        </li>
                      ))}
                    </ul>

                    {notice(order)}

                    <div className="flex flex-wrap gap-2">
                      <Link href={trackHref} className="inline-flex items-center gap-2 min-h-[44px] px-5 rounded-full bg-[#2B0B12] text-[#F6EDE3] text-[14px] font-semibold hover:bg-[#4A1520] transition-colors motion-reduce:transition-none">
                        <i className="ri-map-pin-line" aria-hidden="true"></i>
                        Track order
                      </Link>
                      <button type="button" onClick={() => handleReorder(order)} disabled={reorderingId === order.id} className={outlineDark}>
                        <i className="ri-refresh-line" aria-hidden="true"></i>
                        {reorderingId === order.id ? 'Adding…' : 'Reorder'}
                      </button>
                      <button type="button" onClick={() => handleDownloadInvoice(order.id)} className={outlineDark}>
                        <i className="ri-download-line" aria-hidden="true"></i>
                        Invoice
                      </button>
                      <Link href={helpHref} className={outlineDark}>
                        <i className="ri-customer-service-line" aria-hidden="true"></i>
                        Get help
                      </Link>
                    </div>
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
