import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { FilterProfile } from '../../types/filter-profile';

const FilterProfilesPage: React.FC = () => {
  const [profiles, setProfiles] = useState<FilterProfile[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingProfile, setEditingProfile] = useState<FilterProfile | null>(null);
  const [formData, setFormData] = useState<Partial<FilterProfile>>({
    name: '',
    enabled: true,
    priority: 1,
    agent: '',
    depositType: '',
    includeKeyword: '',
    excludeKeyword: '',
    description: ''
  });
  
  useEffect(() => {
    loadProfiles();
  }, []);
  
  const loadProfiles = async () => {
    if (!window.electron) return;
    const result = await window.electron.getFilters();
    if (result.success) setProfiles(result.data);
  };
  
  const handleSave = async () => {
    if (!formData.name || formData.name.trim() === '') {
      toast.error('Name is required');
      return;
    }
    
    try {
      if (editingProfile) {
        const result = await window.electron.updateFilter(editingProfile.id, formData);
        if (result.success) {
          toast.success('Filter updated');
        }
      } else {
        const result = await window.electron.createFilter(formData);
        if (result.success) {
          toast.success('Filter created');
        }
      }
      
      resetForm();
      loadProfiles();
    } catch (error: any) {
      toast.error(error.message);
    }
  };
  
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete filter "${name}"?`)) return;
    
    const result = await window.electron.deleteFilter(id);
    if (result.success) {
      toast.success('Filter deleted');
      loadProfiles();
    }
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
    setFormData({
      name: '', enabled: true, priority: 1, agent: '',
      depositType: '', includeKeyword: '', excludeKeyword: '', description: ''
    });
  };
  
  const isFormValid = formData.name && formData.name.trim() !== '';
  
  return (
    <div className="space-y-6" data-testid="filter-profiles-page">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Filter Profiles</h1>
        <button
          data-testid="create-filter-btn"
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-accent-primary text-white rounded hover:bg-blue-600"
        >
          + Create Filter
        </button>
      </div>
      
      {showForm && (
        <section className="bg-bg-secondary rounded-lg p-6 border border-border-color">
          <h2 className="text-lg font-semibold mb-4">
            {editingProfile ? 'Edit Filter' : 'New Filter'}
          </h2>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1">Name *</label>
              <input
                data-testid="filter-name-input"
                type="text"
                value={formData.name || ''}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">Priority</label>
              <input
                type="number"
                value={formData.priority || 1}
                onChange={(e) => setFormData({...formData, priority: parseInt(e.target.value)})}
                className="w-full"
                min={1}
              />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">Agent</label>
              <input
                type="text"
                value={formData.agent || ''}
                onChange={(e) => setFormData({...formData, agent: e.target.value})}
                className="w-full"
                placeholder="e.g. aaaacgoasis"
              />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">Deposit Type</label>
              <input
                type="text"
                value={formData.depositType || ''}
                onChange={(e) => setFormData({...formData, depositType: e.target.value})}
                className="w-full"
                placeholder="e.g. PGA"
              />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">Include Keyword</label>
              <input
                type="text"
                value={formData.includeKeyword || ''}
                onChange={(e) => setFormData({...formData, includeKeyword: e.target.value})}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">Exclude Keyword</label>
              <input
                type="text"
                value={formData.excludeKeyword || ''}
                onChange={(e) => setFormData({...formData, excludeKeyword: e.target.value})}
                className="w-full"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm text-text-secondary mb-1">Description</label>
              <textarea
                value={formData.description || ''}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="w-full"
                rows={2}
              />
            </div>
            <div className="col-span-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.enabled || false}
                  onChange={(e) => setFormData({...formData, enabled: e.target.checked})}
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
              className="px-4 py-2 bg-accent-primary text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              Save
            </button>
            <button
              onClick={resetForm}
              className="px-4 py-2 bg-bg-tertiary text-text-primary rounded hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        </section>
      )}
      
      <section className="bg-bg-secondary rounded-lg border border-border-color overflow-hidden">
        <table className="w-full" data-testid="filters-table">
          <thead>
            <tr className="border-b border-border-color">
              <th className="text-left p-3">Priority</th>
              <th className="text-left p-3">Name</th>
              <th className="text-left p-3">Agent</th>
              <th className="text-left p-3">Deposit Type</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {profiles.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-text-tertiary">No filter profiles yet</td></tr>
            ) : (
              profiles
                .sort((a, b) => a.priority - b.priority)
                .map(profile => (
                  <tr key={profile.id} className="border-b border-border-color hover:bg-bg-tertiary">
                    <td className="p-3">{profile.priority}</td>
                    <td className="p-3 font-medium">{profile.name}</td>
                    <td className="p-3 text-text-secondary">{profile.agent || '-'}</td>
                    <td className="p-3 text-text-secondary">{profile.depositType || '-'}</td>
                    <td className="p-3">
                      <button
                        onClick={() => handleToggle(profile)}
                        className={`px-2 py-1 rounded text-xs ${
                          profile.enabled ? 'bg-accent-success text-white' : 'bg-bg-tertiary text-text-secondary'
                        }`}
                      >
                        {profile.enabled ? 'Enabled' : 'Disabled'}
                      </button>
                    </td>
                    <td className="p-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(profile)}
                          className="text-accent-primary hover:underline text-sm"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(profile.id, profile.name)}
                          className="text-accent-error hover:underline text-sm"
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
    </div>
  );
};

export default FilterProfilesPage;
