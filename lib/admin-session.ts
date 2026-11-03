// Server-side team member lookup, screen checks and the activity log for admin API routes.

import { NextResponse } from 'next/server';
import { getAuthToken } from '@/lib/auth';
import { verifyAccessToken } from '@/lib/db/auth';
import { query } from '@/lib/db/pool';
import {
  ADMIN_SCREENS,
  STAFF_PERMISSIONS_KEY,
  STAFF_SCREENS_KEY,
  canOpen,
  parseStaffPermissions,
  type StaffPermissions,
} from '@/lib/admin-permissions';

export type TeamMember = {
  id: string;
  role: 'admin' | 'staff';
  name: string;
  email: string;
  screens: StaffPermissions;
};

/** The screens a staff member may open: their own grant, else the staff default. */
export async function staffScreensFor(userId: string): Promise<StaffPermissions> {
  const { rows } = await query<{ key: string; value: any }>(
    `SELECT key, value FROM site_settings WHERE key = ANY($1::text[])`,
    [[STAFF_PERMISSIONS_KEY, STAFF_SCREENS_KEY]]
  );
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const roleDefault = parseStaffPermissions(byKey.get(STAFF_PERMISSIONS_KEY));
  const personal = byKey.get(STAFF_SCREENS_KEY)?.[userId];
  return personal ? parseStaffPermissions(personal, roleDefault) : roleDefault;
}

export async function getTeamMember(request: Request): Promise<TeamMember | null> {
  const token = getAuthToken(request);
  if (!token) return null;
  const verified = await verifyAccessToken(token);
  if (!verified) return null;
  const { rows } = await query<{ id: string; role: string; full_name: string | null; email: string | null }>(
    `SELECT id, role::text AS role, full_name, email FROM profiles WHERE id = $1 LIMIT 1`,
    [verified.userId]
  );
  const row = rows[0];
  if (!row || (row.role !== 'admin' && row.role !== 'staff')) return null;
  return {
    id: row.id,
    role: row.role,
    name: row.full_name?.trim() || row.email || 'Staff',
    email: row.email || '',
    screens: row.role === 'staff' ? await staffScreensFor(row.id) : {},
  };
}

/** Lets the request through only for a team member allowed to open `screenKey`. */
export async function requireScreen(
  request: Request,
  screenKey: string
): Promise<{ member: TeamMember; error?: never } | { member?: never; error: NextResponse }> {
  const member = await getTeamMember(request);
  if (!member) {
    return { error: NextResponse.json({ error: 'Please sign in again.' }, { status: 401 }) };
  }
  const screen = ADMIN_SCREENS.find((s) => s.key === screenKey);
  if (!canOpen(member.role, screen, member.screens)) {
    return { error: NextResponse.json({ error: 'You do not have access to this screen.' }, { status: 403 }) };
  }
  return { member };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Records a staff action for Admin → Staff activity. Never throws. */
export async function logActivity(entry: {
  userId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: Record<string, unknown>;
  ip?: string | null;
}) {
  try {
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
      [
        entry.userId,
        entry.action,
        entry.entityType,
        entry.entityId && UUID.test(entry.entityId) ? entry.entityId : null,
        JSON.stringify(entry.details ?? {}),
        entry.ip ?? null,
      ]
    );
  } catch (err) {
    console.error('[activity] could not record', entry.action, entry.entityType, err);
  }
}

export function clientIp(request: Request): string | null {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || null;
}
