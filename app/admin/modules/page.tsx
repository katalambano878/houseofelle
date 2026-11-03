'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface Module {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  enabled: boolean;
  category: string;
}

// Only colours that exist in the store palette (tailwind.config.js).
const colorMap: Record<string, string> = {
  red: 'bg-red-100 text-red-600',
  blue: 'bg-blue-100 text-blue-700',
  gold: 'bg-blue-50 text-blue-600',
  green: 'bg-green-100 text-green-700',
  amber: 'bg-amber-100 text-amber-700',
  yellow: 'bg-yellow-100 text-yellow-700',
  gray: 'bg-gray-100 text-gray-600'
};

/** Only modules that gate a real admin page. The sidebar hides those pages while a module is off. */
const MODULE_DEFINITIONS: Omit<Module, 'enabled'>[] = [
  {
    id: 'notifications',
    name: 'Marketing Notifications',
    description: 'Adds the Notifications page for email and SMS campaigns to customers',
    icon: 'ri-notification-3-line',
    color: 'red',
    category: 'Marketing'
  },
  {
    id: 'blog',
    name: 'Blog Management',
    description: 'Adds the Blog page for writing posts. Published posts show on the shop blog either way.',
    icon: 'ri-article-line',
    color: 'green',
    category: 'Marketing'
  },
  {
    id: 'customer-insights',
    name: 'Customer Insights',
    description: 'Adds the Customer Insights page: segments, lifetime value and at-risk customers',
    icon: 'ri-user-search-line',
    color: 'gold',
    category: 'Analytics'
  }
];

/** Tells the admin layout to re-read module states so the sidebar updates without a reload. */
const MODULES_CHANGED_EVENT = 'store-modules-changed';

export default function ModulesPage() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState('');
  const [modules, setModules] = useState<Module[]>(MODULE_DEFINITIONS.map((m) => ({ ...m, enabled: false })));

  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');

  useEffect(() => {
    fetchModuleStates();
  }, []);

  const fetchModuleStates = async () => {
    setLoading(true);
    setLoadError('');
    const { data: { session } } = await supabase.auth.getSession();
    const [modulesRes, profileRes] = await Promise.all([
      supabase.from('store_modules').select('id, enabled'),
      session
        ? supabase.from('profiles').select('role').eq('id', session.user.id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    // Only admins may change modules (the API enforces this too).
    setIsAdmin((profileRes.data as any)?.role === 'admin');

    if (modulesRes.error) {
      setLoadError(modulesRes.error.message || 'Could not load modules.');
    } else {
      const rows = modulesRes.data || [];
      setModules(MODULE_DEFINITIONS.map((m) => ({
        ...m,
        enabled: !!rows.find((d: any) => d.id === m.id)?.enabled,
      })));
    }
    setLoading(false);
  };

  const toggleModule = async (id: string, currentState: boolean) => {
    if (!isAdmin || savingId) return;
    const newState = !currentState;
    setSaveError('');
    setSavingId(id);
    setModules((prev) => prev.map((m) => (m.id === id ? { ...m, enabled: newState } : m)));

    const { error } = await supabase
      .from('store_modules')
      .upsert({ id, enabled: newState, updated_at: new Date().toISOString() });

    setSavingId(null);
    if (error) {
      // Roll back the optimistic change.
      setModules((prev) => prev.map((m) => (m.id === id ? { ...m, enabled: currentState } : m)));
      setSaveError(`Could not update the module: ${error.message}`);
      return;
    }
    window.dispatchEvent(new Event(MODULES_CHANGED_EVENT));
  };

  const categories = ['all', ...Array.from(new Set(modules.map(m => m.category)))];

  const filteredModules = modules.filter(module => {
    const matchesSearch = module.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      module.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'all' || module.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const groupedModules = filteredModules.reduce((acc, module) => {
    if (!acc[module.category]) {
      acc[module.category] = [];
    }
    acc[module.category].push(module);
    return acc;
  }, {} as Record<string, typeof modules>);

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Modules & Features</h1>
        <p className="text-gray-600 mb-8">Turn optional admin pages on or off. A page that is off is hidden from the admin menu.</p>

        {!loading && !isAdmin && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Only the store owner can turn modules on or off. You can see their current state below.
          </div>
        )}
        {saveError && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{saveError}</div>
        )}
        {loadError && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-center justify-between gap-4">
            <span>{loadError}</span>
            <button onClick={fetchModuleStates} className="font-semibold underline">Try again</button>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
              <input
                type="search"
                aria-label="Search modules"
                placeholder="Search modules..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <select
              aria-label="Filter by category"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="p-2 border border-gray-300 rounded-lg outline-none"
            >
              {categories.map(c => <option key={c} value={c}>{c === 'all' ? 'All Categories' : c}</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading modules...</div>
        ) : filteredModules.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No modules match your search.</div>
        ) : (
          <div className="space-y-10">
            {Object.entries(groupedModules).map(([category, items]) => (
              <div key={category}>
                <h2 className="text-xl font-bold text-gray-800 mb-4 border-l-4 border-blue-700 pl-3">{category}</h2>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {items.map(module => (
                    <div key={module.id} className={`bg-white rounded-xl border-2 p-6 transition-all ${module.enabled ? 'border-blue-500 shadow-md' : 'border-gray-200'}`}>
                      <div className="flex justify-between items-start mb-4">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${colorMap[module.color] || 'bg-gray-100 text-gray-600'}`}>
                          <i className={`${module.icon} text-2xl`}></i>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={module.enabled}
                          aria-label={`${module.enabled ? 'Disable' : 'Enable'} ${module.name}`}
                          onClick={() => toggleModule(module.id, module.enabled)}
                          disabled={!isAdmin || savingId === module.id}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${module.enabled ? 'bg-blue-700' : 'bg-gray-300'}`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${module.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                      </div>
                      <h3 className="text-lg font-bold text-gray-900">{module.name}</h3>
                      <p className="text-sm text-gray-500 mt-1">{module.description}</p>
                      <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center">
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${module.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                          {module.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
