import { Metadata } from 'next';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string[];
  ogImage?: string;
  ogType?: 'website' | 'product' | 'article';
  price?: number;
  currency?: string;
  availability?: string;
  category?: string;
  publishedTime?: string;
  author?: string;
  noindex?: boolean;
  canonicalPath?: string;
}

export function generateMetadata({
  title = 'House of Elle | Perfumes, Body Mists & Candles in Accra',
  description = 'Shop curated perfumes, body mists, scented candles and body care at House of Elle in Accra, Ghana. Wholesale options available.',
  keywords = [],
  ogImage,
  ogType = 'website',
  price,
  currency = 'GHS',
  availability,
  category,
  publishedTime,
  author,
  noindex = false,
  canonicalPath = ''
}: SEOProps): Metadata {
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://example.com';
  const defaultOgImage = `${siteUrl}/house-of-elle-logo.png`;
  const resolvedOgImage = ogImage || defaultOgImage;
  const siteName = 'House of Elle';
  const fullTitle = title.includes(siteName) ? title : `${title} | ${siteName}`;

  const defaultKeywords = [
    'perfume shop Accra',
    'perfumes Ghana',
    'body mist Ghana',
    'scented candles Accra',
    'wholesale perfume Ghana',
    'House of Elle'
  ];

  const allKeywords = [...new Set([...keywords, ...defaultKeywords])];

  const metadata: Metadata = {
    title: fullTitle,
    description,
    keywords: allKeywords.join(', '),
    authors: author ? [{ name: author }] : undefined,
    openGraph: {
      title: fullTitle,
      description,
      images: [{ url: resolvedOgImage, width: 1200, height: 630, alt: title }],
      type: ogType as any,
      siteName,
      locale: 'en_GH'
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [resolvedOgImage]
    },
    robots: noindex ? {
      index: false,
      follow: false
    } : {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1
      }
    },
    alternates: {
      canonical: canonicalPath ? `${siteUrl}${canonicalPath}` : siteUrl
    }
  };

  if (ogType === 'article' && publishedTime) {
    metadata.openGraph = {
      ...metadata.openGraph,
      type: 'article',
      publishedTime
    };
  }

  return metadata;
}

export function generateProductSchema(product: {
  name: string;
  description: string;
  image: string;
  price: number;
  currency?: string;
  sku: string;
  rating?: number;
  reviewCount?: number;
  availability?: string;
  brand?: string;
  category?: string;
}) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    image: product.image,
    sku: product.sku,
    brand: {
      '@type': 'Brand',
      name: product.brand || 'House of Elle'
    },
    offers: {
      '@type': 'Offer',
      price: product.price,
      priceCurrency: product.currency || 'GHS',
      availability: product.availability === 'in_stock'
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      url: typeof window !== 'undefined' ? window.location.href : '',
      priceValidUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    }
  };

  if (product.rating && product.reviewCount) {
    (schema as any).aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: product.rating,
      reviewCount: product.reviewCount,
      bestRating: 5,
      worstRating: 1
    };
  }

  if (product.category) {
    (schema as any).category = product.category;
  }

  return schema;
}

export function generateBreadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url
    }))
  };
}

export function generateOrganizationSchema() {
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://example.com';
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'House of Elle',
    url: siteUrl,
    logo: `${siteUrl}/house-of-elle-logo.png`,
    image: `${siteUrl}/house-of-elle-logo.png`,
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+233570551050',
      contactType: 'Customer Service',
      areaServed: 'GH',
      availableLanguage: ['English']
    }
  };
}

export function generateWebsiteSchema() {
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://example.com';
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'House of Elle',
    url: siteUrl,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${siteUrl}/shop?search={search_term_string}`
      },
      'query-input': 'required name=search_term_string'
    }
  };
}

export function StructuredData({ data }: { data: any }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}