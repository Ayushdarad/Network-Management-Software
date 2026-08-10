import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Eye, EyeOff, Lock, AlertCircle, Mail,
  ArrowLeft, CheckCircle, Monitor, Radio, BarChart2,
} from 'lucide-react';
import { useState } from 'react';
import { authApi, settingsApi } from '../lib/api.ts';
import { getDefaultRoute } from '../lib/routes';
import { loadPermissions } from '../lib/permissions';
import tecsidelLogo from '../assets/Tecsidel Logo.jpg';
import TecsidelLogo from '../components/TecsidelLogo';

// ─── Left panel system status items ───────────────────────────
const statusItems = [
  { icon: Monitor,   label: 'Secure Console',      sub: 'Authenticated operator workspace',   status: 'READY',  color: 'text-emerald-400' },
  { icon: Radio,     label: 'Live Device Polling', sub: 'ICMP ping monitoring every cycle',   status: 'ONLINE', color: 'text-emerald-400' },
  { icon: BarChart2, label: 'Reports Engine',      sub: 'Uptime reports and event exports',   status: 'ACTIVE', color: 'text-blue-400' },
];

// ─── Bottom feature pills ──────────────────────────────────────
const features = [
  { label: '24/7',      sub: 'Command center readiness' },
  { label: 'Real-time', sub: 'Live device visibility'   },
  { label: 'NMS',       sub: 'Integrated network ops'   },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const [showPw, setShowPw]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');
  const [view, setView]       = useState<'login' | 'contact'>('login');
  const [form, setForm]       = useState({ email: '', password: '' });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await authApi.login(form.email, form.password);
      localStorage.setItem('nms_token', result.token);
      localStorage.setItem('nms_user', JSON.stringify(result.user));
      try {
        const settings = await settingsApi.get();
        if (settings.permissions) loadPermissions(settings.permissions);
      } catch { /* defaults apply */ }
      navigate(getDefaultRoute());
    } catch (err: any) {
      setError(err.message || 'Login failed. Check your credentials.');
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email) { setError('Please enter your email address'); return; }
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await authApi.forgotPassword(form.email);
      setSuccess(res.message);
      setLoading(false);
    } catch (err: any) {
      setError(err.message || 'Failed to request password reset');
      setLoading(false);
    }
  };

  return (
    <div data-theme="dark" className="min-h-screen flex overflow-hidden"
      style={{ background: '#070d1a' }}>

      {/* ── LEFT PANEL ─────────────────────────────────────────── */}
      <div className="hidden lg:flex flex-col justify-between w-[52%] relative overflow-hidden p-10">

        {/* Background gradient */}
        <div className="absolute inset-0"
          style={{ background: 'linear-gradient(160deg, #0a1628 0%, #071018 50%, #050c18 100%)' }} />
        {/* Radial glow */}
        <div className="absolute inset-0 opacity-20"
          style={{ backgroundImage: 'radial-gradient(ellipse at 30% 40%, rgba(0,102,255,0.4) 0%, transparent 55%), radial-gradient(ellipse at 70% 70%, rgba(6,182,212,0.25) 0%, transparent 50%)' }} />
        {/* Grid */}
        <div className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg,rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />

        {/* Logo */}
        <div className="relative z-10">
          <img src={tecsidelLogo} alt="Tecsidel"
            className="h-20 w-auto object-contain rounded-xl"
            style={{ mixBlendMode: 'screen', filter: 'contrast(1.1)' }} />
          {/* Logo animation — fills the red marked area */}
          <div className="absolute pointer-events-none select-none"
            style={{ left: '110px', top: '-16px', width: 'calc(100% - 30px)', height: '260px' }}>
            <TecsidelLogo />
          </div>
        </div>

        {/* Hero text */}
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
            <span className="text-xs font-semibold text-emerald-400 tracking-widest uppercase">NMS Operations</span>
          </div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            Network<br />Management<br />System
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed max-w-xs">
            Secure access for network operations center monitoring, device management, analytics and infrastructure operations.
          </p>

          {/* Status items */}
          <div className="mt-8 space-y-3">
            {statusItems.map((item, i) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.1 }}
                className="flex items-center justify-between px-4 py-3 rounded-xl border border-white/6 bg-white/3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                    <item.icon size={15} className="text-slate-400" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white">{item.label}</div>
                    <div className="text-[11px] text-slate-500">{item.sub}</div>
                  </div>
                </div>
                <span className={`text-xs font-bold tracking-wider ${item.color}`}>{item.status}</span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Copyright */}
        <div className="relative z-10 text-xs text-slate-600">
          © 2026 Tecsidel S.A. · Secure Infrastructure Platform
        </div>
      </div>

      {/* ── RIGHT PANEL ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col justify-center px-8 md:px-16 py-10 relative"
        style={{ background: '#0b1220' }}>

        <div className="absolute top-0 right-0 w-96 h-96 rounded-full pointer-events-none opacity-10"
          style={{ background: 'radial-gradient(circle, #0066ff, transparent 70%)', transform: 'translate(30%, -30%)' }} />

        <div className="w-full max-w-sm mx-auto">

          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
            className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
            <span className="text-xs font-semibold text-emerald-400 tracking-widest uppercase">Secure Sign In</span>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
            <h2 className="text-3xl font-bold text-white mb-1">NMS Login</h2>
            <p className="text-sm text-slate-400 mb-8">Use your authorized NMS account to continue.</p>

            <AnimatePresence mode="wait">

              {/* ── LOGIN FORM ── */}
              {view === 'login' && (
                <motion.form key="login" onSubmit={handleLogin}
                  initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 16 }} transition={{ duration: 0.2 }}
                  className="space-y-5">

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Email Address</label>
                    <div className="relative">
                      <Mail size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input type="email" value={form.email}
                        onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-cyan-500/60 focus:bg-white/8 transition-all"
                        placeholder="operator@domain.com" required />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Password</label>
                    <div className="relative">
                      <Lock size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input type={showPw ? 'text' : 'password'} value={form.password}
                        onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-11 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-cyan-500/60 focus:bg-white/8 transition-all"
                        placeholder="Enter password" required />
                      <button type="button" onClick={() => setShowPw(s => !s)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                        {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-emerald-500">
                      <Shield size={12} /><span>Encrypted session</span>
                    </div>
                    <button type="button"
                      onClick={() => { setView('contact'); setError(''); setSuccess(''); }}
                      className="text-slate-400 hover:text-blue-400 transition-colors">
                      Operator access issues?
                    </button>
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
                      <AlertCircle size={13} className="shrink-0" />{error}
                    </div>
                  )}

                  <button type="submit" disabled={loading}
                    className="w-full py-3 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2 transition-all disabled:opacity-60"
                    style={{ background: 'linear-gradient(90deg, #0066ff, #06b6d4)' }}>
                    {loading
                      ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Signing in...</>
                      : <><Lock size={15} /> SIGN IN</>}
                  </button>
                </motion.form>
              )}

              {/* ── CONTACT ADMIN ── */}
              {view === 'contact' && (
                <motion.div key="contact"
                  initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.2 }}>

                  <div className="flex flex-col items-center text-center py-6 px-2">
                    {/* Icon */}
                    <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-5">
                      <Shield size={28} className="text-amber-400" />
                    </div>

                    <h3 className="text-lg font-semibold text-white mb-2">Access Restricted</h3>

                    <p className="text-sm text-slate-400 leading-relaxed mb-6">
                      Please contact your{' '}
                      <span className="text-white font-semibold">Administrator</span>{' '}
                      for assistance.
                    </p>

                    {/* Return button */}
                    <button
                      onClick={() => { setView('login'); setError(''); setSuccess(''); }}
                      className="w-full py-3 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2 transition-all"
                      style={{ background: 'linear-gradient(90deg, #0066ff, #06b6d4)' }}
                    >
                      <ArrowLeft size={15} /> Return to Login
                    </button>
                  </div>
                </motion.div>
              )}

            </AnimatePresence>

            {/* Feature pills */}
            <div className="mt-10 grid grid-cols-3 gap-3">
              {features.map((f, i) => (
                <motion.div key={f.label}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + i * 0.08 }}
                  className="text-center p-3 rounded-xl border border-white/6 bg-white/3">
                  <div className="text-sm font-bold text-white">{f.label}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">{f.sub}</div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
