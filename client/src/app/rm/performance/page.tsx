'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getToken, api } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import {
  TrendingUp, Phone, CheckCircle, ShieldAlert, Target,
  Users, MessageSquare, AlertTriangle, ArrowRight,
} from 'lucide-react';

function KpiCard({ icon, label, value, sub, color, accent }: {
  icon: React.ReactNode; label: string; value: string | number;
  sub?: string; color: string; accent: string;
}) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm p-5 border-l-4 ${accent}`}>
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{label}</p>
          <p className="text-[28px] font-black text-slate-900 leading-none mb-1">{value}</p>
          {sub && <p className="text-[11px] text-slate-400">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>{icon}</div>
      </div>
    </div>
  );
}

function MiniBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="text-[12px] text-slate-600 w-28 truncate capitalize">{label.replace(/_/g, ' ')}</span>
      <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[13px] font-bold text-slate-700 w-6 text-right">{value}</span>
    </div>
  );
}

const OUTCOME_COLORS: Record<string, string> = {
  converted: 'bg-emerald-500', retained: 'bg-green-400',
  neutral: 'bg-slate-300', declined: 'bg-orange-400',
  churned: 'bg-red-500', unreachable: 'bg-slate-200',
};
const CHANNEL_COLORS: Record<string, string> = {
  phone: 'bg-blue-500', email: 'bg-purple-500', sms: 'bg-amber-500',
  branch: 'bg-emerald-500', whatsapp: 'bg-green-500', app: 'bg-indigo-500',
};

export default function PerformancePage() {
  const router = useRouter();
  const [perf,     setPerf]     = useState<any>(null);
  const [book,     setBook]     = useState<any>(null);
  const [outcomes, setOutcomes] = useState<any[]>([]);
  const [calls,    setCalls]    = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');

  useEffect(() => {
    if (!getToken()) { router.push('/login'); return; }
    setLoading(true);
    Promise.all([api.getRmPerformance(), api.getRmBookSummary(), api.getRmOutcomes(), api.getRmCalls()])
      .then(([p, b, o, c]) => {
        setPerf(p.performance || p);
        setBook(b.summary);
        setOutcomes(o.outcomes || []);
        setCalls(c.calls || []);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="p-6 space-y-5">
      <Skeleton className="h-8 w-48 rounded-lg" />
      <div className="grid grid-cols-4 gap-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
      <div className="grid grid-cols-3 gap-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}</div>
    </div>
  );

  if (error) return (
    <div className="p-6">
      <div className="bg-red-50 border border-red-100 rounded-xl px-5 py-4 flex items-center gap-3 text-red-600 text-[13px]">
        <AlertTriangle className="w-4 h-4 shrink-0" />{error}
      </div>
    </div>
  );

  const p = perf || {};
  const convRate = p.conversion_rate != null ? `${p.conversion_rate}%` : '—';
  const taskRate = p.tasks_completion_rate != null ? `${p.tasks_completion_rate}%` : '—';
  const avgSent  = p.avg_sentiment != null ? p.avg_sentiment.toFixed(2) : '—';

  const channelEntries = Object.entries(p.channel_breakdown || {}) as [string, number][];
  const outcomeEntries = Object.entries(p.outcome_breakdown || {}) as [string, number][];
  const channelTotal   = channelEntries.reduce((s, [, v]) => s + v, 0);
  const outcomeTotal   = outcomeEntries.reduce((s, [, v]) => s + v, 0);

  const recentOutcomes = [...outcomes].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5);
  const recentCalls    = [...calls].sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()).slice(0, 5);

  const OUTCOME_BADGE: Record<string, string> = {
    converted: 'bg-emerald-100 text-emerald-700', retained: 'bg-green-100 text-green-700',
    neutral: 'bg-slate-100 text-slate-500', declined: 'bg-orange-100 text-orange-600',
    churned: 'bg-red-100 text-red-600', unreachable: 'bg-slate-100 text-slate-400',
  };
  const SENT_BADGE: Record<string, string> = {
    positive: 'bg-emerald-100 text-emerald-700', neutral: 'bg-slate-100 text-slate-500',
    negative: 'bg-red-100 text-red-600',
  };

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-[#0f2d5c]" />
          <h1 className="text-[22px] font-black text-slate-900">My Performance</h1>
          {book && <span className="text-[12px] text-slate-400 ml-2">Book: {book.book_size} customers · {book.at_risk_count} at risk</span>}
        </div>
        <Link href="/rm/today" className="text-[12px] font-semibold text-[#0f2d5c] hover:underline flex items-center gap-1">
          My Day <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {/* KPI Grid — 4 cols */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={<Users className="w-5 h-5 text-[#0f2d5c]" />}      label="Total Interactions"  value={p.total_outcomes ?? 0}   sub="Outcomes logged"        color="bg-blue-50"    accent="border-[#0f2d5c]" />
        <KpiCard icon={<CheckCircle className="w-5 h-5 text-emerald-600" />} label="Saves / Retained"  value={p.saves_retained ?? 0}  sub="Customers retained"     color="bg-emerald-50" accent="border-emerald-500" />
        <KpiCard icon={<Target className="w-5 h-5 text-purple-600" />}      label="Conversion Rate"    value={convRate}               sub="Offer accepted / presented" color="bg-purple-50" accent="border-purple-500" />
        <KpiCard icon={<Phone className="w-5 h-5 text-sky-600" />}          label="Calls Made"         value={p.calls_made ?? 0}      sub="Recorded & analyzed"    color="bg-sky-50"     accent="border-sky-500" />
        <KpiCard icon={<MessageSquare className="w-5 h-5 text-amber-600" />} label="Avg. Call Sentiment" value={avgSent}              sub="−1 negative → +1 positive" color="bg-amber-50"  accent="border-amber-500" />
        <KpiCard icon={<CheckCircle className="w-5 h-5 text-teal-600" />}   label="Task Completion"    value={taskRate}               sub="Done / Assigned"        color="bg-teal-50"    accent="border-teal-500" />
        <KpiCard icon={<ShieldAlert className="w-5 h-5 text-red-500" />}    label="Compliance Flags"   value={p.compliance_flags ?? 0} sub={p.compliance_flags > 0 ? 'Needs review' : 'All clear'} color={p.compliance_flags > 0 ? 'bg-red-50' : 'bg-emerald-50'} accent={p.compliance_flags > 0 ? 'border-red-500' : 'border-emerald-500'} />
        <KpiCard icon={<TrendingUp className="w-5 h-5 text-indigo-600" />}  label="Avg. Portfolio Risk" value={book ? `${(book.avg_churn_score * 100).toFixed(0)}%` : '—'} sub="Mean churn probability" color="bg-indigo-50" accent="border-indigo-400" />
      </div>

      {/* 3-column lower section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Channel breakdown */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h2 className="text-[14px] font-bold text-slate-800 mb-4">Outreach by Channel</h2>
          {channelTotal === 0
            ? <p className="text-[12px] text-slate-400 py-8 text-center">No outreach logged yet</p>
            : <div className="space-y-1">{channelEntries.map(([ch, cnt]) => <MiniBar key={ch} label={ch} value={cnt} max={channelTotal} color={CHANNEL_COLORS[ch] || 'bg-slate-400'} />)}</div>}
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span>Total</span><span className="font-bold text-slate-700">{channelTotal} interactions</span>
          </div>
        </div>

        {/* Outcome breakdown */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h2 className="text-[14px] font-bold text-slate-800 mb-4">Outcomes Breakdown</h2>
          {outcomeTotal === 0
            ? <p className="text-[12px] text-slate-400 py-8 text-center">No outcomes logged yet</p>
            : <div className="space-y-1">{outcomeEntries.map(([oc, cnt]) => <MiniBar key={oc} label={oc} value={cnt} max={outcomeTotal} color={OUTCOME_COLORS[oc] || 'bg-slate-400'} />)}</div>}
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span>Save rate</span>
            <span className="font-bold text-emerald-600">{outcomeTotal > 0 ? `${((outcomeEntries.filter(([k]) => ['converted','retained'].includes(k)).reduce((s,[,v])=>s+v,0)/outcomeTotal)*100).toFixed(0)}%` : '—'}</span>
          </div>
        </div>

        {/* Compliance / health card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col">
          <h2 className="text-[14px] font-bold text-slate-800 mb-4">Compliance Health</h2>
          <div className="flex-1 space-y-3">
            {[
              { label: 'DPDPA Consent', ok: true, note: 'All outreach consent-gated' },
              { label: 'TRAI TCCCPR', ok: true, note: 'DLT-registered templates used' },
              { label: 'Call Recording', ok: (p.compliance_flags ?? 0) === 0, note: (p.compliance_flags ?? 0) === 0 ? 'No flags raised' : `${p.compliance_flags} flag(s) need review` },
              { label: 'Approval Gate', ok: true, note: 'RM approval required before send' },
            ].map(item => (
              <div key={item.label} className="flex items-start gap-2.5">
                <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${item.ok ? 'bg-emerald-100' : 'bg-red-100'}`}>
                  <div className={`w-2 h-2 rounded-full ${item.ok ? 'bg-emerald-500' : 'bg-red-500'}`} />
                </div>
                <div>
                  <p className="text-[12px] font-semibold text-slate-700">{item.label}</p>
                  <p className="text-[10px] text-slate-400">{item.note}</p>
                </div>
              </div>
            ))}
          </div>
          {(p.compliance_flags ?? 0) > 0 && (
            <Link href="/rm/calls" className="mt-4 flex items-center gap-1 text-[11px] font-semibold text-red-600 hover:underline">
              <AlertTriangle className="w-3 h-3" /> Review flagged calls <ArrowRight className="w-3 h-3" />
            </Link>
          )}
        </div>
      </div>

      {/* Recent activity — 2 col */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent outcomes */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[14px] font-bold text-slate-800">Recent Outcomes</h2>
            <Link href="/rm/outcomes" className="text-[11px] text-[#0f2d5c] font-semibold hover:underline flex items-center gap-1">All <ArrowRight className="w-3 h-3" /></Link>
          </div>
          {recentOutcomes.length === 0
            ? <p className="text-[12px] text-slate-400 py-6 text-center">No outcomes logged yet</p>
            : <div className="divide-y divide-slate-50">
                {recentOutcomes.map(o => (
                  <div key={o.id} className="flex items-center gap-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <Link href={`/rm/customers/${o.customer_id}`} className="text-[12px] font-semibold text-[#0f2d5c] hover:underline truncate block">{o.customer_id}</Link>
                      <p className="text-[10px] text-slate-400 capitalize">{o.action_taken?.replace(/_/g,' ')} · {o.channel}</p>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded capitalize ${OUTCOME_BADGE[o.outcome] || 'bg-slate-50 text-slate-500'}`}>{o.outcome}</span>
                    <span className="text-[10px] text-slate-400 shrink-0">{new Date(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                  </div>
                ))}
              </div>}
        </div>

        {/* Recent calls */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[14px] font-bold text-slate-800">Recent Calls</h2>
            <Link href="/rm/calls" className="text-[11px] text-[#0f2d5c] font-semibold hover:underline flex items-center gap-1">All <ArrowRight className="w-3 h-3" /></Link>
          </div>
          {recentCalls.length === 0
            ? <p className="text-[12px] text-slate-400 py-6 text-center">No calls recorded yet</p>
            : <div className="divide-y divide-slate-50">
                {recentCalls.map(c => (
                  <div key={c.id} className="flex items-center gap-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <Link href={`/rm/customers/${c.customer_id}`} className="text-[12px] font-semibold text-[#0f2d5c] hover:underline truncate block">{c.customer_name || c.customer_id}</Link>
                      <p className="text-[10px] text-slate-400">{c.duration_sec ? `${Math.floor(c.duration_sec / 60)}m ${c.duration_sec % 60}s` : '—'} · {c.detected_language?.toUpperCase() || 'EN'}</p>
                    </div>
                    {c.sentiment && <span className={`text-[10px] font-semibold px-2 py-0.5 rounded capitalize ${SENT_BADGE[c.sentiment] || 'bg-slate-50 text-slate-500'}`}>{c.sentiment}</span>}
                    <span className="text-[10px] text-slate-400 shrink-0">{new Date(c.started_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                  </div>
                ))}
              </div>}
        </div>
      </div>
    </div>
  );
}
