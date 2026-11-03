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
        return 'bg-green-100 text-green-700';
      case 'shipped':
        return 'bg-blue-100 text-blue-700';
      case 'processing':
        return 'bg-yellow-100 text-yellow-700';
      case 'cancelled':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

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
      <div className="py-8 text-center">
        <i className="ri-loader-4-line animate-spin text-3xl text-blue-700"></i>
        <p className="mt-2 text-gray-500">Loading orders...</p>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="py-12 text-center bg-white rounded-lg border border-gray-200">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <i className="ri-shopping-bag-line text-3xl text-gray-400"></i>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">No orders yet</h3>
        <p className="text-gray-500 mb-6">Start shopping to see your orders here.</p>
        <Link href="/shop" className="inline-block bg-blue-700 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-800 transition-colors">
          Go to Shop
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Order History</h2>
        <div className="text-sm text-gray-600">
          Total Orders: <span className="font-bold text-gray-900">{orders.length}</span>
        </div>
      </div>

      <div className="space-y-6">
        {orders.map((order) => {
          const trackEmail = order.email || userEmail;
          const trackHref = `/order-tracking?order=${encodeURIComponent(order.orderNumber)}&email=${encodeURIComponent(trackEmail)}`;
          const helpHref = `/contact?order=${encodeURIComponent(order.orderNumber)}&subject=${encodeURIComponent(`Help with order ${order.orderNumber}`)}`;

          return (
          <div key={order.id} className="bg-white border-2 border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
              <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center justify-between gap-4">
                <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-4 sm:gap-6 w-full sm:w-auto">
                  <div className="w-full sm:w-auto">
                    <p className="text-xs text-gray-600 mb-1">Order Number</p>
                    <p className="font-bold text-gray-900">{order.orderNumber}</p>
                  </div>
                  <div className="w-full sm:w-auto">
                    <p className="text-xs text-gray-600 mb-1">Date</p>
                    <p className="font-semibold text-gray-900">
                      {new Date(order.date).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                  <div className="w-full sm:w-auto">
                    <p className="text-xs text-gray-600 mb-1">Delivery</p>
                    <p className="font-semibold text-gray-900">{order.delivery}</p>
                  </div>
                  <div className="w-full sm:w-auto">
                    <p className="text-xs text-gray-600 mb-1">Total</p>
                    <p className="font-bold text-blue-700">GH₵{money(order.total)}</p>
                  </div>
                </div>
                <div className="w-full sm:w-auto">
                  <span className={`inline-block px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap ${getStatusColor(order.status)}`}>
                    {order.status === 'shipped' ? 'Packaged' : order.status.replace('_', ' ').replace(/^\w/, (c: string) => c.toUpperCase())}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-6">
              <div className="space-y-4 mb-4">
                {order.items.map((item) => (
                  <div key={item.id} className="flex space-x-4">
                    <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200">
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-cover object-center"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-gray-900 mb-1">{item.name}</h4>
                      <p className="text-sm text-gray-600">Quantity: {item.quantity}</p>
                      <p className="text-sm font-bold text-gray-900 mt-1">GH₵{money(item.price)}</p>
                    </div>
                  </div>
                ))}
              </div>

              {reorderNotice?.orderId === order.id && (
                <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800 flex items-start gap-2">
                  <i className="ri-information-line mt-0.5"></i>
                  <span>{reorderNotice.text}</span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row flex-wrap gap-3 pt-4 border-t border-gray-200">
                <Link
                  href={trackHref}
                  className="flex-1 sm:flex-none text-center px-4 py-2 bg-blue-700 text-white rounded-lg font-semibold hover:bg-blue-800 transition-colors whitespace-nowrap"
                >
                  <i className="ri-map-pin-line mr-2"></i>
                  Track Order
                </Link>
                <button
                  type="button"
                  onClick={() => handleReorder(order)}
                  disabled={reorderingId === order.id}
                  className="flex-1 sm:flex-none px-4 py-2 border-2 border-gray-300 text-gray-900 rounded-lg font-semibold hover:bg-gray-50 transition-colors whitespace-nowrap disabled:opacity-50"
                >
                  <i className="ri-refresh-line mr-2"></i>
                  {reorderingId === order.id ? 'Adding…' : 'Reorder'}
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadInvoice(order.id)}
                  className="flex-1 sm:flex-none px-4 py-2 border-2 border-gray-300 text-gray-900 rounded-lg font-semibold hover:bg-gray-50 transition-colors whitespace-nowrap"
                >
                  <i className="ri-download-line mr-2"></i>
                  Invoice
                </button>
                <Link
                  href={helpHref}
                  className="flex-1 sm:flex-none text-center px-4 py-2 border-2 border-gray-300 text-gray-900 rounded-lg font-semibold hover:bg-gray-50 transition-colors whitespace-nowrap"
                >
                  <i className="ri-customer-service-line mr-2"></i>
                  Get Help
                </Link>
              </div>
            </div>
          </div>
        );
        })}
      </div>
    </div>
  );
}
