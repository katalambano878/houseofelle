'use client';
import { money } from '@/lib/format-money';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { currentStaffActor } from '@/lib/staff-audit';

const STOCK_FILTERS = ['all', 'low', 'out', 'good', 'untracked'] as const;
type StockFilter = (typeof STOCK_FILTERS)[number];

export default function InventoryManagementPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [restocking, setRestocking] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  // Cost prices are the owner's business; staff see stock and retail value only.
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    fetchInventory();
    currentStaffActor().then((actor) => setIsOwner(actor?.role === 'admin')).catch(() => setIsOwner(false));
    // The dashboard links here with ?filter=low.
    const requested = new URLSearchParams(window.location.search).get('filter');
    if (requested && (STOCK_FILTERS as readonly string[]).includes(requested)) setStockFilter(requested as StockFilter);
  }, []);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      setLoadError('');
      const { data, error } = await supabase
        .from('products')
        .select(`
          id,
          name,
          slug,
          sku,
          price,
          cost_per_item,
          quantity,
          track_quantity,
          continue_selling,
          status,
          metadata,
          categories(name),
          product_variants(id, quantity)
        `)
        .order('name');

      if (error) throw error;

      if (data) {
        const mapped = data.map((p: any) => {
          const variants = Array.isArray(p.product_variants) ? p.product_variants : [];
          // Products with options are stocked per option, so their stock is the sum.
          const stock = variants.length > 0
            ? variants.reduce((sum: number, v: any) => sum + (Number(v.quantity) || 0), 0)
            : Number(p.quantity) || 0;
          const thresholdRaw = Number(p.metadata?.low_stock_threshold);
          const threshold = p.metadata?.low_stock_threshold != null && Number.isFinite(thresholdRaw) ? thresholdRaw : 5;
          const tracked = p.track_quantity !== false;
          let status = 'good';
          if (!tracked) status = 'untracked';
          else if (stock <= 0) status = 'out';
          else if (stock <= threshold) status = 'low';

          // categories is a single object from the forward join
          const categoryData = p.categories as { name: string } | null;
          return {
            id: p.id,
            name: p.name,
            slug: p.slug,
            sku: p.sku || 'N/A',
            category: categoryData?.name || 'Uncategorized',
            currentStock: stock,
            reorderLevel: threshold,
            price: Number(p.price) || 0,
            cost: p.cost_per_item != null ? Number(p.cost_per_item) : null,
            hasVariants: variants.length > 0,
            variantCount: variants.length,
            productStatus: p.status as string,
            sellsWhenOut: !!p.continue_selling,
            status
          };
        });
        setProducts(mapped);
      }
    } catch (error: any) {
      console.error('Error fetching inventory:', error);
      setLoadError(error?.message || 'Could not load inventory.');
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = stockFilter === 'all' || product.status === stockFilter;
    return matchesSearch && matchesFilter;
  });

  const lowStockCount = products.filter(p => p.status === 'low').length;
  const outOfStockCount = products.filter(p => p.status === 'out').length;
  const totalValue = products
    .filter(p => p.status !== 'untracked')
    .reduce((sum, p) => sum + (Math.max(0, p.currentStock) * p.price), 0);

  const toggleProductSelection = (id: string) => {
    setSelectedProducts(prev =>
      prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]
    );
  };

  const toggleAllProducts = () => {
    if (selectedProducts.length === filteredProducts.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(filteredProducts.map(p => p.id));
    }
  };

  const handleBulkRestock = async () => {
    const selected = products.filter(p => selectedProducts.includes(p.id));
    const withVariants = selected.filter(p => p.hasVariants);
    const restockable = selected.filter(p => !p.hasVariants);
    if (restockable.length === 0) {
      alert('The selected products have variants. Restock each variant from the product editor.');
      return;
    }
    const answer = prompt(
      `How many units should be added to each of the ${restockable.length} selected product${restockable.length > 1 ? 's' : ''}?` +
      (withVariants.length ? `\n\n${withVariants.length} product(s) with variants will be skipped — restock those in the product editor.` : '')
    );
    if (answer === null) return;
    const amount = Number(answer.trim());
    if (!Number.isInteger(amount) || amount <= 0) {
      alert('Please enter a whole number greater than 0.');
      return;
    }

    setRestocking(true);
    const failed: string[] = [];
    for (const p of restockable) {
      const { error } = await supabase
        .from('products')
        .update({ quantity: p.currentStock + amount })
        .eq('id', p.id);
      if (error) failed.push(p.name);
    }
    setRestocking(false);
    await fetchInventory();
    setSelectedProducts([]);
    if (failed.length) {
      alert(`Restocked ${restockable.length - failed.length} of ${restockable.length}. Failed: ${failed.join(', ')}`);
    } else {
      alert(`Added ${amount} units to ${restockable.length} product${restockable.length > 1 ? 's' : ''}.`);
    }
  };

  // Quote every field; neutralise values a spreadsheet would treat as a formula.
  const csvCell = (value: unknown) => {
    let text = value == null ? '' : String(value);
    if (/^[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };

  const statusLabel = (s: string) =>
    s === 'good' ? 'In stock' : s === 'low' ? 'Low stock' : s === 'out' ? 'Out of stock' : 'Not tracked';

  const handleExportCSV = () => {
    const csvData = [
      ['SKU', 'Product Name', 'Category', 'Current Stock', 'Low Stock Threshold', 'Price', ...(isOwner ? ['Cost per Item'] : []), 'Status'],
      ...filteredProducts.map(p => [
        p.sku,
        p.name,
        p.category,
        p.currentStock,
        p.reorderLevel,
        money(p.price),
        ...(isOwner ? [p.cost != null ? money(p.cost) : ''] : []),
        statusLabel(p.status)
      ])
    ];

    const csvContent = csvData.map(row => row.map(csvCell).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Inventory Management</h1>
            <p className="text-gray-600 mt-1 md:mt-2 text-sm md:text-base">Check stock levels, spot low and sold-out items, and restock in bulk</p>
          </div>
          <Link
            href="/admin"
            className="bg-gray-900 hover:bg-gray-800 text-white px-6 py-3 rounded-lg font-semibold transition-colors whitespace-nowrap text-center"
          >
            Back to Dashboard
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Products</p>
                <p className="text-3xl font-bold text-gray-900">{products.length}</p>
              </div>
              <div className="w-12 h-12 flex items-center justify-center bg-blue-100 rounded-lg">
                <i className="ri-stack-line text-2xl text-blue-600"></i>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Low Stock Items</p>
                <p className="text-3xl font-bold text-amber-600">{lowStockCount}</p>
              </div>
              <div className="w-12 h-12 flex items-center justify-center bg-amber-100 rounded-lg">
                <i className="ri-alert-line text-2xl text-amber-600"></i>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Out of Stock</p>
                <p className="text-3xl font-bold text-red-600">{outOfStockCount}</p>
              </div>
              <div className="w-12 h-12 flex items-center justify-center bg-red-100 rounded-lg">
                <i className="ri-close-circle-line text-2xl text-red-600"></i>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Stock Retail Value</p>
                <p className="text-2xl md:text-3xl font-bold text-blue-700 break-all">GH₵{totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
              </div>
              <div className="w-12 h-12 flex items-center justify-center bg-blue-100 rounded-lg">
                <i className="ri-money-dollar-circle-line text-2xl text-blue-600"></i>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xl flex items-center justify-center"></i>
                <input
                  type="search"
                  aria-label="Search inventory by product name or SKU"
                  placeholder="Search by product name or SKU..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 overflow-x-auto max-w-full" role="group" aria-label="Stock level">
                {STOCK_FILTERS.map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    aria-pressed={stockFilter === filter}
                    onClick={() => { setStockFilter(filter); setSelectedProducts([]); }}
                    className={`px-4 py-2 rounded-md font-medium text-sm transition-colors whitespace-nowrap cursor-pointer ${stockFilter === filter
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                      }`}
                  >
                    {filter === 'all' && 'All'}
                    {filter === 'low' && 'Low Stock'}
                    {filter === 'out' && 'Out (0)'}
                    {filter === 'good' && 'In Stock'}
                    {filter === 'untracked' && 'Not Tracked'}
                  </button>
                ))}
              </div>

              <button
                onClick={handleExportCSV}
                disabled={filteredProducts.length === 0}
                className="border-2 border-gray-300 hover:border-gray-400 text-gray-700 px-4 py-3 rounded-lg font-semibold transition-colors flex items-center space-x-2 whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <i className="ri-download-line"></i>
                <span>Export</span>
              </button>
            </div>
          </div>

          {selectedProducts.length > 0 && (
            <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-blue-800 font-medium">
                {selectedProducts.length} product{selectedProducts.length > 1 ? 's' : ''} selected
              </p>
              <div className="flex items-center space-x-3">
                <button
                  onClick={handleBulkRestock}
                  disabled={restocking}
                  className="bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-lg font-semibold transition-colors whitespace-nowrap cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {restocking ? 'Restocking…' : 'Bulk Restock'}
                </button>
                <button
                  onClick={() => setSelectedProducts([])}
                  className="text-gray-600 hover:text-gray-900 font-medium whitespace-nowrap cursor-pointer"
                >
                  Clear Selection
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left">
                    <input
                      type="checkbox"
                      aria-label="Select all products shown"
                      checked={selectedProducts.length === filteredProducts.length && filteredProducts.length > 0}
                      onChange={toggleAllProducts}
                      className="w-5 h-5 text-blue-700 rounded cursor-pointer"
                    />
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Product</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">SKU</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Category</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Stock</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Retail Value</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr><td colSpan={8} className="p-10 text-center text-gray-500">Loading inventory...</td></tr>
                ) : loadError ? (
                  <tr>
                    <td colSpan={8} className="p-10 text-center text-red-600">
                      <p className="mb-3">{loadError}</p>
                      <button onClick={fetchInventory} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50">
                        Try again
                      </button>
                    </td>
                  </tr>
                ) : filteredProducts.length === 0 ? (
                  <tr><td colSpan={8} className="p-10 text-center text-gray-500">{products.length === 0 ? 'No products yet.' : 'No products match this search or filter.'}</td></tr>
                ) : (
                  filteredProducts.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          aria-label={`Select ${product.name}`}
                          checked={selectedProducts.includes(product.id)}
                          onChange={() => toggleProductSelection(product.id)}
                          className="w-5 h-5 text-blue-700 rounded cursor-pointer"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-semibold text-gray-900">{product.name}</p>
                          <p className="text-sm text-gray-500">
                            {product.hasVariants ? `${product.variantCount} option${product.variantCount === 1 ? '' : 's'}` : null}
                            {product.hasVariants && isOwner ? ' · ' : null}
                            {isOwner ? (product.cost != null ? `Cost: GH₵${money(product.cost)}` : 'Cost not set') : null}
                            {product.productStatus && product.productStatus !== 'active' ? ` · ${product.productStatus === 'draft' ? 'Draft' : 'Archived'}` : null}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-700">{product.sku}</td>
                      <td className="px-6 py-4 text-gray-700">{product.category}</td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-gray-900">{product.status === 'untracked' ? '—' : product.currentStock}</span>
                        {product.sellsWhenOut && product.status !== 'untracked' && (
                          <p className="text-xs text-gray-500">Sells when out</p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-gray-900">
                          {product.status === 'untracked' ? '—' : `GH₵${money(Math.max(0, product.currentStock) * product.price)}`}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {product.status === 'good' && (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700 whitespace-nowrap">
                            <i className="ri-checkbox-circle-fill mr-1"></i>
                            In Stock
                          </span>
                        )}
                        {product.status === 'low' && (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-amber-100 text-amber-700 whitespace-nowrap">
                            <i className="ri-alert-fill mr-1"></i>
                            Low Stock
                          </span>
                        )}
                        {product.status === 'out' && (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-700 whitespace-nowrap">
                            <i className="ri-close-circle-fill mr-1"></i>
                            Out of Stock
                          </span>
                        )}
                        {product.status === 'untracked' && (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-700 whitespace-nowrap">
                            Not tracked
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <Link
                            href={`/admin/products/${product.id}`}
                            className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-blue-700 transition-colors cursor-pointer"
                            title="Edit"
                            aria-label={`Edit ${product.name}`}
                          >
                            <i className="ri-edit-line text-lg"></i>
                          </Link>
                          {product.slug && (
                            <Link
                              href={`/product/${product.slug}`}
                              target="_blank"
                              className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-blue-700 transition-colors cursor-pointer"
                              title="View in store"
                              aria-label={`View ${product.name} in the store`}
                            >
                              <i className="ri-eye-line text-lg"></i>
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
