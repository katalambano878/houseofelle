import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://example.com';

export const SEO_KEYWORDS = [
  'perfume shop Accra',
  'perfumes Ghana',
  'body mist Ghana',
  'scented candles Accra',
  'wholesale perfume Ghana',
  'House of Elle',
];

type SeoInput = {
  title: string;
  description: string;
  path?: string;
  image?: string;
};

export function buildPageMetadata({ title, description, path = '', image = '/opengraph-image' }: SeoInput): Metadata {
  return {
    title,
    description,
    keywords: SEO_KEYWORDS.join(', '),
    alternates: {
      canonical: `${siteUrl}${path}`,
    },
    openGraph: {
      title,
      description,
      type: 'website',
      url: `${siteUrl}${path}`,
      images: [{ url: image, width: 1200, height: 630 }],
      locale: 'en_GH',
      siteName: 'House of Elle',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export const pageSeoTemplates = {
  home: () =>
    buildPageMetadata({
      title: 'House of Elle | Perfumes, Body Mists & Candles in Accra',
      description:
        'Shop curated perfumes, body mists, scented candles and body care at House of Elle in Accra, Ghana. Wholesale options available.',
      path: '/',
    }),
  shop: () =>
    buildPageMetadata({
      title: 'Shop Perfumes & Body Care in Accra | House of Elle',
      description:
        'Browse curated perfumes, body mists, scented candles and body care at House of Elle, with delivery in Accra and across Ghana.',
      path: '/shop',
    }),
  categories: () =>
    buildPageMetadata({
      title: 'Shop by Category | House of Elle',
      description:
        'Explore perfumes, body mists, candles, body care and wholesale collections at House of Elle in Accra, Ghana.',
      path: '/categories',
    }),
  about: () =>
    buildPageMetadata({
      title: 'About House of Elle | Fragrance & Body Care in Accra',
      description:
        'Learn about House of Elle, a fragrance and body care destination in Accra offering curated perfumes, body mists, candles and wholesale options.',
      path: '/about',
    }),
  contact: () =>
    buildPageMetadata({
      title: 'Contact House of Elle | Accra',
      description:
        'Contact House of Elle in Spintex Lashibi, Accra, for orders, scent recommendations and wholesale enquiries.',
      path: '/contact',
    }),
};
