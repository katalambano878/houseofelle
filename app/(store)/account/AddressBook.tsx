'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Address {
  id: string;
  user_id: string;
  label: string | null;
  full_name: string;
  phone: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  is_default: boolean | null;
}

interface AddressForm {
  label: string;
  full_name: string;
  phone: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  is_default: boolean;
}

const EMPTY_FORM: AddressForm = {
  label: '',
  full_name: '',
  phone: '',
  address_line1: '',
  address_line2: '',
  city: '',
  state: '',
  postal_code: '',
  country: 'Ghana',
  is_default: false,
};

type FormErrors = Partial<Record<keyof AddressForm, string>>;

const inputClass =
  'w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-700 focus:border-transparent';

function validate(form: AddressForm): FormErrors {
  const errors: FormErrors = {};
  if (!form.full_name.trim()) errors.full_name = 'Enter the recipient name';
  const digits = form.phone.replace(/\D/g, '');
  if (!form.phone.trim()) errors.phone = 'Enter a phone number';
  else if (digits.length < 9 || digits.length > 15) errors.phone = 'Enter a valid phone number';
  if (!form.address_line1.trim()) errors.address_line1 = 'Enter the street address or landmark';
  if (!form.city.trim()) errors.city = 'Enter the city or town';
  if (!form.state.trim()) errors.state = 'Enter the region';
  if (!form.country.trim()) errors.country = 'Enter the country';
  return errors;
}

export default function AddressBook() {
  const [userId, setUserId] = useState<string | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AddressForm>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadAddresses = useCallback(async (uid: string) => {
    const { data, error: loadError } = await supabase
      .from('addresses')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false });
    if (loadError) {
      setError('We could not load your addresses. Please refresh and try again.');
    } else {
      const rows = (data as Address[]) || [];
      // Default address first.
      rows.sort((a, b) => Number(!!b.is_default) - Number(!!a.is_default));
      setAddresses(rows);
      setError('');
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!active) return;
      const uid = session?.user?.id ?? null;
      setUserId(uid);
      if (uid) await loadAddresses(uid);
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [loadAddresses]);

  const openNew = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, is_default: addresses.length === 0 });
    setFormErrors({});
    setShowForm(true);
  };

  const openEdit = (address: Address) => {
    setEditingId(address.id);
    setForm({
      label: address.label || '',
      full_name: address.full_name || '',
      phone: address.phone || '',
      address_line1: address.address_line1 || '',
      address_line2: address.address_line2 || '',
      city: address.city || '',
      state: address.state || '',
      postal_code: address.postal_code || '',
      country: address.country || 'Ghana',
      is_default: !!address.is_default,
    });
    setFormErrors({});
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
  };

  const update = <K extends keyof AddressForm>(key: K, value: AddressForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (formErrors[key]) setFormErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const clearOtherDefaults = async (uid: string, keepId?: string) => {
    let q = supabase.from('addresses').update({ is_default: false }).eq('user_id', uid).eq('is_default', true);
    if (keepId) q = q.neq('id', keepId);
    const { error: clearError } = await q;
    if (clearError) throw clearError;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    const errors = validate(form);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSaving(true);
    setError('');
    const row = {
      label: form.label.trim() || null,
      full_name: form.full_name.trim(),
      phone: form.phone.trim(),
      address_line1: form.address_line1.trim(),
      address_line2: form.address_line2.trim() || null,
      city: form.city.trim(),
      state: form.state.trim(),
      postal_code: form.postal_code.trim(),
      country: form.country.trim() || 'Ghana',
      is_default: form.is_default,
    };

    try {
      if (form.is_default) await clearOtherDefaults(userId, editingId || undefined);
      if (editingId) {
        const { error: updateError } = await supabase
          .from('addresses')
          .update(row)
          .eq('id', editingId)
          .eq('user_id', userId);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('addresses')
          .insert({ ...row, user_id: userId, type: 'shipping' });
        if (insertError) throw insertError;
      }
      await loadAddresses(userId);
      closeForm();
    } catch {
      setError('We could not save this address. Please check the details and try again.');
    } finally {
      setSaving(false);
    }
  };

  const deleteAddress = async (address: Address) => {
    if (!userId) return;
    if (!window.confirm(`Delete the address for ${address.full_name}?`)) return;
    setBusyId(address.id);
    setError('');
    const { error: deleteError } = await supabase
      .from('addresses')
      .delete()
      .eq('id', address.id)
      .eq('user_id', userId);
    if (deleteError) {
      setError('We could not delete this address. Please try again.');
    } else {
      setAddresses((prev) => prev.filter((a) => a.id !== address.id));
      if (editingId === address.id) closeForm();
    }
    setBusyId(null);
  };

  const setDefault = async (address: Address) => {
    if (!userId) return;
    setBusyId(address.id);
    setError('');
    try {
      await clearOtherDefaults(userId, address.id);
      const { error: defaultError } = await supabase
        .from('addresses')
        .update({ is_default: true })
        .eq('id', address.id)
        .eq('user_id', userId);
      if (defaultError) throw defaultError;
      await loadAddresses(userId);
    } catch {
      setError('We could not change your default address. Please try again.');
    }
    setBusyId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-500">
        <i className="ri-loader-4-line animate-spin text-2xl mr-2"></i>
        Loading addresses…
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-600 mb-4">Sign in to manage your saved addresses.</p>
        <a
          href="/auth/login?redirect=/account"
          className="inline-block px-6 py-3 bg-blue-700 text-white rounded-lg font-semibold hover:bg-blue-800 transition-colors"
        >
          Sign In
        </a>
      </div>
    );
  }

  const fieldError = (key: keyof AddressForm) =>
    formErrors[key] ? <p className="mt-1 text-sm text-red-600">{formErrors[key]}</p> : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4">
        <h2 className="text-2xl font-bold text-gray-900">Address Book</h2>
        {!showForm && (
          <button
            onClick={openNew}
            className="px-4 py-2 bg-blue-700 text-white rounded-lg font-semibold hover:bg-blue-800 transition-colors whitespace-nowrap"
          >
            <i className="ri-add-line mr-2"></i>
            Add New Address
          </button>
        )}
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start">
          <i className="ri-error-warning-line mr-2 mt-0.5"></i>
          <span>{error}</span>
        </div>
      )}

      {showForm && (
        <div className="bg-white border-2 border-blue-700 rounded-lg p-6 mb-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">
            {editingId ? 'Edit Address' : 'New Address'}
          </h3>
          <form onSubmit={handleSubmit} noValidate className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="addr-name" className="block text-sm font-semibold text-gray-900 mb-2">Full Name</label>
              <input
                id="addr-name"
                type="text"
                value={form.full_name}
                onChange={(e) => update('full_name', e.target.value)}
                className={inputClass}
                placeholder="Recipient's full name"
                autoComplete="name"
              />
              {fieldError('full_name')}
            </div>
            <div>
              <label htmlFor="addr-phone" className="block text-sm font-semibold text-gray-900 mb-2">Phone Number</label>
              <input
                id="addr-phone"
                type="tel"
                value={form.phone}
                onChange={(e) => update('phone', e.target.value)}
                className={inputClass}
                placeholder="+233 24 123 4567"
                autoComplete="tel"
              />
              {fieldError('phone')}
            </div>
            <div className="md:col-span-2">
              <label htmlFor="addr-line1" className="block text-sm font-semibold text-gray-900 mb-2">Street Address / Landmark</label>
              <input
                id="addr-line1"
                type="text"
                value={form.address_line1}
                onChange={(e) => update('address_line1', e.target.value)}
                className={inputClass}
                placeholder="House number, street name or nearest landmark"
                autoComplete="address-line1"
              />
              {fieldError('address_line1')}
            </div>
            <div className="md:col-span-2">
              <label htmlFor="addr-line2" className="block text-sm font-semibold text-gray-900 mb-2">
                Address Line 2 <span className="font-normal text-gray-500">(optional)</span>
              </label>
              <input
                id="addr-line2"
                type="text"
                value={form.address_line2}
                onChange={(e) => update('address_line2', e.target.value)}
                className={inputClass}
                placeholder="Apartment, area or GPS address"
                autoComplete="address-line2"
              />
            </div>
            <div>
              <label htmlFor="addr-city" className="block text-sm font-semibold text-gray-900 mb-2">City / Town</label>
              <input
                id="addr-city"
                type="text"
                value={form.city}
                onChange={(e) => update('city', e.target.value)}
                className={inputClass}
                placeholder="Accra"
                autoComplete="address-level2"
              />
              {fieldError('city')}
            </div>
            <div>
              <label htmlFor="addr-region" className="block text-sm font-semibold text-gray-900 mb-2">Region</label>
              <input
                id="addr-region"
                type="text"
                value={form.state}
                onChange={(e) => update('state', e.target.value)}
                className={inputClass}
                placeholder="Greater Accra"
                autoComplete="address-level1"
              />
              {fieldError('state')}
            </div>
            <div>
              <label htmlFor="addr-postal" className="block text-sm font-semibold text-gray-900 mb-2">
                Postal Code <span className="font-normal text-gray-500">(optional)</span>
              </label>
              <input
                id="addr-postal"
                type="text"
                value={form.postal_code}
                onChange={(e) => update('postal_code', e.target.value)}
                className={inputClass}
                autoComplete="postal-code"
              />
            </div>
            <div>
              <label htmlFor="addr-country" className="block text-sm font-semibold text-gray-900 mb-2">Country</label>
              <input
                id="addr-country"
                type="text"
                value={form.country}
                onChange={(e) => update('country', e.target.value)}
                className={inputClass}
                placeholder="Ghana"
                autoComplete="country-name"
              />
              {fieldError('country')}
            </div>
            <div>
              <label htmlFor="addr-label" className="block text-sm font-semibold text-gray-900 mb-2">
                Label <span className="font-normal text-gray-500">(optional)</span>
              </label>
              <input
                id="addr-label"
                type="text"
                value={form.label}
                onChange={(e) => update('label', e.target.value)}
                className={inputClass}
                placeholder="Home, Office…"
              />
            </div>
            <div className="md:col-span-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={form.is_default}
                  onChange={(e) => update('is_default', e.target.checked)}
                  className="w-4 h-4 text-blue-700 border-gray-300 rounded focus:ring-blue-700"
                />
                <span className="ml-2 text-sm text-gray-700">Set as default address</span>
              </label>
            </div>
            <div className="md:col-span-2 flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-3 bg-blue-700 text-white rounded-lg font-semibold hover:bg-blue-800 transition-colors whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving…' : 'Save Address'}
              </button>
              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="flex-1 py-3 border-2 border-gray-300 text-gray-900 rounded-lg font-semibold hover:bg-gray-50 transition-colors whitespace-nowrap"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {addresses.length === 0 && !showForm ? (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-lg">
          <i className="ri-map-pin-line text-4xl text-gray-300"></i>
          <p className="mt-3 text-gray-600">You have no saved addresses yet.</p>
          <p className="text-sm text-gray-500">Save a delivery address to check out faster.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {addresses.map((address) => (
            <div
              key={address.id}
              className={`bg-white border-2 rounded-lg p-6 relative ${address.is_default ? 'border-blue-700' : 'border-gray-200'}`}
            >
              {address.is_default && (
                <div className="absolute top-4 right-4">
                  <span className="px-3 py-1 bg-blue-700 text-white text-xs font-semibold rounded-full whitespace-nowrap">
                    Default
                  </span>
                </div>
              )}

              <div className="mb-4 pr-20">
                {address.label && (
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">{address.label}</p>
                )}
                <h3 className="text-lg font-bold text-gray-900">{address.full_name}</h3>
                <p className="text-gray-600">{address.phone}</p>
              </div>

              <div className="text-gray-700 space-y-1 mb-6">
                <p>{address.address_line1}</p>
                {address.address_line2 && <p>{address.address_line2}</p>}
                <p>
                  {address.city}, {address.state}
                  {address.postal_code ? ` ${address.postal_code}` : ''}
                </p>
                <p>{address.country}</p>
              </div>

              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                <button
                  onClick={() => openEdit(address)}
                  disabled={busyId === address.id}
                  className="flex-1 py-2 border border-gray-300 text-gray-900 rounded-lg font-semibold hover:bg-gray-50 transition-colors whitespace-nowrap"
                >
                  Edit
                </button>
                {!address.is_default && (
                  <button
                    onClick={() => setDefault(address)}
                    disabled={busyId === address.id}
                    className="flex-1 py-2 border border-blue-700 text-blue-700 rounded-lg font-semibold hover:bg-blue-50 transition-colors whitespace-nowrap disabled:opacity-60"
                  >
                    Set Default
                  </button>
                )}
                <button
                  onClick={() => deleteAddress(address)}
                  disabled={busyId === address.id}
                  aria-label={`Delete address for ${address.full_name}`}
                  className="px-4 py-2 border border-red-600 text-red-600 rounded-lg font-semibold hover:bg-red-50 transition-colors whitespace-nowrap disabled:opacity-60"
                >
                  <i className="ri-delete-bin-line"></i>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
