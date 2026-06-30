'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { ArrowLeft, RefreshCw, Phone, TrendingUp, AlertTriangle, CheckSquare, Bell } from 'lucide-react';

const TIER_BADGE: Record<string, string> = {
  PRIORITY: 'bg-red-100 text-red-700 border border-red-200',
  ESCALATE: 'bg-orange-100 text-orange-700 border border-orange-200',
  STANDARD: 'bg-amber-100 text-amber-700 border border-amber-200',
  MONITOR:  'bg-blue-100 text-blue-700 border border-blue-200',
  NONE:     'bg-emerald-100 text-emerald-700 border border-emerald-200',
};

function fmtDate(d?: string) {
  if (!d) return '—';
  try { return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(d)); }
  catch { return d; }
}

export default function RmDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [detail,  setDetail]  = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [noteMsg, setNoteMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [sent,    setSent]    = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.getAdminRm(id);
      setDetail(r);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { if (id) load(); }, [id]);

  const sendNote = async () => {
    if (!noteMsg.trim()) return;
    setSending(true);
    try {
      await api.notifyRm(id, noteMsg);
      setNoteMsg('');
      setSent(true);
      setTimeout(() => setSent(false), 3000);
    } catch {}
    setSending(false);
  };

  if (loading) return (
    <div className="p-6 space-y-4">
      {[1,2,3].map(i => <div key={i} className="h-24 bg-white rounded-xl border border-slate-200 animate-pulse" />)}
    </div>
  );

  if (!detail) return (
    <div className="p-6">
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
        <p className="text-slate-500">RM not found</p>
        <Link href="/admin/rms" className="mt-3 inline-flex items-center gap-1 text-sm text-[#0f2d5c] hover:underline"><ArrowLeft className="w-3.5 h-3.5" /> Back to RMs</Link>
      </div>
    </div>
  );

  const rm    = detail.rm || {};
  const st    = detail.stats || {};
  const book  = detail.book || [];
  const activity: any[] = (detail.recent_activity || []).slice(0, 10);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/rms" className="p-2 rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-slate-700 transition-colors shadow-sm">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900">{rm.rm_name || id}</h1>
          <p className="text-slate-400 text-sm">@{rm.username} · {rm.role}</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-700 text-xs shadow-sm transition-all">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Book Size',   value: st.book_size || 0,  icon: null,         accent: 'border-l-[#0f2d5c]' },
          { label: 'At-Risk',     value: st.at_risk_count||0,icon: AlertTriangle, accent: 'border-l-red-500' },
          { label: 'Saves',       value: st.saves || 0,      icon: TrendingUp,   accent: 'border-l-emerald-500' },
          { label: 'Calls',       value: st.calls || 0,      icon: Phone,        accent: 'border-l-blue-500' },
          { label: 'Task Rate',   value: `${st.task_rate||0}%`,icon: CheckSquare, accent: 'border-l-amber-500' },
        ].map(c => (
          <div key={c.label} className={`bg-white rounded-xl border border-slate-200 shadow-sm p-4 border-l-4 ${c.accent}`}>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{c.label}</p>
            <p className="text-xl font-bold text-slate-900 tabular-nums">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Book */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Customer Book ({book.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-2 pr-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Customer</th>
                  <th className="text-left py-2 pr-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Segment</th>
                  <th className="text-left py-2 pr-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Tier</th>
                  <th className="text-right py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {book.slice(0, 12).map((c: any) => (
                  <tr key={c.customer_id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 pr-3">
                      <p className="font-medium text-slate-800 text-[13px]">{c.full_name}</p>
                      <p className="text-[10px] text-slate-400">{c.city}</p>
                    </td>
                    <td className="py-2.5 pr-3 text-[12px] text-slate-600">{c.segment}</td>
                    <td className="py-2.5 pr-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${TIER_BADGE[c.risk_tier]||''}`}>{c.risk_tier}</span>
                    </td>
                    <td className="py-2.5 text-right font-bold text-slate-900 text-[13px] tabular-nums">{Math.round((c.churn_score||0)*100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {book.length > 12 && <p className="text-[11px] text-slate-400 text-center pt-3">+{book.length - 12} more customers</p>}
          </div>
        </div>

        {/* Sidebar: notify + activity */}
        <div className="space-y-5">
          {/* Send note */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <Bell className="w-4 h-4 text-slate-400" /> Send Note to RM
            </h2>
            <textarea
              className="w-full rounded-xl border border-slate-200 text-sm text-slate-800 p-3 resize-none focus:outline-none focus:border-[#0f2d5c]/40"
              rows={3} placeholder="Message to this RM…"
              value={noteMsg} onChange={e => setNoteMsg(e.target.value)}
            />
            <button
              onClick={sendNote} disabled={!noteMsg.trim() || sending}
              className="mt-2 w-full py-2 rounded-lg bg-[#0f2d5c] text-white text-sm font-semibold hover:bg-[#0f2d5c]/90 transition-colors disabled:opacity-50"
            >
              {sending ? 'Sending…' : sent ? '✓ Sent' : 'Send Note'}
            </button>
          </div>

          {/* Recent activity */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Recent Activity</h2>
            {activity.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-4">No activity yet</p>
            ) : (
              <div className="space-y-3">
                {activity.map((a: any, i: number) => (
                  <div key={i} className="flex items-start gap-2.5 text-sm border-b border-slate-50 pb-2.5 last:border-0">
                    <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                      a.type === 'outcome' ? 'bg-emerald-400' : a.type === 'call' ? 'bg-blue-400' : 'bg-amber-400'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] text-slate-700 truncate">{a.summary}</p>
                      <p className="text-[10px] text-slate-400">{a.customer_name} · {fmtDate(a.timestamp)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
