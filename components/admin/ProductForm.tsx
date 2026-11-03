'use client';
import { money } from '@/lib/format-money';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { adminFetch } from '@/lib/admin-fetch';
import { recordStaffAction } from '@/lib/staff-audit';

const ALLOWED_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'];
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_IMAGES = 10;

/** Returns an error message when the file can't be uploaded, or null when it is fine. */
function validateImageFile(file: File): string | null {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!ALLOWED_IMAGE_EXTENSIONS.includes(ext) || (file.type && !ALLOWED_IMAGE_TYPES.includes(file.type))) {
        return 'Please choose a JPG, PNG, WebP, GIF or AVIF image.';
    }
    if (file.size > MAX_IMAGE_BYTES) {
        return `This image is ${(file.size / 1024 / 1024).toFixed(1)} MB. The maximum is 10 MB.`;
    }
    return null;
}

function randomId() {
    return typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

interface ProductFormProps {
    initialData?: any;
    isEditMode?: boolean;
}

export default function ProductForm({ initialData, isEditMode = false }: ProductFormProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [categories, setCategories] = useState<any[]>([]);

    const [productName, setProductName] = useState(initialData?.name || '');
    const [categoryId, setCategoryId] = useState(initialData?.category_id || '');
    const [price, setPrice] = useState(initialData?.price || '');
    const [comparePrice, setComparePrice] = useState(initialData?.compare_at_price || '');
    // Set when this product is in a live sale, so the price fields can explain themselves.
    const [liveSale, setLiveSale] = useState<{ id: string; name: string; percent_off: number; original_price: number } | null>(null);

    useEffect(() => {
        if (!initialData?.id) return;
        adminFetch<{ sale: typeof liveSale }>(`/api/admin/discounts?product=${initialData.id}`)
            .then((d) => setLiveSale(d.sale))
            .catch(() => setLiveSale(null));
    }, [initialData?.id]);
    const [sku, setSku] = useState(initialData?.sku || '');
    const [stock, setStock] = useState(initialData?.quantity || '');
    const [moq, setMoq] = useState(initialData?.moq || '1');
    const [lowStockThreshold, setLowStockThreshold] = useState(initialData?.metadata?.low_stock_threshold || '5');
    const [description, setDescription] = useState(initialData?.description || '');
    const [status, setStatus] = useState(String(initialData?.status || 'active').toLowerCase());
    const [featured, setFeatured] = useState(initialData?.featured || false);
    const [preorderShipping, setPreorderShipping] = useState(initialData?.metadata?.preorder_shipping || '');
    const [activeTab, setActiveTab] = useState('general');

    // Auto-generate SKU function
    const generateSku = () => {
        const prefix = 'HOE'; // House of Elle
        const timestamp = Date.now().toString(36).toUpperCase().slice(-4);
        const random = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `${prefix}-${timestamp}-${random}`;
    };

    // --- Variant System ---
    // Preset scent / colour options (swatch colours are only a visual hint)
    const colorPresets = [
        { name: 'Vanilla', hex: '#F3E5AB' },
        { name: 'Rose', hex: '#E8A0B4' },
        { name: 'Oud', hex: '#5C3A21' },
        { name: 'Amber', hex: '#FFBF00' },
        { name: 'Sandalwood', hex: '#C19A6B' },
        { name: 'Jasmine', hex: '#F8F4E3' },
        { name: 'Lavender', hex: '#B57EDC' },
        { name: 'Citrus', hex: '#F7B32B' },
        { name: 'Coconut', hex: '#FFFDF5' },
        { name: 'Ocean', hex: '#4A90B8' },
        { name: 'Musk', hex: '#D8C3A5' },
        { name: 'Black', hex: '#000000' },
        { name: 'White', hex: '#FFFFFF' },
        { name: 'Gold', hex: '#D4AF37' },
    ];
    const sizePresets = ['10ml', '30ml', '50ml', '100ml', '150ml', '250ml', 'Gift Set', 'Wholesale Box'];

    // Parse existing variants to extract unique colors and sizes.
    // Archived variants (kept only because past orders reference them) are hidden from the editor.
    const allExistingVariants = (initialData?.product_variants || []).map((v: any) => ({
        ...v,
        stock: v.stock ?? v.quantity ?? 0,
        color: v.color ?? v.option2 ?? '',
        size: v.option1 ?? ''
    }));
    const existingVariants = allExistingVariants.filter((v: any) => !v.metadata?.archived);
    const archivedVariants = allExistingVariants.filter((v: any) => v.metadata?.archived);

    const [selectedColors, setSelectedColors] = useState<{ name: string; hex: string }[]>(() => {
        const colors = new Map<string, string>();
        existingVariants.forEach((v: any) => {
            if (v.color) {
                const preset = colorPresets.find(c => c.name.toLowerCase() === v.color.toLowerCase());
                colors.set(v.color, preset?.hex || '#888888');
            }
        });
        return Array.from(colors.entries()).map(([name, hex]) => ({ name, hex }));
    });

    const [selectedSizes, setSelectedSizes] = useState<string[]>(() => {
        const sizes = new Set<string>();
        existingVariants.forEach((v: any) => {
            if (v.size) sizes.add(v.size);
        });
        return Array.from(sizes);
    });

    const [customColorName, setCustomColorName] = useState('');
    const [customColorHex, setCustomColorHex] = useState('#888888');
    const [customSize, setCustomSize] = useState('');

    // Build variants from colors × sizes (or just sizes, or just colors)
    const buildVariantKey = (color: string, size: string) => `${color}|||${size}`;

    // Store variant data (price, stock) in a map keyed by "color|||size"
    const [variantData, setVariantData] = useState<Record<string, { price: string; stock: string; sku: string; id?: string }>>(() => {
        const data: Record<string, { price: string; stock: string; sku: string; id?: string }> = {};
        existingVariants.forEach((v: any) => {
            const key = buildVariantKey(v.color || '', v.size || '');
            data[key] = {
                price: v.price?.toString() || '',
                stock: v.stock?.toString() || '0',
                sku: v.sku || '',
                id: v.id
            };
        });
        return data;
    });

    // Computed: all variant combinations
    const variantCombinations = (() => {
        const combos: { color: string; colorHex: string; size: string; key: string }[] = [];
        const colors = selectedColors.length > 0 ? selectedColors : [{ name: '', hex: '' }];
        const sizes = selectedSizes.length > 0 ? selectedSizes : [''];

        for (const color of colors) {
            for (const size of sizes) {
                if (!color.name && !size) continue; // skip if both empty
                const key = buildVariantKey(color.name, size);
                combos.push({ color: color.name, colorHex: color.hex, size, key });
            }
        }
        return combos;
    })();

    // Build the flat variants array for saving (used by handleSubmit)
    const variants = variantCombinations.map(combo => {
        const d = variantData[combo.key] || { price: price, stock: '0', sku: '' };
        return {
            key: combo.key,
            id: d.id as string | undefined,
            name: combo.size,
            color: combo.color,
            sku: d.sku,
            price: d.price || price,
            stock: d.stock || '0'
        };
    });

    const updateVariantField = (key: string, field: string, value: string) => {
        setVariantData(prev => ({
            ...prev,
            [key]: { ...prev[key] || { price: price, stock: '0', sku: '' }, [field]: value }
        }));
    };

    // Bulk set price/stock for all variants
    const bulkSetField = (field: 'price' | 'stock', value: string) => {
        setVariantData(prev => {
            const updated = { ...prev };
            variantCombinations.forEach(combo => {
                updated[combo.key] = { ...updated[combo.key] || { price: price, stock: '0', sku: '' }, [field]: value };
            });
            return updated;
        });
    };

    const toggleColor = (color: { name: string; hex: string }) => {
        setSelectedColors(prev => {
            const exists = prev.find(c => c.name === color.name);
            if (exists) return prev.filter(c => c.name !== color.name);
            return [...prev, color];
        });
    };

    const toggleSize = (size: string) => {
        setSelectedSizes(prev => {
            if (prev.includes(size)) return prev.filter(s => s !== size);
            return [...prev, size];
        });
    };

    const addCustomColor = () => {
        if (!customColorName.trim()) return;
        const exists = selectedColors.find(c => c.name.toLowerCase() === customColorName.trim().toLowerCase());
        if (!exists) {
            setSelectedColors(prev => [...prev, { name: customColorName.trim(), hex: customColorHex }]);
        }
        setCustomColorName('');
        setCustomColorHex('#888888');
    };

    const addCustomSize = () => {
        if (!customSize.trim()) return;
        if (!selectedSizes.includes(customSize.trim())) {
            setSelectedSizes(prev => [...prev, customSize.trim()]);
        }
        setCustomSize('');
    };

    // Images
    const [images, setImages] = useState<any[]>(initialData?.product_images || []);
    const [uploading, setUploading] = useState(false);

    // SEO
    const [seoTitle, setSeoTitle] = useState(initialData?.seo_title || '');
    const [metaDescription, setMetaDescription] = useState(initialData?.seo_description || '');
    const [urlSlug, setUrlSlug] = useState(initialData?.slug || '');
    const [keywords, setKeywords] = useState(initialData?.tags?.join(', ') || '');

    const tabs = [
        { id: 'general', label: 'General', icon: 'ri-information-line' },
        { id: 'pricing', label: 'Pricing & Inventory', icon: 'ri-price-tag-3-line' },
        { id: 'variants', label: 'Variants', icon: 'ri-layout-grid-line' },
        { id: 'images', label: 'Images', icon: 'ri-image-line' },
        { id: 'seo', label: 'SEO', icon: 'ri-search-line' }
    ];

    // Fetch categories once. A product's current category stays listed even if it was made inactive.
    useEffect(() => {
        async function fetchCategories() {
            const { data } = await supabase.from('categories').select('id, name, status').order('name');
            if (data) {
                setCategories(data.filter((c: any) => c.status === 'active' || c.id === initialData?.category_id));
            }
        }
        fetchCategories();
    }, [initialData?.category_id]);

    // Auto-generate slug from name if not manually edited
    useEffect(() => {
        if (!isEditMode && productName && !urlSlug) {
            setUrlSlug(productName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''));
        }
    }, [productName, isEditMode, urlSlug]);

    // Auto-generate SKU for new products
    useEffect(() => {
        if (!isEditMode && !sku) {
            setSku(generateSku());
        }
    }, [isEditMode]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const input = e.target;
        try {
            if (!input.files || input.files.length === 0) return;
            if (images.length >= MAX_IMAGES) {
                alert(`A product can have up to ${MAX_IMAGES} images. Remove one first.`);
                return;
            }

            const file = input.files[0];
            const invalid = validateImageFile(file);
            if (invalid) {
                alert(invalid);
                return;
            }

            setUploading(true);
            const fileExt = (file.name.split('.').pop() || '').toLowerCase();
            const filePath = `${randomId()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('products')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('products')
                .getPublicUrl(filePath);

            setImages([...images, { url: publicUrl, position: images.length }]);

        } catch (error: any) {
            alert('Error uploading image: ' + (error?.message || 'Please try again.'));
        } finally {
            setUploading(false);
            input.value = '';
        }
    };

    const handleRemoveImage = (indexToRemove: number) => {
        setImages(images.filter((_, idx) => idx !== indexToRemove));
    };

    /** Moves an image to the front, making it the one shown in the shop and on the POS. */
    const handleMakePrimary = (index: number) => {
        if (index === 0) return;
        setImages((prev) => [prev[index], ...prev.filter((_, idx) => idx !== index)]);
    };

    /** Returns what must be fixed before saving, or null when the form is ready. */
    const validate = (): string | null => {
        if (!productName.trim()) return 'Please enter a product name.';
        // Drafts may be saved before they are priced; anything on sale needs a real price.
        const selling = status === 'active';
        const priceValue = parseFloat(price);
        if (price !== '' && price != null && !(priceValue >= 0)) return 'The price must be a number.';
        if (selling && !(priceValue > 0)) return 'Please enter a price above GH₵ 0, or save the product as a Draft.';
        if (comparePrice !== '' && comparePrice != null && !(parseFloat(comparePrice) >= 0)) return 'The compare-at price must be a number.';
        if (variants.length === 0 && stock !== '' && parseInt(stock) < 0) return 'Stock cannot be below 0.';
        for (const v of variants) {
            const label = [v.color, v.name].filter(Boolean).join(' / ');
            if (selling && !(parseFloat(v.price) > 0)) return `Please enter a price above GH₵ 0 for ${label}.`;
            if (parseInt(v.stock) < 0) return `Stock for ${label} cannot be below 0.`;
        }
        if (!(parseInt(moq) >= 1)) return 'The minimum order quantity must be at least 1.';
        return null;
    };

    // Variant helpers removed — variants are now auto-generated from selectedColors × selectedSizes

    const handleSubmit = async () => {
        const invalid = validate();
        if (invalid) {
            alert(invalid);
            return;
        }
        try {
            setLoading(true);

            // If product has variants, auto-sync main stock = sum of variant stocks
            const hasVariants = variants.length > 0;
            const variantStockTotal = hasVariants
                ? variants.reduce((sum, v) => sum + (parseInt(v.stock) || 0), 0)
                : parseInt(stock) || 0;

            const productData = {
                name: productName.trim(),
                slug: urlSlug || productName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''),
                description,
                category_id: categoryId || null,
                price: parseFloat(price) || 0,
                compare_at_price: comparePrice ? parseFloat(comparePrice) : null,
                sku: sku || generateSku(), // Auto-generate if empty
                quantity: hasVariants ? variantStockTotal : (parseInt(stock) || 0),
                moq: parseInt(moq) || 1,
                status: status.toLowerCase(),
                featured,
                seo_title: seoTitle,
                seo_description: metaDescription,
                tags: (keywords as string).split(',').map((k: string) => k.trim()).filter(Boolean),
                metadata: {
                    ...(initialData?.metadata || {}),
                    low_stock_threshold: parseInt(lowStockThreshold) || 5,
                    preorder_shipping: preorderShipping.trim() || null
                }
            };

            let productId = initialData?.id;
            let error;

            if (isEditMode && productId) {
                // Update existing
                const { error: updateError } = await supabase
                    .from('products')
                    .update(productData)
                    .eq('id', productId);
                error = updateError;
            } else {
                // Create new
                const { data: newProduct, error: insertError } = await supabase
                    .from('products')
                    .insert([productData])
                    .select()
                    .single();

                if (newProduct) productId = newProduct.id;
                error = insertError;
            }

            if (error) throw error;

            if (!productId) throw new Error('The product was not saved. Please try again.');

            recordStaffAction({
                action: isEditMode ? 'update' : 'create',
                entityType: 'products',
                entityId: productId,
                details: { label: productData.name, price: productData.price, quantity: productData.quantity },
            });

            const problems: string[] = [];

            // 1. Images: update kept rows, insert new ones, and only then remove the ones taken out.
            const originalImages: any[] = isEditMode ? (initialData?.product_images || []) : [];
            const keptImageIds = new Set(images.filter((img) => img.id).map((img) => img.id));
            let imagesSaved = true;
            for (let idx = 0; idx < images.length; idx++) {
                const img = images[idx];
                if (!img.id) continue;
                const { error: imgUpdateError } = await supabase
                    .from('product_images')
                    .update({ position: idx, alt_text: productName })
                    .eq('id', img.id);
                if (imgUpdateError) {
                    imagesSaved = false;
                    problems.push(`Image ${idx + 1}: ${imgUpdateError.message}`);
                }
            }
            const newImages = images
                .map((img, idx) => ({ img, idx }))
                .filter(({ img }) => !img.id)
                .map(({ img, idx }) => ({
                    product_id: productId,
                    url: img.url,
                    position: idx,
                    alt_text: productName
                }));
            if (newImages.length > 0) {
                const { data: insertedImages, error: imgInsertError } = await supabase
                    .from('product_images')
                    .insert(newImages)
                    .select('id, url, position');
                if (imgInsertError) {
                    imagesSaved = false;
                    problems.push(`New images: ${imgInsertError.message}`);
                } else if (insertedImages) {
                    // Remember the new row ids so a retry updates them instead of inserting duplicates.
                    setImages(prev => prev.map((img, idx) => {
                        if (img.id) return img;
                        const row = (insertedImages as any[]).find(r => r.position === idx && r.url === img.url);
                        return row ? { ...img, id: row.id } : img;
                    }));
                }
            }
            const removedImageIds = originalImages
                .filter((img: any) => img.id && !keptImageIds.has(img.id))
                .map((img: any) => img.id);
            if (imagesSaved && removedImageIds.length > 0) {
                const { error: imgDeleteError } = await supabase.from('product_images').delete().in('id', removedImageIds);
                if (imgDeleteError) problems.push(`Removing images: ${imgDeleteError.message}`);
            }

            // 2. Variants: update existing rows in place, insert new ones, delete (or archive) removed ones.
            const variantRow = (v: (typeof variants)[number], existingMetadata?: any) => {
                const colorHex = selectedColors.find(c => c.name === v.color)?.hex || null;
                const metadata: Record<string, any> = { ...(existingMetadata || {}) };
                delete metadata.archived;
                if (colorHex) metadata.color_hex = colorHex;
                else delete metadata.color_hex;
                return {
                    product_id: productId,
                    name: v.name || v.color || 'Default',
                    sku: v.sku?.trim() || null,
                    price: parseFloat(v.price) || 0,
                    quantity: parseInt(v.stock) || 0,
                    option1: v.name || null,
                    option2: v.color?.trim() || null,
                    metadata
                };
            };
            const variantLabel = (v: { name?: string; color?: string }) =>
                [v.color, v.name].filter(Boolean).join(' / ') || 'Default';

            const keptVariantIds = new Set<string>();
            for (const v of variants) {
                // Re-use a previously archived variant with the same scent/size instead of creating a duplicate.
                const archived = !v.id
                    ? archivedVariants.find((a: any) => buildVariantKey(a.color || '', a.size || '') === v.key)
                    : undefined;
                const targetId = v.id || archived?.id;
                if (targetId) {
                    keptVariantIds.add(targetId);
                    const existing = allExistingVariants.find((ev: any) => ev.id === targetId);
                    const { error: varUpdateError } = await supabase
                        .from('product_variants')
                        .update(variantRow(v, existing?.metadata))
                        .eq('id', targetId);
                    if (varUpdateError) problems.push(`Variant ${variantLabel(v)}: ${varUpdateError.message}`);
                } else {
                    const { data: inserted, error: varInsertError } = await supabase
                        .from('product_variants')
                        .insert([variantRow(v)])
                        .select('id')
                        .single();
                    if (varInsertError) problems.push(`New variant ${variantLabel(v)}: ${varInsertError.message}`);
                    else if (inserted?.id) {
                        keptVariantIds.add(inserted.id);
                        setVariantData(prev => ({ ...prev, [v.key]: { ...(prev[v.key] || { price: v.price, stock: v.stock, sku: v.sku }), id: inserted.id } }));
                    }
                }
            }

            const removedVariants = existingVariants.filter((v: any) => v.id && !keptVariantIds.has(v.id));
            for (const v of removedVariants) {
                const { error: varDeleteError } = await supabase.from('product_variants').delete().eq('id', v.id);
                if (!varDeleteError) continue;
                // Most likely referenced by an order or a cart: keep the row but take it off sale.
                const { error: archiveError } = await supabase
                    .from('product_variants')
                    .update({ quantity: 0, metadata: { ...(v.metadata || {}), archived: true } })
                    .eq('id', v.id);
                if (archiveError) problems.push(`Removing variant ${variantLabel(v)}: ${archiveError.message}`);
            }

            if (problems.length > 0) {
                if (!isEditMode) {
                    // The product row exists now; switch to editing it so a retry doesn't create a duplicate.
                    alert(`The product was created, but some parts were not saved:\n\n- ${problems.join('\n- ')}\n\nOpen the product again to fix them.`);
                    router.push(`/admin/products/${productId}`);
                } else {
                    alert(`Some changes were not saved:\n\n- ${problems.join('\n- ')}\n\nReload the page to see what was saved, then try again.`);
                }
                return;
            }

            alert(isEditMode ? 'Product updated successfully!' : 'Product created successfully!');
            router.push('/admin/products');

        } catch (err: any) {
            console.error('Error saving product:', err);
            const message = String(err?.message || '');
            alert(
                /duplicate|unique/i.test(message) && /slug/i.test(message)
                    ? 'Another product already uses this URL slug. Change it on the SEO tab and save again.'
                    : `Could not save the product: ${message || 'unknown error'}`
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center space-x-4">
                    <Link
                        href="/admin/products"
                        aria-label="Back to products"
                        className="w-10 h-10 shrink-0 flex items-center justify-center border-2 border-gray-300 rounded-lg hover:border-gray-400 transition-colors"
                    >
                        <i className="ri-arrow-left-line text-xl text-gray-700"></i>
                    </Link>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                            {isEditMode ? 'Edit Product' : 'Add New Product'}
                        </h1>
                        <p className="text-gray-600 mt-1">
                            {isEditMode ? 'Update product information and settings' : 'Create a new product for your catalog'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {isEditMode && (
                        <Link
                            href={`/product/${initialData?.slug || initialData?.id}`}
                            target="_blank"
                            className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:border-gray-400 transition-colors font-semibold whitespace-nowrap cursor-pointer flex items-center"
                        >
                            <i className="ri-eye-line mr-2"></i>
                            Preview
                        </Link>
                    )}
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className={`px-6 py-3 bg-blue-700 hover:bg-blue-800 text-white rounded-lg font-semibold transition-colors whitespace-nowrap cursor-pointer flex items-center ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                    >
                        {loading ? (
                            <>
                                <i className="ri-loader-4-line animate-spin mr-2"></i>
                                Saving...
                            </>
                        ) : (
                            <>
                                <i className="ri-save-line mr-2"></i>
                                {isEditMode ? 'Save Changes' : 'Create Product'}
                            </>
                        )}
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="border-b border-gray-200 overflow-x-auto">
                    <div className="flex">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                aria-pressed={activeTab === tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center space-x-2 px-4 sm:px-6 py-4 font-semibold whitespace-nowrap transition-colors border-b-2 cursor-pointer ${activeTab === tab.id
                                    ? 'border-blue-700 text-blue-700 bg-blue-50'
                                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                    }`}
                            >
                                <i className={`${tab.icon} text-xl`}></i>
                                <span>{tab.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="p-4 sm:p-8">
                    {activeTab === 'general' && (
                        <div className="space-y-6 max-w-3xl">
                            <div>
                                <label htmlFor="pf-name" className="block text-sm font-semibold text-gray-900 mb-2">
                                    Product Name *
                                </label>
                                <input
                                    id="pf-name"
                                    type="text"
                                    value={productName}
                                    onChange={(e) => setProductName(e.target.value)}
                                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="Enter product name"
                                />
                            </div>

                            <div>
                                <label htmlFor="pf-description" className="block text-sm font-semibold text-gray-900 mb-2">
                                    Description
                                </label>
                                <textarea
                                    id="pf-description"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    rows={6}
                                    maxLength={500}
                                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                                    placeholder="Describe your product..."
                                />
                                <p className="text-sm text-gray-500 mt-2">{description.length}/500 characters</p>
                            </div>

                            <div className="grid md:grid-cols-2 gap-6">
                                <div>
                                    <label htmlFor="pf-category" className="block text-sm font-semibold text-gray-900 mb-2">
                                        Category
                                    </label>
                                    <select
                                        id="pf-category"
                                        value={categoryId}
                                        onChange={(e) => setCategoryId(e.target.value)}
                                        className="w-full px-4 py-3 pr-8 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
                                    >
                                        <option value="">{categories.length === 0 ? 'No categories yet' : 'No category'}</option>
                                        {categories.map(cat => (
                                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label htmlFor="pf-status" className="block text-sm font-semibold text-gray-900 mb-2">
                                        Status
                                    </label>
                                    <select
                                        id="pf-status"
                                        value={status}
                                        onChange={(e) => setStatus(e.target.value)}
                                        className="w-full px-4 py-3 pr-8 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
                                    >
                                        <option value="active">Active</option>
                                        <option value="draft">Draft</option>
                                        <option value="archived">Archived</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex items-center space-x-3">
                                <input
                                    id="pf-featured"
                                    type="checkbox"
                                    checked={featured}
                                    onChange={(e) => setFeatured(e.target.checked)}
                                    className="w-5 h-5 text-blue-700 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                                />
                                <label htmlFor="pf-featured" className="text-gray-900 font-medium cursor-pointer">
                                    Feature this product on homepage
                                </label>
                            </div>

                            <div>
                                <label htmlFor="pf-preorder" className="block text-sm font-semibold text-gray-900 mb-2">
                                    Pre-order / Estimated Shipping
                                </label>
                                <input
                                    id="pf-preorder"
                                    type="text"
                                    value={preorderShipping}
                                    onChange={(e) => setPreorderShipping(e.target.value)}
                                    placeholder="e.g., Ships in 14 days, Available March 15"
                                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                                <p className="text-xs text-gray-500 mt-1">Leave empty if product ships immediately. Otherwise, enter estimated shipping time.</p>
                            </div>
                        </div>
                    )}

                    {activeTab === 'pricing' && (
                        <div className="space-y-6 max-w-3xl">
                            {liveSale && (
                                <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                                    <i className="ri-price-tag-3-line text-lg leading-none mt-0.5" aria-hidden="true"></i>
                                    <p>
                                        This product is in the <span className="font-semibold">{liveSale.name}</span> sale at {liveSale.percent_off}% off, so the price below is the sale price.
                                        Its regular price, GH₵ {money(liveSale.original_price)}, comes back when the sale ends. If you change the price here, your new price is kept instead.{' '}
                                        <Link href={`/admin/discounts/${liveSale.id}`} className="font-semibold underline">Manage the sale</Link>
                                    </p>
                                </div>
                            )}
                            <div className="grid md:grid-cols-2 gap-6">
                                <div>
                                    <label htmlFor="pf-price" className="block text-sm font-semibold text-gray-900 mb-2">
                                        Price (GH₵) *
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 font-semibold">GH₵</span>
                                        <input
                                            id="pf-price"
                                            type="number"
                                            min="0"
                                            inputMode="decimal"
                                            value={price}
                                            onChange={(e) => setPrice(e.target.value)}
                                            className="w-full pl-16 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            step="0.01"
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="pf-compare" className="block text-sm font-semibold text-gray-900 mb-2">
                                        Compare at Price (GH₵)
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 font-semibold">GH₵</span>
                                        <input
                                            id="pf-compare"
                                            type="number"
                                            min="0"
                                            inputMode="decimal"
                                            value={comparePrice}
                                            onChange={(e) => setComparePrice(e.target.value)}
                                            className="w-full pl-16 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            step="0.01"
                                            placeholder="0.00"
                                        />
                                    </div>
                                    <p className="text-sm text-gray-500 mt-2">Optional. Shown crossed out next to the price when it is higher.</p>
                                </div>
                            </div>

                            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                <p className="text-blue-900 font-semibold mb-1">Discount Calculation</p>
                                {price && comparePrice && parseFloat(comparePrice) > parseFloat(price) ? (
                                    <p className="text-blue-800">
                                        Savings: GH₵ {money((parseFloat(comparePrice) - parseFloat(price)))}
                                        <span className="ml-2">
                                            ({(((parseFloat(comparePrice) - parseFloat(price)) / parseFloat(comparePrice)) * 100).toFixed(0)}% off)
                                        </span>
                                    </p>
                                ) : (
                                    <p className="text-blue-800 text-sm">Enter a valid compare price higher than the price to see discount.</p>
                                )}
                            </div>

                            <div className="pt-6 border-t border-gray-200">
                                <h3 className="text-lg font-bold text-gray-900 mb-4">Inventory</h3>

                                <div className="grid md:grid-cols-2 gap-6">
                                    <div>
                                        <label htmlFor="pf-sku" className="block text-sm font-semibold text-gray-900 mb-2">
                                            SKU (Auto-generated)
                                        </label>
                                        <div className="flex gap-2">
                                            <input
                                                id="pf-sku"
                                                type="text"
                                                value={sku}
                                                onChange={(e) => setSku(e.target.value)}
                                                className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono bg-gray-50"
                                                placeholder="Auto-generated"
                                                readOnly
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setSku(generateSku())}
                                                className="px-4 py-3 border-2 border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors cursor-pointer"
                                                title="Generate new SKU"
                                                aria-label="Generate a new SKU"
                                            >
                                                <i className="ri-refresh-line text-lg"></i>
                                            </button>
                                        </div>
                                        <p className="text-sm text-gray-500 mt-1">SKU is auto-generated. Click refresh to generate a new one.</p>
                                    </div>

                                    <div>
                                        <label htmlFor="pf-stock" className="block text-sm font-semibold text-gray-900 mb-2">
                                            Stock Quantity
                                        </label>
                                        {variants.length > 0 ? (
                                            <div>
                                                <input
                                                    id="pf-stock"
                                                    type="number"
                                                    value={variants.reduce((sum: number, v: any) => sum + (parseInt(v.stock) || 0), 0)}
                                                    readOnly
                                                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                                                />
                                                <p className="text-sm text-amber-700 mt-1 flex items-center">
                                                    <i className="ri-information-line mr-1"></i>
                                                    Stock is managed per variant. Edit stock in the Variants tab.
                                                </p>
                                            </div>
                                        ) : (
                                            <input
                                                id="pf-stock"
                                                type="number"
                                                min="0"
                                                value={stock}
                                                onChange={(e) => setStock(e.target.value)}
                                                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                placeholder="0"
                                            />
                                        )}
                                    </div>
                                </div>

                                <div className="grid md:grid-cols-2 gap-6 mt-6">
                                    <div>
                                        <label htmlFor="pf-moq" className="block text-sm font-semibold text-gray-900 mb-2">
                                            Minimum Order Quantity (MOQ)
                                        </label>
                                        <input
                                            id="pf-moq"
                                            type="number"
                                            value={moq}
                                            onChange={(e) => setMoq(e.target.value)}
                                            min="1"
                                            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            placeholder="1"
                                        />
                                        <p className="text-sm text-gray-500 mt-1">Minimum quantity customers must order</p>
                                    </div>

                                    <div>
                                        <label htmlFor="pf-low-stock" className="block text-sm font-semibold text-gray-900 mb-2">
                                            Low Stock Threshold
                                        </label>
                                        <input
                                            id="pf-low-stock"
                                            min="0"
                                            type="number"
                                            value={lowStockThreshold}
                                            onChange={(e) => setLowStockThreshold(e.target.value)}
                                            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                        <p className="text-sm text-gray-500 mt-1">Marked as low stock on the dashboard and inventory at or below this number</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'variants' && (
                        <div className="space-y-8">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">Product Variants</h3>
                                <p className="text-gray-600 mt-1">Select scents / colours and sizes below — variants are generated automatically</p>
                            </div>

                            {/* STEP 1: Colors */}
                            <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                                <h4 className="text-sm font-bold text-gray-900 mb-1 flex items-center">
                                    <i className="ri-palette-line mr-2 text-lg text-blue-700"></i>
                                    Step 1: Select Scents / Colours
                                    {selectedColors.length > 0 && (
                                        <span className="ml-2 bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-0.5 rounded-full">
                                            {selectedColors.length} selected
                                        </span>
                                    )}
                                </h4>
                                <p className="text-xs text-gray-500 mb-4">Click to add/remove. Skip if the product has no scent or colour options.</p>

                                <div className="flex flex-wrap gap-2 mb-4">
                                    {colorPresets.map(color => {
                                        const isSelected = selectedColors.some(c => c.name === color.name);
                                        return (
                                            <button
                                                key={color.name}
                                                type="button"
                                                aria-pressed={isSelected}
                                                onClick={() => toggleColor(color)}
                                                className={`flex items-center space-x-2 px-3 py-2 rounded-lg border-2 transition-all text-sm font-medium ${isSelected
                                                        ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600'
                                                        : 'border-gray-200 hover:border-gray-300 bg-white'
                                                    }`}
                                                title={color.name}
                                            >
                                                <span
                                                    className="w-5 h-5 rounded-full border border-gray-300 flex-shrink-0"
                                                    style={{ backgroundColor: color.hex }}
                                                ></span>
                                                <span className={isSelected ? 'text-blue-800' : 'text-gray-700'}>{color.name}</span>
                                                {isSelected && <i className="ri-check-line text-blue-700"></i>}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Custom color */}
                                <div className="flex items-center gap-2 pt-3 border-t border-gray-200">
                                    <input
                                        type="color"
                                        value={customColorHex}
                                        onChange={(e) => setCustomColorHex(e.target.value)}
                                        className="w-10 h-10 shrink-0 rounded-lg border border-gray-300 cursor-pointer p-0.5"
                                        title="Pick a swatch colour"
                                        aria-label="Swatch colour for the custom scent or colour"
                                    />
                                    <input
                                        type="text"
                                        aria-label="Custom scent or colour name"
                                        value={customColorName}
                                        onChange={(e) => setCustomColorName(e.target.value)}
                                        placeholder="Custom scent / colour"
                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomColor(); } }}
                                    />
                                    <button
                                        type="button"
                                        onClick={addCustomColor}
                                        disabled={!customColorName.trim()}
                                        className="shrink-0 px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                    >
                                        Add Scent / Colour
                                    </button>
                                </div>

                                {/* Selected colors summary */}
                                {selectedColors.length > 0 && (
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        {selectedColors.map(color => (
                                            <span key={color.name} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-sm shadow-sm">
                                                <span className="w-3.5 h-3.5 rounded-full border border-gray-300" style={{ backgroundColor: color.hex }}></span>
                                                {color.name}
                                                <button type="button" onClick={() => toggleColor(color)} aria-label={`Remove ${color.name}`} className="text-gray-400 hover:text-red-500 ml-1">
                                                    <i className="ri-close-line text-sm"></i>
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* STEP 2: Sizes */}
                            <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                                <h4 className="text-sm font-bold text-gray-900 mb-1 flex items-center">
                                    <i className="ri-ruler-line mr-2 text-lg text-blue-700"></i>
                                    Step 2: Select Sizes
                                    {selectedSizes.length > 0 && (
                                        <span className="ml-2 bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-0.5 rounded-full">
                                            {selectedSizes.length} selected
                                        </span>
                                    )}
                                </h4>
                                <p className="text-xs text-gray-500 mb-4">Click sizes to add/remove. Use custom for other volumes or pack sizes.</p>

                                <div className="flex flex-wrap gap-2 mb-4">
                                    {sizePresets.map(size => {
                                        const isSelected = selectedSizes.includes(size);
                                        return (
                                            <button
                                                key={size}
                                                type="button"
                                                aria-pressed={isSelected}
                                                onClick={() => toggleSize(size)}
                                                className={`px-5 py-2.5 rounded-lg border-2 font-semibold text-sm transition-all ${isSelected
                                                        ? 'border-blue-600 bg-blue-50 text-blue-800 ring-1 ring-blue-600'
                                                        : 'border-gray-200 hover:border-gray-300 bg-white text-gray-700'
                                                    }`}
                                            >
                                                {size}
                                                {isSelected && <i className="ri-check-line ml-1.5 text-blue-600"></i>}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Custom size */}
                                <div className="flex items-center gap-2 pt-3 border-t border-gray-200">
                                    <input
                                        type="text"
                                        aria-label="Custom size"
                                        value={customSize}
                                        onChange={(e) => setCustomSize(e.target.value)}
                                        placeholder="Custom size (e.g. 75ml, Travel Size)"
                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomSize(); } }}
                                    />
                                    <button
                                        type="button"
                                        onClick={addCustomSize}
                                        disabled={!customSize.trim()}
                                        className="shrink-0 px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                    >
                                        Add Size
                                    </button>
                                </div>

                                {/* Selected sizes summary */}
                                {selectedSizes.length > 0 && (
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        {selectedSizes.map(size => (
                                            <span key={size} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-sm shadow-sm font-medium">
                                                {size}
                                                <button type="button" onClick={() => toggleSize(size)} aria-label={`Remove ${size}`} className="text-gray-400 hover:text-red-500 ml-1">
                                                    <i className="ri-close-line text-sm"></i>
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* STEP 3: Variant Grid */}
                            {variantCombinations.length > 0 && (
                                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                    <div className="p-4 bg-gray-50 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                        <div>
                                            <h4 className="text-sm font-bold text-gray-900 flex items-center">
                                                <i className="ri-grid-line mr-2 text-lg text-blue-700"></i>
                                                Step 3: Set Price & Stock ({variantCombinations.length} variant{variantCombinations.length > 1 ? 's' : ''})
                                            </h4>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const val = prompt('Set price for ALL variants:', price?.toString() || '0');
                                                    if (val !== null) bulkSetField('price', val);
                                                }}
                                                className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors"
                                            >
                                                Bulk Set Price
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const val = prompt('Set stock for ALL variants:', '0');
                                                    if (val !== null) bulkSetField('stock', val);
                                                }}
                                                className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors"
                                            >
                                                Bulk Set Stock
                                            </button>
                                        </div>
                                    </div>

                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead className="bg-gray-50 border-b border-gray-200">
                                                <tr>
                                                    {selectedColors.length > 0 && (
                                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Scent / Colour</th>
                                                    )}
                                                    {selectedSizes.length > 0 && (
                                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Size</th>
                                                    )}
                                                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Price (GH₵)</th>
                                                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Stock</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {variantCombinations.map((combo) => {
                                                    const d = variantData[combo.key] || { price: price, stock: '0', sku: '' };
                                                    return (
                                                        <tr key={combo.key} className="border-b border-gray-100 hover:bg-gray-50">
                                                            {selectedColors.length > 0 && (
                                                                <td className="py-3 px-4">
                                                                    <div className="flex items-center gap-2">
                                                                        <span
                                                                            className="w-5 h-5 rounded-full border border-gray-300 flex-shrink-0"
                                                                            style={{ backgroundColor: combo.colorHex }}
                                                                        ></span>
                                                                        <span className="text-sm font-medium text-gray-900">{combo.color}</span>
                                                                    </div>
                                                                </td>
                                                            )}
                                                            {selectedSizes.length > 0 && (
                                                                <td className="py-3 px-4">
                                                                    <span className="text-sm font-semibold text-gray-900 bg-gray-100 px-2.5 py-1 rounded">
                                                                        {combo.size}
                                                                    </span>
                                                                </td>
                                                            )}
                                                            <td className="py-3 px-4">
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    aria-label={`Price for ${[combo.color, combo.size].filter(Boolean).join(' / ')}`}
                                                                    value={d.price}
                                                                    onChange={(e) => updateVariantField(combo.key, 'price', e.target.value)}
                                                                    className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                                                    step="0.01"
                                                                    placeholder={price?.toString() || '0'}
                                                                />
                                                            </td>
                                                            <td className="py-3 px-4">
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    aria-label={`Stock for ${[combo.color, combo.size].filter(Boolean).join(' / ')}`}
                                                                    value={d.stock}
                                                                    onChange={(e) => updateVariantField(combo.key, 'stock', e.target.value)}
                                                                    className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                                                    placeholder="0"
                                                                />
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="p-3 bg-blue-50 border-t border-blue-100">
                                        <p className="text-xs text-blue-800 flex items-center">
                                            <i className="ri-information-line mr-1.5"></i>
                                            Total stock across all variants: <strong className="ml-1">{variants.reduce((sum, v) => sum + (parseInt(v.stock) || 0), 0)}</strong>
                                        </p>
                                    </div>
                                </div>
                            )}

                            {variantCombinations.length === 0 && (
                                <div className="p-8 text-center text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                                    <i className="ri-palette-line text-4xl text-gray-300 mb-2 block"></i>
                                    <p className="font-medium">No variants configured</p>
                                    <p className="text-sm mt-1">Select scents / colours and/or sizes above to create variant combinations.</p>
                                    <p className="text-xs mt-2 text-gray-400">You can add just scents / colours, just sizes, or both for a full grid.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'images' && (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 mb-1">Product Images</h3>
                                <p className="text-gray-600">Add up to {MAX_IMAGES} images. The first image is the primary one shown in the shop. Images are saved when you save the product.</p>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {images.map((img: any, index: number) => (
                                    <div key={img.id || img.url || index} className="relative group">
                                        <div className="aspect-square bg-gray-100 rounded-xl overflow-hidden border-2 border-gray-200">
                                            <img src={img.url} alt={`Product ${index + 1}`} className="w-full h-full object-cover" />
                                        </div>
                                        {index === 0 && (
                                            <span className="absolute top-2 left-2 bg-blue-700 text-white px-2 py-1 rounded text-xs font-semibold whitespace-nowrap">
                                                Primary
                                            </span>
                                        )}
                                        <div className="absolute inset-x-0 bottom-0 sm:inset-0 bg-black/50 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2 rounded-b-xl sm:rounded-xl">
                                            <a href={img.url} target="_blank" rel="noreferrer" aria-label={`Open image ${index + 1}`} className="w-9 h-9 flex items-center justify-center bg-white text-gray-900 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
                                                <i className="ri-eye-line"></i>
                                            </a>
                                            {index > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleMakePrimary(index)}
                                                    aria-label={`Make image ${index + 1} the primary image`}
                                                    title="Make primary"
                                                    className="w-9 h-9 flex items-center justify-center bg-white text-blue-700 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer"
                                                >
                                                    <i className="ri-star-line"></i>
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveImage(index)}
                                                aria-label={`Remove image ${index + 1}`}
                                                className="w-9 h-9 flex items-center justify-center bg-white text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                                            >
                                                <i className="ri-delete-bin-line"></i>
                                            </button>
                                        </div>
                                    </div>
                                ))}

                                {images.length < MAX_IMAGES && <label className={`aspect-square border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-700 hover:bg-blue-50 transition-colors flex flex-col items-center justify-center space-y-2 text-gray-600 hover:text-blue-700 cursor-pointer ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                    {uploading ? (
                                        <i className="ri-loader-4-line animate-spin text-3xl"></i>
                                    ) : (
                                        <i className="ri-upload-2-line text-3xl"></i>
                                    )}
                                    <span className="text-sm font-semibold">{uploading ? 'Uploading...' : 'Upload Image'}</span>
                                    <input
                                        type="file"
                                        accept=".jpg,.jpeg,.png,.webp,.gif,.avif,image/jpeg,image/png,image/webp,image/gif,image/avif"
                                        className="hidden"
                                        onChange={handleImageUpload}
                                        disabled={uploading}
                                    />
                                </label>}
                            </div>

                            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                                <p className="text-sm text-gray-700">
                                    <strong>Image Guidelines:</strong> Use high-quality images (min 1000x1000px), white or neutral backgrounds work best.
                                    Supported formats: JPG, PNG, WebP, GIF, AVIF (max 10MB each).
                                </p>
                            </div>
                        </div>
                    )}

                    {activeTab === 'seo' && (
                        <div className="space-y-6 max-w-3xl">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 mb-1">Search Engine Optimization</h3>
                                <p className="text-gray-600">Optimize how this product appears in search results</p>
                            </div>

                            <div>
                                <label htmlFor="pf-seo-title" className="block text-sm font-semibold text-gray-900 mb-2">
                                    Page Title
                                </label>
                                <input
                                    id="pf-seo-title"
                                    type="text"
                                    value={seoTitle}
                                    onChange={(e) => setSeoTitle(e.target.value)}
                                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder={productName ? `${productName} | House of Elle` : 'Leave empty to use the product name'}
                                />
                                <p className="text-sm text-gray-500 mt-2">{seoTitle.length}/60 characters recommended</p>
                            </div>

                            <div>
                                <label htmlFor="pf-seo-description" className="block text-sm font-semibold text-gray-900 mb-2">
                                    Meta Description
                                </label>
                                <textarea
                                    id="pf-seo-description"
                                    rows={3}
                                    maxLength={500}
                                    value={metaDescription}
                                    onChange={(e) => setMetaDescription(e.target.value)}
                                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                                    placeholder="One or two sentences shown under the product in Google results"
                                />
                                <p className="text-sm text-gray-500 mt-2">{metaDescription.length}/160 characters recommended</p>
                            </div>

                            <div>
                                <label htmlFor="pf-slug" className="block text-sm font-semibold text-gray-900 mb-2">
                                    URL Slug
                                </label>
                                <div className="flex items-center">
                                    <span className="text-gray-600 bg-gray-100 px-3 sm:px-4 py-3 border-2 border-r-0 border-gray-300 rounded-l-lg whitespace-nowrap">
                                        /product/
                                    </span>
                                    <input
                                        id="pf-slug"
                                        type="text"
                                        value={urlSlug}
                                        onChange={(e) => setUrlSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-'))}
                                        className="flex-1 min-w-0 px-4 py-3 border-2 border-gray-300 rounded-r-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="product-slug"
                                    />
                                </div>
                            </div>

                            <div>
                                <label htmlFor="pf-keywords" className="block text-sm font-semibold text-gray-900 mb-2">
                                    Keywords
                                </label>
                                <input
                                    id="pf-keywords"
                                    type="text"
                                    value={keywords}
                                    onChange={(e) => setKeywords(e.target.value)}
                                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="keyword1, keyword2"
                                />
                                <p className="text-sm text-gray-500 mt-2">Separate keywords with commas</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
