'use client';
import { money } from '@/lib/format-money';
import { DELIVERY_OPTIONS, deliveryLabel, type DeliveryMethod } from '@/lib/delivery';

import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';

/** Round to whole pesewas so totals like 3 x 19.99 compare exactly with cash tendered. */
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Strip characters that would break a PostgREST or() filter. */
const orSafe = (v: string) => v.replace(/[,()"'\\*%]/g, ' ').trim();
import { supabase } from '@/lib/supabase';
import { currentStaffActor, recordStaffAction } from '@/lib/staff-audit';

interface Variant {
    id: string;
    name: string;
    price: number;
    quantity: number;
    sku: string | null;
    image: string | null;
}

interface Product {
    id: string;
    name: string;
    price: number;
    quantity: number;
    category: string;
    image: string;
    sku: string;
    /** False when stock is not tracked or the product may be sold past zero. */
    limitStock: boolean;
    variants: Variant[];
}

interface CartItem {
    /** productId plus variantId, so two variants of one product are separate lines. */
    key: string;
    productId: string;
    variantId: string | null;
    /** The variant's own name, exactly as in product_variants.name (mark_order_paid matches on it). */
    variantName: string | null;
    name: string;
    price: number;
    image: string;
    sku: string | null;
    stock: number;
    limitStock: boolean;
    cartQuantity: number;
}

const lineKey = (productId: string, variantId: string | null) => `${productId}:${variantId || ''}`;

interface Customer {
    id: string;
    full_name: string;
    email: string;
    phone?: string;
}

export default function POSPage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [activeCategory, setActiveCategory] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [variantPicker, setVariantPicker] = useState<Product | null>(null);
    const [cartNotice, setCartNotice] = useState('');

    // Checkout State
    const [showCheckoutModal, setShowCheckoutModal] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [customerSearch, setCustomerSearch] = useState('');
    const [customerMatches, setCustomerMatches] = useState<Customer[] | null>(null);
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [amountTendered, setAmountTendered] = useState<string>('');
    const [processing, setProcessing] = useState(false);
    const [completedOrder, setCompletedOrder] = useState<any>(null);
    const [checkoutError, setCheckoutError] = useState<string | null>(null);
    const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('pickup');
    // Delivery fee agreed with the customer for doorstep / outside-Accra orders.
    const [deliveryFee, setDeliveryFee] = useState('');
    const [guestDetails, setGuestDetails] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        region: ''
    });

    const ghanaRegions = [
        'Greater Accra', 'Ashanti', 'Western', 'Central', 'Eastern',
        'Northern', 'Volta', 'Upper East', 'Upper West', 'Brong-Ahafo',
        'Ahafo', 'Bono', 'Bono East', 'North East', 'Savannah', 'Oti', 'Western North'
    ];

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
    }, []);

    const fetchData = async () => {
        setLoading(true);
        setLoadError('');

        const [{ data: prodData, error: prodError }, { data: custData }] = await Promise.all([
            supabase
                .from('products')
                .select(`
          id, name, price, quantity, sku, track_quantity, continue_selling,
          categories(name),
          product_images(url, position),
          product_variants(id, name, price, quantity, sku, image_url)
        `)
                .eq('status', 'active')
                .order('name'),
            supabase
                .from('customers')
                .select('id, full_name, email, phone')
                .order('full_name')
                .limit(200),
        ]);

        if (prodError) {
            setLoadError(prodError.message || 'Could not load products.');
        } else {
            const formatted: Product[] = (prodData || []).map((p: any) => {
                const images = Array.isArray(p.product_images) ? [...p.product_images] : [];
                images.sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0));
                const category = Array.isArray(p.categories) ? p.categories[0] : p.categories;
                const variants: Variant[] = (Array.isArray(p.product_variants) ? p.product_variants : [])
                    .map((v: any) => ({
                        id: v.id,
                        name: v.name,
                        price: Number(v.price) || 0,
                        quantity: Number(v.quantity) || 0,
                        sku: v.sku || null,
                        image: v.image_url || null,
                    }))
                    .sort((a: Variant, b: Variant) => a.name.localeCompare(b.name));
                return {
                    id: p.id,
                    name: p.name,
                    price: Number(p.price) || 0,
                    quantity: variants.length
                        ? variants.reduce((sum, v) => sum + v.quantity, 0)
                        : Number(p.quantity) || 0,
                    category: category?.name || 'Uncategorized',
                    image: images[0]?.url || '/house-of-elle-logo.png',
                    sku: p.sku || '',
                    limitStock: p.track_quantity !== false && !p.continue_selling,
                    variants,
                };
            });
            setProducts(formatted);
            const cats = Array.from(new Set(formatted.map(p => p.category))).sort();
            setCategories(['All', ...cats]);
        }

        if (custData) setCustomers(custData as Customer[]);
        setLoading(false);
    };

    const flashNotice = (text: string) => {
        setCartNotice(text);
        setTimeout(() => setCartNotice((current) => (current === text ? '' : current)), 2500);
    };

    // Cart Functions
    const addLine = (product: Product, variant: Variant | null) => {
        const key = lineKey(product.id, variant?.id || null);
        const stock = variant ? variant.quantity : product.quantity;
        const existing = cart.find(item => item.key === key);
        const nextQty = (existing?.cartQuantity || 0) + 1;
        if (product.limitStock && nextQty > stock) {
            flashNotice(stock > 0 ? `Only ${stock} of ${product.name}${variant ? ` (${variant.name})` : ''} in stock` : `${product.name}${variant ? ` (${variant.name})` : ''} is out of stock`);
            return;
        }
        setCart(prev => {
            if (prev.some(item => item.key === key)) {
                return prev.map(item => item.key === key ? { ...item, cartQuantity: item.cartQuantity + 1 } : item);
            }
            return [...prev, {
                key,
                productId: product.id,
                variantId: variant?.id || null,
                variantName: variant?.name || null,
                name: product.name,
                price: variant ? variant.price : product.price,
                image: variant?.image || product.image,
                sku: variant?.sku || product.sku || null,
                stock,
                limitStock: product.limitStock,
                cartQuantity: 1,
            }];
        });
    };

    const addToCart = (product: Product) => {
        if (product.variants.length > 0) {
            setVariantPicker(product);
            return;
        }
        addLine(product, null);
    };

    const removeFromCart = (key: string) => {
        setCart(prev => prev.filter(item => item.key !== key));
    };

    const updateQuantity = (key: string, delta: number) => {
        const line = cart.find(item => item.key === key);
        if (line && delta > 0 && line.limitStock && line.cartQuantity + delta > line.stock) {
            flashNotice(`Only ${line.stock} of ${line.name}${line.variantName ? ` (${line.variantName})` : ''} in stock`);
            return;
        }
        setCart(prev => prev.map(item => {
            if (item.key === key) {
                const newQty = item.cartQuantity + delta;
                return newQty > 0 ? { ...item, cartQuantity: newQty } : item;
            }
            return item;
        }));
    };

    const emptyCart = () => setCart([]);

    // Computed
    const filteredProducts = useMemo(() => {
        return products.filter(p => {
            const q = searchQuery.toLowerCase();
            const matchesSearch = p.name.toLowerCase().includes(q) ||
                p.sku?.toLowerCase().includes(q) ||
                p.variants.some(v => v.sku?.toLowerCase().includes(q) || v.name.toLowerCase().includes(q));
            const matchesCat = activeCategory === 'All' || p.category === activeCategory;
            return matchesSearch && matchesCat;
        });
    }, [products, searchQuery, activeCategory]);

    // Only the first 200 customers are preloaded, so search the whole list on the server.
    useEffect(() => {
        const q = orSafe(customerSearch);
        if (q.length < 2) {
            setCustomerMatches(null);
            return;
        }
        let cancelled = false;
        const t = setTimeout(async () => {
            const { data, error } = await supabase
                .from('customers')
                .select('id, full_name, email, phone')
                .or(`full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`)
                .order('full_name')
                .limit(50);
            if (!cancelled && !error) setCustomerMatches((data || []) as Customer[]);
        }, 250);
        return () => {
            cancelled = true;
            clearTimeout(t);
        };
    }, [customerSearch]);

    // Filter customers by search
    const filteredCustomers = useMemo(() => {
        if (!customerSearch.trim()) return customers;
        if (customerMatches) return customerMatches;
        const q = customerSearch.toLowerCase();
        return customers.filter(c =>
            c.full_name?.toLowerCase().includes(q) ||
            c.email?.toLowerCase().includes(q) ||
            c.phone?.includes(q)
        );
    }, [customers, customerSearch, customerMatches]);

    const cartTotal = round2(cart.reduce((sum, item) => sum + (item.price * item.cartQuantity), 0));
    const tax = 0;
    const deliveryFeeAmount = deliveryMethod === 'pickup' ? 0 : Math.max(0, round2(parseFloat(deliveryFee) || 0));
    const grandTotal = round2(cartTotal + tax + deliveryFeeAmount);
    const changeDue = amountTendered ? round2(parseFloat(amountTendered) - grandTotal) : 0;

    // Get the customer email and phone for the order
    const getOrderEmail = () => {
        if (selectedCustomer) return selectedCustomer.email;
        return guestDetails.email || 'pos-walkin@store.local';
    };

    const getOrderPhone = () => {
        if (selectedCustomer) return selectedCustomer.phone || '';
        return guestDetails.phone || '';
    };

    const getCustomerFullName = () => {
        if (selectedCustomer) return selectedCustomer.full_name || '';
        return `${guestDetails.firstName} ${guestDetails.lastName}`.trim();
    };

    // Validate before checkout
    const validateCheckout = (): string | null => {
        if (cart.length === 0) return 'Cart is empty';

        if (paymentMethod === 'momo') {
            const phone = getOrderPhone();
            if (!phone) return 'Phone number is required for Mobile Money payment';
        }

        if (paymentMethod === 'cash') {
            const tendered = round2(parseFloat(amountTendered || '0') || 0);
            if (tendered < grandTotal) return 'Insufficient amount tendered';
        }

        // For guest, require at least a name or phone
        if (!selectedCustomer) {
            const hasName = guestDetails.firstName.trim() || guestDetails.lastName.trim();
            const hasContact = guestDetails.email.trim() || guestDetails.phone.trim();
            if (!hasName && !hasContact) return 'Please enter customer name or contact info';
        }

        // Require address for anything that is delivered
        if (deliveryMethod !== 'pickup') {
            if (!guestDetails.address.trim()) return 'Delivery address is required';
            if (!guestDetails.city.trim()) return 'City is required for delivery';
            if (!guestDetails.region) return 'Region is required for delivery';
        }

        return null;
    };

    // Checkout Logic
    const handleCheckout = async () => {
        const validationError = validateCheckout();
        if (validationError) {
            setCheckoutError(validationError);
            return;
        }

        setProcessing(true);
        setCheckoutError(null);

        try {
            const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            const customerName = getCustomerFullName();
            const customerEmail = getOrderEmail();
            const customerPhone = getOrderPhone();

            const isCashOrCard = paymentMethod === 'cash' || paymentMethod === 'card';
            // Who rang up the sale, for Admin → Staff activity.
            const seller = await currentStaffActor();

            // Build shipping/billing address
            const addressData = selectedCustomer ? {
                firstName: selectedCustomer.full_name?.split(' ')[0] || '',
                lastName: selectedCustomer.full_name?.split(' ').slice(1).join(' ') || '',
                email: selectedCustomer.email,
                phone: selectedCustomer.phone || '',
                address: guestDetails.address,
                city: guestDetails.city,
                region: guestDetails.region,
                pos_sale: true
            } : {
                firstName: guestDetails.firstName,
                lastName: guestDetails.lastName,
                email: guestDetails.email,
                phone: guestDetails.phone,
                address: guestDetails.address,
                city: guestDetails.city,
                region: guestDetails.region,
                pos_sale: true
            };

            // 1. Create Order
            const { data: order, error: orderError } = await supabase
                .from('orders')
                .insert([{
                    order_number: orderNumber,
                    user_id: null,
                    email: customerEmail,
                    phone: customerPhone,
                    status: isCashOrCard ? 'processing' : 'pending',
                    payment_status: isCashOrCard ? 'paid' : 'pending',
                    currency: 'GHS',
                    subtotal: cartTotal,
                    tax_total: tax,
                    shipping_total: deliveryFeeAmount,
                    discount_total: 0,
                    total: grandTotal,
                    shipping_method: deliveryMethod,
                    payment_method: paymentMethod === 'momo' ? 'moolre' : paymentMethod,
                    shipping_address: addressData,
                    billing_address: addressData,
                    metadata: {
                        source: 'pos',
                        pos_sale: true,
                        sold_by_id: seller?.id ?? null,
                        sold_by_name: seller?.name ?? null,
                        first_name: addressData.firstName,
                        last_name: addressData.lastName,
                        phone: customerPhone
                    }
                }])
                .select()
                .single();

            if (orderError) throw orderError;

            // 2. Create Order Items (with product_name, unit_price, total_price)
            const orderItems = cart.map(item => ({
                order_id: order.id,
                product_id: item.productId,
                variant_id: item.variantId,
                product_name: item.name,
                variant_name: item.variantName,
                sku: item.sku,
                quantity: item.cartQuantity,
                unit_price: item.price,
                total_price: Math.round(item.price * item.cartQuantity * 100) / 100,
                metadata: { image: item.image, pos_sale: true }
            }));

            const { error: itemsError } = await supabase
                .from('order_items')
                .insert(orderItems);

            if (itemsError) {
                // Don't leave an order with no items behind.
                await supabase.from('orders').delete().eq('id', order.id);
                throw itemsError;
            }

            recordStaffAction({
                action: 'pos_sale',
                entityType: 'orders',
                entityId: order.id,
                actor: seller,
                details: {
                    label: orderNumber,
                    total: grandTotal,
                    items: cart.reduce((sum, item) => sum + item.cartQuantity, 0),
                    payment_method: paymentMethod,
                },
            });

            // 3. Upsert Customer Record (email is required in customers table)
            const hasRealEmail = customerEmail && customerEmail !== 'pos-walkin@store.local';
            const upsertEmail = hasRealEmail
                ? customerEmail
                : customerPhone
                    ? `${customerPhone.replace(/[^0-9]/g, '')}@pos.local`
                    : null;

            if (upsertEmail) {
                try {
                    const { error: custError } = await supabase.rpc('upsert_customer_from_order', {
                        p_email: upsertEmail,
                        p_phone: customerPhone || null,
                        p_full_name: customerName || null,
                        p_first_name: addressData.firstName || null,
                        p_last_name: addressData.lastName || null,
                        p_user_id: null,
                        p_address: addressData
                    });
                    if (custError) console.error('Customer upsert error (non-fatal):', custError);
                    // Refresh customer list silently
                    supabase.from('customers').select('id, full_name, email, phone').order('full_name').limit(200)
                        .then(({ data }) => { if (data) setCustomers(data as Customer[]); });
                } catch (custErr) {
                    console.error('Customer upsert error (non-fatal):', custErr);
                }
            }

            // 4. If Cash or Card — mark as paid, reduce stock
            if (isCashOrCard) {
                // mark_order_paid reduces product and variant stock (matched on variant_name).
                let stockWarning = '';
                try {
                    const { error: stockErr } = await supabase.rpc('mark_order_paid', {
                        order_ref: orderNumber,
                        moolre_ref: `POS-${paymentMethod.toUpperCase()}-${Date.now()}`
                    });
                    if (stockErr) stockWarning = `Sale saved, but stock was not updated: ${stockErr.message}`;
                } catch (stockErr: any) {
                    stockWarning = `Sale saved, but stock was not updated: ${stockErr?.message || 'unknown error'}`;
                }

                // Success — show completed
                const tendered = paymentMethod === 'cash' ? round2(parseFloat(amountTendered || '0') || 0) : 0;
                const change = paymentMethod === 'cash' ? Math.max(0, round2(tendered - grandTotal)) : 0;
                setCompletedOrder({
                    id: order.id, orderNumber, total: grandTotal, subtotal: cartTotal, deliveryFee: deliveryFeeAmount,
                    deliveryMethod, items: cart, stockWarning, change, tendered, paymentMethod,
                    customerName, customerPhone, soldBy: seller?.name || '', createdAt: new Date().toISOString(),
                });
                setCart([]);
                // Reflect the new stock levels in the grid.
                fetchData();

                // Send notification
                if (customerEmail && customerEmail !== 'pos-walkin@store.local') {
                    const { data: { session } } = await supabase.auth.getSession();
                    fetch('/api/notifications', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            ...(session?.access_token && { 'Authorization': `Bearer ${session.access_token}` })
                        },
                        body: JSON.stringify({
                            type: 'order_created',
                            payload: {
                                ...order,
                                order_number: orderNumber,
                                email: customerEmail,
                                shipping_address: addressData
                            }
                        })
                    }).catch(err => console.error('POS Notification error:', err));
                }
            }

            // 5. If Momo — initiate Moolre payment
            if (paymentMethod === 'momo') {
                const paymentRes = await fetch('/api/payment/moolre', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        orderId: orderNumber,
                        amount: grandTotal,
                        customerEmail: customerEmail
                    })
                });

                const paymentResult = await paymentRes.json();

                if (!paymentResult.success) {
                    throw new Error(paymentResult.message || 'Failed to initiate Mobile Money payment');
                }

                // Show completed with payment link
                setCompletedOrder({
                    id: order.id,
                    orderNumber,
                    total: grandTotal,
                    subtotal: cartTotal,
                    deliveryFee: deliveryFeeAmount,
                    deliveryMethod,
                    items: cart,
                    paymentMethod,
                    customerName,
                    customerPhone,
                    soldBy: seller?.name || '',
                    createdAt: new Date().toISOString(),
                    paymentUrl: paymentResult.url,
                    paymentPending: true
                });
                setCart([]);
            }

        } catch (error: any) {
            console.error('Checkout failed:', error);
            setCheckoutError(error.message || 'Checkout failed. Please try again.');
        } finally {
            setProcessing(false);
        }
    };

    const resetCheckout = () => {
        setShowCheckoutModal(false);
        setCompletedOrder(null);
        setAmountTendered('');
        setSelectedCustomer(null);
        setCustomerSearch('');
        setCustomerMatches(null);
        setCheckoutError(null);
        setPaymentMethod('cash');
        setDeliveryMethod('pickup');
        setDeliveryFee('');
        setGuestDetails({
            firstName: '',
            lastName: '',
            email: '',
            phone: '',
            address: '',
            city: '',
            region: ''
        });
    };

    const paymentLabel = (m: string) => (m === 'momo' ? 'Mobile Money' : m === 'card' ? 'Card' : 'Cash');

    // Printed receipt: rendered straight into <body> so print CSS can hide the rest of the admin.
    const receipt = completedOrder && typeof document !== 'undefined' ? createPortal(
        <div className="pos-receipt-root" aria-hidden="true">
            <style>{`
                .pos-receipt-root { display: none; }
                @media print {
                    @page { margin: 6mm; }
                    body > *:not(.pos-receipt-root) { display: none !important; }
                    .pos-receipt-root { display: block !important; width: 72mm; margin: 0 auto; font-family: ui-monospace, Menlo, monospace; font-size: 11px; color: #000; }
                    .pos-receipt-root table { width: 100%; border-collapse: collapse; }
                    .pos-receipt-root td { padding: 2px 0; vertical-align: top; }
                }
            `}</style>
            <div style={{ textAlign: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>House of Elle</div>
                <div>Spintex Lashibi, Accra</div>
                <div>0553347531</div>
            </div>
            <div>Receipt: {completedOrder.orderNumber}</div>
            <div>{new Date(completedOrder.createdAt || Date.now()).toLocaleString('en-GB')}</div>
            {completedOrder.customerName && <div>Customer: {completedOrder.customerName}</div>}
            {completedOrder.soldBy && <div>Served by: {completedOrder.soldBy}</div>}
            <hr style={{ border: 0, borderTop: '1px dashed #000', margin: '6px 0' }} />
            <table>
                <tbody>
                    {(completedOrder.items || []).map((item: CartItem) => (
                        <tr key={item.key}>
                            <td>
                                {item.name}{item.variantName ? ` (${item.variantName})` : ''}
                                <div>{item.cartQuantity} x GH₵{money(item.price)}</div>
                            </td>
                            <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>GH₵{money(round2(item.price * item.cartQuantity))}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <hr style={{ border: 0, borderTop: '1px dashed #000', margin: '6px 0' }} />
            <table>
                <tbody>
                    <tr><td>Subtotal</td><td style={{ textAlign: 'right' }}>GH₵{money(completedOrder.subtotal)}</td></tr>
                    {Number(completedOrder.deliveryFee) > 0 && (
                        <tr><td>{deliveryLabel(completedOrder.deliveryMethod)} fee</td><td style={{ textAlign: 'right' }}>GH₵{money(completedOrder.deliveryFee)}</td></tr>
                    )}
                    <tr><td style={{ fontWeight: 700 }}>Total</td><td style={{ textAlign: 'right', fontWeight: 700 }}>GH₵{money(completedOrder.total)}</td></tr>
                    <tr><td>Payment</td><td style={{ textAlign: 'right' }}>{paymentLabel(completedOrder.paymentMethod)}{completedOrder.paymentPending ? ' (awaiting payment)' : ''}</td></tr>
                    {completedOrder.paymentMethod === 'cash' && (
                        <>
                            <tr><td>Cash received</td><td style={{ textAlign: 'right' }}>GH₵{money(completedOrder.tendered)}</td></tr>
                            <tr><td>Change</td><td style={{ textAlign: 'right' }}>GH₵{money(completedOrder.change)}</td></tr>
                        </>
                    )}
                </tbody>
            </table>
            {completedOrder.deliveryMethod && completedOrder.deliveryMethod !== 'pickup' && (
                <div style={{ marginTop: 6 }}>Delivery: {deliveryLabel(completedOrder.deliveryMethod)}</div>
            )}
            <div style={{ textAlign: 'center', marginTop: 10 }}>Thank you for shopping with House of Elle!</div>
        </div>,
        document.body
    ) : null;

    return (
        <div className="flex flex-col lg:flex-row h-[calc(100vh-90px)] -m-4 lg:-m-6 overflow-hidden bg-gray-100 relative">

            {/* LEFT: Product Grid */}
            <div className={`flex-1 flex flex-col h-full min-w-0 ${isMobileCartOpen ? 'hidden lg:flex' : 'flex'}`}>
                {/* Header / Search */}
                <div className="bg-white p-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 shrink-0">
                    <div className="relative w-full sm:flex-1 sm:max-w-lg">
                        <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                        <input
                            type="search"
                            aria-label="Search products by name, SKU or option"
                            placeholder="Search products..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                            autoFocus
                        />
                    </div>
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar min-w-0" role="group" aria-label="Category">
                        {categories.map(cat => (
                            <button
                                key={cat}
                                type="button"
                                aria-pressed={activeCategory === cat}
                                onClick={() => setActiveCategory(cat)}
                                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${activeCategory === cat
                                    ? 'bg-blue-700 text-white shadow-md'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Grid Area */}
                <div className="flex-1 overflow-y-auto p-4 content-start">
                    {cartNotice && (
                        <div role="status" className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
                            {cartNotice}
                        </div>
                    )}
                    {loadError ? (
                        <div className="flex flex-col items-center justify-center h-full text-red-600 gap-3">
                            <p>{loadError}</p>
                            <button onClick={fetchData} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50">
                                Try again
                            </button>
                        </div>
                    ) : loading ? (
                        <div className="flex items-center justify-center h-full text-gray-500">Loading products...</div>
                    ) : filteredProducts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-500">
                            <i className="ri-inbox-line text-4xl mb-2"></i>
                            <p>No products found</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 pb-20 lg:pb-4">
                            {filteredProducts.map(product => (
                                <button
                                    type="button"
                                    key={product.id}
                                    onClick={() => addToCart(product)}
                                    aria-label={`Add ${product.name} to the order${product.variants.length > 0 ? ' (choose an option)' : ''}`}
                                    className="text-left bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer overflow-hidden border border-gray-100 group flex flex-col h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                >
                                    <div className="aspect-square relative bg-gray-50 shrink-0">
                                        <img
                                            src={product.image}
                                            alt={product.name}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                        />
                                        <div className={`absolute top-2 right-2 text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm ${product.limitStock && product.quantity <= 0 ? 'bg-red-600/80' : 'bg-black/60'}`}>
                                            {product.limitStock && product.quantity <= 0 ? 'Out of stock' : `Qty: ${product.quantity}`}
                                        </div>
                                        {product.variants.length > 0 && (
                                            <div className="absolute top-2 left-2 bg-white/90 text-gray-800 text-xs px-2 py-1 rounded-full">
                                                {product.variants.length} options
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-3 flex flex-col flex-1">
                                        <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 mb-auto">{product.name}</h3>
                                        <div className="flex items-center justify-between mt-2 pt-2">
                                            <span className="text-blue-700 font-bold">
                                                {product.variants.length > 0 && new Set(product.variants.map(v => v.price)).size > 1
                                                    ? `From GH₵${money(Math.min(...product.variants.map(v => v.price)))}`
                                                    : `GH₵${money(product.variants[0]?.price ?? product.price)}`}
                                            </span>
                                            <span aria-hidden="true" className="w-8 h-8 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center group-hover:bg-blue-700 group-hover:text-white transition-colors">
                                                <i className="ri-add-line"></i>
                                            </span>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Mobile Bottom Cart Bar */}
                {cart.length > 0 && (
                    <div className="lg:hidden p-4 border-t border-gray-200 bg-white fixed bottom-0 left-0 right-0 z-30 shadow-2xl safe-area-bottom">
                        <button
                            onClick={() => setIsMobileCartOpen(true)}
                            className="w-full py-3 bg-blue-700 text-white rounded-xl font-bold flex justify-between px-6 shadow-lg active:scale-95 transition-transform"
                        >
                            <span className="flex items-center text-sm">
                                <span className="bg-white/20 px-2 py-0.5 rounded mr-2">{cart.reduce((a, b) => a + b.cartQuantity, 0)}</span>
                                Items
                            </span>
                            <span>View Cart</span>
                            <span>GH₵{money(grandTotal)}</span>
                        </button>
                    </div>
                )}
            </div>

            {/* RIGHT: Cart Panel */}
            <div className={`w-full lg:w-96 bg-white border-l border-gray-200 flex flex-col h-full shadow-lg z-20 absolute inset-0 lg:relative ${isMobileCartOpen ? 'flex' : 'hidden lg:flex'}`}>
                <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50 shrink-0">
                    <div className="flex items-center">
                        <button onClick={() => setIsMobileCartOpen(false)} aria-label="Back to products" className="lg:hidden mr-3 p-2 -ml-2 text-gray-600 hover:bg-gray-200 rounded-full transition-colors">
                            <i className="ri-arrow-left-line text-xl"></i>
                        </button>
                        <h2 className="text-lg font-bold text-gray-900 flex items-center">
                            <i className="ri-shopping-basket-2-line mr-2"></i>
                            Current Order
                        </h2>
                    </div>
                    <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded-full">
                        {cart.reduce((a, b) => a + b.cartQuantity, 0)} Items
                    </span>
                </div>

                {/* Cart Items */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {cart.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-4">
                            <i className="ri-shopping-cart-line text-5xl opacity-20"></i>
                            <p className="text-sm">Cart is empty</p>
                            <button onClick={() => setIsMobileCartOpen(false)} className="lg:hidden text-blue-700 font-medium hover:underline">
                                Start Adding Products
                            </button>
                        </div>
                    ) : (
                        cart.map(item => (
                            <div key={item.key} className="flex gap-3 p-3 bg-gray-50 rounded-lg group hover:bg-gray-100 transition-colors">
                                <div className="w-16 h-16 bg-white rounded-md overflow-hidden flex-shrink-0 border border-gray-200">
                                    <img src={item.image} className="w-full h-full object-cover" alt="" />
                                </div>
                                <div className="flex-1 min-w-0 flex flex-col justify-between">
                                    <div className="flex justify-between items-start">
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-gray-900 line-clamp-1">{item.name}</p>
                                            {item.variantName && <p className="text-xs text-gray-500 line-clamp-1">{item.variantName}</p>}
                                        </div>
                                        <button onClick={() => removeFromCart(item.key)} aria-label={`Remove ${item.name}`} className="text-gray-400 hover:text-red-500">
                                            <i className="ri-delete-bin-line"></i>
                                        </button>
                                    </div>
                                    <div className="flex items-center justify-between mt-2">
                                        <div className="flex items-center space-x-2 bg-white rounded border border-gray-200 px-1 py-0.5">
                                            <button onClick={() => updateQuantity(item.key, -1)} aria-label={`Decrease quantity of ${item.name}`} className="w-6 h-6 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded">
                                                <i className="ri-subtract-line text-xs"></i>
                                            </button>
                                            <span className="text-sm font-semibold w-6 text-center">{item.cartQuantity}</span>
                                            <button onClick={() => updateQuantity(item.key, 1)} aria-label={`Increase quantity of ${item.name}`} className="w-6 h-6 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded">
                                                <i className="ri-add-line text-xs"></i>
                                            </button>
                                        </div>
                                        <p className="text-sm font-bold text-gray-900">GH₵{money((item.price * item.cartQuantity))}</p>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Cart Footer */}
                <div className="p-4 bg-gray-50 border-t border-gray-200 space-y-4 shrink-0 safe-area-bottom">
                    <div className="space-y-1 text-sm">
                        <div className="flex justify-between text-gray-600">
                            <span>Subtotal</span>
                            <span>GH₵{money(cartTotal)}</span>
                        </div>
                        {deliveryFeeAmount > 0 && (
                            <div className="flex justify-between text-gray-600">
                                <span>{deliveryLabel(deliveryMethod)} fee</span>
                                <span>GH₵{money(deliveryFeeAmount)}</span>
                            </div>
                        )}
                        <div className="flex justify-between text-xl font-bold text-gray-900 pt-2 border-t border-gray-200 mt-2">
                            <span>Total</span>
                            <span>GH₵{money(grandTotal)}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={emptyCart}
                            disabled={cart.length === 0}
                            className="px-4 py-3 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Clear
                        </button>
                        <button
                            onClick={() => { setShowCheckoutModal(true); setCheckoutError(null); }}
                            disabled={cart.length === 0}
                            className="px-4 py-3 bg-blue-700 text-white rounded-lg hover:bg-blue-800 font-bold text-sm shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Charge GH₵{money(grandTotal)}
                        </button>
                    </div>
                </div>
            </div>

            {/* Checkout Modal */}
            {showCheckoutModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        {completedOrder ? (
                            // SUCCESS STATE
                            <div className="p-8 text-center flex flex-col items-center justify-center space-y-6 overflow-y-auto">
                                <div className={`w-20 h-20 rounded-full flex items-center justify-center ${completedOrder.paymentPending ? 'bg-amber-100' : 'bg-blue-100'}`}>
                                    <i className={`text-5xl ${completedOrder.paymentPending ? 'ri-time-line text-amber-600' : 'ri-checkbox-circle-fill text-blue-600'}`}></i>
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-900">
                                        {completedOrder.paymentPending ? 'Payment Link Generated!' : 'Payment Successful!'}
                                    </h2>
                                    <p className="text-gray-500 mt-1">Order #{completedOrder.orderNumber}</p>

                                    {!completedOrder.paymentPending && completedOrder.change > 0 && (
                                        <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
                                            <p className="text-sm text-blue-700">Change Due</p>
                                            <p className="text-2xl font-bold text-blue-800">GH₵{money(completedOrder.change)}</p>
                                        </div>
                                    )}

                                    {completedOrder.stockWarning && (
                                        <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                                            {completedOrder.stockWarning}
                                        </div>
                                    )}

                                    {completedOrder.paymentPending && completedOrder.paymentUrl && (
                                        <div className="mt-4 space-y-3">
                                            <p className="text-sm text-gray-600">
                                                Customer can pay using this link:
                                            </p>
                                            <a
                                                href={completedOrder.paymentUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center px-6 py-3 bg-amber-600 text-white rounded-xl font-semibold hover:bg-amber-700 transition-colors"
                                            >
                                                <i className="ri-external-link-line mr-2"></i>
                                                Open Payment Page
                                            </a>
                                            <div className="mt-2">
                                                <button
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(completedOrder.paymentUrl);
                                                        alert('Payment link copied!');
                                                    }}
                                                    className="text-sm text-blue-700 hover:text-blue-800 font-medium underline"
                                                >
                                                    <i className="ri-file-copy-line mr-1"></i>
                                                    Copy Link
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-4 w-full mt-4">
                                    <button onClick={() => window.print()} className="py-3 px-4 border border-gray-300 rounded-xl font-semibold hover:bg-gray-50 transition-colors">
                                        <i className="ri-printer-line mr-2"></i>
                                        Print Receipt
                                    </button>
                                    <button onClick={resetCheckout} className="py-3 px-4 bg-blue-700 text-white rounded-xl font-semibold hover:bg-blue-800 transition-colors">
                                        New Order
                                    </button>
                                </div>
                            </div>
                        ) : (
                            // CHECKOUT FORM
                            <>
                                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
                                    <h3 className="text-xl font-bold text-gray-900">Finalize Payment</h3>
                                    <button onClick={() => setShowCheckoutModal(false)} aria-label="Close checkout" className="w-8 h-8 rounded-full hover:bg-gray-200 flex items-center justify-center text-gray-500">
                                        <i className="ri-close-line text-xl"></i>
                                    </button>
                                </div>

                                <div className="p-6 space-y-6 overflow-y-auto">
                                    {/* Error Display */}
                                    {checkoutError && (
                                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start space-x-2">
                                            <i className="ri-error-warning-line text-red-500 mt-0.5"></i>
                                            <p className="text-sm text-red-700">{checkoutError}</p>
                                        </div>
                                    )}

                                    {/* Total Display */}
                                    <div className="text-center py-4 bg-blue-50 rounded-xl border border-blue-100">
                                        <p className="text-sm text-blue-800 uppercase tracking-wide font-semibold">Amount to Pay</p>
                                        <p className="text-4xl font-extrabold text-blue-700 mt-1">GH₵{money(grandTotal)}</p>
                                    </div>

                                    {/* Customer Select */}
                                    <div>
                                        <label htmlFor="pos-customer" className="block text-sm font-semibold text-gray-700 mb-2">Customer</label>

                                        {/* Customer search input */}
                                        <div className="relative mb-2">
                                            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                                            <input
                                                type="search"
                                                aria-label="Search customers"
                                                placeholder="Search customers by name, email, or phone..."
                                                value={customerSearch}
                                                onChange={(e) => setCustomerSearch(e.target.value)}
                                                className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                            />
                                        </div>

                                        <select
                                            id="pos-customer"
                                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none mb-2"
                                            onChange={(e) => {
                                                setSelectedCustomer(filteredCustomers.find(c => c.id === e.target.value) || customers.find(c => c.id === e.target.value) || null);
                                            }}
                                            value={selectedCustomer?.id || ''}
                                        >
                                            <option value="">
                                                {customerSearch.trim() && filteredCustomers.length === 0 ? 'No matching customers. Walk-in / New Guest' : 'Walk-in Customer / New Guest'}
                                            </option>
                                            {selectedCustomer && !filteredCustomers.some(c => c.id === selectedCustomer.id) && (
                                                <option value={selectedCustomer.id}>{selectedCustomer.full_name || 'No Name'} — {selectedCustomer.phone || selectedCustomer.email}</option>
                                            )}
                                            {filteredCustomers.map(c => (
                                                <option key={c.id} value={c.id}>
                                                    {c.full_name || 'No Name'} — {c.phone || c.email}
                                                </option>
                                            ))}
                                        </select>

                                        {selectedCustomer && (
                                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-2 flex items-center justify-between">
                                                <div>
                                                    <p className="font-semibold text-gray-900 text-sm">{selectedCustomer.full_name}</p>
                                                    <p className="text-xs text-gray-600">{selectedCustomer.email} {selectedCustomer.phone && `| ${selectedCustomer.phone}`}</p>
                                                </div>
                                                <button
                                                    onClick={() => setSelectedCustomer(null)}
                                                    aria-label="Remove selected customer"
                                                    className="text-gray-400 hover:text-red-500 text-sm"
                                                >
                                                    <i className="ri-close-line"></i>
                                                </button>
                                            </div>
                                        )}

                                        {!selectedCustomer && (
                                            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mt-2 space-y-3">
                                                <h4 className="text-sm font-bold text-gray-900 border-b border-gray-200 pb-2 mb-2">
                                                    New Customer Details
                                                    <span className="text-xs font-normal text-gray-500 ml-2">(will be saved to customer list)</span>
                                                </h4>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <input
                                                        type="text"
                                                        aria-label="First name"
                                                        placeholder="First Name"
                                                        value={guestDetails.firstName}
                                                        onChange={e => setGuestDetails({ ...guestDetails, firstName: e.target.value })}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                                                    />
                                                    <input
                                                        type="text"
                                                        aria-label="Last name"
                                                        placeholder="Last Name"
                                                        value={guestDetails.lastName}
                                                        onChange={e => setGuestDetails({ ...guestDetails, lastName: e.target.value })}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                                                    />
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <input
                                                        type="email"
                                                        aria-label="Email"
                                                        placeholder="Email"
                                                        value={guestDetails.email}
                                                        onChange={e => setGuestDetails({ ...guestDetails, email: e.target.value })}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                                                    />
                                                    <input
                                                        type="tel"
                                                        aria-label={paymentMethod === 'momo' ? 'Phone (required for Mobile Money)' : 'Phone'}
                                                        placeholder={paymentMethod === 'momo' ? 'Phone (Required) *' : 'Phone'}
                                                        value={guestDetails.phone}
                                                        onChange={e => setGuestDetails({ ...guestDetails, phone: e.target.value })}
                                                        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm ${paymentMethod === 'momo' && !guestDetails.phone ? 'border-amber-400 bg-amber-50' : 'border-gray-300'
                                                            }`}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Delivery Method */}
                                    <div>
                                        <p id="pos-delivery-label" className="block text-sm font-semibold text-gray-700 mb-2">Delivery Method</p>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" role="group" aria-labelledby="pos-delivery-label">
                                            {DELIVERY_OPTIONS.map((option) => (
                                                <button
                                                    key={option.id}
                                                    type="button"
                                                    aria-pressed={deliveryMethod === option.id}
                                                    onClick={() => setDeliveryMethod(option.id)}
                                                    className={`p-3 rounded-lg border transition-all flex items-center space-x-3 ${deliveryMethod === option.id
                                                        ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600'
                                                        : 'border-gray-200 hover:border-gray-300'
                                                        }`}
                                                >
                                                    <i className={`${option.icon} text-xl ${deliveryMethod === option.id ? 'text-blue-700' : 'text-gray-400'}`}></i>
                                                    <div className="text-left">
                                                        <p className={`text-sm font-semibold ${deliveryMethod === option.id ? 'text-blue-800' : 'text-gray-700'}`}>{option.label}</p>
                                                        <p className="text-xs text-gray-500">{option.id === 'pickup' ? 'Customer picks up' : option.id === 'doorstep' ? 'Within Accra' : 'Via bus station'}</p>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>

                                        {deliveryMethod !== 'pickup' && (
                                            <div className="mt-3">
                                                <label htmlFor="pos-delivery-fee" className="block text-sm font-semibold text-gray-700 mb-1">Delivery fee (GH₵)</label>
                                                <input
                                                    id="pos-delivery-fee"
                                                    type="number"
                                                    inputMode="decimal"
                                                    min="0"
                                                    step="0.01"
                                                    value={deliveryFee}
                                                    onChange={(e) => setDeliveryFee(e.target.value)}
                                                    placeholder="0.00"
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                                                />
                                                <p className="text-xs text-gray-500 mt-1">Added to the total. Leave empty if the customer pays the rider directly.</p>
                                            </div>
                                        )}

                                        {/* Delivery Address (shown for anything delivered) */}
                                        {deliveryMethod !== 'pickup' && (
                                            <div className="mt-3 bg-blue-50 p-4 rounded-lg border border-blue-200 space-y-3">
                                                <h4 className="text-sm font-bold text-gray-900 flex items-center">
                                                    <i className="ri-map-pin-line mr-2 text-blue-600"></i>
                                                    Delivery Address
                                                </h4>
                                                <input
                                                    type="text"
                                                    aria-label="Street address or location"
                                                    placeholder="Street Address / Location *"
                                                    value={guestDetails.address}
                                                    onChange={e => setGuestDetails({ ...guestDetails, address: e.target.value })}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                                                />
                                                <div className="grid grid-cols-2 gap-3">
                                                    <input
                                                        type="text"
                                                        aria-label="City or town"
                                                        placeholder="City / Town *"
                                                        value={guestDetails.city}
                                                        onChange={e => setGuestDetails({ ...guestDetails, city: e.target.value })}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                                                    />
                                                    <select
                                                        aria-label="Region"
                                                        value={guestDetails.region}
                                                        onChange={e => setGuestDetails({ ...guestDetails, region: e.target.value })}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                                                    >
                                                        <option value="">Select Region *</option>
                                                        {ghanaRegions.map(r => (
                                                            <option key={r} value={r}>{r}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Payment Method */}
                                    <div>
                                        <p id="pos-payment-label" className="block text-sm font-semibold text-gray-700 mb-2">Payment Method</p>
                                        <div className="grid grid-cols-3 gap-3" role="group" aria-labelledby="pos-payment-label">
                                            {[
                                                { key: 'cash', label: 'Cash', icon: 'ri-money-dollar-box-line' },
                                                { key: 'card', label: 'Card', icon: 'ri-bank-card-line' },
                                                { key: 'momo', label: 'MoMo', icon: 'ri-smartphone-line' }
                                            ].map(method => (
                                                <button
                                                    key={method.key}
                                                    type="button"
                                                    aria-pressed={paymentMethod === method.key}
                                                    onClick={() => setPaymentMethod(method.key)}
                                                    className={`py-3 rounded-lg font-medium border transition-all flex flex-col items-center space-y-1 ${paymentMethod === method.key
                                                        ? 'border-blue-600 bg-blue-50 text-blue-800 ring-1 ring-blue-600'
                                                        : 'border-gray-200 hover:border-gray-300 text-gray-600'
                                                        }`}
                                                >
                                                    <i className={`${method.icon} text-xl`}></i>
                                                    <span className="text-sm">{method.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Cash Tendered */}
                                    {paymentMethod === 'cash' && (
                                        <div>
                                            <label htmlFor="pos-tendered" className="block text-sm font-semibold text-gray-700 mb-2">Amount Tendered</label>
                                            <div className="relative">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">GH₵</span>
                                                <input
                                                    id="pos-tendered"
                                                    type="number"
                                                    inputMode="decimal"
                                                    min="0"
                                                    step="0.01"
                                                    value={amountTendered}
                                                    onChange={(e) => setAmountTendered(e.target.value)}
                                                    className="w-full pl-16 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold text-lg"
                                                    placeholder="0.00"
                                                    autoFocus
                                                />
                                            </div>
                                            {changeDue > 0 && (
                                                <p className="text-right text-blue-700 font-bold mt-2">Change: GH₵{money(changeDue)}</p>
                                            )}
                                            {changeDue < 0 && amountTendered && (
                                                <p className="text-right text-red-500 font-medium mt-2">Insufficient amount</p>
                                            )}
                                            {/* Quick amount buttons */}
                                            <div className="flex flex-wrap gap-2 mt-3">
                                                {[grandTotal, Math.ceil(grandTotal / 10) * 10, Math.ceil(grandTotal / 50) * 50, Math.ceil(grandTotal / 100) * 100].filter((v, i, a) => a.indexOf(v) === i).map(amount => (
                                                    <button
                                                        key={amount}
                                                        type="button"
                                                        onClick={() => setAmountTendered(amount.toFixed(2))}
                                                        className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors"
                                                    >
                                                        GH₵{money(amount)}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* MoMo info */}
                                    {paymentMethod === 'momo' && (
                                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                                            <div className="flex items-start space-x-2">
                                                <i className="ri-information-line text-amber-600 mt-0.5"></i>
                                                <div className="text-sm text-amber-800">
                                                    <p className="font-semibold">Mobile Money Payment</p>
                                                    <p className="mt-1">A Moolre payment link will be generated. The customer can pay via their phone, or you can open the link on your device.</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Card info */}
                                    {paymentMethod === 'card' && (
                                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                            <div className="flex items-start space-x-2">
                                                <i className="ri-bank-card-line text-blue-600 mt-0.5"></i>
                                                <div className="text-sm text-blue-800">
                                                    <p className="font-semibold">Card Payment</p>
                                                    <p className="mt-1">Process the card payment on your POS terminal, then tap &quot;Complete Payment&quot; to confirm.</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="p-6 border-t border-gray-100 bg-gray-50 shrink-0">
                                    <button
                                        onClick={handleCheckout}
                                        disabled={processing}
                                        className="w-full py-4 bg-gray-900 text-white rounded-xl font-bold text-lg shadow-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center space-x-2"
                                    >
                                        {processing ? (
                                            <>
                                                <i className="ri-loader-4-line animate-spin"></i>
                                                <span>Processing...</span>
                                            </>
                                        ) : paymentMethod === 'momo' ? (
                                            <>
                                                <i className="ri-smartphone-line"></i>
                                                <span>Generate Payment Link</span>
                                            </>
                                        ) : (
                                            <>
                                                <i className="ri-secure-payment-line"></i>
                                                <span>Complete Payment</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {receipt}

            {/* Variant Picker */}
            {variantPicker && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={() => setVariantPicker(null)}
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-label={`Choose an option for ${variantPicker.name}`}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
                    >
                        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                            <div className="min-w-0">
                                <h2 className="text-lg font-bold text-gray-900 truncate">{variantPicker.name}</h2>
                                <p className="text-sm text-gray-500">Choose an option</p>
                            </div>
                            <button
                                onClick={() => setVariantPicker(null)}
                                aria-label="Close"
                                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500"
                            >
                                <i className="ri-close-line text-xl"></i>
                            </button>
                        </div>
                        <div className="overflow-y-auto p-2">
                            {variantPicker.variants.map((v) => {
                                const inCart = cart.find((c) => c.key === lineKey(variantPicker.id, v.id))?.cartQuantity || 0;
                                const soldOut = variantPicker.limitStock && v.quantity - inCart <= 0;
                                return (
                                    <button
                                        key={v.id}
                                        disabled={soldOut}
                                        onClick={() => {
                                            addLine(variantPicker, v);
                                            setVariantPicker(null);
                                        }}
                                        className="w-full flex items-center justify-between gap-3 p-3 rounded-lg text-left hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <div className="min-w-0">
                                            <p className="font-medium text-gray-900 truncate">{v.name}</p>
                                            <p className="text-xs text-gray-500">
                                                {soldOut ? 'Out of stock' : `${v.quantity} in stock`}
                                                {inCart > 0 ? ` · ${inCart} in cart` : ''}
                                                {v.sku ? ` · ${v.sku}` : ''}
                                            </p>
                                        </div>
                                        <span className="font-bold text-blue-700 whitespace-nowrap">GH₵{money(v.price)}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
