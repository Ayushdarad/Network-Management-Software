import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings, Users, Shield, Bell, Database,
  Save, ChevronRight, Check, Plus, Trash2,
  Eye, EyeOff, X, Pencil, Loader2, Lock, RefreshCw
} from 'lucide-react';
import { usersApi, settingsApi } from '../lib/api';
import { showToast } from '../components/Toast';
import { getCurrentUser } from '../lib/api';
import {
  PERMISSION_GROUPS, PERMISSION_LABELS, DEFAULT_PERMISSIONS,
  loadPermissions, getPermissions, type Permission, type Role
} from '../lib/permissions';

const SECTIONS = [
  { id: 'general',       label: 'General',           icon: Settings },
  { id: 'users',         label: 'Users & Access',     icon: Users    },
  { id: 'permissions',   label: 'Role Permissions',   icon: Shield   },
  { id: 'profile',       label: 'My Profile',         icon: Shield   },
  { id: 'notifications', label: 'Notifications',      icon: Bell     },
  { id: 'retention',     label: 'Data Retention',     icon: Database },
];

// ─── Toggle ───────────────────────────────────────────────────
function Toggle({ label, description, checked, onChange }: {
  label: string; description?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-white/4 last:border-0">
      <div>
        <div className="text-sm font-medium text-slate-200">{label}</div>
        {description && <div className="text-xs text-slate-500 mt-0.5">{description}</div>}
      </div>
      <button onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-all ${checked ? 'bg-blue-600' : 'bg-white/10'}`}>
        <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${checked ? 'left-6' : 'left-1'}`} />
      </button>
    </div>
  );
}

// ─── Add/Edit User Modal ──────────────────────────────────────
function UserModal({ user, onClose, onSaved }: {
  user?: any; onClose: () => void; onSaved: () => void;
}) {
  const isEdit = !!user;
  const [form, setForm] = useState({
    name:     user?.name     ?? '',
    email:    user?.email    ?? '',
    password: '',
    role:     user?.role     ?? 'viewer',
    status:   user?.status   ?? 'active',
  });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isEdit) {
        const payload: any = { name: form.name, role: form.role, status: form.status };
        if (form.password) payload.password = form.password;
        await usersApi.update(user.id, payload);
        showToast(`User "${form.name}" updated`, 'success');
      } else {
        if (!form.password) { showToast('Password is required', 'error'); setLoading(false); return; }
        await usersApi.create({ name: form.name, email: form.email, password: form.password, role: form.role });
        showToast(`User "${form.name}" created`, 'success');
      }
      onSaved();
    } catch (err: any) {
      showToast(err.message || 'Failed to save user', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="absolute inset-0 bg-black/50" />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="glass rounded-2xl border border-white/10 w-full max-w-md p-6 relative z-10 shadow-glass">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"><X size={18} /></button>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Users size={18} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">{isEdit ? 'Edit User' : 'Add New User'}</h2>
            <p className="text-xs text-slate-400">{isEdit ? `Editing ${user.email}` : 'Create a new NMS account'}</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Full Name *</label>
            <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50" placeholder="John Smith" />
          </div>
          {!isEdit && (
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Email *</label>
              <input required type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50" placeholder="user@domain.com" />
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">{isEdit ? 'New Password (leave blank to keep)' : 'Password *'}</label>
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 pr-10 text-sm text-white outline-none focus:border-blue-500/50" placeholder="••••••••" />
              <button type="button" onClick={() => setShowPw(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Role</label>
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50">
                <option value="admin">Admin</option>
                <option value="operator">Operator</option>
                <option value="viewer">Viewer</option>
                <option value="security">Security</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 rounded-xl text-sm text-slate-300 border border-white/10 hover:bg-white/5 transition-all">Cancel</button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-60 transition-all flex items-center justify-center gap-2">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {isEdit ? 'Save Changes' : 'Create User'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────
export default function SettingsPage() {
  const [section,   setSection]   = useState('general');
  const [config,    setConfig]    = useState<Record<string, any>>({});
  const [users,     setUsers]     = useState<any[]>([]);
  const [saving,    setSaving]    = useState(false);
  const [userModal, setUserModal] = useState<{ open: boolean; user?: any }>({ open: false });
  const [perms,     setPerms]     = useState<Record<Role, Permission[]>>(() => ({ ...DEFAULT_PERMISSIONS }));
  const [savingPerms, setSavingPerms] = useState(false);
  const currentUser = getCurrentUser();

  // Profile state
  const [profile, setProfile] = useState({ name: currentUser?.name ?? '', email: currentUser?.email ?? '' });
  const [pwForm,  setPwForm]  = useState({ current: '', newPw: '', confirm: '' });
  const [showPws, setShowPws] = useState({ current: false, newPw: false, confirm: false });

  useEffect(() => {
    settingsApi.get().then(s => {
      setConfig(s);
      if (s.permissions) {
        setPerms(s.permissions as Record<Role, Permission[]>);
        loadPermissions(s.permissions);
      }
    }).catch(() => {});
    usersApi.list().then(r => setUsers(r.data)).catch(() => {});
  }, []);

  const savePermissions = async () => {
    setSavingPerms(true);
    try {
      const res = await settingsApi.updatePermissions(perms as Record<string, string[]>);
      loadPermissions(res.permissions);
      showToast('Role permissions updated', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to save permissions', 'error');
    } finally {
      setSavingPerms(false);
    }
  };

  const togglePerm = (role: Role, perm: Permission) => {
    setPerms(prev => {
      const current = prev[role] ?? [];
      const has = current.includes(perm);
      return {
        ...prev,
        [role]: has ? current.filter(p => p !== perm) : [...current, perm],
      };
    });
  };

  const resetPerms = () => {
    setPerms({ ...DEFAULT_PERMISSIONS });
    showToast('Permissions reset to defaults (not saved yet)', 'info');
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      const updated = await settingsApi.update(config);
      setConfig(updated);
      showToast('Settings saved', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  const saveProfile = async () => {
    try {
      await usersApi.update(currentUser.id, { name: profile.name });
      const stored = JSON.parse(localStorage.getItem('nms_user') || '{}');
      localStorage.setItem('nms_user', JSON.stringify({ ...stored, name: profile.name }));
      showToast('Profile updated — refresh to see name change in topbar', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to update profile', 'error');
    }
  };

  const changePassword = async () => {
    if (pwForm.newPw !== pwForm.confirm) { showToast('Passwords do not match', 'error'); return; }
    if (pwForm.newPw.length < 6) { showToast('Password must be at least 6 characters', 'error'); return; }
    try {
      await usersApi.update(currentUser.id, { password: pwForm.newPw });
      setPwForm({ current: '', newPw: '', confirm: '' });
      showToast('Password changed successfully', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to change password', 'error');
    }
  };

  const deleteUser = async (user: any) => {
    if (user.id === currentUser?.id) { showToast('Cannot delete your own account', 'error'); return; }
    if (!confirm(`Delete user "${user.name}"?`)) return;
    try {
      await usersApi.delete(user.id);
      setUsers(prev => prev.filter(u => u.id !== user.id));
      showToast(`User "${user.name}" deleted`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to delete user', 'error');
    }
  };

  const toggleUserStatus = async (user: any) => {
    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    try {
      await usersApi.update(user.id, { status: newStatus });
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, status: newStatus } : u));
      showToast(`${user.name} set to ${newStatus}`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to update status', 'error');
    }
  };

  const set = (key: string, value: any) => setConfig(c => ({ ...c, [key]: value }));
  const field = (key: string, label: string, type = 'text', placeholder = '') => (
    <div key={key}>
      <label className="block text-xs font-medium text-slate-400 mb-1.5">{label}</label>
      <input type={type} value={config[key] ?? ''} placeholder={placeholder}
        onChange={e => set(key, type === 'number' ? Number(e.target.value) : e.target.value)}
        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500/50 transition-all" />
    </div>
  );

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">System Settings</h1>
          <p className="text-sm text-slate-500">Configure Tecsidel NMS platform</p>
        </div>
        {(section === 'general' || section === 'notifications' || section === 'retention') && (
          <button onClick={saveConfig} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-60 transition-all shadow-lg shadow-blue-500/25">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-4 gap-5">
        {/* Sidebar */}
        <div className="glass rounded-2xl p-3 border border-white/8 h-fit">
          {SECTIONS.map(s => (
            <button key={s.id} onClick={() => setSection(s.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all mb-0.5 ${
                section === s.id
                  ? 'bg-blue-600/20 text-blue-300 border border-blue-500/20'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}>
              <s.icon size={15} />
              {s.label}
              {section === s.id && <ChevronRight size={13} className="ml-auto" />}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="col-span-3">
          <motion.div key={section} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }} className="space-y-4">

            {/* ── GENERAL ── */}
            {section === 'general' && (
              <div className="glass rounded-2xl p-6 border border-white/8 space-y-4">
                <h2 className="text-sm font-semibold text-white border-b border-white/6 pb-3">General Configuration</h2>
                {field('platformName',    'Platform Name',                'text',   'Tecsidel NMS')}
                {field('organization',    'Organization',                 'text',   'My Company')}
                {field('timezone',        'Timezone',                     'text',   'UTC+5:30')}
                {field('pollInterval',    'Poll Interval (seconds)',       'number', '5')}
                <div className="pt-2 border-t border-white/6">
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Feature Flags</div>
                  <Toggle label="Auto Discovery" description="Automatically discover new devices on network"
                    checked={!!config.autoDiscovery} onChange={v => set('autoDiscovery', v)} />
                  <Toggle label="Email Alerts" description="Send email alerts to NOC team"
                    checked={!!config.emailAlerts} onChange={v => set('emailAlerts', v)} />
                  <Toggle label="Audit Logging" description="Log all user actions"
                    checked={!!config.auditLogging} onChange={v => set('auditLogging', v)} />
                </div>
              </div>
            )}

            {/* ── USERS ── */}
            {section === 'users' && (
              <div className="glass rounded-2xl border border-white/8 overflow-hidden">
                <div className="px-5 py-4 border-b border-white/8 flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">Users & Access Control</span>
                  <button onClick={() => setUserModal({ open: true })}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs bg-blue-600/20 text-blue-400 border border-blue-500/20 hover:bg-blue-600/30 transition-all">
                    <Plus size={13} /> Add User
                  </button>
                </div>
                {users.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 text-sm">
                    <Users size={28} className="mx-auto mb-2 opacity-30" />No users found
                  </div>
                ) : (
                  <table className="nms-table">
                    <thead>
                      <tr><th>User</th><th>Role</th><th>Status</th><th>Last Login</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                      {users.map(u => (
                        <tr key={u.id}>
                          <td>
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                                {u.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <div className="text-sm font-medium text-slate-200">{u.name}</div>
                                <div className="text-xs text-slate-500">{u.email}</div>
                              </div>
                            </div>
                          </td>
                          <td><span className="badge badge-info text-[10px] capitalize">{u.role}</span></td>
                          <td>
                            <span className={`badge text-[10px] ${u.isOnline ? 'badge-success' : 'badge-unknown'}`}>
                              {u.isOnline ? 'Online' : 'Offline'}
                            </span>
                          </td>
                          <td className="text-xs text-slate-400 whitespace-nowrap">
                            {u.lastLogin
                              ? new Date(u.lastLogin).toLocaleString()
                              : <span className="text-slate-600">Never</span>}
                          </td>
                          <td>
                            <div className="flex items-center gap-2">
                              <button onClick={() => setUserModal({ open: true, user: u })}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition-all">
                                <Pencil size={13} />
                              </button>
                              <button onClick={() => deleteUser(u)}
                                disabled={u.id === currentUser?.id}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed">
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* ── PERMISSIONS ── */}
            {section === 'permissions' && (
              <div className="glass rounded-2xl border border-white/8 overflow-hidden">
                <div className="px-5 py-4 border-b border-white/8 flex items-center justify-between">
                  <div>
                    <span className="text-sm font-semibold text-white">Role Permissions</span>
                    <p className="text-xs text-slate-500 mt-0.5">Toggle what each role can access and do in the NMS</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={resetPerms}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-slate-400 border border-white/10 hover:bg-white/5 transition-all">
                      <RefreshCw size={12} /> Reset Defaults
                    </button>
                    <button onClick={savePermissions} disabled={savingPerms}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-60 transition-all">
                      {savingPerms ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                      Save Permissions
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/6">
                        <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-64">Permission</th>
                        {(['admin','operator','viewer','security'] as Role[]).map(role => (
                          <th key={role} className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider">
                            <span className={`px-2 py-1 rounded-lg ${
                              role === 'admin'    ? 'bg-red-500/15 text-red-400' :
                              role === 'operator' ? 'bg-blue-500/15 text-blue-400' :
                              role === 'viewer'   ? 'bg-slate-500/15 text-slate-400' :
                              'bg-amber-500/15 text-amber-400'
                            }`}>{role}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {PERMISSION_GROUPS.map(group => (
                        <>
                          {/* Group header */}
                          <tr key={group.label} className="bg-white/2">
                            <td colSpan={5} className="px-5 py-2 text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                              {group.label}
                            </td>
                          </tr>
                          {/* Permission rows */}
                          {group.perms.map(perm => (
                            <tr key={perm} className="border-b border-white/4 hover:bg-white/2 transition-colors">
                              <td className="px-5 py-2.5 text-xs text-slate-300">
                                {PERMISSION_LABELS[perm]}
                              </td>
                              {(['admin','operator','viewer','security'] as Role[]).map(role => {
                                const isAdmin = role === 'admin';
                                const checked = perms[role]?.includes(perm) ?? false;
                                return (
                                  <td key={role} className="px-4 py-2.5 text-center">
                                    <button
                                      onClick={() => !isAdmin && togglePerm(role, perm)}
                                      disabled={isAdmin}
                                      title={isAdmin ? 'Admin always has full access' : `Toggle ${perm} for ${role}`}
                                      className={`w-5 h-5 rounded flex items-center justify-center mx-auto transition-all ${
                                        isAdmin
                                          ? 'bg-emerald-500/30 border border-emerald-500/40 cursor-not-allowed'
                                          : checked
                                          ? 'bg-emerald-600 border border-emerald-500 hover:bg-emerald-500'
                                          : 'bg-white/5 border border-white/15 hover:border-white/30'
                                      }`}
                                    >
                                      {(checked || isAdmin) && <Check size={11} className="text-white" />}
                                    </button>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="px-5 py-3 border-t border-white/6 text-xs text-slate-500 flex items-center gap-2">
                  <Shield size={12} className="text-amber-400" />
                  Admin role always has full access and cannot be restricted. Changes take effect immediately after saving.
                </div>
              </div>
            )}

            {/* ── PROFILE ── */}
            {section === 'profile' && (
              <div className="space-y-4">
                <div className="glass rounded-2xl p-6 border border-white/8 space-y-4">
                  <h2 className="text-sm font-semibold text-white border-b border-white/6 pb-3">My Profile</h2>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Full Name</label>
                    <input value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500/50 transition-all" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Email</label>
                    <input value={profile.email} disabled
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-400 outline-none opacity-50 cursor-not-allowed" />
                    <p className="text-xs text-slate-600 mt-1">Email cannot be changed</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Role</label>
                    <input value={currentUser?.role ?? '—'} disabled
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-400 outline-none opacity-50 cursor-not-allowed capitalize" />
                  </div>
                  <button onClick={saveProfile}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 transition-all">
                    <Save size={14} /> Update Profile
                  </button>
                </div>

                <div className="glass rounded-2xl p-6 border border-white/8 space-y-4">
                  <div className="flex items-center gap-2 border-b border-white/6 pb-3">
                    <Lock size={15} className="text-amber-400" />
                    <h2 className="text-sm font-semibold text-white">Change Password</h2>
                  </div>
                  {(['current', 'newPw', 'confirm'] as const).map((key, i) => (
                    <div key={key}>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">
                        {key === 'current' ? 'Current Password' : key === 'newPw' ? 'New Password' : 'Confirm New Password'}
                      </label>
                      <div className="relative">
                        <input
                          type={showPws[key] ? 'text' : 'password'}
                          value={pwForm[key]}
                          onChange={e => setPwForm(p => ({ ...p, [key]: e.target.value }))}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 pr-10 text-sm text-white outline-none focus:border-blue-500/50 transition-all"
                          placeholder="••••••••"
                        />
                        <button type="button" onClick={() => setShowPws(s => ({ ...s, [key]: !s[key] }))}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                          {showPws[key] ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>
                  ))}
                  <button onClick={changePassword}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-amber-600 hover:bg-amber-500 transition-all">
                    <Lock size={14} /> Change Password
                  </button>
                </div>
              </div>
            )}

            {/* ── NOTIFICATIONS ── */}
            {section === 'notifications' && (
              <div className="glass rounded-2xl p-6 border border-white/8">
                <h2 className="text-sm font-semibold text-white border-b border-white/6 pb-3 mb-4">Notification Settings</h2>
                <Toggle label="Email Alerts — Critical" description="Send email for critical severity alerts"
                  checked={!!config.emailAlerts} onChange={v => set('emailAlerts', v)} />
                <Toggle label="Auto-Resolve Notifications" description="Notify when alerts auto-resolve"
                  checked={!!config.autoDiscovery} onChange={v => set('autoDiscovery', v)} />
                <Toggle label="Audit Logging" description="Log all user and system actions"
                  checked={!!config.auditLogging} onChange={v => set('auditLogging', v)} />
                <div className="mt-4">
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Alert Email Recipients</label>
                  <input type="text" placeholder="noc@company.com, alerts@company.com"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500/50 transition-all" />
                  <p className="text-xs text-slate-600 mt-1">Comma-separated email addresses</p>
                </div>
              </div>
            )}

            {/* ── RETENTION ── */}
            {section === 'retention' && (
              <div className="glass rounded-2xl p-6 border border-white/8 space-y-4">
                <h2 className="text-sm font-semibold text-white border-b border-white/6 pb-3">Data Retention Policy</h2>
                {field('logRetention',     'Syslog Retention (days)',    'number', '180')}
                {field('alertRetention',   'Alert History (days)',       'number', '365')}
                <div className="p-4 rounded-xl bg-amber-500/8 border border-amber-500/20 text-xs text-amber-400">
                  ⚠️ Reducing retention will permanently delete older data. Changes take effect on next cleanup cycle.
                </div>
              </div>
            )}

          </motion.div>
        </div>
      </div>

      {/* User Modal */}
      <AnimatePresence>
        {userModal.open && (
          <UserModal
            user={userModal.user}
            onClose={() => setUserModal({ open: false })}
            onSaved={() => {
              setUserModal({ open: false });
              usersApi.list().then(r => setUsers(r.data)).catch(() => {});
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
