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
  PRIORITY: 'bg-[#6B132B] text-white',
  ESCALATE: 'bg-[#B46B3E] text-white',
  STANDARD: 'bg-[#F9F9F7] text-[#2A161B] border border-soft',
  MONITOR:  'bg-[#F4D9C0] text-[#2A161B]',
};
const STATUS_BADGE: Record<string, string> = {
  open:     'bg-[#6B132B] text-white',
  pending:  'bg-[#B46B3E] text-white',
  resolved: 'bg-[#F9F9F7] text-[#2A161B] border border-soft',
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
    <div className="p-6 space-y-6 bg-[#F9F9F7] min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-black text-[#2A161B] font-heading">Escalations</h1>
          <p className="text-[13px] text-[#6B6562] mt-0.5">Cases requiring manager or admin review</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 rounded-md border border-soft bg-white text-[#6B6562] hover:text-[#2A161B] text-xs transition-colors">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-md border border-soft p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-[#6B132B] shrink-0" />
          <div>
            <p className="text-[10px] font-semibold text-[#6B6562] uppercase tracking-wider">Open</p>
            <p className="text-xl font-black text-[#2A161B] tabular-nums">{open}</p>
          </div>
        </div>
        <div className="bg-white rounded-md border border-soft p-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-[#B46B3E] shrink-0" />
          <div>
            <p className="text-[10px] font-semibold text-[#6B6562] uppercase tracking-wider">Resolved</p>
            <p className="text-xl font-black text-[#2A161B] tabular-nums">{resolved}</p>
          </div>
        </div>
        <div className="bg-white rounded-md border border-soft p-4 flex items-center gap-3">
          <Clock className="w-5 h-5 text-[#6B132B] shrink-0" />
          <div>
            <p className="text-[10px] font-semibold text-[#6B6562] uppercase tracking-wider">Total</p>
            <p className="text-xl font-black text-[#2A161B] tabular-nums">{items.length}</p>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-[#8B8481]" />
        {['all', 'open', 'pending', 'resolved'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold capitalize transition-all ${
              filter === f ? 'bg-[#6B132B] text-white' : 'bg-white border border-soft text-[#6B6562] hover:border-[#B46B3E]'
            }`}>{f}</button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 bg-white rounded-md border border-soft animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-md border border-soft p-12 text-center">
          <CheckCircle2 className="w-10 h-10 text-[#B46B3E] mx-auto mb-3" />
          <p className="text-[#2A161B] font-medium">No escalations</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item: any) => (
            <div key={item.id} className="bg-white rounded-md border border-soft p-5">
              <div className="flex items-start gap-4">
                <AlertTriangle className={`w-5 h-5 mt-0.5 shrink-0 ${item.status === 'resolved' ? 'text-[#8B8481]' : 'text-[#6B132B]'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="font-bold text-[#2A161B]">{item.customer_name || item.customer_id}</p>
                    {item.risk_tier && <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${TIER_BADGE[item.risk_tier]||''}`}>{item.risk_tier}</span>}
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${STATUS_BADGE[item.status]||'bg-[#F9F9F7] text-[#6B6562] border border-soft'}`}>{item.status?.toUpperCase()}</span>
                  </div>
                  <p className="text-sm text-[#6B6562] mb-2">{item.reason || item.notes || 'No reason provided'}</p>
                  <div className="flex items-center gap-4 text-[11px] text-[#6B6562]">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{fmtDate(item.created_at)}</span>
                    {item.assigned_to && <span>Assigned: {item.assigned_to}</span>}
                    {item.reviewer && <span>Reviewed by: {item.reviewer}</span>}
                  </div>
                </div>
                {(item.status === 'open' || item.status === 'pending') && (
                  <button onClick={() => { setResolveId(item.id); setOutcome('resolved'); setNotes(''); }}
                    className="px-3 py-1.5 rounded-md bg-[#6B132B] text-white text-xs font-semibold hover:bg-[#6B132B]/90 transition-all shrink-0">
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
          <div className="bg-white border border-soft rounded-md p-6 w-[440px]" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-[#2A161B] mb-4">Resolve Escalation</h3>
            <label className="block text-[11px] font-semibold text-[#6B6562] uppercase tracking-wide mb-1">Outcome</label>
            <select value={outcome} onChange={e => setOutcome(e.target.value)}
              className="w-full rounded-md border border-soft text-sm text-[#2A161B] p-2.5 focus:outline-none focus:border-[#6B132B]/40 mb-3 bg-white">
              <option value="resolved">Resolved</option>
              <option value="escalated">Escalated further</option>
              <option value="dismissed">Dismissed</option>
            </select>
            <label className="block text-[11px] font-semibold text-[#6B6562] uppercase tracking-wide mb-1">Notes</label>
            <textarea className="w-full rounded-md border border-soft text-sm text-[#2A161B] p-3 resize-none focus:outline-none focus:border-[#6B132B]/40 bg-white"
              rows={3} placeholder="Resolution notes…" value={notes} onChange={e => setNotes(e.target.value)} />
            <div className="flex gap-2 justify-end mt-4">
              <button onClick={() => setResolveId(null)} className="px-4 py-2 rounded-md text-sm text-[#6B6562] hover:text-[#2A161B] transition-colors">Cancel</button>
              <button onClick={doResolve} disabled={acting}
                className="px-4 py-2 rounded-md bg-[#6B132B] text-white text-sm font-semibold hover:bg-[#6B132B]/90 disabled:opacity-50 transition-all">
                {acting ? 'Saving…' : 'Save Resolution'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
