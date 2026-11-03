'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import ProductForm from '@/components/admin/ProductForm';
import { supabase } from '@/lib/supabase';

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const [productData, setProductData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    async function fetchProduct() {
      try {
        const { data, error } = await supabase
          .from('products')
          .select(`
            *,
            categories(id, name),
            product_variants(*),
            product_images(*)
          `)
          .eq('id', resolvedParams.id)
          .maybeSingle();

        if (error) throw error;
        setProductData(data);
      } catch (error: any) {
        console.error('Error fetching product:', error);
        setLoadError(error?.message || 'Could not load this product.');
      } finally {
        setLoading(false);
      }
    }

    if (resolvedParams.id) {
      fetchProduct();
    }
  }, [resolvedParams.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <i className="ri-loader-4-line text-4xl text-blue-700 animate-spin mb-4 block"></i>
          <p className="text-gray-500 font-medium">Loading product details...</p>
        </div>
      </div>
    );
  }

  if (!productData) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <i className="ri-error-warning-line text-4xl text-red-500 mb-4 block"></i>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{loadError ? 'Could Not Load Product' : 'Product Not Found'}</h2>
          <p className="text-gray-600">
            {loadError || 'The product you are trying to edit does not exist or has been deleted.'}
          </p>
          <Link href="/admin/products" className="inline-block mt-4 text-blue-700 hover:text-blue-800 font-medium">
            <i className="ri-arrow-left-line mr-1"></i>Back to products
          </Link>
        </div>
      </div>
    );
  }

  return <ProductForm initialData={productData} isEditMode={true} />;
}
