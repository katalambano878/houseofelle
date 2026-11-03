import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { CartProvider } from "@/context/CartContext";
import { WishlistProvider } from "@/context/WishlistContext";
import "./globals.css";

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#C89B3C',
};

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://example.com';

// Favicon & OG assets from public
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "House of Elle | Perfumes, Body Mists & Candles in Accra",
    template: "%s | House of Elle"
  },
  description: "Shop curated perfumes, body mists, scented candles and body care at House of Elle in Accra, Ghana. Wholesale options available.",
  keywords: [
    "perfume shop Accra",
    "perfumes Ghana",
    "body mist Ghana",
    "scented candles Accra",
    "wholesale perfume Ghana",
    "House of Elle"
  ],
  authors: [{ name: "House of Elle" }],
  creator: "House of Elle",
  publisher: "House of Elle",
  applicationName: "House of Elle",
  referrer: "origin-when-cross-origin",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: '/favicon/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon/favicon.png', sizes: '48x48', type: 'image/png' },
      { url: '/favicon/favicon.ico', sizes: 'any' },
    ],
    shortcut: '/favicon/favicon.ico',
    apple: '/favicon/apple-touch-icon.png',
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'House of Elle',
  },
  formatDetection: {
    telephone: true,
    email: false,
    address: false,
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || '',
  },
  openGraph: {
    type: "website",
    locale: "en_GH",
    url: siteUrl,
    title: "House of Elle | Perfumes, Body Mists & Candles",
    description: "Curated fragrance and body care from Accra.",
    siteName: "House of Elle",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "House of Elle - Fragrance and body care in Accra",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "House of Elle",
    description: "Curated perfumes, body mists and candles from Accra.",
    images: ["/opengraph-image"],
  },
  category: "shopping",
};

// Google Analytics Measurement ID
const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
// Google reCAPTCHA v3 Site Key
const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-GH">
      <head>
        {/* PWA Meta Tags */}
        <meta name="theme-color" content="#C89B3C" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="House of Elle" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#C89B3C" />
        <meta name="msapplication-tap-highlight" content="no" />

        {/* Favicon from public/favicon */}
        <link rel="icon" href="/favicon/favicon-32x32.png" type="image/png" sizes="32x32" />
        <link rel="icon" href="/favicon/favicon-16x16.png" type="image/png" sizes="16x16" />
        <link rel="shortcut icon" href="/favicon/favicon.ico" />

        {/* Apple Touch Icons from public/favicon */}
        <link rel="apple-touch-icon" href="/favicon/apple-touch-icon.png" />
        <link rel="apple-touch-startup-image" href="/favicon/apple-touch-icon.png" />

        <meta name="robots" content="index,follow" />
        <link
          href="https://cdn.jsdelivr.net/npm/remixicon@4.1.0/fonts/remixicon.css"
          rel="stylesheet"
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- App Router: fonts loaded in root layout apply to all pages */}
        <link href="https://fonts.googleapis.com/css2?family=Great+Vibes&family=Montserrat:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Pacifico&family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet" />

        {/* Structured Data - Organization + LocalBusiness */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "Organization",
                  "@id": `${siteUrl}#organization`,
                  "name": "House of Elle",
                  "url": siteUrl,
                  "logo": `${siteUrl}/house-of-elle-logo.png`,
                  "image": `${siteUrl}/house-of-elle-logo.png`,
                  "description": "Fragrance and body care house in Accra, Ghana: perfumes, body mists, scented candles and wholesale.",
                  "sameAs": [
                    "https://www.instagram.com/houseof_elle",
                    "https://www.tiktok.com/@houseof_elle"
                  ],
                  "contactPoint": {
                    "@type": "ContactPoint",
                    "contactType": "customer service",
                    "telephone": "+233553347531",
                    "availableLanguage": "English",
                    "areaServed": "GH"
                  }
                },
                {
                  "@type": "Store",
                  "@id": `${siteUrl}#store`,
                  "name": "House of Elle",
                  "image": `${siteUrl}/house-of-elle-logo.png`,
                  "url": siteUrl,
                  "telephone": "+233553347531",
                  "priceRange": "GH₵",
                  "address": {
                    "@type": "PostalAddress",
                    "streetAddress": "Spintex Lashibi, Shalom Spot Junction",
                    "addressLocality": "Accra",
                    "addressCountry": "GH"
                  }
                }
              ]
            })
          }}
        />
      </head>

      {/* Google Analytics */}
      {GA_MEASUREMENT_ID && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
            strategy="afterInteractive"
          />
          <Script id="google-analytics" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              // Consent mode: nothing is stored until the visitor accepts in the cookie banner.
              var c = {};
              try { c = JSON.parse(localStorage.getItem('cookieConsent') || '{}'); } catch (e) {}
              gtag('consent', 'default', {
                analytics_storage: c.analytics ? 'granted' : 'denied',
                ad_storage: c.marketing ? 'granted' : 'denied',
                ad_user_data: c.marketing ? 'granted' : 'denied',
                ad_personalization: c.marketing ? 'granted' : 'denied'
              });
              gtag('js', new Date());
              gtag('config', '${GA_MEASUREMENT_ID}', {
                page_path: window.location.pathname,
              });
            `}
          </Script>
        </>
      )}

      {/* Google reCAPTCHA v3 */}
      {RECAPTCHA_SITE_KEY && (
        <Script
          src={`https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`}
          strategy="afterInteractive"
        />
      )}

      <body className="antialiased font-sans overflow-x-hidden pwa-body">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[10000] focus:px-6 focus:py-3 focus:bg-blue-600 focus:text-white focus:rounded-lg focus:font-semibold focus:shadow-lg"
        >
          Skip to main content
        </a>
        <CartProvider>
          <WishlistProvider>
            <div id="main-content">
              {children}
            </div>
          </WishlistProvider>
        </CartProvider>
      </body>
    </html>
  );
}
