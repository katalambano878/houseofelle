# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
- **Shoppers:** customers in Ghana (mainly Accra) buying perfumes, body mists, candles and body care, on their phones more often than not. Many check out as guests.
- **Wholesale buyers:** resellers buying in quantity (products carry a minimum order quantity).
- **Store team:** the owner (admin role) and staff (staff role), who manage products, stock, orders, the in-store POS, customers, reviews and SMS campaigns from `/admin`.

## Product Purpose
House of Elle is a fragrance and body care destination in Accra, Ghana. The online store lets customers browse curated perfumes, body mists, candles and wholesale options, pay with Mobile Money, and track their orders. Success means a shopper finds a scent, pays without friction, and receives clear order updates by SMS and email.

## Positioning
A curated Accra fragrance and body care house: a hand-picked selection rather than an endless marketplace, with wholesale options for resellers.

## Operating Context
- Payments run through Moolre (Mobile Money); order confirmations and payment reminders go out by SMS (Taysend, with Moolre as fallback) and email (Resend).
- Prices are in Ghana cedis (GH₵).
- Staff also sell in person through the admin POS screen.
- Hosted on big-vps through Coolify, with plain Postgres behind a Supabase-compatible shim (`/rest/v1`, `/auth/v1`, `/storage/v1`).

## Capabilities and Constraints
- Storefront: shop, categories, product pages, cart, guest or account checkout, order tracking, account with order history and invoices, reviews, contact form.
- Admin: products (including bulk ZIP/CSV import and catalog PDF), inventory, orders, POS, customers, coupons, reviews, notifications/campaigns, analytics, store modules, SMS credit.
- Brand name in all customer messages: **House of Elle**.

## Brand Commitments
- Name: House of Elle. Logo at `public/house-of-elle-logo.png`.
- Category language: fragrance, perfume, body mist, candles, body care, wholesale. Not fashion or clothing.

## Evidence on Hand
- Real product catalog in the database (perfume import batches under `data/imports/`).
- No testimonials, press or sales figures have been provided; do not invent them.

## Product Principles
1. Checkout must be trustworthy: prices and payment state come from the server, never the browser.
2. Mobile-first: most shoppers browse and pay on a phone.
3. Customers always know where their order stands (SMS, email, tracking page).
4. Staff tools favour speed and clarity over decoration.
