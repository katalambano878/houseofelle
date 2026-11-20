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
  'w-full h-[52px] px-4 rounded-[14px] bg-white text-[16px] text-[#1F1115] placeholder:text-[#8A7479] outline-none shadow-[inset_0_0_0_1px_rgba(31,17,21,0.16)] focus:shadow-[inset_0_0_0_1.5px_#2B0B12] transition-shadow motion-reduce:transition-none';
const labelClass = 'block text-[14px] font-semibold mb-2';
const optional = <span className="font-normal text-[#6B565B]">(optional)</span>;
const outlineBtn =
  'inline-flex items-center justify-center gap-2 min-h-[44px] px-5 rounded-full shadow-[inset_0_0_0_1px_rgba(31,17,21,0.22)] text-[14px] font-semibold hover:bg-white transition-colors motion-reduce:transition-none disabled:opacity-50';

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
      <div className="flex items-center justify-center gap-2 py-16 text-[15px] text-[#6B565B]" role="status">
        <i className="ri-loader-4-line animate-spin motion-reduce:animate-none text-2xl text-[#2B0B12]" aria-hidden="true"></i>
        Loading addresses…
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="flex flex-col items-center gap-4 text-center py-16">
        <p className="text-[15px] text-[#6B565B]">Sign in to manage your saved addresses.</p>
        <a
          href="/auth/login?redirect=/account"
          className="inline-flex items-center min-h-[52px] px-7 rounded-full bg-[#2B0B12] text-[#F6EDE3] text-[15px] font-bold hover:bg-[#4A1520] transition-colors motion-reduce:transition-none"
        >
          Sign in
        </a>
      </div>
    );
  }

  const fieldError = (key: keyof AddressForm) =>
    formErrors[key] ? <p className="mt-1.5 text-[13px] text-[#7A1F2E]">{formErrors[key]}</p> : null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="font-serif text-[28px] md:text-[30px] leading-none">Addresses</h2>
        {!showForm && (
          <button
            type="button"
            onClick={openNew}
            className="inline-flex items-center gap-2 min-h-[48px] px-5 rounded-full bg-[#2B0B12] text-[#F6EDE3] text-[14px] font-bold hover:bg-[#4A1520] transition-colors motion-reduce:transition-none"
          >
            <i className="ri-add-line text-lg" aria-hidden="true"></i>
            Add an address
          </button>
        )}
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-2xl bg-[#F6DCD7] text-[#7A1F2E] px-4 py-3 text-sm">
          <i className="ri-error-warning-line text-base leading-5" aria-hidden="true"></i>
          <span>{error}</span>
        </div>
      )}

      {showForm && (
        <div className="p-6 md:p-8 rounded-[24px] bg-[#FBF6EF] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.1)]">
          <h3 className="font-serif text-[24px] leading-none mb-5">
            {editingId ? 'Edit address' : 'New address'}
          </h3>
          <form onSubmit={handleSubmit} noValidate className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="addr-name" className={labelClass}>Full name</label>
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
              <label htmlFor="addr-phone" className={labelClass}>Phone number</label>
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
              <label htmlFor="addr-line1" className={labelClass}>Street address or landmark</label>
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
              <label htmlFor="addr-line2" className={labelClass}>
                Address line 2 {optional}
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
              <label htmlFor="addr-city" className={labelClass}>City or town</label>
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
              <label htmlFor="addr-region" className={labelClass}>Region</label>
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
              <label htmlFor="addr-postal" className={labelClass}>
                Postal code {optional}
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
              <label htmlFor="addr-country" className={labelClass}>Country</label>
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
              <label htmlFor="addr-label" className={labelClass}>
                Label {optional}
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
              <label className="inline-flex items-center gap-3 min-h-[44px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_default}
                  onChange={(e) => update('is_default', e.target.checked)}
                  className="w-5 h-5 rounded accent-[#2B0B12]"
                />
                <span className="text-[14px] text-[#4D3A3F]">Make this my default address</span>
              </label>
            </div>
            <div className="md:col-span-2 flex flex-wrap gap-3 pt-1">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center min-h-[52px] px-7 rounded-full bg-[#2B0B12] text-[#F6EDE3] text-[15px] font-bold hover:bg-[#4A1520] transition-colors motion-reduce:transition-none disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving…' : 'Save address'}
              </button>
              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className={`${outlineBtn} min-h-[52px] px-7`}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {addresses.length === 0 && !showForm ? (
        <div className="flex flex-col items-center text-center gap-2 px-6 py-14 rounded-[24px] bg-[#FBF6EF] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.1)]">
          <span className="w-14 h-14 mb-2 rounded-full bg-[#F1E8DC] text-[#7A1F2E] inline-flex items-center justify-center">
            <i className="ri-map-pin-line text-2xl" aria-hidden="true"></i>
          </span>
          <p className="text-[15px] font-semibold">You have no saved addresses yet.</p>
          <p className="text-[14px] text-[#6B565B]">Save a delivery address to check out faster.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {addresses.map((address) => (
            <li
              key={address.id}
              className={`flex flex-col gap-5 p-6 rounded-[22px] bg-[#FBF6EF] ${address.is_default ? 'shadow-[inset_0_0_0_1.5px_#2B0B12]' : 'shadow-[inset_0_0_0_1px_rgba(31,17,21,0.1)]'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-0.5 min-w-0">
                  {address.label && <span className="text-[13px] font-semibold text-[#7A1F2E]">{address.label}</span>}
                  <h3 className="font-serif text-[22px] leading-tight">{address.full_name}</h3>
                  <span className="text-[14px] text-[#6B565B] tabular-nums">{address.phone}</span>
                </div>
                {address.is_default && (
                  <span className="flex-none inline-flex items-center h-7 px-3 rounded-full bg-[#2B0B12] text-[#F6EDE3] text-[13px] font-semibold">
                    Default
                  </span>
                )}
              </div>

              <address className="not-italic text-[15px] leading-relaxed text-[#4D3A3F]">
                {address.address_line1}
                {address.address_line2 && <><br />{address.address_line2}</>}
                <br />
                {address.city}, {address.state}
                {address.postal_code ? ` ${address.postal_code}` : ''}
                <br />
                {address.country}
              </address>

              <div className="flex flex-wrap gap-2 mt-auto">
                <button
                  type="button"
                  onClick={() => openEdit(address)}
                  disabled={busyId === address.id}
                  className={outlineBtn}
                >
                  Edit
                </button>
                {!address.is_default && (
                  <button
                    type="button"
                    onClick={() => setDefault(address)}
                    disabled={busyId === address.id}
                    className={outlineBtn}
                  >
                    Make default
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => deleteAddress(address)}
                  disabled={busyId === address.id}
                  aria-label={`Delete address for ${address.full_name}`}
                  className="inline-flex items-center justify-center w-11 h-11 rounded-full text-[#7A1F2E] shadow-[inset_0_0_0_1px_rgba(122,31,46,0.35)] hover:bg-[#F6DCD7] transition-colors motion-reduce:transition-none disabled:opacity-50"
                >
                  <i className="ri-delete-bin-line text-lg" aria-hidden="true"></i>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
