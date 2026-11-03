// Validation for campaign fields sent by Admin → Discounts.

export interface CampaignFields {
  name?: string;
  starts_at?: string | null;
  ends_at?: string | null;
  banner_enabled?: boolean;
  banner_text?: string | null;
  popup_enabled?: boolean;
  popup_title?: string | null;
  popup_message?: string | null;
  popup_cta_label?: string | null;
  announce?: boolean;
}

const TEXT_LIMITS: Record<string, number> = {
  banner_text: 160,
  popup_title: 80,
  popup_message: 300,
  popup_cta_label: 30,
};

function cleanText(value: unknown, max: number): string | null {
  if (value == null) return null;
  const text = String(value).replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, max) : null;
}

function cleanDate(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export function campaignFields(body: any, creating: boolean): { fields: CampaignFields } | { error: string } {
  const fields: CampaignFields = {};
  if (creating || body.name !== undefined) {
    const name = cleanText(body.name, 60);
    if (!name) return { error: 'Give the campaign a name.' };
    fields.name = name;
  }
  for (const key of ['starts_at', 'ends_at'] as const) {
    if (body[key] === undefined) continue;
    const d = cleanDate(body[key]);
    if (d === undefined) return { error: 'One of the dates is not valid.' };
    fields[key] = d;
  }
  if (fields.starts_at && fields.ends_at && new Date(fields.ends_at) <= new Date(fields.starts_at)) {
    return { error: 'The end must be after the start.' };
  }
  for (const key of ['banner_enabled', 'popup_enabled', 'announce'] as const) {
    if (body[key] !== undefined) fields[key] = body[key] === true;
  }
  for (const [key, max] of Object.entries(TEXT_LIMITS)) {
    if (body[key] !== undefined) (fields as any)[key] = cleanText(body[key], max);
  }
  return { fields };
}
