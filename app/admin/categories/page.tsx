'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function AdminCategoriesPage() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('all');

  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [productCounts, setProductCounts] = useState<Record<string, number>>({});

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    image_url: '',
    parent_id: '' as string | null,
    featured: false,
    status: 'active'
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      setLoadError('');
      const [{ data, error }, { data: productRows }] = await Promise.all([
        supabase.from('categories').select('*').order('created_at', { ascending: false }),
        supabase.from('products').select('category_id'),
      ]);

      if (error) throw error;
      if (data) setCategories(data);
      const counts: Record<string, number> = {};
      (productRows || []).forEach((p: any) => {
        if (p.category_id) counts[p.category_id] = (counts[p.category_id] || 0) + 1;
      });
      setProductCounts(counts);
    } catch (err: any) {
      console.error('Error fetching categories:', err);
      setLoadError(err?.message || 'Could not load categories.');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (category: any) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      slug: category.slug,
      description: category.description || '',
      image_url: category.image_url || '',
      parent_id: category.parent_id || '',
      featured: category.metadata?.featured || false,
      status: category.status
    });
    setShowEditModal(true);
  };

  const handleDelete = async (categoryId: string) => {
    const children = categories.filter((c) => c.parent_id === categoryId);
    if (children.length > 0) {
      alert(
        `This category has ${children.length} sub-categor${children.length > 1 ? 'ies' : 'y'} (${children.map((c) => c.name).join(', ')}). ` +
        'Move or delete those first, then delete this category.'
      );
      return;
    }
    const inUse = productCounts[categoryId] || 0;
    if (!confirm(
      inUse > 0
        ? `Delete this category? Its ${inUse} product${inUse === 1 ? '' : 's'} will be left without a category.`
        : 'Delete this category?'
    )) return;
    try {
      // products.category_id has no ON DELETE action, so products must be unlinked before the
      // category row can go. Remember which ones we unlinked so we can put them back if the delete fails.
      const { data: linked, error: linkedError } = await supabase
        .from('products')
        .select('id')
        .eq('category_id', categoryId);
      if (linkedError) throw linkedError;
      const productIds = (linked || []).map((p: any) => p.id);

      if (productIds.length > 0) {
        const { error: unlinkError } = await supabase.from('products').update({ category_id: null }).in('id', productIds);
        if (unlinkError) throw unlinkError;
      }

      const { error } = await supabase.from('categories').delete().eq('id', categoryId);
      if (error) {
        if (productIds.length > 0) {
          const { error: relinkError } = await supabase.from('products').update({ category_id: categoryId }).in('id', productIds);
          if (relinkError) {
            throw new Error(`${error.message}. Also could not restore ${productIds.length} product(s) to this category: ${relinkError.message}`);
          }
        }
        throw error;
      }
      setCategories(categories.filter((c) => c.id !== categoryId));
      setProductCounts((prev) => ({ ...prev, [categoryId]: 0 }));
      alert('Category deleted successfully');
    } catch (err: any) {
      alert('Error deleting: ' + (err?.message ?? 'Please try again.'));
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    try {
      if (!input.files || input.files.length === 0) return;

      const file = input.files[0];
      const fileExt = (file.name.split('.').pop() || '').toLowerCase();
      const allowedExts = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'];
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
      if (!allowedExts.includes(fileExt) || (file.type && !allowedTypes.includes(file.type))) {
        alert('Please choose a JPG, PNG, WebP, GIF or AVIF image.');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        alert(`This image is ${(file.size / 1024 / 1024).toFixed(1)} MB. The maximum is 10 MB.`);
        return;
      }

      setUploading(true);
      const randomPart = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      const filePath = `cat-${randomPart}.${fileExt}`;

      // Upload to 'products' bucket for simplicity, or create a 'categories' bucket
      const { error: uploadError } = await supabase.storage
        .from('products')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('products')
        .getPublicUrl(filePath);

      setFormData({ ...formData, image_url: publicUrl });

    } catch (error: any) {
      alert('Error uploading image: ' + (error?.message || 'Please try again.'));
    } finally {
      setUploading(false);
      input.value = '';
    }
  };

  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.slug.trim()) {
      alert('Name and Slug are required');
      return;
    }
    const slugTaken = categories.some((c) => c.slug === formData.slug.trim() && c.id !== editingCategory?.id);
    if (slugTaken) {
      alert('Another category already uses this URL slug. Please choose a different one.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: formData.name.trim(),
        slug: formData.slug.trim(),
        description: formData.description,
        image_url: formData.image_url || null,
        parent_id: formData.parent_id || null, // Handle empty string as null
        status: formData.status,
        // Keep any other settings stored on the category.
        metadata: {
          ...(showEditModal && editingCategory?.metadata ? editingCategory.metadata : {}),
          featured: formData.featured
        }
      };

      if (showEditModal && editingCategory) {
        const { error } = await supabase
          .from('categories')
          .update(payload)
          .eq('id', editingCategory.id);
        if (error) throw error;
        alert('Category updated');
      } else {
        const { error } = await supabase
          .from('categories')
          .insert([payload]);
        if (error) throw error;
        alert('Category created');
      }

      setShowAddModal(false);
      setShowEditModal(false);
      setEditingCategory(null);
      setFormData({ name: '', slug: '', description: '', image_url: '', parent_id: '', featured: false, status: 'active' });
      fetchCategories();

    } catch (err: any) {
      console.error(err);
      alert('Error saving category: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  /** True when `id` is `rootId` or sits somewhere beneath it. */
  const isSelfOrDescendant = (id: string, rootId: string): boolean => {
    let current: any = categories.find((c) => c.id === id);
    const seen = new Set<string>();
    while (current && !seen.has(current.id)) {
      if (current.id === rootId) return true;
      seen.add(current.id);
      current = categories.find((c) => c.id === current.parent_id);
    }
    return false;
  };

  // Auto-generate slug
  useEffect(() => {
    if (showAddModal && formData.name && !editingCategory) {
      setFormData(prev => ({
        ...prev,
        slug: prev.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
      }));
    }
  }, [formData.name, showAddModal, editingCategory]);


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Categories</h1>
          <p className="text-gray-600 mt-1">Organize your products into categories</p>
        </div>
        <button
          onClick={() => {
            setEditingCategory(null);
            setFormData({ name: '', slug: '', description: '', image_url: '', parent_id: '', featured: false, status: 'active' });
            setShowAddModal(true);
          }}
          className="bg-blue-700 hover:bg-blue-800 text-white px-6 py-3 rounded-lg font-semibold transition-colors whitespace-nowrap cursor-pointer"
        >
          <i className="ri-add-line mr-2"></i>
          Add Category
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <p className="text-sm text-gray-600 mb-1">Total Categories</p>
          <p className="text-2xl font-bold text-gray-900">{categories.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <p className="text-sm text-gray-600 mb-1">Active</p>
          <p className="text-2xl font-bold text-blue-700">{categories.filter(c => c.status === 'active').length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <p className="text-sm text-gray-600 mb-1">Featured</p>
          <p className="text-2xl font-bold text-blue-700">{categories.filter(c => c.metadata?.featured).length}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Category</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Slug</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Parent</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Products</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Status</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Featured</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="p-8 text-center text-gray-500">Loading categories...</td></tr>
              ) : loadError ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-red-600">
                    <p className="mb-3">{loadError}</p>
                    <button onClick={fetchCategories} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50">Try again</button>
                  </td>
                </tr>
              ) : categories.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-gray-500">No categories yet. Add one to start organising products.</td></tr>
              ) : (
                categories.map((category) => (
                  <tr key={category.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-16 h-16 shrink-0 bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                          {category.image_url ? (
                            <img src={category.image_url} alt={category.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                              <i className="ri-image-line text-2xl"></i>
                            </div>
                          )}
                        </div>
                        <span className="font-semibold text-gray-900">{category.name}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-gray-700 text-sm font-mono">{category.slug}</td>
                    <td className="py-4 px-4 text-sm text-gray-600">
                      {categories.find(c => c.id === category.parent_id)?.name || '-'}
                    </td>
                    <td className="py-4 px-4 text-sm text-gray-700">{productCounts[category.id] || 0}</td>
                    <td className="py-4 px-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap capitalize ${category.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                        {category.status}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      {category.metadata?.featured ? (
                        <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold whitespace-nowrap">
                          Featured
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleEdit(category)}
                          aria-label={`Edit ${category.name}`}
                          title="Edit"
                          className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <i className="ri-edit-line text-lg w-4 h-4 flex items-center justify-center"></i>
                        </button>
                        <button
                          onClick={() => handleDelete(category.id)}
                          aria-label={`Delete ${category.name}`}
                          title="Delete"
                          className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <i className="ri-delete-bin-line text-lg w-4 h-4 flex items-center justify-center"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="category-modal-title" className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 id="category-modal-title" className="text-2xl font-bold text-gray-900">
                {showAddModal ? 'Add New Category' : 'Edit Category'}
              </h2>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setShowEditModal(false);
                  setEditingCategory(null);
                }}
                aria-label="Close"
                className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
              >
                <i className="ri-close-line text-2xl w-6 h-6 flex items-center justify-center"></i>
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="cat-name" className="block text-sm font-semibold text-gray-900 mb-2">
                    Category Name *
                  </label>
                  <input
                    id="cat-name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter category name"
                  />
                </div>

                <div>
                  <label htmlFor="cat-parent" className="block text-sm font-semibold text-gray-900 mb-2">
                    Parent Category (Optional)
                  </label>
                  <select
                    id="cat-parent"
                    value={formData.parent_id || ''}
                    onChange={(e) => setFormData({ ...formData, parent_id: e.target.value || null })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">None (Top Level)</option>
                    {categories
                      // A category cannot sit under itself or under one of its own sub-categories.
                      .filter(c => !editingCategory || !isSelfOrDescendant(c.id, editingCategory.id))
                      .map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))
                    }
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="cat-slug" className="block text-sm font-semibold text-gray-900 mb-2">
                  URL Slug *
                </label>
                <input
                  id="cat-slug"
                  type="text"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-') })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="category-url-slug"
                />
              </div>

              <div>
                <label htmlFor="cat-description" className="block text-sm font-semibold text-gray-900 mb-2">
                  Description
                </label>
                <textarea
                  id="cat-description"
                  rows={3}
                  maxLength={500}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  placeholder="Brief description of this category..."
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Category Image
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-700 hover:bg-blue-50 transition-colors relative">
                  {uploading ? (
                    <div className="flex flex-col items-center">
                      <i className="ri-loader-4-line animate-spin text-3xl mb-2 text-blue-700"></i>
                      <span className="text-sm font-medium text-gray-600">Uploading...</span>
                    </div>
                  ) : formData.image_url ? (
                    <div className="relative group">
                      <img src={formData.image_url} alt="Category" className="h-40 mx-auto object-contain rounded-lg shadow-sm" />
                      <div className="mt-3 flex items-center justify-center gap-2">
                        <label className="cursor-pointer bg-white border border-gray-300 px-4 py-2 rounded-lg font-semibold text-sm hover:bg-gray-100 focus-within:ring-2 focus-within:ring-blue-500">
                          Change Image
                          <input type="file" accept=".jpg,.jpeg,.png,.webp,.gif,.avif,image/jpeg,image/png,image/webp,image/gif,image/avif" className="sr-only" onChange={handleImageUpload} />
                        </label>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, image_url: '' })}
                          className="bg-white border border-red-200 text-red-600 px-4 py-2 rounded-lg font-semibold text-sm hover:bg-red-50"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="cursor-pointer block focus-within:ring-2 focus-within:ring-blue-500 rounded-lg">
                      <i className="ri-upload-cloud-line text-4xl text-gray-400 mb-2 w-10 h-10 flex items-center justify-center mx-auto"></i>
                      <p className="text-gray-700 font-medium">Click to upload image</p>
                      <p className="text-sm text-gray-500 mt-1">Square (1:1) Recommended (e.g., 800x800px)</p>
                      <input type="file" accept=".jpg,.jpeg,.png,.webp,.gif,.avif,image/jpeg,image/png,image/webp,image/gif,image/avif" className="sr-only" onChange={handleImageUpload} />
                    </label>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="cat-status" className="block text-sm font-semibold text-gray-900 mb-2">Status</label>
                  <select
                    id="cat-status"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div className="flex items-center space-x-3 mt-6">
                  <input
                    id="cat-featured"
                    type="checkbox"
                    checked={formData.featured}
                    onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
                    className="w-5 h-5 text-blue-700 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                  />
                  <label htmlFor="cat-featured" className="text-gray-900 font-medium cursor-pointer">
                    Feature on homepage
                  </label>
                </div>
              </div>

            </div>

            <div className="p-6 border-t border-gray-200 flex items-center justify-end space-x-3 bg-gray-50 rounded-b-2xl">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setShowEditModal(false);
                  setEditingCategory(null);
                }}
                disabled={saving}
                className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:border-gray-400 font-semibold transition-colors whitespace-nowrap cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving || uploading}
                className={`px-6 py-3 bg-blue-700 hover:bg-blue-800 text-white rounded-lg font-semibold transition-colors whitespace-nowrap cursor-pointer flex items-center ${saving ? 'opacity-70' : ''}`}
              >
                {saving && <i className="ri-loader-4-line animate-spin mr-2"></i>}
                {showAddModal ? 'Add Category' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
