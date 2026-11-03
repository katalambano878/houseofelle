'use client';

// Records staff actions taken in client admin pages, for Admin → Staff activity.
// audit_logs is append-only for staff in lib/db/rest-policy.ts. Failures are
// logged and swallowed: a missing log line must never block a sale or an update.

import { supabase } from '@/lib/supabase';

export type StaffActor = {
  id: string;
  email: string;
  name: string;
  role: string;
};

let cached: StaffActor | null = null;

export async function currentStaffActor(): Promise<StaffActor | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return null;
  if (cached?.id === session.user.id) return cached;

  const { data: profile } = await supabase
    .from('profiles')
    .select('email, full_name, role')
    .eq('id', session.user.id)
    .maybeSingle();

  cached = {
    id: session.user.id,
    email: profile?.email || session.user.email || '',
    name: profile?.full_name || profile?.email || session.user.email || 'Staff',
    role: profile?.role || 'staff',
  };
  return cached;
}

export async function recordStaffAction(input: {
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: Record<string, unknown>;
  actor?: StaffActor | null;
}) {
  try {
    const actor = input.actor === undefined ? await currentStaffActor() : input.actor;
    if (!actor) return;

    const { error } = await supabase.from('audit_logs').insert({
      user_id: actor.id,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId || null,
      details: {
        ...(input.details || {}),
        actor_email: actor.email,
        actor_name: actor.name,
        actor_role: actor.role,
      },
    });
    if (error) console.error('Audit log failed:', error.message);
  } catch (err) {
    console.error('Audit log failed:', err);
  }
}
