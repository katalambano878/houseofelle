import Link from 'next/link';
import { notFound } from 'next/navigation';

type Block =
  | { type: 'h'; text: string }
  | { type: 'p'; text: string; link?: { href: string; label: string } }
  | { type: 'ul' | 'ol'; items: string[] };

interface Article {
  title: string;
  category: string;
  blocks: Block[];
  related: string[];
}

// Keep the ids and titles in sync with app/(store)/help/page.tsx.
const articles: Record<string, Article> = {
  '1': {
    title: 'How do I track my order?',
    category: 'Orders & Delivery',
    blocks: [
      { type: 'h', text: 'On our website' },
      {
        type: 'ol',
        items: [
          'Go to the Order Tracking page.',
          'Enter your order number (it starts with ORD-) and the email you used at checkout.',
          'Select "Track Order" to see the latest status.',
        ],
      },
      { type: 'p', text: 'Open the tracking page:', link: { href: '/order-tracking', label: 'Order Tracking' } },
      { type: 'h', text: 'In your account' },
      { type: 'p', text: 'If you placed the order while signed in, it appears under Account → Order History, with a Track Order button.', link: { href: '/account?tab=orders', label: 'Go to Order History' } },
      { type: 'h', text: 'What the statuses mean' },
      {
        type: 'ul',
        items: [
          'Pending / Awaiting payment: we have your order and are waiting for your Mobile Money payment to be confirmed.',
          'Processing: payment is confirmed and we are preparing your items.',
          'Packaged: your order is packed and ready for delivery.',
          'Delivered: your order has been delivered.',
        ],
      },
    ],
    related: ['2', '3', '11'],
  },
  '2': {
    title: 'How much is delivery and how long does it take?',
    category: 'Orders & Delivery',
    blocks: [
      { type: 'p', text: 'We deliver within Ghana from our shop at Spintex Lashibi, Shalom Spot Junction, Accra.' },
      { type: 'p', text: 'Delivery fees depend on your location and are confirmed after you order. Checkout does not charge a delivery fee; we contact you to confirm the fee and the expected delivery time before your order goes out.' },
      { type: 'p', text: 'If you have a question about delivery to your area, get in touch:', link: { href: '/contact?subject=Delivery%20question', label: 'Contact us' } },
    ],
    related: ['1', '3'],
  },
  '3': {
    title: 'Can I change my delivery address?',
    category: 'Orders & Delivery',
    blocks: [
      { type: 'p', text: 'Contact us as soon as possible with your order number and the new address. We can usually update it if your order has not left our shop yet.' },
      { type: 'p', text: 'Send us the details:', link: { href: '/contact?subject=Change%20delivery%20address', label: 'Contact us' } },
      { type: 'p', text: 'To save addresses for future orders, add them to your account address book.', link: { href: '/help/article/20', label: 'Managing saved addresses' } },
    ],
    related: ['1', '20'],
  },
  '6': {
    title: 'My item arrived damaged, leaking or wrong. What do I do?',
    category: 'Returns & Problems',
    blocks: [
      { type: 'p', text: 'We are sorry something went wrong. Let us know as soon as possible so we can put it right.' },
      {
        type: 'ol',
        items: [
          'Open the Returns page and enter your order number and email.',
          'Select the affected items and tell us what happened (damaged or leaking, wrong item, missing item, not as described).',
          'Submit the request. We will contact you to agree the next steps.',
        ],
      },
      { type: 'p', text: 'Please keep the item and all its packaging until we have been in touch. Photos of the damage help us sort it out faster.' },
      { type: 'p', text: 'Start here:', link: { href: '/returns', label: 'Report a problem with an order' } },
    ],
    related: ['1', '11'],
  },
  '11': {
    title: 'How do I pay?',
    category: 'Payment',
    blocks: [
      { type: 'p', text: 'We accept Mobile Money, processed securely by Moolre. Prices on our website are in Ghana cedis (GH₵).' },
      {
        type: 'ol',
        items: [
          'Add your items to the cart and go to checkout.',
          'Enter your delivery details and place your order.',
          "You are taken to Moolre's secure payment page. Choose Mobile Money and follow the steps to approve the payment.",
        ],
      },
      { type: 'p', text: 'Once the payment is confirmed you will see your order confirmation. If the payment does not go through, you can try again, or contact us with your order number and we will help.' },
      { type: 'p', text: 'Payment problem?', link: { href: '/contact?subject=Payment%20problem', label: 'Contact us' } },
    ],
    related: ['1', '2'],
  },
  '16': {
    title: 'Creating an account and resetting your password',
    category: 'Account',
    blocks: [
      { type: 'p', text: 'An account lets you see your order history, save addresses and keep track of support requests. You can also check out as a guest.' },
      { type: 'p', text: 'Create an account:', link: { href: '/auth/signup', label: 'Sign up' } },
      { type: 'h', text: 'Forgot your password?' },
      { type: 'p', text: 'Request a reset link and we will email you a link to choose a new password (at least 8 characters).', link: { href: '/auth/forgot-password', label: 'Reset password' } },
    ],
    related: ['20', '19'],
  },
  '19': {
    title: 'Can I download my data or delete my account?',
    category: 'Account',
    blocks: [
      { type: 'p', text: 'Yes. Sign in and open Privacy & Data in your account. You can download a copy of your profile, saved addresses and orders, or send us a request to delete your account. We confirm deletion requests by email.' },
      { type: 'p', text: 'Open privacy settings:', link: { href: '/account/privacy', label: 'Privacy & Data' } },
    ],
    related: ['16', '20'],
  },
  '20': {
    title: 'How do I manage my saved addresses?',
    category: 'Account',
    blocks: [
      {
        type: 'ol',
        items: [
          'Sign in and go to Account → Addresses.',
          'Select "Add New Address" and fill in the recipient, phone number, street or landmark, city and region.',
          'Tick "Set as default address" for the address you use most.',
        ],
      },
      { type: 'p', text: 'You can edit or delete an address at any time.', link: { href: '/account?tab=addresses', label: 'Go to Addresses' } },
    ],
    related: ['3', '16'],
  },
  '21': {
    title: 'Do you sell wholesale?',
    category: 'Products & Wholesale',
    blocks: [
      { type: 'p', text: 'Yes. Some products are sold in wholesale quantities; where a minimum order quantity applies it is shown on the product page and the cart starts at that quantity.' },
      { type: 'p', text: 'For bulk orders, gift sets or business enquiries, get in touch and tell us what you need.', link: { href: '/contact?subject=Wholesale%20enquiry', label: 'Contact us about wholesale' } },
    ],
    related: ['11', '25'],
  },
  '25': {
    title: 'How should I store my perfume?',
    category: 'Products & Wholesale',
    blocks: [
      { type: 'p', text: 'Heat, light and air break down fragrance over time. A few simple habits help your perfumes and body mists last longer:' },
      {
        type: 'ul',
        items: [
          'Keep bottles in a cool, dry place away from direct sunlight.',
          'Avoid storing fragrance in a hot car or a steamy bathroom.',
          'Close the cap tightly after each use.',
          'Keep scented candles away from heat and trim the wick before lighting.',
        ],
      },
    ],
    related: ['21', '6'],
  },
};

export function generateStaticParams() {
  return Object.keys(articles).map((id) => ({ id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const article = articles[id];
  return { title: article ? `${article.title} | Help Center` : 'Help Center' };
}

export default async function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const article = articles[id];
  if (!article) notFound();

  const related = article.related
    .filter((rid) => articles[rid])
    .map((rid) => ({ id: rid, ...articles[rid] }));

  return (
    <main className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <Link
          href="/help"
          className="inline-flex items-center text-blue-700 hover:text-blue-900 font-semibold mb-6 whitespace-nowrap"
        >
          <i className="ri-arrow-left-line mr-2"></i>
          Back to Help Center
        </Link>

        <div className="bg-white rounded-xl shadow-sm p-6 sm:p-8 mb-6">
          <div className="mb-6 pb-6 border-b border-gray-200">
            <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold whitespace-nowrap mb-4">
              {article.category}
            </span>
            <h1 className="text-3xl font-bold text-gray-900">{article.title}</h1>
          </div>

          <article className="space-y-4 text-gray-700 leading-relaxed">
            {article.blocks.map((block, i) => {
              if (block.type === 'h') {
                return <h2 key={i} className="text-xl font-bold text-gray-900 pt-2">{block.text}</h2>;
              }
              if (block.type === 'p') {
                return (
                  <p key={i}>
                    {block.text}
                    {block.link && (
                      <>
                        {' '}
                        <Link href={block.link.href} className="text-blue-700 font-semibold hover:underline">
                          {block.link.label}
                        </Link>
                      </>
                    )}
                  </p>
                );
              }
              const ListTag = block.type;
              return (
                <ListTag key={i} className={`${block.type === 'ol' ? 'list-decimal' : 'list-disc'} pl-6 space-y-2`}>
                  {block.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ListTag>
              );
            })}
          </article>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 sm:p-8 mb-6 text-center">
          <h3 className="text-xl font-bold text-gray-900 mb-2">Still need help?</h3>
          <p className="text-gray-600 mb-4">Our team is happy to help with orders, payments and fragrance questions.</p>
          <Link
            href="/support/ticket"
            className="inline-block bg-blue-700 hover:bg-blue-800 text-white px-6 py-3 rounded-lg font-semibold transition-colors whitespace-nowrap"
          >
            Contact Support
          </Link>
        </div>

        {related.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-6 sm:p-8">
            <h3 className="text-xl font-bold text-gray-900 mb-6">Related Articles</h3>
            <div className="space-y-3">
              {related.map((item) => (
                <Link
                  key={item.id}
                  href={`/help/article/${item.id}`}
                  className="flex items-center justify-between p-4 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <i className="ri-file-text-line text-xl text-blue-700"></i>
                    <div>
                      <p className="font-semibold text-gray-900">{item.title}</p>
                      <p className="text-sm text-gray-600">{item.category}</p>
                    </div>
                  </div>
                  <i className="ri-arrow-right-s-line text-2xl text-gray-400"></i>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
