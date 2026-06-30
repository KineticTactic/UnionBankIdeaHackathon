'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Users, TrendingUp, AlertTriangle, ChevronRight, RefreshCw, Bell } from 'lucide-react';

const TIER_DOT: Record<string, string> = {
  PRIORITY: 'bg-red-500',
  ESCALATE: 'bg-orange-500',
  STANDARD: 'bg-amber-500',
  MONITOR:  'bg-blue-500',
  NONE:     'bg-emerald-500',
};

export default function RmManagementPage() {
  const [rms, setRms]       = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notifyId, setNotifyId] = useState<string | null>(null);
  const [msgDraft, setMsgDraft] = useState('');
  const router = useRouter();

  const load = async () => {
    setLoading(true);
    try { const r = await api.getAdminRms(); setRms(r.rms || []); } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const sendNotify = async (username: string) => {
    if (!msgDraft.trim()) return;
    try { await api.notifyRm(username, msgDraft); }
    catch {}
    setNotifyId(null);
    setMsgDraft('');
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-white/30 text-sm animate-pulse">Loading RM data…</div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">RM Management</h1>
          <p className="text-white/40 text-sm mt-0.5">{rms.length} relationship managers in the system</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/6 hover:bg-white/10 text-white/60 hover:text-white text-xs transition-all">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-white/8 bg-white/4 p-4">
          <p className="text-[10px] text-white/40 uppercase tracking-widest font-semibold mb-1">Total RMs</p>
          <p className="text-3xl font-bold text-white">{rms.length}</p>
        </div>
        <div className="rounded-xl border border-white/8 bg-white/4 p-4">
          <p className="text-[10px] text-white/40 uppercase tracking-widest font-semibold mb-1">Total Book Size</p>
          <p className="text-3xl font-bold text-white">{rms.reduce((s, r) => s + r.book_size, 0)}</p>
        </div>
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
          <p className="text-[10px] text-red-400/70 uppercase tracking-widest font-semibold mb-1">Total At-Risk</p>
          <p className="text-3xl font-bold text-red-400">{rms.reduce((s, r) => s + r.at_risk_count, 0)}</p>
        </div>
      </div>

      {/* RM Table */}
      <div className="rounded-xl border border-white/8 bg-white/4 overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto_auto] gap-0 text-[10px] font-semibold uppercase tracking-widest text-white/30 px-5 py-3 border-b border-white/8">
          <span>RM Name</span>
          <span className="text-right w-20">Book</span>
          <span className="text-right w-20">At-Risk</span>
          <span className="text-right w-20">Saves</span>
          <span className="text-right w-24">Calls (7d)</span>
          <span className="text-right w-24">Task %</span>
          <span className="w-24" />
        </div>
        {rms.length === 0 && (
          <p className="px-5 py-8 text-white/30 text-sm">No RMs found.</p>
        )}
        {rms.map((rm) => (
          <div
            key={rm.username}
            className="grid grid-cols-[1fr_auto_auto_auto_auto_auto_auto] gap-0 items-center px-5 py-4 border-b border-white/5 last:border-0 hover:bg-white/4 transition-colors group"
          >
            {/* Name */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-full bg-[#0f2d5c] border border-white/15 flex items-center justify-center text-[11px] font-bold text-white shrink-0">
                {rm.rm_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0,2)}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">{rm.rm_name}</p>
                <p className="text-[10px] text-white/35">@{rm.username} · {rm.role}</p>
              </div>
              {rm.active && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />}
            </div>
            <div className="w-20 text-right text-sm font-medium text-white tabular-nums">{rm.book_size}</div>
            <div className="w-20 text-right">
              <span className={`text-sm font-bold tabular-nums ${rm.at_risk_count > 0 ? 'text-red-400' : 'text-white/40'}`}>
                {rm.at_risk_count}
              </span>
            </div>
            <div className="w-20 text-right text-sm font-bold text-emerald-400 tabular-nums">{rm.saves_this_month}</div>
            <div className="w-24 text-right text-sm text-white/70 tabular-nums">{rm.calls_this_week}</div>
            <div className="w-24 text-right">
              <div className="flex items-center justify-end gap-1.5">
                <div className="w-12 h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full bg-sky-400 rounded-full" style={{ width: `${rm.task_completion_rate}%` }} />
                </div>
                <span className="text-[11px] text-white/50 tabular-nums">{rm.task_completion_rate}%</span>
              </div>
            </div>
            <div className="w-24 flex items-center justify-end gap-1.5">
              <button
                onClick={(e) => { e.stopPropagation(); setNotifyId(rm.username); setMsgDraft(''); }}
                className="p-1.5 rounded-md bg-white/0 hover:bg-white/10 text-white/30 hover:text-amber-400 transition-all"
                title="Notify RM"
              >
                <Bell className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => router.push(`/admin/rms/${rm.username}`)}
                className="p-1.5 rounded-md bg-white/0 hover:bg-white/10 text-white/30 hover:text-white transition-all"
                title="View profile"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Notify modal */}
      {notifyId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center" onClick={() => setNotifyId(null)}>
          <div className="bg-[#0f2d5c] border border-white/15 rounded-2xl p-6 w-[440px] shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-white mb-1">Notify RM</h3>
            <p className="text-[12px] text-white/40 mb-4">@{notifyId}</p>
            <textarea
              className="w-full rounded-xl bg-white/6 border border-white/10 text-sm text-white placeholder-white/25 p-3 resize-none focus:outline-none focus:border-white/30"
              rows={4}
              placeholder="Type your message…"
              value={msgDraft}
              onChange={e => setMsgDraft(e.target.value)}
            />
            <div className="flex gap-2 mt-4 justify-end">
              <button onClick={() => setNotifyId(null)} className="px-4 py-2 rounded-lg text-sm text-white/50 hover:text-white transition-colors">Cancel</button>
              <button
                onClick={() => sendNotify(notifyId)}
                className="px-4 py-2 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-300 text-sm font-semibold hover:bg-amber-500/30 transition-all"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
