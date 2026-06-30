'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { ArrowLeft, PhoneCall, CheckSquare, ClipboardList, User, TrendingUp, AlertTriangle } from 'lucide-react';

const TIER_COLORS: Record<string, string> = {
  PRIORITY: 'bg-red-500/15 text-red-400 border-red-500/30',
  ESCALATE: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  STANDARD: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  MONITOR:  'bg-blue-500/15 text-blue-400 border-blue-500/30',
  NONE:     'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
};

const ACT_ICONS: Record<string, React.ElementType> = {
  call:    PhoneCall,
  outcome: ClipboardList,
  task:    CheckSquare,
};

const ACT_COLORS: Record<string, string> = {
  call:    'bg-sky-500/20 text-sky-400',
  outcome: 'bg-emerald-500/20 text-emerald-400',
  task:    'bg-purple-500/20 text-purple-400',
};

function fmtDate(dt?: string) {
  if (!dt) return '—';
  try { return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(dt)); }
  catch { return dt; }
}

export default function RmProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();
  const [data, setData]     = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]       = useState<'activity' | 'book'>('activity');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try { const r = await api.getAdminRm(id as string); setData(r); } catch {}
      setLoading(false);
    })();
  }, [id]);

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-white/30 text-sm animate-pulse">Loading RM profile…</div>
  );
  if (!data) return (
    <div className="text-white/40 text-sm p-8">RM not found.</div>
  );

  const rm    = data.rm    || {};
  const stats = data.stats || {};
  const book  = data.book  || [];
  const activity: any[] = data.activity || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/admin/rms')} className="p-2 rounded-lg bg-white/6 hover:bg-white/10 text-white/60 hover:text-white transition-all">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">{rm.rm_name}</h1>
          <p className="text-white/40 text-sm">@{rm.username} · {rm.role}</p>
        </div>
        {rm.active && <span className="ml-2 flex items-center gap-1.5 text-[11px] text-emerald-400"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />Active</span>}
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Book Size',    value: stats.book_size    ?? '—', accent: '' },
          { label: 'At-Risk',      value: stats.at_risk_count ?? '—', accent: 'text-red-400' },
          { label: 'Saves',        value: stats.saves         ?? '—', accent: 'text-emerald-400' },
          { label: 'Total Calls',  value: stats.calls         ?? '—', accent: 'text-sky-400' },
          { label: 'Task Comp.',   value: `${stats.task_completion_rate ?? 0}%`, accent: 'text-purple-400' },
        ].map(item => (
          <div key={item.label} className="rounded-xl border border-white/8 bg-white/4 p-4">
            <p className="text-[10px] text-white/40 uppercase tracking-widest font-semibold mb-1">{item.label}</p>
            <p className={`text-2xl font-bold ${item.accent || 'text-white'}`}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/4 border border-white/8 rounded-xl p-1 w-fit">
        {(['activity', 'book'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t ? 'bg-white/12 text-white' : 'text-white/40 hover:text-white'}`}
          >
            {t === 'activity' ? 'Activity Feed' : `Book (${book.length})`}
          </button>
        ))}
      </div>

      {tab === 'activity' && (
        <div className="rounded-xl border border-white/8 bg-white/4 divide-y divide-white/5 overflow-hidden">
          {activity.length === 0 && <p className="px-5 py-8 text-white/30 text-sm">No activity recorded.</p>}
          {activity.map((item: any, i: number) => {
            const Icon  = ACT_ICONS[item.type] || ClipboardList;
            const color = ACT_COLORS[item.type] || 'bg-white/10 text-white/50';
            return (
              <div key={i} className="flex items-start gap-4 px-5 py-4 hover:bg-white/3 transition-colors">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium truncate">{item.customer_name}</p>
                  <p className="text-[12px] text-white/50 truncate capitalize">{item.summary}</p>
                </div>
                <p className="text-[11px] text-white/25 shrink-0 mt-0.5">{fmtDate(item.timestamp)}</p>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'book' && (
        <div className="rounded-xl border border-white/8 bg-white/4 overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-0 text-[10px] font-semibold uppercase tracking-widest text-white/30 px-5 py-3 border-b border-white/8">
            <span>Customer</span>
            <span className="w-24 text-center">Segment</span>
            <span className="w-24 text-center">Tier</span>
            <span className="w-20 text-right">Churn</span>
          </div>
          {book.map((c: any) => (
            <div key={c.customer_id} className="grid grid-cols-[1fr_auto_auto_auto] gap-0 items-center px-5 py-3 border-b border-white/5 last:border-0 hover:bg-white/4 transition-colors">
              <div>
                <p className="text-sm font-medium text-white">{c.full_name}</p>
                <p className="text-[11px] text-white/35">{c.city}</p>
              </div>
              <div className="w-24 text-center text-xs text-white/50">{c.segment}</div>
              <div className="w-24 text-center">
                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${TIER_COLORS[c.risk_tier] || ''}`}>{c.risk_tier}</span>
              </div>
              <div className="w-20 text-right text-sm font-bold text-white tabular-nums">
                {Math.round((c.churn_score || 0) * 100)}%
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
