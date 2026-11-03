'use client';

import { useState, useEffect, useCallback, Fragment } from 'react';
import { supabase } from '@/lib/supabase';
import { money } from '@/lib/format-money';

const ID_CHUNK = 100;

interface SalesStat {
    productId: string;
    productName: string;
    ordersCount: number;
    itemsSold: number;
    totalRevenue: number;
    _orderIds: Set<string>;
    variants: Map<string, { quantity: number; revenue: number }>;
}

interface VariantDisplay {
    name: string;
    quantity: number;
    revenue: number;
}

export default function ProductSalesStats({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const [period, setPeriod] = useState<'24h' | '7d' | '30d' | 'all'>('7d');
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState<(Omit<SalesStat, '_orderIds' | 'variants'> & { variants: VariantDisplay[] })[]>([]);
    const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
    const [loadError, setLoadError] = useState('');

    const fetchStats = useCallback(async () => {
        setLoading(true);

        // Calculate the start date based on period
        let startDate: string | null = null;
        const now = new Date();

        if (period === '24h') {
            const d = new Date(now);
            d.setHours(d.getHours() - 24);
            startDate = d.toISOString();
        } else if (period === '7d') {
            const d = new Date(now);
            d.setDate(d.getDate() - 7);
            startDate = d.toISOString();
        } else if (period === '30d') {
            const d = new Date(now);
            d.setDate(d.getDate() - 30);
            startDate = d.toISOString();
        }
        // 'all' leaves startDate as null

        setLoadError('');
        try {
            // 1. Paid, non-cancelled orders in the period.
            let ordersQuery = supabase
                .from('orders')
                .select('id')
                .eq('payment_status', 'paid')
                .neq('status', 'cancelled');
            if (startDate) ordersQuery = ordersQuery.gte('created_at', startDate);
            const { data: orderRows, error: ordersError } = await ordersQuery;
            if (ordersError) throw ordersError;

            // 2. Their items, in chunks so request URLs stay short.
            const orderIds = (orderRows || []).map((o: any) => o.id as string);
            const items: any[] = [];
            for (let k = 0; k < orderIds.length; k += ID_CHUNK) {
                const { data: chunk, error: itemsError } = await supabase
                    .from('order_items')
                    .select('order_id, quantity, product_name, product_id, variant_id, variant_name, unit_price, total_price')
                    .in('order_id', orderIds.slice(k, k + ID_CHUNK));
                if (itemsError) throw itemsError;
                if (chunk) items.push(...chunk);
            }

            const map = new Map<string, SalesStat>();
            items.forEach((item: any) => {
                const pid = item.product_id || `name:${item.product_name}`;
                const qty = Number(item.quantity) || 0;
                const revenue = Number(item.total_price) || (Number(item.unit_price) || 0) * qty;

                let entry = map.get(pid);
                if (!entry) {
                    entry = {
                        productId: pid,
                        productName: item.product_name || 'Unknown product',
                        ordersCount: 0,
                        itemsSold: 0,
                        totalRevenue: 0,
                        _orderIds: new Set(),
                        variants: new Map()
                    };
                    map.set(pid, entry);
                }

                entry.itemsSold += qty;
                entry.totalRevenue += revenue;

                const variantName = item.variant_name || 'Default';
                const existing = entry.variants.get(variantName) || { quantity: 0, revenue: 0 };
                existing.quantity += qty;
                existing.revenue += revenue;
                entry.variants.set(variantName, existing);

                if (item.order_id && !entry._orderIds.has(item.order_id)) {
                    entry.ordersCount++;
                    entry._orderIds.add(item.order_id);
                }
            });

            const result = Array.from(map.values())
                .map(({ _orderIds, variants, ...rest }) => ({
                    ...rest,
                    variants: Array.from(variants.entries())
                        .map(([name, data]) => ({ name, ...data }))
                        .sort((a, b) => b.quantity - a.quantity)
                }))
                .sort((a, b) => b.itemsSold - a.itemsSold);

            setStats(result);
        } catch (err: any) {
            console.error('Error fetching product stats:', err);
            setStats([]);
            setLoadError(err?.message || 'Could not load sales data.');
        } finally {
            setLoading(false);
        }
    }, [period]);

    useEffect(() => {
        if (isOpen) fetchStats();
    }, [isOpen, fetchStats]);

    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-label="Product sales breakdown"
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">

                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Product Sales Breakdown</h2>
                        <p className="text-sm text-gray-500 mt-1">See which products are performing best</p>
                    </div>
                    <button
                        onClick={onClose}
                        aria-label="Close"
                        className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
                    >
                        <i className="ri-close-line text-2xl text-gray-500"></i>
                    </button>
                </div>

                {/* Filters */}
                <div className="px-6 py-4 bg-white border-b border-gray-100 flex flex-wrap gap-2">
                    {(['24h', '7d', '30d', 'all'] as const).map((p) => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${period === p
                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-transparent'
                                }`}
                        >
                            {p === 'all' ? 'All Time' : p === '24h' ? 'Last 24 Hours' : p === '7d' ? 'Last 7 Days' : 'Last 30 Days'}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto bg-gray-50/30">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-500 font-semibold uppercase tracking-wider sticky top-0 border-b border-gray-200">
                            <tr>
                                <th className="p-4 pl-6">Product Name</th>
                                <th className="p-4 text-center">Orders Count</th>
                                <th className="p-4 text-center">Items Sold (Qty)</th>
                                <th className="p-4 text-right pr-6">Revenue (GH₵)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="p-12 text-center text-gray-500">
                                        <i className="ri-loader-4-line text-3xl animate-spin text-blue-600 mb-2 block"></i>
                                        Loading sales data...
                                    </td>
                                </tr>
                            ) : loadError ? (
                                <tr>
                                    <td colSpan={4} className="p-12 text-center text-red-600">
                                        <p className="mb-3">{loadError}</p>
                                        <button onClick={fetchStats} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50">
                                            Try again
                                        </button>
                                    </td>
                                </tr>
                            ) : stats.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="p-12 text-center text-gray-500">
                                        <i className="ri-inbox-line text-3xl mb-2 block text-gray-300"></i>
                                        No products sold in this period.
                                    </td>
                                </tr>
                            ) : (
                                stats.map((s) => (
                                    <Fragment key={s.productId}>
                                    {(() => {
                                        const hasVariants = s.variants.length > 1 || (s.variants.length === 1 && s.variants[0].name !== 'Default');
                                        return (
                                    <>
                                    <tr 
                                        className={`hover:bg-blue-50/30 transition-colors ${hasVariants ? 'cursor-pointer' : ''}`}
                                        onClick={() => hasVariants && setExpandedProduct(expandedProduct === s.productId ? null : s.productId)}
                                    >
                                        <td className="p-4 pl-6 font-medium text-gray-900">
                                            <div className="flex items-center space-x-2">
                                                {hasVariants ? (
                                                    <i className={`ri-arrow-${expandedProduct === s.productId ? 'down' : 'right'}-s-line text-gray-400`}></i>
                                                ) : (
                                                    <span className="w-4"></span>
                                                )}
                                                <span>{s.productName}</span>
                                                {hasVariants && (
                                                    <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-semibold">
                                                        {s.variants.length} variants
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                {s.ordersCount}
                                            </span>
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className="font-bold text-blue-700 text-base">{s.itemsSold}</span>
                                        </td>
                                        <td className="p-4 text-right pr-6 text-gray-600 font-mono">
                                            {s.totalRevenue > 0 ? money(s.totalRevenue) : '-'}
                                        </td>
                                    </tr>
                                    {expandedProduct === s.productId && hasVariants && (
                                        s.variants.map((v) => (
                                            <tr key={`${s.productId}-${v.name}`} className="bg-gray-50/80 border-l-2 border-purple-200">
                                                <td className="p-3 pl-14 text-gray-600 text-xs">
                                                    <span className="inline-flex items-center space-x-1.5">
                                                        <i className="ri-price-tag-3-line text-purple-400"></i>
                                                        <span className="font-medium">{v.name}</span>
                                                    </span>
                                                </td>
                                                <td className="p-3 text-center text-xs text-gray-400">—</td>
                                                <td className="p-3 text-center text-xs font-semibold text-gray-700">{v.quantity}</td>
                                                <td className="p-3 text-right pr-6 text-xs text-gray-500 font-mono">
                                                    {v.revenue > 0 ? money(v.revenue) : '-'}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                    </>
                                        );
                                    })()}
                                    </Fragment>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="p-4 border-t border-gray-100 bg-gray-50 text-xs text-gray-500 flex justify-between">
                    <span>* Only paid/confirmed orders · Click a row to see variant breakdown</span>
                    <span>{stats.length} product{stats.length === 1 ? '' : 's'}</span>
                </div>
            </div>
        </div>
    );
}
