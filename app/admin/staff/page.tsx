'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { adminFetch, cedis } from '@/lib/admin-fetch';
import { supabase } from '@/lib/supabase';
import { ADMIN_GROUPS, STAFF_GRANTABLE, type StaffPermissions } from '@/lib/admin-permissions';

type Role = 'admin' | 'staff';

type Member = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: Role;
  created_at: string;
  last_sign_in_at: string | null;
  sales_30d: number;
  revenue_30d: number;
  actions_7d: number;
  last_action_at: string | null;
  customScreens: boolean;
  screens: StaffPermissions | null;
};

type Form = {
  id?: string;
  email: string;
  fullName: string;
  phone: string;
  role: Role;
  password: string;
  screenMode: 'default' | 'custom';
  screens: StaffPermissions;
};

type FieldErrors = Partial<Record<'fullName' | 'email' | 'password' | 'role' | 'screens', string>>;
type Notice = { kind: 'ok' | 'error'; text: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:bg-gray-50 disabled:text-gray-500';

function displayName(m: Pick<Member, 'full_name' | 'email'>) {
  return m.full_name?.trim() || m.email;
}

function initials(name: string) {
  return name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function relative(iso: string | null, never: string) {
  if (!iso) return never;
  const then = new Date(iso).getTime();
  const mins = Math.round((Date.now() - then) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Accra' });
}

/** 12 characters without look-alikes (0/O, 1/l/I), easy to read out over the phone. */
function generatePassword() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = new Uint32Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

function countOn(screens: StaffPermissions | null | undefined) {
  return screens ? STAFF_GRANTABLE.filter((s) => screens[s.key]).length : 0;
}

export default function StaffPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [defaults, setDefaults] = useState<StaffPermissions>({});
  const [me, setMe] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const data = await adminFetch<{ staff: Member[]; me: string; defaults: StaffPermissions }>('/api/admin/staff');
      setMembers(data.staff);
      setMe(data.me);
      setDefaults(data.defaults);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load the team.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const admins = members.filter((m) => m.role === 'admin').length;
  const staffCount = members.length - admins;

  function openAdd() {
    setNotice(null);
    setConfirmRemove(null);
    setForm({
      email: '',
      fullName: '',
      phone: '',
      role: 'staff',
      password: generatePassword(),
      screenMode: 'default',
      screens: { ...defaults },
    });
  }

  function openEdit(m: Member) {
    setNotice(null);
    setConfirmRemove(null);
    setForm({
      id: m.id,
      email: m.email,
      fullName: m.full_name || '',
      phone: m.phone || '',
      role: m.role,
      password: '',
      screenMode: m.customScreens ? 'custom' : 'default',
      screens: { ...(m.screens || defaults) },
    });
  }

  async function remove(m: Member) {
    setRemovingId(m.id);
    try {
      const result = await adminFetch<{ message: string }>(`/api/admin/staff?userId=${encodeURIComponent(m.id)}`, {
        method: 'DELETE',
      });
      setNotice({ kind: 'ok', text: result.message });
      setConfirmRemove(null);
      await load();
    } catch (err) {
      setNotice({ kind: 'error', text: err instanceof Error ? err.message : 'Could not remove them.' });
    } finally {
      setRemovingId(null);
    }
  }

  /** Why the remove button is off for this person, or null when it is allowed. */
  function removeBlocked(m: Member): string | null {
    if (m.id === me) return 'You cannot remove yourself.';
    if (m.role === 'admin' && admins <= 1) return 'The store needs at least one admin.';
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Staff</h1>
          <p className="mt-1 text-gray-600">
            People who can sign in to the House of Elle admin. Set the screens staff get by default on{' '}
            <Link href="/admin/roles" className="font-medium text-blue-700 underline-offset-2 hover:underline">
              Roles &amp; access
            </Link>
            .
          </p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          disabled={loading || Boolean(loadError)}
          className="inline-flex items-center justify-center gap-2 self-start rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white shadow-sm transition-colors hover:bg-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-50 sm:self-auto shrink-0 whitespace-nowrap"
        >
          <i className="ri-user-add-line" aria-hidden="true" /> Add team member
        </button>
      </div>

      <div aria-live="polite">
        {notice && (
          <div
            role={notice.kind === 'error' ? 'alert' : 'status'}
            className={`flex items-start justify-between gap-4 rounded-lg border p-4 text-sm ${
              notice.kind === 'ok' ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-700'
            }`}
          >
            <span className="flex items-start gap-2">
              <i className={`${notice.kind === 'ok' ? 'ri-checkbox-circle-line' : 'ri-error-warning-line'} mt-0.5`} aria-hidden="true" />
              {notice.text}
            </span>
            <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss message" className="shrink-0 rounded p-0.5 hover:bg-black/5">
              <i className="ri-close-line" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      {loadError ? (
        <div className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-2">
            <i className="ri-error-warning-line text-lg" aria-hidden="true" />
            {loadError}
          </span>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              load();
            }}
            className="self-start rounded-lg border border-red-300 bg-white px-4 py-2 font-semibold text-red-700 hover:bg-red-100 sm:self-auto"
          >
            Try again
          </button>
        </div>
      ) : (
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm" aria-labelledby="team-heading">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-gray-200 px-4 py-4 sm:px-6">
            <h2 id="team-heading" className="text-lg font-bold text-gray-900">
              Team
            </h2>
            {!loading && (
              <p className="text-sm text-gray-500">
                {admins} admin{admins === 1 ? '' : 's'} · {staffCount} staff
              </p>
            )}
          </div>

          {loading ? (
            <ul className="divide-y divide-gray-100" aria-label="Loading team">
              {[0, 1, 2].map((i) => (
                <li key={i} className="flex animate-pulse items-center gap-4 px-4 py-5 sm:px-6">
                  <span className="h-11 w-11 shrink-0 rounded-full bg-gray-100" />
                  <span className="flex-1 space-y-2">
                    <span className="block h-3.5 w-40 rounded bg-gray-100" />
                    <span className="block h-3 w-56 max-w-full rounded bg-gray-100" />
                  </span>
                  <span className="hidden h-8 w-28 rounded-lg bg-gray-100 sm:block" />
                </li>
              ))}
            </ul>
          ) : (
            <ul className="divide-y divide-gray-100">
              {members.map((m) => {
                const name = displayName(m);
                const blocked = removeBlocked(m);
                const confirming = confirmRemove === m.id;
                return (
                  <li key={m.id} className="px-4 py-5 sm:px-6">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
                      <div className="flex min-w-0 flex-1 items-start gap-4 xl:min-w-[16rem]">
                        <span
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                            m.role === 'admin' ? 'bg-blue-700 text-white' : 'bg-blue-100 text-blue-700'
                          }`}
                          aria-hidden="true"
                        >
                          {initials(name)}
                        </span>
                        <div className="min-w-0">
                          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="truncate font-semibold text-gray-900">{name}</span>
                            {m.id === me && <span className="text-xs text-gray-500">(you)</span>}
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                m.role === 'admin' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {m.role === 'admin' ? 'Admin' : 'Staff'}
                            </span>
                          </p>
                          <p className="truncate text-sm text-gray-500">
                            {m.email}
                            {m.phone ? ` · ${m.phone}` : ''}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            {m.role === 'admin'
                              ? 'Opens every screen'
                              : m.customScreens
                                ? `Own list: ${countOn(m.screens)} of ${STAFF_GRANTABLE.length} screens`
                                : `Staff default: ${countOn(m.screens)} of ${STAFF_GRANTABLE.length} screens`}
                            {' · '}
                            Signed in {relative(m.last_sign_in_at, 'never')}
                          </p>
                        </div>
                      </div>

                      <dl className="grid grid-cols-3 gap-3 rounded-lg bg-gray-50 px-4 py-3 text-sm sm:max-w-md xl:w-[22rem] xl:shrink-0">
                        <div>
                          <dt className="text-xs text-gray-500">POS sales, 30 days</dt>
                          <dd className="font-semibold tabular-nums text-gray-900">{m.sales_30d}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-gray-500">Sold</dt>
                          <dd className="font-semibold tabular-nums text-gray-900">{cedis(m.revenue_30d)}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-gray-500">Actions, 7 days</dt>
                          <dd className="font-semibold tabular-nums text-gray-900">{m.actions_7d}</dd>
                        </div>
                      </dl>

                      <div className="flex flex-wrap gap-2 xl:shrink-0 xl:justify-end">
                        <Link
                          href={`/admin/activity?user=${m.id}`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        >
                          <i className="ri-history-line" aria-hidden="true" /> Activity
                        </Link>
                        <button
                          type="button"
                          onClick={() => openEdit(m)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                          aria-label={`Edit ${name}`}
                        >
                          <i className="ri-edit-line" aria-hidden="true" /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmRemove(confirming ? null : m.id)}
                          disabled={Boolean(blocked)}
                          title={blocked || undefined}
                          aria-expanded={confirming}
                          aria-label={`Remove ${name} from the team`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400 disabled:hover:bg-transparent"
                        >
                          <i className="ri-user-unfollow-line" aria-hidden="true" /> Remove
                        </button>
                      </div>
                    </div>

                    {confirming && (
                      <div role="alertdialog" aria-label={`Remove ${name}?`} className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
                        <p className="font-semibold text-red-800">Remove {name} from the team?</p>
                        <p className="mt-1 text-sm text-red-700">
                          They will be signed out of the admin and cannot open it again. Their account stays as a customer
                          account, and every order, sale and change they made stays on record under their name.
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => remove(m)}
                            disabled={removingId === m.id}
                            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                          >
                            {removingId === m.id ? 'Removing…' : 'Remove access'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmRemove(null)}
                            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                          >
                            Keep them
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {!loading && staffCount === 0 && (
            <div className="border-t border-gray-100 bg-gray-50 px-4 py-8 text-center sm:px-6">
              <i className="ri-team-line text-3xl text-gray-400" aria-hidden="true" />
              <p className="mt-2 font-semibold text-gray-900">No staff yet</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-gray-600">
                Add the people who serve customers in the shop. Each sale they ring up on the POS is recorded under their
                name, and they only see the screens you allow.
              </p>
              <button
                type="button"
                onClick={openAdd}
                className="mt-4 inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                <i className="ri-user-add-line" aria-hidden="true" /> Add the first staff member
              </button>
            </div>
          )}
        </section>
      )}

      {form && (
        <MemberDrawer
          form={form}
          isSelf={form.id === me}
          lastAdmin={Boolean(form.id) && admins <= 1 && members.find((m) => m.id === form.id)?.role === 'admin'}
          defaults={defaults}
          onChange={setForm}
          onClose={() => setForm(null)}
          onSaved={async (message) => {
            setForm(null);
            setNotice({ kind: 'ok', text: message });
            await load();
          }}
        />
      )}
    </div>
  );
}

function MemberDrawer({
  form,
  isSelf,
  lastAdmin,
  defaults,
  onChange,
  onClose,
  onSaved,
}: {
  form: Form;
  isSelf: boolean;
  lastAdmin: boolean;
  defaults: StaffPermissions;
  onChange: (f: Form) => void;
  onClose: () => void;
  onSaved: (message: string) => void | Promise<void>;
}) {
  const editing = Boolean(form.id);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(!editing);
  const [copied, setCopied] = useState(false);
  const [existingCustomer, setExistingCustomer] = useState<string | null | undefined>(undefined);
  const panelRef = useRef<HTMLFormElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const roleLocked = isSelf || lastAdmin;

  useEffect(() => {
    firstFieldRef.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      // Keep Tab inside the panel while it is open.
      if (e.key === 'Tab' && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const groups = useMemo(
    () =>
      ADMIN_GROUPS.map((group) => ({ group, screens: STAFF_GRANTABLE.filter((s) => s.group === group) })).filter(
        (g) => g.screens.length > 0
      ),
    []
  );

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    onChange({ ...form, [key]: value });
    if (key in errors) setErrors((e) => ({ ...e, [key]: undefined }));
    if (key === 'email') setExistingCustomer(undefined);
  }

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (!form.fullName.trim()) next.fullName = 'Enter their name.';
    if (!editing && !EMAIL.test(form.email.trim())) next.email = 'Enter a valid email address.';
    const needsPassword = !editing && existingCustomer === undefined;
    if ((needsPassword || form.password) && form.password.length < 8) next.password = 'At least 8 characters.';
    if (form.role === 'staff' && form.screenMode === 'custom' && countOn(form.screens) === 0) {
      next.screens = 'Tick at least one screen, or use the staff default.';
    }
    return next;
  }

  async function submit(e: React.FormEvent, promoteExisting = false) {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    setFormError('');
    if (Object.keys(found).length) return;

    const screens = form.role === 'staff' ? (form.screenMode === 'custom' ? form.screens : null) : undefined;
    setSaving(true);
    try {
      const res = await fetchWithErrors(editing ? 'PATCH' : 'POST', {
        ...(editing
          ? { userId: form.id, role: roleLocked ? undefined : form.role, password: form.password || undefined }
          : { email: form.email.trim(), role: form.role, password: form.password, promoteExisting }),
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        // On create, null means "use the default", which is also what leaving it out does.
        screens: editing ? screens : screens || undefined,
      });
      if (res.ok) {
        await onSaved(res.data.message);
        return;
      }
      if (res.data.code === 'existing_customer') {
        setExistingCustomer(res.data.existingName ?? null);
        return;
      }
      if (res.data.fieldErrors) setErrors(res.data.fieldErrors);
      setFormError(res.data.error || 'Could not save.');
    } finally {
      setSaving(false);
    }
  }

  async function copyPassword() {
    try {
      await navigator.clipboard.writeText(form.password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setShowPassword(true);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <form
        ref={panelRef}
        onSubmit={(e) => submit(e)}
        noValidate
        role="dialog"
        aria-modal="true"
        aria-labelledby="member-drawer-title"
        className="relative flex h-full w-full max-w-lg flex-col bg-white shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4 sm:px-6">
          <div>
            <h2 id="member-drawer-title" className="text-xl font-bold text-gray-900">
              {editing ? `Edit ${form.fullName || form.email}` : 'Add team member'}
            </h2>
            <p className="mt-0.5 text-sm text-gray-500">
              {editing ? form.email : 'They sign in at /admin/login with this email.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900"
          >
            <i className="ri-close-line text-2xl" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
          <div className="space-y-4">
            <Field id="m-name" label="Full name" error={errors.fullName}>
              <input
                id="m-name"
                ref={firstFieldRef}
                value={form.fullName}
                onChange={(e) => set('fullName', e.target.value)}
                autoComplete="off"
                maxLength={120}
                aria-invalid={Boolean(errors.fullName)}
                aria-describedby={errors.fullName ? 'm-name-error' : undefined}
                className={inputClass}
                placeholder="e.g. Akosua Mensah"
              />
            </Field>
            <Field id="m-email" label="Email" hint={editing ? 'The sign-in email cannot be changed here.' : undefined} error={errors.email}>
              <input
                id="m-email"
                type="email"
                inputMode="email"
                value={form.email}
                disabled={editing}
                onChange={(e) => set('email', e.target.value)}
                autoComplete="off"
                maxLength={254}
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? 'm-email-error' : editing ? 'm-email-hint' : undefined}
                className={inputClass}
                placeholder="name@example.com"
              />
            </Field>
            <Field id="m-phone" label="Phone (optional)">
              <input
                id="m-phone"
                type="tel"
                inputMode="tel"
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
                autoComplete="off"
                maxLength={30}
                className={inputClass}
                placeholder="024 000 0000"
              />
            </Field>
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-gray-700">Role</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  { value: 'staff', title: 'Staff', text: 'Opens only the screens you allow.' },
                  { value: 'admin', title: 'Admin', text: 'Opens everything, including team, roles and profit.' },
                ] as const
              ).map((option) => {
                const checked = form.role === option.value;
                return (
                  <label
                    key={option.value}
                    className={`flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-blue-500 ${
                      checked ? 'border-blue-700 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                    } ${roleLocked ? 'cursor-not-allowed opacity-60' : ''}`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={option.value}
                      checked={checked}
                      disabled={roleLocked}
                      onChange={() => set('role', option.value)}
                      className="mt-1 h-4 w-4 accent-[#6B4F3A]"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-gray-900">{option.title}</span>
                      <span className="block text-xs text-gray-500">{option.text}</span>
                    </span>
                  </label>
                );
              })}
            </div>
            {roleLocked && (
              <p className="mt-2 text-xs text-gray-500">
                {isSelf ? 'You cannot change your own role.' : 'This is the only admin. Make someone else an admin first.'}
              </p>
            )}
          </fieldset>

          {existingCustomer === undefined && (
            <Field
              id="m-password"
              label={editing ? 'New temporary password (optional)' : 'Temporary password'}
              hint={
                editing
                  ? 'Leave blank to keep their current password.'
                  : 'Share it with them privately. They can sign in with it straight away.'
              }
              error={errors.password}
            >
              <div className="flex gap-2">
                <div className="relative min-w-0 flex-1">
                  <input
                    id="m-password"
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={(e) => set('password', e.target.value)}
                    autoComplete="new-password"
                    spellCheck={false}
                    maxLength={200}
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby={errors.password ? 'm-password-error' : 'm-password-hint'}
                    className={`${inputClass} pr-11 font-mono tracking-wide`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-gray-500 hover:text-gray-900"
                  >
                    <i className={showPassword ? 'ri-eye-off-line' : 'ri-eye-line'} aria-hidden="true" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    set('password', generatePassword());
                    setShowPassword(true);
                  }}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  aria-label="Generate a new password"
                >
                  <i className="ri-refresh-line" aria-hidden="true" />
                  <span className="hidden sm:inline">New</span>
                </button>
                {form.password && (
                  <button
                    type="button"
                    onClick={copyPassword}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    aria-label="Copy password"
                  >
                    <i className={copied ? 'ri-check-line text-green-600' : 'ri-file-copy-line'} aria-hidden="true" />
                    <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                )}
              </div>
            </Field>
          )}

          {existingCustomer !== undefined && (
            <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-semibold">
                {form.email} already has a customer account{existingCustomer ? ` (${existingCustomer})` : ''}.
              </p>
              <p className="mt-1">
                You can give that account {form.role} access instead. They keep their own password; the temporary password
                is not used.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={(e) => submit(e, true)}
                  disabled={saving}
                  className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
                >
                  {saving ? 'Giving access…' : 'Give this account access'}
                </button>
                <button
                  type="button"
                  onClick={() => setExistingCustomer(undefined)}
                  className="rounded-lg border border-amber-300 bg-white px-4 py-2 font-medium text-amber-900 hover:bg-amber-100"
                >
                  Use a different email
                </button>
              </div>
            </div>
          )}

          {form.role === 'staff' && (
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-gray-700">Screens they can open</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {(
                  [
                    { value: 'default', title: 'Staff default', text: `${countOn(defaults)} screens, set on Roles & access.` },
                    { value: 'custom', title: 'Choose for this person', text: 'Overrides the default for them only.' },
                  ] as const
                ).map((option) => {
                  const checked = form.screenMode === option.value;
                  return (
                    <label
                      key={option.value}
                      className={`flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-blue-500 ${
                        checked ? 'border-blue-700 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="screenMode"
                        value={option.value}
                        checked={checked}
                        onChange={() =>
                          onChange({
                            ...form,
                            screenMode: option.value,
                            screens: option.value === 'default' ? { ...defaults } : form.screens,
                          })
                        }
                        className="mt-1 h-4 w-4 accent-[#6B4F3A]"
                      />
                      <span>
                        <span className="block text-sm font-semibold text-gray-900">{option.title}</span>
                        <span className="block text-xs text-gray-500">{option.text}</span>
                      </span>
                    </label>
                  );
                })}
              </div>

              <div
                className={`mt-3 rounded-lg border ${errors.screens ? 'border-red-300' : 'border-gray-200'}`}
                aria-describedby={errors.screens ? 'm-screens-error' : undefined}
              >
                {groups.map(({ group, screens }) => (
                  <div key={group} className="border-b border-gray-100 last:border-b-0">
                    <p className="bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-500">{group}</p>
                    <ul>
                      {screens.map((screen) => {
                        const disabled = form.screenMode === 'default';
                        const id = `m-screen-${screen.key}`;
                        return (
                          <li key={screen.key}>
                            <label
                              htmlFor={id}
                              className={`flex items-start gap-3 px-3 py-2.5 ${disabled ? 'cursor-default' : 'cursor-pointer hover:bg-gray-50'}`}
                            >
                              <input
                                id={id}
                                type="checkbox"
                                checked={form.screens[screen.key] === true}
                                disabled={disabled}
                                onChange={(e) => {
                                  onChange({ ...form, screens: { ...form.screens, [screen.key]: e.target.checked } });
                                  setErrors((er) => ({ ...er, screens: undefined }));
                                }}
                                className="mt-0.5 h-4 w-4 shrink-0 accent-[#6B4F3A]"
                              />
                              <span className="min-w-0">
                                <span className={`block text-sm font-medium ${disabled ? 'text-gray-500' : 'text-gray-900'}`}>
                                  {screen.title}
                                </span>
                                <span className="block text-xs text-gray-500">{screen.description}</span>
                              </span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
              {errors.screens && (
                <p id="m-screens-error" className="mt-1.5 text-sm text-red-600">
                  {errors.screens}
                </p>
              )}
            </fieldset>
          )}
        </div>

        <div className="border-t border-gray-200 px-5 py-4 sm:px-6">
          {formError && (
            <p role="alert" className="mb-3 flex items-start gap-2 text-sm text-red-600">
              <i className="ri-error-warning-line mt-0.5" aria-hidden="true" /> {formError}
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || existingCustomer !== undefined}
              className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-50"
            >
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Add to team'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

/** Like adminFetch, but hands back the error body so field errors and codes reach the form. */
async function fetchWithErrors(method: 'POST' | 'PATCH', body: Record<string, unknown>) {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const res = await fetch('/api/admin/staff', {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      credentials: 'include',
      cache: 'no-store',
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok && !data.error) data.error = `Request failed (${res.status})`;
    return { ok: res.ok, data };
  } catch {
    return { ok: false, data: { error: 'Could not reach the server. Check the connection and try again.' } };
  }
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-red-600">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-gray-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
