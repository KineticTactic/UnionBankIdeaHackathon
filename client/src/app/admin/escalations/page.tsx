'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { AlertTriangle, CheckCircle2, RefreshCw, Clock, Filter } from 'lucide-react';

function fmtDate(d?: string) {
  if (!d) return '—';
  try { return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(d)); }
  catch { return d; }
}

const TIER_BADGE: Record<string, string> = {
  PRIORITY: 'bg-crimson-soft text-crimson border border-soft',
  ESCALATE: 'bg-copper-soft text-copper-dark border border-soft',
  STANDARD: 'bg-copper-soft text-copper-dark border border-soft',
  MONITOR:  'bg-teal-soft text-teal-dark border border-soft',
};
const STATUS_BADGE: Record<string, string> = {
  open:     'bg-crimson-soft text-crimson border border-soft',
  pending:  'bg-copper-soft text-copper-dark border border-soft',
  resolved: 'bg-sage-soft text-sage-brand border border-soft',
};

export default function EscalationsPage() {
  const [items,    setItems]    = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState<string>('all');
  const [resolveId, setResolveId] = useState<string | null>(null);
  const [outcome,  setOutcome]  = useState('resolved');
  const [notes,    setNotes]    = useState('');
  const [acting,   setActing]   = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.getEscalations();
      setItems(r.escalations || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const doResolve = async () => {
    if (!resolveId) return;
    setActing(true);
    try {
      await api.resolveEscalation(resolveId, { outcome, notes });
      setResolveId(null); setNotes('');
      await load();
    } catch {}
    setActing(false);
  };

  const filtered = filter === 'all' ? items : items.filter(i => i.status === filter);
  const open     = items.filter(i => i.status === 'open' || i.status === 'pending').length;
  const resolved = items.filter(i => i.status === 'resolved').length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Escalations</h1>
          <p className="text-slate-400 text-sm mt-0.5">Cases requiring manager or admin review</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-700 text-xs shadow-sm transition-all">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 border-l-4 border-l-red-500">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Open</p>
          <p className="text-2xl font-bold text-crimson tabular-nums">{open}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 border-l-4 border-l-emerald-500">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Resolved</p>
          <p className="text-2xl font-bold text-sage-brand tabular-nums">{resolved}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 border-l-4 border-l-[var(--crimson)]">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Total</p>
          <p className="text-2xl font-bold text-slate-900 tabular-nums">{items.length}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-slate-400" />
        {['all', 'open', 'pending', 'resolved'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
              filter === f ? 'bg-[var(--crimson)] text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
            }`}>{f}</button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 bg-white rounded-xl border border-slate-200 animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <CheckCircle2 className="w-10 h-10 text-sage-brand mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No escalations</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item: any) => (
            <div key={item.id} className={`bg-white rounded-xl border shadow-sm p-5 ${
              (item.status === 'open' || item.status === 'pending') ? 'border-soft' : 'border-slate-200'
            }`}>
              <div className="flex items-start gap-4">
                <AlertTriangle className={`w-5 h-5 mt-0.5 shrink-0 ${item.status === 'resolved' ? 'text-slate-300' : 'text-crimson'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="font-bold text-slate-900">{item.customer_name || item.customer_id}</p>
                    {item.risk_tier && <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${TIER_BADGE[item.risk_tier]||''}`}>{item.risk_tier}</span>}
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${STATUS_BADGE[item.status]||'bg-slate-100 text-slate-600 border-slate-200 border'}`}>{item.status?.toUpperCase()}</span>
                  </div>
                  <p className="text-sm text-slate-600 mb-2">{item.reason || item.notes || 'No reason provided'}</p>
                  <div className="flex items-center gap-4 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{fmtDate(item.created_at)}</span>
                    {item.assigned_to && <span>Assigned: {item.assigned_to}</span>}
                    {item.reviewer && <span>Reviewed by: {item.reviewer}</span>}
                  </div>
                </div>
                {(item.status === 'open' || item.status === 'pending') && (
                  <button onClick={() => { setResolveId(item.id); setOutcome('resolved'); setNotes(''); }}
                    className="px-3 py-1.5 rounded-lg bg-[var(--crimson)] text-white text-xs font-semibold hover:bg-[var(--crimson)]/90 transition-all shrink-0">
                    Resolve
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Resolve modal */}
      {resolveId && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center" onClick={() => setResolveId(null)}>
          <div className="bg-white border border-slate-200 rounded-2xl p-6 w-[440px] shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-slate-900 mb-4">Resolve Escalation</h3>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Outcome</label>
            <select value={outcome} onChange={e => setOutcome(e.target.value)}
              className="w-full rounded-xl border border-slate-200 text-sm text-slate-800 p-2.5 focus:outline-none focus:border-[var(--crimson)]/40 mb-3">
              <option value="resolved">Resolved</option>
              <option value="escalated">Escalated further</option>
              <option value="dismissed">Dismissed</option>
            </select>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Notes</label>
            <textarea className="w-full rounded-xl border border-slate-200 text-sm text-slate-800 p-3 resize-none focus:outline-none focus:border-[var(--crimson)]/40"
              rows={3} placeholder="Resolution notes…" value={notes} onChange={e => setNotes(e.target.value)} />
            <div className="flex gap-2 justify-end mt-4">
              <button onClick={() => setResolveId(null)} className="px-4 py-2 rounded-lg text-sm text-slate-500 hover:text-slate-700 transition-colors">Cancel</button>
              <button onClick={doResolve} disabled={acting}
                className="px-4 py-2 rounded-lg bg-[var(--crimson)] text-white text-sm font-semibold hover:bg-[var(--crimson)]/90 disabled:opacity-50 transition-all">
                {acting ? 'Saving…' : 'Save Resolution'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
