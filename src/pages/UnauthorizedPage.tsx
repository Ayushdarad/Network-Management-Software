import { useNavigate } from 'react-router-dom';
import { ShieldOff, ArrowLeft } from 'lucide-react';
import { getCurrentUser } from '../lib/api';

export default function UnauthorizedPage() {
  const navigate = useNavigate();
  const user = getCurrentUser();

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] gap-5 animate-fade-in">
      <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
        <ShieldOff size={28} className="text-red-400" />
      </div>
      <div className="text-center">
        <h1 className="text-xl font-bold text-white mb-2">Access Denied</h1>
        <p className="text-sm text-slate-400 max-w-sm">
          Your role <span className="text-amber-400 font-semibold capitalize">({user?.role ?? 'unknown'})</span> does not have permission to access this page.
        </p>
        <p className="text-xs text-slate-500 mt-1">Contact your administrator to request access.</p>
      </div>
      <button onClick={() => navigate('/dashboard')}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 transition-all">
        <ArrowLeft size={14} /> Back to Dashboard
      </button>
    </div>
  );
}
