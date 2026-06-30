'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { AlertTriangle, CheckCircle2, RefreshCw, Clock } from 'lucide-react';

const SEVERITY_COLORS: Record<string, string> = {
  HIGH:   'bg-red-500/15 text-red-400 border-red-500/30',
  MEDIUM: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  LOW:    'bg-amber-500/15 text-amber-400 border-amber-500/30',
};

function fmtDate(dt?: string) {
  if (!dt) return '—';
  try { return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(dt)); }
  catch { return dt; }
}

export default function EscalationsPage() {
  const [items, setItems]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'open' | 'resolved' | 'all'>('open');
  const [resolving, setResolving] = useState<string | null>(null);
  const [notes, setNotes]   = useState('');
  const [outcome, setOutcome] = useState('resolved');

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.getEscalations(filter === 'all' ? undefined : filter);
      setItems(r.escalations || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [filter]);

  const handleResolve = async (id: string) => {
    try { await api.resolveEscalation(id, { outcome, notes }); }
    catch {}
    setResolving(null);
    setNotes('');
    load();
  };

  const openCount     = items.filter(i => i.status === 'open').length;
  const resolvedCount = items.filter(i => i.status === 'resolved').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Escalation Queue</h1>
          <p className="text-white/40 text-sm mt-0.5">High-priority customer cases requiring manager attention</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/6 hover:bg-white/10 text-white/60 hover:text-white text-xs transition-all">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5">
          <p className="text-[10px] text-red-400/70 uppercase tracking-widest font-semibold mb-1">Open</p>
          <p className="text-3xl font-bold text-red-400">{openCount}</p>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
          <p className="text-[10px] text-emerald-400/70 uppercase tracking-widest font-semibold mb-1">Resolved</p>
          <p className="text-3xl font-bold text-emerald-400">{resolvedCount}</p>
        </div>
        <div className="rounded-xl border border-white/8 bg-white/4 p-5">
          <p className="text-[10px] text-white/40 uppercase tracking-widest font-semibold mb-1">Total</p>
          <p className="text-3xl font-bold text-white">{items.length}</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-white/4 border border-white/8 rounded-xl p-1 w-fit">
        {(['open', 'resolved', 'all'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize ${filter === f ? 'bg-white/12 text-white' : 'text-white/40 hover:text-white'}`}>
            {f}
          </button>
        ))}
      </div>

      {loading && <div className="text-white/30 text-sm animate-pulse py-4">Loading…</div>}

      {!loading && items.length === 0 && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-8 text-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3 opacity-60" />
          <p className="text-emerald-300 font-semibold">No {filter !== 'all' ? filter : ''} escalations</p>
          <p className="text-white/30 text-sm mt-1">Queue is clear</p>
        </div>
      )}

      <div className="space-y-3">
        {items.map((item: any) => (
          <div key={item.id} className={`rounded-xl border p-5 ${item.status === 'resolved' ? 'border-white/6 bg-white/2 opacity-60' : 'border-white/10 bg-white/5'}`}>
            <div className="flex items-start gap-4">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${item.status === 'resolved' ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
                {item.status === 'resolved'
                  ? <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  : <AlertTriangle className="w-5 h-5 text-red-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <p className="text-sm font-bold text-white">{item.customer_name || item.customer_id}</p>
                  {item.severity && (
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${SEVERITY_COLORS[item.severity] || 'bg-white/10 text-white/50 border-white/10'}`}>
                      {item.severity}
                    </span>
                  )}
                  {item.status === 'resolved' && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold border bg-emerald-500/15 text-emerald-400 border-emerald-500/30">RESOLVED</span>
                  )}
                </div>
                <p className="text-sm text-white/60">{item.reason || item.description || 'Escalation flagged by PCOP system'}</p>
                <div className="flex items-center gap-4 mt-2">
                  <span className="flex items-center gap-1 text-[11px] text-white/30">
                    <Clock className="w-3 h-3" />{fmtDate(item.created_at)}
                  </span>
                  {item.rm_name && <span className="text-[11px] text-white/30">RM: {item.rm_name}</span>}
                  {item.resolved_by && <span className="text-[11px] text-white/30">Resolved by: {item.resolved_by}</span>}
                </div>
                {item.notes && <p className="text-[12px] text-white/40 mt-2 italic">"{item.notes}"</p>}
              </div>
              {item.status !== 'resolved' && (
                <button
                  onClick={() => { setResolving(item.id); setNotes(''); setOutcome('resolved'); }}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold hover:bg-emerald-500/25 transition-all shrink-0"
                >
                  Resolve
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Resolve modal */}
      {resolving && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center" onClick={() => setResolving(null)}>
          <div className="bg-[#0f2d5c] border border-white/15 rounded-2xl p-6 w-[440px] shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-white mb-4">Resolve Escalation</h3>
            <div className="mb-3">
              <label className="text-[11px] text-white/40 font-semibold uppercase tracking-widest block mb-1">Outcome</label>
              <select
                value={outcome}
                onChange={e => setOutcome(e.target.value)}
                className="w-full rounded-xl bg-white/6 border border-white/10 text-sm text-white p-3 focus:outline-none focus:border-white/30"
              >
                <option value="resolved">Resolved</option>
                <option value="escalated_further">Escalated Further</option>
                <option value="no_action_required">No Action Required</option>
                <option value="customer_retained">Customer Retained</option>
              </select>
            </div>
            <div className="mb-4">
              <label className="text-[11px] text-white/40 font-semibold uppercase tracking-widest block mb-1">Notes</label>
              <textarea
                className="w-full rounded-xl bg-white/6 border border-white/10 text-sm text-white placeholder-white/25 p-3 resize-none focus:outline-none focus:border-white/30"
                rows={3}
                placeholder="Resolution notes…"
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setResolving(null)} className="px-4 py-2 rounded-lg text-sm text-white/50 hover:text-white transition-colors">Cancel</button>
              <button onClick={() => handleResolve(resolving)} className="px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-sm font-semibold hover:bg-emerald-500/30 transition-all">
                Confirm Resolution
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
