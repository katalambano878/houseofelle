import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sale',
  description: 'Perfumes, body mists, candles and body care on sale at House of Elle, Accra.',
  alternates: { canonical: '/sale' },
};

export default function SaleLayout({ children }: { children: React.ReactNode }) {
  return children;
}
