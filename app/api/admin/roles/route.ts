import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/pool';
import { clientIp, logActivity, requireScreen } from '@/lib/admin-session';
import {
  STAFF_GRANTABLE,
  STAFF_PERMISSIONS_KEY,
  STAFF_SCREENS_KEY,
  parseStaffPermissions,
  type StaffPermissions,
} from '@/lib/admin-permissions';

export const dynamic = 'force-dynamic';

const NO_GRANTS: StaffPermissions = Object.fromEntries(STAFF_GRANTABLE.map((s) => [s.key, false]));

/** The staff default, plus how many staff follow it and how many have their own list. */
async function load() {
  const [settings, staff] = await Promise.all([
    query<{ key: string; value: any }>(`SELECT key, value FROM site_settings WHERE key = ANY($1::text[])`, [
      [STAFF_PERMISSIONS_KEY, STAFF_SCREENS_KEY],
    ]),
    query<{ id: string }>(`SELECT id FROM profiles WHERE role = 'staff'`),
  ]);
  const byKey = new Map(settings.rows.map((r) => [r.key, r.value]));
  const personal = (byKey.get(STAFF_SCREENS_KEY) || {}) as Record<string, unknown>;
  const custom = staff.rows.filter((r) => personal[r.id]).length;
  return {
    permissions: parseStaffPermissions(byKey.get(STAFF_PERMISSIONS_KEY)),
    saved: byKey.has(STAFF_PERMISSIONS_KEY),
    staffCount: staff.rows.length,
    customCount: custom,
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireScreen(request, 'roles');
  if (auth.error) return auth.error;
  return NextResponse.json(await load(), { headers: { 'Cache-Control': 'no-store' } });
}

export async function PUT(request: NextRequest) {
  const auth = await requireScreen(request, 'roles');
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => ({}));
  const raw = body?.permissions;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return NextResponse.json({ error: 'Send the screens as { screenKey: true | false }.' }, { status: 400 });
  }
  // Unknown and owner-only keys are dropped; missing keys count as off.
  const permissions = parseStaffPermissions(raw, NO_GRANTS);
  if (!STAFF_GRANTABLE.some((s) => permissions[s.key])) {
    return NextResponse.json(
      { error: 'Give staff at least one screen. To stop someone signing in, remove them on the Staff page.' },
      { status: 400 }
    );
  }

  const before = (await load()).permissions;
  await query(
    `INSERT INTO site_settings (key, value, category)
     VALUES ($1, $2::jsonb, 'team')
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [STAFF_PERMISSIONS_KEY, JSON.stringify(permissions)]
  );

  const added = STAFF_GRANTABLE.filter((s) => permissions[s.key] && !before[s.key]).map((s) => s.title);
  const removed = STAFF_GRANTABLE.filter((s) => !permissions[s.key] && before[s.key]).map((s) => s.title);
  if (added.length || removed.length) {
    await logActivity({
      userId: auth.member.id,
      action: 'update',
      entityType: 'roles',
      details: {
        label: 'Default staff screens',
        changes: {
          ...(added.length ? { screens_added: added.join(', ') } : {}),
          ...(removed.length ? { screens_removed: removed.join(', ') } : {}),
        },
      },
      ip: clientIp(request),
    });
  }

  return NextResponse.json({
    ...(await load()),
    message: 'Saved. Staff on the default see the change the next time they open a page.',
  });
}
