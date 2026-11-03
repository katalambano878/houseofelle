'use client';

// Shared pieces for Admin → Discounts: status labels, date helpers and the storefront preview.

export type CampaignStatus = 'draft' | 'scheduled' | 'live' | 'ended';

export interface CampaignRow {
  id: string;
  name: string;
  status: CampaignStatus;
  starts_at: string | null;
  ends_at: string | null;
  banner_enabled: boolean;
  banner_text: string | null;
  popup_enabled: boolean;
  popup_title: string | null;
  popup_message: string | null;
  popup_cta_label: string | null;
  announce: boolean;
  started_at: string | null;
  ended_at: string | null;
  updated_at: string;
  product_count?: number;
  applied_count?: number;
  min_percent?: number | null;
  max_percent?: number | null;
}

export const STATUS_META: Record<CampaignStatus, { label: string; className: string; icon: string }> = {
  live: { label: 'Live', className: 'bg-green-100 text-green-800', icon: 'ri-broadcast-line' },
  scheduled: { label: 'Scheduled', className: 'bg-amber-100 text-amber-800', icon: 'ri-time-line' },
  draft: { label: 'Draft', className: 'bg-gray-100 text-gray-700', icon: 'ri-draft-line' },
  ended: { label: 'Ended', className: 'bg-gray-100 text-gray-500', icon: 'ri-flag-line' },
};

export function StatusPill({ status, announced }: { status: CampaignStatus; announced?: boolean }) {
  const meta = STATUS_META[status];
  return (
    <span className="inline-flex items-center gap-1.5 flex-wrap">
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${meta.className}`}>
        {status === 'live' ? (
          <span className="relative flex w-1.5 h-1.5" aria-hidden="true">
            <span className="absolute inset-0 rounded-full bg-green-500 opacity-75 animate-ping motion-reduce:animate-none" />
            <span className="relative w-1.5 h-1.5 rounded-full bg-green-600" />
          </span>
        ) : (
          <i className={`${meta.icon} text-[13px]`} aria-hidden="true" />
        )}
        {meta.label}
      </span>
      {announced && status !== 'live' && status !== 'ended' && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
          <i className="ri-megaphone-line text-[13px]" aria-hidden="true" />
          Announced
        </span>
      )}
    </span>
  );
}

export function formatWhen(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** ISO → value for <input type="datetime-local"> in the browser's time zone. */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function timeLeft(iso: string | null | undefined, now = Date.now()): string | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return null;
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${Math.max(1, m)}m`;
}

export function percentRange(min?: number | null, max?: number | null): string {
  const lo = Number(min) || 0;
  const hi = Number(max) || 0;
  if (!hi) return 'No discounts yet';
  return lo === hi ? `${hi}% off` : `${lo}–${hi}% off`;
}

/** Ready-made campaigns for the Ghana retail calendar. */
export const CAMPAIGN_TEMPLATES: { name: string; banner: string; popupTitle: string; popupMessage: string }[] = [
  {
    name: 'Black Friday',
    banner: 'Black Friday sales!!! Enjoy massive discounts, 10 to 40% off',
    popupTitle: 'Black Friday is here',
    popupMessage: 'Enjoy massive discounts of 10 to 40% off selected perfumes, body mists and candles.',
  },
  {
    name: 'Christmas Sale',
    banner: 'Christmas sale: gift-ready fragrances at special prices',
    popupTitle: 'Christmas gifting, sorted',
    popupMessage: 'Perfumes, body mists and candles at festive prices while stocks last.',
  },
  {
    name: "Valentine's Day",
    banner: "Valentine's Day: scents for someone special, now on sale",
    popupTitle: "Valentine's picks",
    popupMessage: 'Treat them, or yourself, to a signature scent at a lower price.',
  },
  {
    name: "Mother's Day",
    banner: "Mother's Day sale: spoil her with a new favourite scent",
    popupTitle: "For Mum",
    popupMessage: "Celebrate Mother's Day with perfumes and body care at special prices.",
  },
  {
    name: 'Independence Day',
    banner: 'Independence Day sale: celebrate with special prices',
    popupTitle: 'Happy Independence Day',
    popupMessage: 'Mark the day with a fresh scent. Selected products are on sale.',
  },
  {
    name: 'Clearance',
    banner: 'Clearance: last pieces at their lowest prices',
    popupTitle: 'Clearance sale',
    popupMessage: 'Final stock at reduced prices. Once it is gone, it is gone.',
  },
];

/** What shoppers will see: the moving top banner and the welcome popup. */
export function PromoPreview({
  bannerEnabled,
  bannerText,
  popupEnabled,
  popupTitle,
  popupMessage,
  ctaLabel,
  name,
}: {
  bannerEnabled: boolean;
  bannerText: string;
  popupEnabled: boolean;
  popupTitle: string;
  popupMessage: string;
  ctaLabel: string;
  name: string;
}) {
  const text = bannerText || name;
  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden bg-gray-50">
      <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 border-b border-gray-200 bg-white flex items-center gap-2">
        <i className="ri-eye-line" aria-hidden="true" /> Storefront preview
      </div>
      {bannerEnabled ? (
        <div className="bg-blue-800 text-white text-xs py-2 overflow-hidden whitespace-nowrap" aria-hidden="true">
          <div className="promo-marquee-track inline-flex">
            {[0, 1].map((k) => (
              <span key={k} className="inline-flex shrink-0">
                {Array.from({ length: 4 }).map((_, i) => (
                  <span key={i} className="inline-flex items-center gap-3 px-6">
                    <i className="ri-flashlight-fill text-blue-500" />
                    <span className="font-medium">{text}</span>
                  </span>
                ))}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-gray-200 text-gray-500 text-xs py-2 text-center">Banner off: the usual store message shows</div>
      )}
      <div className="relative h-56 bg-gradient-to-br from-blue-50 to-white flex items-center justify-center p-4">
        {popupEnabled ? (
          <div className="w-full max-w-[17rem] bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
            <div className="bg-blue-800 text-white px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-blue-500 font-semibold">{name}</p>
              <p className="font-serif text-lg leading-tight mt-0.5">{popupTitle || name}</p>
            </div>
            <div className="px-4 py-3">
              <p className="text-xs text-gray-600 leading-relaxed line-clamp-3">{popupMessage || 'Selected products are on sale now.'}</p>
              <span className="mt-3 inline-flex w-full justify-center bg-blue-700 text-white text-xs font-semibold rounded-lg py-2">
                {ctaLabel || 'Shop the sale'}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-500">Popup off</p>
        )}
      </div>
    </div>
  );
}
