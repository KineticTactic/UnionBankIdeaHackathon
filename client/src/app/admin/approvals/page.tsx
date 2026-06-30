'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { CheckCircle2, XCircle, RefreshCw, Clock, Send, AlertTriangle } from 'lucide-react';

function fmtDate(dt?: string) {
  if (!dt) return '—';
  try { return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(dt)); }
  catch { return dt; }
}

const CHANNEL_COLORS: Record<string, string> = {
  email: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  sms:   'bg-green-500/15 text-green-400 border-green-500/30',
  push:  'bg-purple-500/15 text-purple-400 border-purple-500/30',
  call:  'bg-amber-500/15 text-amber-400 border-amber-500/30',
};

export default function ApprovalsPage() {
  const [items,    setItems]    = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [acting,   setActing]   = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [reason,   setReason]   = useState('');
  const [stats,    setStats]    = useState({ pending: 0, approved: 0, rejected: 0 });

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.getPendingApprovals();
      const all: any[] = r.approvals || r.items || [];
      setItems(all);
      setStats({
        pending:  all.filter(x => x.status === 'pending').length,
        approved: all.filter(x => x.status === 'approved').length,
        rejected: all.filter(x => x.status === 'rejected').length,
      });
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const approve = async (id: string) => {
    setActing(id);
    try { await api.approveOutreach(id, 'admin'); await load(); }
    catch {}
    setActing(null);
  };

  const reject = async (id: string) => {
    setActing(id);
    try { await api.rejectOutreach(id, reason || 'Rejected by admin', 'admin'); setRejectId(null); setReason(''); await load(); }
    catch {}
    setActing(null);
  };

  const pending = items.filter(x => x.status === 'pending');
  const done    = items.filter(x => x.status !== 'pending');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Approval Queue</h1>
          <p className="text-white/40 text-sm mt-0.5">HERALD human-in-loop gate — review outreach before dispatch</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/6 hover:bg-white/10 text-white/60 hover:text-white text-xs transition-all">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
          <p className="text-[10px] text-amber-400/70 uppercase tracking-widest font-semibold mb-1">Pending Review</p>
          <p className="text-3xl font-bold text-amber-400">{stats.pending}</p>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
          <p className="text-[10px] text-emerald-400/70 uppercase tracking-widest font-semibold mb-1">Approved</p>
          <p className="text-3xl font-bold text-emerald-400">{stats.approved}</p>
        </div>
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5">
          <p className="text-[10px] text-red-400/70 uppercase tracking-widest font-semibold mb-1">Rejected</p>
          <p className="text-3xl font-bold text-red-400">{stats.rejected}</p>
        </div>
      </div>

      {/* RBI compliance note */}
      <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4 flex items-start gap-3">
        <AlertTriangle className="w-4 h-4 text-sky-400 mt-0.5 shrink-0" />
        <p className="text-xs text-sky-300/80">
          <strong>RBI AI Governance 2024</strong> — All AI-generated outreach must pass human review before dispatch. Approved messages are logged with approver identity and timestamp for audit.
        </p>
      </div>

      {loading && <p className="text-white/30 text-sm animate-pulse py-4">Loading…</p>}

      {/* Pending */}
      {!loading && pending.length === 0 && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-8 text-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3 opacity-60" />
          <p className="text-emerald-300 font-semibold">Queue is clear</p>
          <p className="text-white/30 text-sm mt-1">No pending approvals</p>
        </div>
      )}

      {pending.length > 0 && (
        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-amber-400/70">{pending.length} Pending</p>
          {pending.map((item: any) => (
            <div key={item.id || item.jobId} className="rounded-xl border border-amber-500/20 bg-amber-500/4 p-5">
              <div className="flex items-start gap-4">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
                  <Send className="w-4 h-4 text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="text-sm font-bold text-white">{item.customer_name || item.customer_id}</p>
                    {item.channel && (
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${CHANNEL_COLORS[item.channel] || 'bg-white/8 text-white/50 border-white/10'}`}>
                        {item.channel?.toUpperCase()}
                      </span>
                    )}
                  </div>
                  {item.subject && <p className="text-sm text-white/60 mb-1">"{item.subject}"</p>}
                  {item.content?.email?.subject && <p className="text-sm text-white/60 mb-1">"{item.content.email.subject}"</p>}
                  {(item.offer || item.action) && (
                    <p className="text-xs text-white/40">Offer: {item.offer || item.action}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    <span className="flex items-center gap-1 text-[11px] text-white/25">
                      <Clock className="w-3 h-3" />{fmtDate(item.created_at || item.queued_at)}
                    </span>
                    {item.rm_username && <span className="text-[11px] text-white/25">RM: {item.rm_username}</span>}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => { setRejectId(item.id || item.jobId); setReason(''); }}
                    disabled={acting === (item.id || item.jobId)}
                    className="px-3 py-1.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-semibold hover:bg-red-500/25 transition-all disabled:opacity-50 flex items-center gap-1"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Reject
                  </button>
                  <button
                    onClick={() => approve(item.id || item.jobId)}
                    disabled={acting === (item.id || item.jobId)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold hover:bg-emerald-500/25 transition-all disabled:opacity-50 flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> {acting === (item.id || item.jobId) ? 'Sending…' : 'Approve'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Done */}
      {done.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-white/30">Recent</p>
          {done.slice(0, 5).map((item: any) => (
            <div key={item.id || item.jobId} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/5 bg-white/2 opacity-60">
              {item.status === 'approved'
                ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                : <XCircle className="w-4 h-4 text-red-400 shrink-0" />}
              <p className="text-sm text-white/60 flex-1 truncate">{item.customer_name || item.customer_id}</p>
              <span className={`text-[10px] font-semibold ${item.status === 'approved' ? 'text-emerald-400' : 'text-red-400'}`}>
                {item.status?.toUpperCase()}
              </span>
              <span className="text-[11px] text-white/25">{fmtDate(item.updated_at || item.created_at)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Reject modal */}
      {rejectId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center" onClick={() => setRejectId(null)}>
          <div className="bg-[#0f2d5c] border border-white/15 rounded-2xl p-6 w-[440px] shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-white mb-4">Reject Outreach</h3>
            <textarea
              className="w-full rounded-xl bg-white/6 border border-white/10 text-sm text-white placeholder-white/25 p-3 resize-none focus:outline-none focus:border-white/30"
              rows={3}
              placeholder="Rejection reason (required for audit trail)…"
              value={reason}
              onChange={e => setReason(e.target.value)}
            />
            <div className="flex gap-2 justify-end mt-4">
              <button onClick={() => setRejectId(null)} className="px-4 py-2 rounded-lg text-sm text-white/50 hover:text-white transition-colors">Cancel</button>
              <button
                onClick={() => reject(rejectId)}
                disabled={!reason.trim()}
                className="px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-sm font-semibold hover:bg-red-500/30 transition-all disabled:opacity-40"
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
