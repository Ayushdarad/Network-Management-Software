import { motion, AnimatePresence } from 'framer-motion';
import { Archive, Search, Tag, Database, CheckCircle2, Clock, AlertTriangle, X, Edit2, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { assetsApi } from '../lib/api';

export default function AssetManagementPage() {
  const [assets, setAssets] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [form, setForm] = useState({ name: '', owner: '', category: 'License', status: 'active' });

  const fetchAssets = async () => {
    try {
      const data = await assetsApi.list();
      setAssets(data);
    } catch (err) {
      console.error('Failed to fetch assets', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await assetsApi.update(editingId, form);
      } else {
        await assetsApi.create(form);
      }
      setIsModalOpen(false);
      setEditingId(null);
      setForm({ name: '', owner: '', category: 'License', status: 'active' });
      fetchAssets(); // Refresh list
    } catch (err: any) {
      console.error('Failed to save asset', err);
      alert(`Error saving asset: ${err.message}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this asset?')) return;
    try {
      await assetsApi.delete(id);
      fetchAssets();
    } catch (err: any) {
      console.error('Failed to delete asset', err);
      alert(`Error deleting asset: ${err.message}`);
    }
  };

  const openAddModal = () => {
    setEditingId(null);
    setForm({ name: '', owner: '', category: 'License', status: 'active' });
    setIsModalOpen(true);
  };

  const openEditModal = (asset: any) => {
    setEditingId(asset.id);
    setForm({ name: asset.name, owner: asset.owner, category: asset.category, status: asset.status });
    setIsModalOpen(true);
  };

  const filtered = assets.filter(asset =>
    asset.name.toLowerCase().includes(query.toLowerCase()) ||
    asset.owner.toLowerCase().includes(query.toLowerCase()) ||
    asset.id.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="space-y-5 animate-fade-in relative">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Asset Management</h1>
          <p className="text-sm text-slate-500">Track licenses, warranties, ownership, and asset records separately from device inventory.</p>
        </div>
        <button 
          onClick={openAddModal}
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all"
        >
          + Add Asset
        </button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total Assets', value: assets.length, icon: Archive, color: 'text-blue-400' },
          { label: 'Active', value: assets.filter(a => a.status === 'active').length, icon: CheckCircle2, color: 'text-emerald-400' },
          { label: 'Review', value: assets.filter(a => a.status === 'review').length, icon: Clock, color: 'text-amber-400' },
          { label: 'Expired', value: assets.filter(a => a.status === 'expired').length, icon: AlertTriangle, color: 'text-red-400' },
        ].map(card => (
          <div key={card.label} className="glass rounded-xl p-4 border border-white/8">
            <div className="flex items-center justify-between">
              <div>
                <div className={`text-2xl font-bold ${card.color}`}>{loading ? '-' : card.value}</div>
                <div className="text-xs text-slate-500">{card.label}</div>
              </div>
              <card.icon size={18} className={card.color} />
            </div>
          </div>
        ))}
      </div>

      <div className="glass rounded-2xl p-5 border border-white/8">
        <div className="flex items-center gap-2 mb-4">
          <Search size={14} className="text-slate-500" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search assets, owners, or IDs..."
            className="bg-transparent text-sm text-white placeholder-slate-500 outline-none w-full"
          />
        </div>

        <div className="grid gap-3">
          {loading ? (
             <div className="py-16 text-center text-slate-500 text-sm">Loading assets...</div>
          ) : filtered.length > 0 ? (
            filtered.map(asset => (
              <motion.div
                key={asset.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between p-4 rounded-xl bg-white/3 border border-white/6"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center">
                    <Tag size={16} className="text-blue-400" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">{asset.name}</div>
                    <div className="text-xs text-slate-500">{asset.id} · {asset.category} · Owner: {asset.owner}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right border-r border-white/10 pr-4">
                    <div className={`text-xs font-semibold ${asset.status === 'active' ? 'text-emerald-400' : asset.status === 'review' ? 'text-amber-400' : 'text-red-400'}`}>
                      {asset.status}
                    </div>
                    <div className="text-xs text-slate-500">
                       {new Date(asset.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEditModal(asset)} className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => handleDelete(asset.id)} className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="py-16 text-center text-slate-500">
              <Archive size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No assets found</p>
              <p className="text-xs mt-1">Click "Add Asset" to start tracking records.</p>
            </div>
          )}
        </div>
      </div>

      <div className="glass rounded-2xl p-5 border border-white/8">
        <div className="flex items-center gap-2 mb-3">
          <Database size={15} className="text-cyan-400" />
          <span className="text-sm font-semibold text-white">Asset Notes</span>
        </div>
        <p className="text-sm text-slate-400 leading-relaxed">
          This page is intentionally separate from Device Inventory. Use it for non-device records like licenses,
          warranties, CMDB entries, and ownership metadata.
        </p>
      </div>

      {/* Add Asset Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass rounded-2xl border border-white/10 w-full max-w-md overflow-hidden"
            >
              <div className="flex items-center justify-between p-5 border-b border-white/5">
                <h2 className="text-lg font-bold text-white">{editingId ? 'Edit Asset' : 'Add New Asset'}</h2>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-5 space-y-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Asset Name</label>
                  <input required type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                    className="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50"
                    placeholder="e.g., Core Router License"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Owner</label>
                  <input required type="text" value={form.owner} onChange={e => setForm({...form, owner: e.target.value})}
                    className="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50"
                    placeholder="e.g., Network Team"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5">Category</label>
                    <select value={form.category} onChange={e => setForm({...form, category: e.target.value})}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50">
                      <option>License</option>
                      <option>Subscription</option>
                      <option>Warranty</option>
                      <option>Record</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5">Status</label>
                    <select value={form.status} onChange={e => setForm({...form, status: e.target.value})}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50">
                      <option value="active">Active</option>
                      <option value="review">Review</option>
                      <option value="expired">Expired</option>
                    </select>
                  </div>
                </div>
                <div className="pt-4 flex items-center justify-end gap-3">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="text-sm font-semibold text-slate-400 hover:text-white">
                    Cancel
                  </button>
                  <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-blue-500/20">
                    Save Asset
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
