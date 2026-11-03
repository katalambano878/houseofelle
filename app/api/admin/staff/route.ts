import { NextRequest, NextResponse } from 'next/server';
import { getPool, query } from '@/lib/db/pool';
import { createTeamMember, setUserPassword } from '@/lib/db/auth';
import { clientIp, logActivity, requireScreen } from '@/lib/admin-session';
import {
  STAFF_GRANTABLE,
  STAFF_PERMISSIONS_KEY,
  STAFF_SCREENS_KEY,
  parseStaffPermissions,
  type StaffPermissions,
} from '@/lib/admin-permissions';

export const dynamic = 'force-dynamic';

type Role = 'admin' | 'staff';

const ROLES = new Set<string>(['admin', 'staff']);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NO_GRANTS: StaffPermissions = Object.fromEntries(STAFF_GRANTABLE.map((s) => [s.key, false]));

function clean(value: unknown, max = 120): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function bad(error: string, status = 400, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error, ...extra }, { status });
}

/**
 * Reads a per-person grant from the request. `undefined` leaves the grant alone,
 * `null` clears it (the person follows the staff default), an object replaces it.
 */
function screensFromBody(value: unknown): StaffPermissions | null | undefined | 'invalid' {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) return 'invalid';
  const screens = parseStaffPermissions(value, NO_GRANTS);
  if (!Object.values(screens).some(Boolean)) return 'invalid';
  return screens;
}

async function saveScreens(userId: string, screens: StaffPermissions | null) {
  if (screens === null) {
    await query(`UPDATE site_settings SET value = value - $2, updated_at = now() WHERE key = $1`, [
      STAFF_SCREENS_KEY,
      userId,
    ]);
    return;
  }
  await query(
    `INSERT INTO site_settings (key, value, category)
     VALUES ($1, jsonb_build_object($2::text, $3::jsonb), 'team')
     ON CONFLICT (key) DO UPDATE
       SET value = COALESCE(site_settings.value, '{}'::jsonb) || jsonb_build_object($2::text, $3::jsonb),
           updated_at = now()`,
    [STAFF_SCREENS_KEY, userId, JSON.stringify(screens)]
  );
}

function changedScreens(before: StaffPermissions, after: StaffPermissions) {
  const added = STAFF_GRANTABLE.filter((s) => after[s.key] && !before[s.key]).map((s) => s.title);
  const removed = STAFF_GRANTABLE.filter((s) => !after[s.key] && before[s.key]).map((s) => s.title);
  return { added, removed };
}

async function grantSettings() {
  const { rows } = await query<{ key: string; value: any }>(
    `SELECT key, value FROM site_settings WHERE key = ANY($1::text[])`,
    [[STAFF_PERMISSIONS_KEY, STAFF_SCREENS_KEY]]
  );
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const defaults = parseStaffPermissions(byKey.get(STAFF_PERMISSIONS_KEY));
  const personal = (byKey.get(STAFF_SCREENS_KEY) || {}) as Record<string, unknown>;
  return { defaults, personal };
}

/**
 * Runs `sql` (which must update profile $1) only while another admin would remain.
 * Admin rows are locked first, so two owners removing each other at the same
 * moment cannot leave the store with none. Returns the updated rows, or null when blocked.
 */
async function withAdminGuard<T>(userId: string, losesAdmin: boolean, sql: string, params: unknown[]): Promise<T[] | null> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    if (losesAdmin) {
      const admins = await client.query<{ id: string }>(`SELECT id FROM profiles WHERE role = 'admin' FOR UPDATE`);
      if (admins.rows.some((r) => r.id === userId) && admins.rows.length <= 1) {
        await client.query('ROLLBACK');
        return null;
      }
    }
    const res = await client.query(sql, params as any[]);
    await client.query('COMMIT');
    return res.rows as T[];
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireScreen(request, 'staff');
  if (auth.error) return auth.error;

  const [{ rows }, grants] = await Promise.all([
    query(
      `SELECT p.id, p.email, p.full_name, p.phone, p.role::text AS role, p.created_at,
              u.last_sign_in_at,
              COALESCE(s.sales, 0)::int AS sales_30d,
              COALESCE(s.revenue, 0)::float AS revenue_30d,
              COALESCE(a.actions, 0)::int AS actions_7d,
              a.last_action_at
         FROM profiles p
         LEFT JOIN auth.users u ON u.id = p.id
         LEFT JOIN (
           SELECT metadata->>'sold_by_id' AS staff_id, COUNT(*) AS sales, SUM(total) AS revenue
             FROM orders
            WHERE payment_status = 'paid'
              AND status NOT IN ('cancelled', 'refunded')
              AND metadata->>'sold_by_id' IS NOT NULL
              AND created_at >= now() - interval '30 days'
            GROUP BY 1
         ) s ON s.staff_id = p.id::text
         LEFT JOIN (
           SELECT user_id,
                  COUNT(*) FILTER (WHERE created_at >= now() - interval '7 days') AS actions,
                  MAX(created_at) AS last_action_at
             FROM audit_logs GROUP BY user_id
         ) a ON a.user_id = p.id
        WHERE p.role IN ('admin', 'staff')
        ORDER BY (p.role = 'admin') DESC, p.created_at ASC`
    ),
    grantSettings(),
  ]);

  return NextResponse.json(
    {
      me: auth.member.id,
      defaults: grants.defaults,
      staff: rows.map((row: any) => {
        const own = grants.personal[row.id];
        return {
          ...row,
          customScreens: row.role === 'staff' && Boolean(own),
          screens: row.role === 'staff' ? (own ? parseStaffPermissions(own, grants.defaults) : grants.defaults) : null,
        };
      }),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

export async function POST(request: NextRequest) {
  const auth = await requireScreen(request, 'staff');
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => ({}));
  const email = clean(body.email, 254).toLowerCase();
  const fullName = clean(body.fullName);
  const phone = clean(body.phone, 30);
  const role = clean(body.role, 10);
  const password = typeof body.password === 'string' ? body.password : '';
  const promoteExisting = body.promoteExisting === true;
  const screens = screensFromBody(body.screens);

  const fieldErrors: Record<string, string> = {};
  if (!fullName) fieldErrors.fullName = 'Enter their name.';
  if (!EMAIL.test(email)) fieldErrors.email = 'Enter a valid email address.';
  if (!ROLES.has(role)) fieldErrors.role = 'Choose Admin or Staff.';
  if (screens === 'invalid') fieldErrors.screens = 'Give them at least one screen.';
  if (Object.keys(fieldErrors).length) return bad(Object.values(fieldErrors)[0], 400, { fieldErrors });

  const existing = await query<{ id: string; role: string; full_name: string | null }>(
    `SELECT p.id, p.role::text AS role, p.full_name
       FROM auth.users u LEFT JOIN profiles p ON p.id = u.id
      WHERE lower(u.email) = $1 LIMIT 1`,
    [email]
  );
  const found = existing.rows[0];

  let userId: string;
  let promoted = false;
  if (found) {
    if (ROLES.has(found.role)) {
      return bad('This person is already on the team.', 409, { fieldErrors: { email: 'Already on the team.' } });
    }
    if (!promoteExisting) {
      // The UI confirms first: promoting keeps the customer's own password.
      return bad('This email already has a customer account.', 409, {
        code: 'existing_customer',
        existingName: found.full_name || null,
      });
    }
    if (!found.id) return bad('That account has no profile yet. Ask them to sign in once, then try again.', 409);
    userId = found.id;
    promoted = true;
    await query(
      `UPDATE profiles
          SET role = $2::user_role, full_name = $3, phone = COALESCE(NULLIF($4, ''), phone), updated_at = now()
        WHERE id = $1`,
      [userId, role, fullName, phone]
    );
  } else {
    if (password.length < 8) {
      return bad('The temporary password must be at least 8 characters.', 400, {
        fieldErrors: { password: 'At least 8 characters.' },
      });
    }
    const created = await createTeamMember({ email, password, role: role as Role, fullName, phone: phone || null });
    if (created.error || !created.userId) return bad(created.error || 'Could not create the account.');
    userId = created.userId;
  }

  if (role === 'staff' && screens && screens !== 'invalid') await saveScreens(userId, screens);

  await logActivity({
    userId: auth.member.id,
    action: promoted ? 'promote' : 'invite',
    entityType: 'staff',
    entityId: userId,
    details: { label: fullName, changes: { role } },
    ip: clientIp(request),
  });

  return NextResponse.json({
    userId,
    message: promoted
      ? `${fullName} can now sign in to the admin as ${role} with their existing password.`
      : `${fullName} can sign in at /admin/login with ${email} and the temporary password you set.`,
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireScreen(request, 'staff');
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => ({}));
  const userId = clean(body.userId, 40);
  const role = clean(body.role, 10);
  const fullName = clean(body.fullName);
  const password = typeof body.password === 'string' ? body.password : '';
  const screens = screensFromBody(body.screens);

  if (!UUID.test(userId)) return bad('Missing team member.');
  if (role && !ROLES.has(role)) return bad('Choose Admin or Staff.', 400, { fieldErrors: { role: 'Choose Admin or Staff.' } });
  if (typeof body.fullName === 'string' && !fullName) {
    return bad('Enter their name.', 400, { fieldErrors: { fullName: 'Enter their name.' } });
  }
  if (screens === 'invalid') return bad('Give them at least one screen.', 400, { fieldErrors: { screens: 'Give them at least one screen.' } });
  if (password && password.length < 8) {
    return bad('The new password must be at least 8 characters.', 400, { fieldErrors: { password: 'At least 8 characters.' } });
  }
  if (userId === auth.member.id && role && role !== 'admin') {
    return bad('You cannot remove your own admin access.', 403);
  }

  const target = await query<{ role: string; full_name: string | null; email: string | null }>(
    `SELECT role::text AS role, full_name, email FROM profiles WHERE id = $1`,
    [userId]
  );
  const before = target.rows[0];
  if (!before || !ROLES.has(before.role)) return bad('That person is not on the team.', 404);

  const nextRole = (role || before.role) as Role;
  const phone = typeof body.phone === 'string' ? clean(body.phone, 30) : null;

  const updated = await withAdminGuard<{ id: string }>(
    userId,
    before.role === 'admin' && nextRole !== 'admin',
    `UPDATE profiles
        SET role = $2::user_role,
            full_name = COALESCE(NULLIF($3, ''), full_name),
            phone = CASE WHEN $5::boolean THEN NULLIF($4, '') ELSE phone END,
            updated_at = now()
      WHERE id = $1
      RETURNING id`,
    [userId, nextRole, fullName, phone ?? '', phone !== null]
  );
  if (!updated) return bad('The store needs at least one admin. Make someone else an admin first.', 409);
  if (!updated[0]) return bad('That person is not on the team.', 404);

  const changes: Record<string, unknown> = {};
  if (nextRole !== before.role) changes.role = nextRole;
  if (fullName && fullName !== (before.full_name || '')) changes.name = fullName;

  if (nextRole === 'staff') {
    const { defaults, personal } = await grantSettings();
    const own = personal[userId];
    const previous = own ? parseStaffPermissions(own, defaults) : defaults;
    if (screens !== undefined) {
      await saveScreens(userId, screens);
      const diff = changedScreens(previous, screens ?? defaults);
      if (diff.added.length) changes.screens_added = diff.added.join(', ');
      if (diff.removed.length) changes.screens_removed = diff.removed.join(', ');
      if (screens === null && own) changes.screens = 'staff default';
    }
  } else if (before.role === 'staff') {
    // Admins open everything; a stale personal grant would come back if they were made staff again.
    await saveScreens(userId, null);
  }

  if (password) {
    const error = await setUserPassword(userId, password);
    if (error) return bad(error);
    changes.password = 'reset';
  }

  if (Object.keys(changes).length) {
    await logActivity({
      userId: auth.member.id,
      action: 'update',
      entityType: 'staff',
      entityId: userId,
      details: { label: fullName || before.full_name || before.email, changes },
      ip: clientIp(request),
    });
  }

  return NextResponse.json({
    message: password ? 'Saved. Their new password works from their next sign-in.' : 'Saved.',
  });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireScreen(request, 'staff');
  if (auth.error) return auth.error;

  const userId = clean(request.nextUrl.searchParams.get('userId'), 40);
  if (!UUID.test(userId)) return bad('Missing team member.');
  if (userId === auth.member.id) return bad('You cannot remove yourself.', 403);

  const target = await query<{ role: string }>(`SELECT role::text AS role FROM profiles WHERE id = $1`, [userId]);
  const was = target.rows[0]?.role;
  if (!was || !ROLES.has(was)) return bad('That person is not on the team.', 404);

  // Demote, never delete: their orders, sales and activity stay linked to them.
  const rows = await withAdminGuard<{ full_name: string | null; email: string | null }>(
    userId,
    was === 'admin',
    `UPDATE profiles SET role = 'customer', updated_at = now()
      WHERE id = $1 AND role IN ('admin', 'staff')
      RETURNING full_name, email`,
    [userId]
  );
  if (!rows) return bad('The store needs at least one admin. Make someone else an admin first.', 409);
  if (!rows[0]) return bad('That person is not on the team.', 404);
  await saveScreens(userId, null);

  await logActivity({
    userId: auth.member.id,
    action: 'remove',
    entityType: 'staff',
    entityId: userId,
    details: { label: rows[0].full_name || rows[0].email, changes: { role: `${was} → customer` } },
    ip: clientIp(request),
  });
  return NextResponse.json({
    message: `${rows[0].full_name || rows[0].email} can no longer open the admin. Their past sales and activity stay on record.`,
  });
}
