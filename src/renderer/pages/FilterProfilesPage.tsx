import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { FilterProfile } from '../../types/filter-profile';
import StatusBadge from '../components/StatusBadge';
import InfoCard from '../components/InfoCard';
import ConfirmDialog from '../components/ConfirmDialog';

const FilterProfilesPage: React.FC = () => {
  const [profiles, setProfiles] = useState<FilterProfile[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingProfile, setEditingProfile] = useState<FilterProfile | null>(null);
  const [formData, setFormData] = useState<Partial<FilterProfile>>({
    name: '', enabled: true, priority: 1, agent: '',
    depositType: '', includeKeyword: '', excludeKeyword: '', description: ''
  });
  const [deleteTarget, setDeleteTarget] = useState<FilterProfile | null>(null);

  useEffect(() => { loadProfiles(); }, []);

  const loadProfiles = async () => {
    if (!window.electron) return;
    const result = await window.electron.getFilters();
    if (result.success) setProfiles(result.data);
  };

  const handleSave = async () => {
    if (!formData.name || formData.name.trim() === '') { toast.error('Name is required'); return; }
    try {
      if (editingProfile) {
        const result = await window.electron.updateFilter(editingProfile.id, formData);
        if (result.success) toast.success('Filter updated');
      } else {
        const result = await window.electron.createFilter(formData);
        if (result.success) toast.success('Filter created');
      }
      resetForm();
      loadProfiles();
    } catch (error: any) { toast.error(error.message); }
  };

  const performDelete = async () => {
    if (!deleteTarget) return;
    const result = await window.electron.deleteFilter(deleteTarget.id);
    if (result.success) {
      toast.success('Filter deleted');
      loadProfiles();
    }
    setDeleteTarget(null);
  };

  const handleEdit = (profile: FilterProfile) => {
    setEditingProfile(profile);
    setFormData(profile);
    setShowForm(true);
  };

  const handleToggle = async (profile: FilterProfile) => {
    await window.electron.updateFilter(profile.id, { enabled: !profile.enabled });
    loadProfiles();
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingProfile(null);
    setFormData({ name: '', enabled: true, priority: 1, agent: '', depositType: '', includeKeyword: '', excludeKeyword: '', description: '' });
  };

  const isFormValid = formData.name && formData.name.trim() !== '';

  return (
    <div className="space-y-5 max-w-5xl" data-testid="filter-profiles-page">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-semibold">Filter Profiles</h1>
          <p className="text-xs text-text-tertiary mt-0.5">{profiles.length} profile(s) — {profiles.filter(p => p.enabled).length} enabled</p>
        </div>
        <button
          data-testid="create-filter-btn"
          onClick={() => setShowForm(true)}
          className="h-9 px-4 text-sm bg-accent-primary text-white rounded hover:bg-blue-500"
        >
          + Create Filter
        </button>
      </div>

      {showForm && (
        <InfoCard title={editingProfile ? 'Edit Filter' : 'New Filter'} testId="filter-form">
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <div>
              <label className="block text-xs text-text-secondary mb-1">Name *</label>
              <input
                data-testid="filter-name-input"
                type="text"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full h-9 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">Priority</label>
              <input
                type="number"
                value={formData.priority || 1}
                onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                className="w-full h-9 text-sm"
                min={1}
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">Agent</label>
              <input
                type="text"
                value={formData.agent || ''}
                onChange={(e) => setFormData({ ...formData, agent: e.target.value })}
                className="w-full h-9 text-sm"
                placeholder="e.g. aaaacgoasis"
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">Deposit Type</label>
              <input
                type="text"
                value={formData.depositType || ''}
                onChange={(e) => setFormData({ ...formData, depositType: e.target.value })}
                className="w-full h-9 text-sm"
                placeholder="e.g. PGA"
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">Include Keyword</label>
              <input
                type="text"
                value={formData.includeKeyword || ''}
                onChange={(e) => setFormData({ ...formData, includeKeyword: e.target.value })}
                className="w-full h-9 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">Exclude Keyword</label>
              <input
                type="text"
                value={formData.excludeKeyword || ''}
                onChange={(e) => setFormData({ ...formData, excludeKeyword: e.target.value })}
                className="w-full h-9 text-sm"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-text-secondary mb-1">Description</label>
              <textarea
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full text-sm"
                rows={2}
              />
            </div>
            <div className="col-span-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={formData.enabled || false}
                  onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                />
                <span>Enabled</span>
              </label>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <button
              data-testid="save-filter-btn"
              onClick={handleSave}
              disabled={!isFormValid}
              className="h-9 px-4 text-sm bg-accent-primary text-white rounded hover:bg-blue-500 disabled:opacity-50"
            >
              Save
            </button>
            <button
              onClick={resetForm}
              className="h-9 px-4 text-sm bg-bg-tertiary text-text-primary rounded hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        </InfoCard>
      )}

      <section className="bg-bg-secondary rounded-md border border-border-color overflow-hidden">
        <table className="w-full" data-testid="filters-table">
          <thead>
            <tr className="border-b border-border-color text-xs uppercase tracking-wider text-text-secondary">
              <th className="text-left px-4 py-2.5">Priority</th>
              <th className="text-left px-4 py-2.5">Name</th>
              <th className="text-left px-4 py-2.5">Agent</th>
              <th className="text-left px-4 py-2.5">Deposit Type</th>
              <th className="text-left px-4 py-2.5">Status</th>
              <th className="text-right px-4 py-2.5">Actions</th>
            </tr>
          </thead>
          <tbody>
            {profiles.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-10 text-center text-text-tertiary">
                  <div className="text-sm">No filter profiles yet.</div>
                  <div className="text-xs mt-1">Click "Create Filter" to add your first profile.</div>
                </td>
              </tr>
            ) : (
              profiles
                .sort((a, b) => a.priority - b.priority)
                .map(profile => (
                  <tr key={profile.id} className="border-b border-border-color/50 hover:bg-bg-tertiary/40">
                    <td className="px-4 py-2.5 font-mono text-sm text-text-secondary">{profile.priority}</td>
                    <td className="px-4 py-2.5 font-medium text-sm">{profile.name}</td>
                    <td className="px-4 py-2.5 text-sm text-text-secondary">{profile.agent || '—'}</td>
                    <td className="px-4 py-2.5 text-sm text-text-secondary">{profile.depositType || '—'}</td>
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => handleToggle(profile)}
                        className="focus:outline-none"
                        title="Toggle enabled"
                      >
                        <StatusBadge
                          tone={profile.enabled ? 'success' : 'neutral'}
                          label={profile.enabled ? 'Enabled' : 'Disabled'}
                          size="sm"
                        />
                      </button>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex gap-3 justify-end text-xs">
                        <button
                          onClick={() => handleEdit(profile)}
                          className="text-accent-primary hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeleteTarget(profile)}
                          className="text-red-400 hover:underline"
                          data-testid={`delete-filter-${profile.id}`}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
            )}
          </tbody>
        </table>
      </section>

      <ConfirmDialog
        open={!!deleteTarget}
        title={`Delete filter "${deleteTarget?.name}"?`}
        description="This permanently removes the filter profile. Existing exported rows in SQLite and Google Sheets are not affected."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        tone="danger"
        onConfirm={performDelete}
        onCancel={() => setDeleteTarget(null)}
        testId="confirm-delete-filter"
      />
    </div>
  );
};

export default FilterProfilesPage;
