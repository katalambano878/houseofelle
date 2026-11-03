'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import { ADMIN_GROUPS, ADMIN_SCREENS, STAFF_GRANTABLE, type StaffPermissions } from '@/lib/admin-permissions';

type RolesData = {
  permissions: StaffPermissions;
  saved: boolean;
  staffCount: number;
  customCount: number;
};

const OWNER_ONLY = ADMIN_SCREENS.filter((s) => s.adminOnly);

function same(a: StaffPermissions | null, b: StaffPermissions | null) {
  if (!a || !b) return a === b;
  return STAFF_GRANTABLE.every((s) => Boolean(a[s.key]) === Boolean(b[s.key]));
}

export default function RolesPage() {
  const [data, setData] = useState<RolesData | null>(null);
  const [draft, setDraft] = useState<StaffPermissions | null>(null);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const result = await adminFetch<RolesData>('/api/admin/roles');
      setData(result);
      setDraft(result.permissions);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load staff access.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const groups = useMemo(
    () =>
      ADMIN_GROUPS.map((group) => ({ group, screens: STAFF_GRANTABLE.filter((s) => s.group === group) })).filter(
        (g) => g.screens.length > 0
      ),
    []
  );

  const dirty = Boolean(data && draft && !same(draft, data.permissions));
  const granted = draft ? STAFF_GRANTABLE.filter((s) => draft[s.key]).length : 0;
  const noneGranted = Boolean(draft) && granted === 0;

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  function toggle(key: string, on: boolean) {
    if (!draft) return;
    setNotice(null);
    setDraft({ ...draft, [key]: on });
  }

  function setGroup(keys: string[], on: boolean) {
    if (!draft) return;
    setNotice(null);
    const next = { ...draft };
    for (const key of keys) next[key] = on;
    setDraft(next);
  }

  async function save() {
    if (!draft || noneGranted) return;
    setSaving(true);
    setNotice(null);
    try {
      const result = await adminFetch<RolesData & { message: string }>('/api/admin/roles', {
        method: 'PUT',
        body: JSON.stringify({ permissions: draft }),
      });
      setData(result);
      setDraft(result.permissions);
      setNotice({ kind: 'ok', text: result.message });
    } catch (err) {
      setNotice({ kind: 'error', text: err instanceof Error ? err.message : 'Could not save.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`max-w-4xl space-y-6 ${dirty ? 'pb-28' : ''}`}>
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Roles &amp; access</h1>
        <p className="mt-1 text-gray-600">
          Choose the screens every staff member can open. To give one person a different list, edit them on{' '}
          <Link href="/admin/staff" className="font-medium text-blue-700 underline-offset-2 hover:underline">
            Staff
          </Link>
          .
        </p>
      </div>

      <div aria-live="polite">
        {notice && (
          <div
            role={notice.kind === 'error' ? 'alert' : 'status'}
            className={`flex items-start gap-2 rounded-lg border p-4 text-sm ${
              notice.kind === 'ok' ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-700'
            }`}
          >
            <i className={`${notice.kind === 'ok' ? 'ri-checkbox-circle-line' : 'ri-error-warning-line'} mt-0.5`} aria-hidden="true" />
            {notice.text}
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="flex items-center gap-2 font-semibold text-gray-900">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-700 text-white">
              <i className="ri-vip-crown-line" aria-hidden="true" />
            </span>
            Admin
          </p>
          <p className="mt-3 text-sm text-gray-600">
            Opens every screen, including the owner-only ones listed at the bottom. This cannot be limited.
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="flex items-center gap-2 font-semibold text-gray-900">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
              <i className="ri-user-line" aria-hidden="true" />
            </span>
            Staff
          </p>
          {data && draft ? (
            <p className="mt-3 text-sm text-gray-600">
              Opens <span className="font-semibold text-gray-900">{granted}</span> of {STAFF_GRANTABLE.length} screens.{' '}
              {data.staffCount === 0
                ? 'Nobody is on staff yet.'
                : `${data.staffCount - data.customCount} of ${data.staffCount} staff use this list${
                    data.customCount ? `; ${data.customCount} ${data.customCount === 1 ? 'has' : 'have'} their own` : ''
                  }.`}
            </p>
          ) : (
            <span className="mt-3 block h-4 w-48 animate-pulse rounded bg-gray-100" />
          )}
        </div>
      </div>

      {loadError ? (
        <div className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-2">
            <i className="ri-error-warning-line text-lg" aria-hidden="true" />
            {loadError}
          </span>
          <button
            type="button"
            onClick={load}
            className="self-start rounded-lg border border-red-300 bg-white px-4 py-2 font-semibold text-red-700 hover:bg-red-100 sm:self-auto"
          >
            Try again
          </button>
        </div>
      ) : !draft ? (
        <div className="space-y-4" aria-label="Loading">
          {[0, 1, 2].map((i) => (
            <div key={i} className="animate-pulse rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <span className="block h-3 w-24 rounded bg-gray-100" />
              <span className="mt-5 block h-4 w-2/3 rounded bg-gray-100" />
              <span className="mt-3 block h-4 w-1/2 rounded bg-gray-100" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {noneGranted && (
            <p role="alert" className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <i className="ri-error-warning-line mt-0.5" aria-hidden="true" />
              Staff need at least one screen. To stop someone signing in, remove them on the Staff page instead.
            </p>
          )}

          {groups.map(({ group, screens }) => {
            const keys = screens.map((s) => s.key);
            const allOn = keys.every((k) => draft[k]);
            const headingId = `group-${group}`;
            return (
              <section key={group} aria-labelledby={headingId} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 sm:px-5">
                  <h2 id={headingId} className="font-semibold text-gray-900">
                    {group}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setGroup(keys, !allOn)}
                    className="rounded-md px-2 py-1 text-sm font-medium text-blue-700 hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    {allOn ? 'Turn all off' : 'Turn all on'}
                  </button>
                </div>
                <ul className="divide-y divide-gray-100">
                  {screens.map((screen) => {
                    const on = draft[screen.key] === true;
                    const changed = data ? Boolean(data.permissions[screen.key]) !== on : false;
                    const labelId = `screen-${screen.key}`;
                    return (
                      <li key={screen.key} className="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5">
                        <div className="flex min-w-0 items-start gap-3">
                          <span
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
                              on ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-400'
                            }`}
                            aria-hidden="true"
                          >
                            <i className={screen.icon} />
                          </span>
                          <div className="min-w-0">
                            <p id={labelId} className="flex flex-wrap items-center gap-2 font-medium text-gray-900">
                              {screen.title}
                              {screen.moduleId && (
                                <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-500">
                                  Needs module on
                                </span>
                              )}
                              {changed && <span className="text-xs font-medium text-amber-700">Not saved</span>}
                            </p>
                            <p className="text-sm text-gray-500">{screen.description}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={on}
                          aria-labelledby={labelId}
                          onClick={() => toggle(screen.key, !on)}
                          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                            on ? 'bg-blue-700' : 'bg-gray-300'
                          }`}
                        >
                          <span
                            className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
                              on ? 'translate-x-5' : 'translate-x-0.5'
                            }`}
                          />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}

          <section aria-labelledby="owner-only" className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
            <div className="border-b border-gray-200 px-4 py-3 sm:px-5">
              <h2 id="owner-only" className="flex items-center gap-2 font-semibold text-gray-900">
                <i className="ri-lock-line text-gray-500" aria-hidden="true" /> Owner only
              </h2>
              <p className="mt-0.5 text-sm text-gray-500">Only admins can open these. They cannot be given to staff.</p>
            </div>
            <ul className="divide-y divide-gray-200">
              {OWNER_ONLY.map((screen) => (
                <li key={screen.key} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-gray-500" aria-hidden="true">
                    <i className={screen.icon} />
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-700">{screen.title}</p>
                    <p className="text-sm text-gray-500">{screen.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      {dirty && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] lg:left-64">
          <div className="mx-auto flex max-w-4xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-700">You have unsaved changes to staff access.</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setDraft(data?.permissions ?? null);
                  setNotice(null);
                }}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 sm:flex-none"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving || noneGranted}
                className="flex-1 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-50 sm:flex-none"
              >
                {saving ? 'Saving…' : 'Save access'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
