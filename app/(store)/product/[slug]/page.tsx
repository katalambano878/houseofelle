import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase-admin';
import ProductDetailClient from './ProductDetailClient';

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://example.com';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;

  try {
    // Server-side read straight from the database (no HTTP round trip to our own /rest/v1).
    const { data: product } = await supabaseAdmin
      .from('products')
      .select('name, description, price, quantity, slug, product_images(url, position)')
      .eq('slug', slug)
      .eq('status', 'active')
      .maybeSingle();

    if (!product) {
      return {
        title: 'Product not found',
        robots: { index: false },
      };
    }

    const title = product.name; // the root layout's template appends "| House of Elle"
    const description = (product.description || `Shop ${product.name} at House of Elle, Accra.`).slice(0, 155);
    const images = [...(product.product_images || [])].sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0));
    const image = images[0]?.url || `${siteUrl}/opengraph-image`;

    return {
      title,
      description,
      alternates: {
        canonical: `${siteUrl}/product/${product.slug}`,
      },
      openGraph: {
        title,
        description,
        type: 'website',
        images: [{ url: image }],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [image],
      },
    };
  } catch {
    return {};
  }
}

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // Real 404 for unknown or hidden products (instead of a "soft 404" page with status 200).
  const { data: exists, error } = await supabaseAdmin
    .from('products')
    .select('id')
    .eq('slug', slug)
    .eq('status', 'active')
    .maybeSingle();
  if (!error && !exists) notFound();
  return <ProductDetailClient slug={slug} />;
}
