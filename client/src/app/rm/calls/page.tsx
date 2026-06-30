'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getToken, api } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Mic, X, AlertTriangle, ChevronRight, Phone, Clock,
  TrendingUp, ShieldCheck, RefreshCw, MessageSquare,
} from 'lucide-react';

const SENTIMENT_COLORS: Record<string, string> = {
  positive:   'bg-sage-soft text-sage-brand border-soft',
  neutral:    'bg-slate-100 text-slate-500 border-slate-200',
  negative:   'bg-crimson-soft text-crimson border-soft',
  distressed: 'bg-crimson-soft text-crimson border-soft',
};
const OUTCOME_COLORS: Record<string, string> = {
  retained:  'bg-sage-soft text-sage-brand',
  converted: 'bg-teal-soft text-teal-dark',
  neutral:   'bg-slate-100 text-slate-600',
  churned:   'bg-crimson-soft text-crimson',
};

function hasFlag(call: any) {
  return Array.isArray(call.compliance_flags) ? call.compliance_flags.length > 0 : !!call.compliance_flag;
}

function fmtDuration(sec: number) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function StatCard({ label, value, sub, icon: Icon, accent = 'navy' }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; accent?: 'navy' | 'red' | 'emerald' | 'amber';
}) {
  const border = { navy: 'border-[var(--crimson)]', red: 'border-red-500', emerald: 'border-emerald-500', amber: 'border-amber-500' };
  const ic     = { navy: 'text-[var(--crimson)]',   red: 'text-crimson',   emerald: 'text-sage-brand',   amber: 'text-copper' };
  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm p-4 border-l-4 ${border[accent]}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{label}</p>
          <p className="text-[28px] font-black text-slate-900 leading-none">{value}</p>
          {sub && <p className="text-[11px] text-slate-400 mt-1">{sub}</p>}
        </div>
        <div className={`p-2 rounded-lg bg-slate-50 ${ic[accent]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

function CallDetail({ call, custName, onClose }: { call: any; custName: string; onClose: () => void }) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Mic className="w-4 h-4 text-[var(--crimson)]" />
          <h2 className="text-[14px] font-bold text-slate-900">Call Detail</h2>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 transition-colors">
          <X className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {/* Customer + badges */}
        <div className="flex items-start gap-3 flex-wrap">
          <div>
            <Link href={`/rm/customers/${call.customer_id}`}
              className="text-[15px] font-bold text-[var(--crimson)] hover:underline block">{custName}</Link>
            <p className="text-[11px] text-slate-400">{call.customer_id}</p>
          </div>
          <div className="flex gap-1.5 flex-wrap mt-0.5">
            {call.committed_at && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-sage-soft text-sage-brand border border-soft">
                Committed
              </span>
            )}
            {hasFlag(call) && (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-crimson bg-crimson-soft px-2 py-0.5 rounded border border-soft">
                <AlertTriangle className="w-3 h-3" /> Flag
              </span>
            )}
            {call.follow_up_required && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-copper-soft text-copper-dark border border-soft">
                Follow-up
              </span>
            )}
          </div>
        </div>

        {/* Meta grid */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Date', val: new Date(call.started_at).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }) },
            { label: 'Time', val: new Date(call.started_at).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' }) },
            { label: 'Duration', val: call.duration_sec ? fmtDuration(call.duration_sec) : '—' },
            { label: 'Language', val: (call.detected_language || 'en').toUpperCase() },
          ].map(({ label, val }) => (
            <div key={label} className="bg-slate-50 rounded-lg p-3">
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">{label}</p>
              <p className="text-[13px] font-semibold text-slate-700 mt-0.5">{val}</p>
            </div>
          ))}
        </div>

        {/* Sentiment + Outcome */}
        <div className="grid grid-cols-2 gap-3">
          {call.sentiment && (
            <div className={`rounded-lg p-3 border ${SENTIMENT_COLORS[call.sentiment] || 'bg-slate-50 border-slate-200 text-slate-500'}`}>
              <p className="text-[10px] font-semibold uppercase tracking-wide opacity-60">Sentiment</p>
              <p className="text-[13px] font-bold capitalize mt-0.5">{call.sentiment}</p>
            </div>
          )}
          {call.outcome && (
            <div className={`rounded-lg p-3 border border-transparent ${OUTCOME_COLORS[call.outcome] || 'bg-slate-50 text-slate-600'}`}>
              <p className="text-[10px] font-semibold uppercase tracking-wide opacity-60">Outcome</p>
              <p className="text-[13px] font-bold capitalize mt-0.5">{call.outcome}</p>
            </div>
          )}
        </div>

        {/* Summary */}
        {call.summary && (
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Summary</p>
            <p className="text-[12px] text-slate-700 bg-slate-50 rounded-xl p-3 leading-relaxed">{call.summary}</p>
          </div>
        )}

        {/* Offer */}
        {call.offer_presented && (
          <div className="bg-teal-soft rounded-xl p-3">
            <p className="text-[10px] font-semibold text-blue-400 uppercase tracking-wide mb-1">Offer Presented</p>
            <p className="text-[12px] text-teal-dark font-medium">{call.offer_presented}</p>
            <p className="text-[11px] text-teal-dark mt-0.5">
              {call.offer_accepted === true ? '✓ Accepted' : call.offer_accepted === false ? '✗ Declined' : 'No response recorded'}
            </p>
          </div>
        )}

        {/* Lists */}
        {call.objections?.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Objections</p>
            <div className="space-y-1">
              {call.objections.map((o: string, i: number) => (
                <p key={i} className="text-[12px] text-slate-600 bg-copper-soft rounded-lg px-3 py-1.5">• {o}</p>
              ))}
            </div>
          </div>
        )}
        {call.commitments?.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Commitments</p>
            <div className="space-y-1">
              {call.commitments.map((c: string, i: number) => (
                <p key={i} className="text-[12px] text-sage-brand bg-sage-soft rounded-lg px-3 py-1.5">✓ {c}</p>
              ))}
            </div>
          </div>
        )}
        {call.rm_action_items?.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Action Items</p>
            <div className="space-y-1">
              {call.rm_action_items.map((a: string, i: number) => (
                <p key={i} className="text-[12px] text-slate-600 bg-slate-50 rounded-lg px-3 py-1.5">→ {a}</p>
              ))}
            </div>
          </div>
        )}
        {call.competitor_mentions?.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Competitor Mentions</p>
            <div className="space-y-1">
              {call.competitor_mentions.map((c: string, i: number) => (
                <p key={i} className="text-[12px] text-crimson bg-crimson-soft rounded-lg px-3 py-1.5">⚠ {c}</p>
              ))}
            </div>
          </div>
        )}
        {call.follow_up_required && call.follow_up_date && (
          <div className="bg-copper-soft border border-soft rounded-xl p-3">
            <p className="text-[10px] font-semibold text-copper uppercase tracking-wide">Follow-up Scheduled</p>
            <p className="text-[13px] font-bold text-copper-dark mt-0.5">
              {new Date(call.follow_up_date).toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'long' })}
            </p>
          </div>
        )}

        {/* Compliance flags */}
        {Array.isArray(call.compliance_flags) && call.compliance_flags.length > 0 && (
          <div className="bg-crimson-soft border border-red-100 rounded-xl p-3">
            <p className="text-[11px] font-semibold text-crimson mb-1.5 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> Compliance Flags
            </p>
            {call.compliance_flags.map((f: string, i: number) => (
              <p key={i} className="text-[11px] text-crimson leading-snug">• {f}</p>
            ))}
          </div>
        )}

        {/* Transcript */}
        {call.transcript && (
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Transcript</p>
            <div className="bg-slate-50 rounded-xl p-3 max-h-48 overflow-y-auto">
              <p className="text-[11px] text-slate-600 whitespace-pre-wrap leading-relaxed">{call.transcript}</p>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
        <button onClick={async () => {
          try { const d = await api.getRmCall(call.id); Object.assign(call, d.call); } catch {}
        }} className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors">
          Load transcript
        </button>
        <Link href={`/rm/customers/${call.customer_id}`}
          className="flex items-center gap-1 text-[12px] font-semibold text-[var(--crimson)] hover:underline">
          Open 360 <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}

export default function CallsPage() {
  const router = useRouter();
  const [calls,     setCalls]     = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [selected,  setSelected]  = useState<any | null>(null);
  const [search,    setSearch]    = useState('');

  const load = () => {
    if (!getToken()) { router.push('/login'); return; }
    setLoading(true);
    Promise.all([api.getRmCalls(), api.getRmBook()])
      .then(([c, b]) => { setCalls(c.calls || []); setCustomers(b.customers || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const custName = (id: string) => {
    const from_list = calls.find(c => c.customer_id === id)?.customer_name;
    return from_list || customers.find(c => c.customer_id === id)?.full_name || id;
  };

  // Derived stats
  const flagCount     = calls.filter(c => hasFlag(c)).length;
  const followUpCount = calls.filter(c => c.follow_up_required).length;
  const avgDurationSec = calls.length
    ? Math.round(calls.reduce((s, c) => s + (c.duration_sec || 0), 0) / calls.length) : 0;
  const positiveCount = calls.filter(c => c.sentiment === 'positive').length;

  // Sentiment distribution
  const sentiments = ['positive', 'neutral', 'negative', 'distressed'];
  const sentimentDist = sentiments.map(s => ({ label: s, count: calls.filter(c => c.sentiment === s).length }));

  // Outcome distribution
  const outcomes = [...new Set(calls.map(c => c.outcome).filter(Boolean))];
  const outcomeDist = outcomes.map(o => ({ label: o, count: calls.filter(c => c.outcome === o).length }));

  const filtered = calls.filter(c =>
    !search ||
    custName(c.customer_id).toLowerCase().includes(search.toLowerCase()) ||
    c.customer_id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 flex flex-col gap-6 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Mic className="w-5 h-5 text-[var(--crimson)]" />
            <h1 className="text-[22px] font-black text-slate-900">Call Log</h1>
          </div>
          <p className="text-[13px] text-slate-400">
            {calls.length} calls recorded ·{' '}
            {flagCount > 0
              ? <span className="text-crimson font-semibold">{flagCount} compliance flag{flagCount > 1 ? 's' : ''}</span>
              : <span className="text-sage-brand font-medium">0 compliance flags</span>}
          </p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-[12px] text-slate-500 hover:bg-slate-50 transition-colors">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* KPI Cards */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Calls"      value={calls.length}              sub="in your book"                 icon={Phone}       accent="navy"    />
          <StatCard label="Avg Duration"     value={avgDurationSec ? fmtDuration(avgDurationSec) : '—'} sub="per call"    icon={Clock}       accent="amber"   />
          <StatCard label="Positive Calls"   value={positiveCount}             sub={`of ${calls.length} total`}   icon={TrendingUp}  accent="emerald" />
          <StatCard label="Compliance Flags" value={flagCount}                 sub={flagCount ? 'needs review' : 'all clear'} icon={ShieldCheck} accent={flagCount ? 'red' : 'emerald'} />
        </div>
      )}

      {/* Summary panels + call list */}
      {loading ? (
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Sentiment breakdown */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-3">Sentiment Breakdown</p>
            {sentimentDist.filter(s => s.count > 0).length === 0 ? (
              <p className="text-[12px] text-slate-400 mt-2">No data yet</p>
            ) : sentimentDist.map(({ label, count }) => count > 0 ? (
              <div key={label} className="flex items-center gap-2 mb-2.5">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded capitalize w-20 text-center border ${SENTIMENT_COLORS[label] || 'bg-slate-50 text-slate-500 border-slate-200'}`}>{label}</span>
                <div className="flex-1 bg-slate-100 rounded-full h-2">
                  <div className="h-2 rounded-full bg-[var(--crimson)] transition-all" style={{ width: `${(count / calls.length) * 100}%` }} />
                </div>
                <span className="text-[11px] font-semibold text-slate-600 w-4 text-right">{count}</span>
              </div>
            ) : null)}
          </div>

          {/* Outcome breakdown */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-3">Outcome Breakdown</p>
            {outcomeDist.length === 0 ? (
              <p className="text-[12px] text-slate-400 mt-2">No outcomes recorded</p>
            ) : outcomeDist.map(({ label, count }) => (
              <div key={label} className="flex items-center gap-2 mb-2.5">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded capitalize w-20 text-center ${OUTCOME_COLORS[label] || 'bg-slate-50 text-slate-600'}`}>{label}</span>
                <div className="flex-1 bg-slate-100 rounded-full h-2">
                  <div className="h-2 rounded-full bg-[var(--crimson)] transition-all" style={{ width: `${(count / calls.length) * 100}%` }} />
                </div>
                <span className="text-[11px] font-semibold text-slate-600 w-4 text-right">{count}</span>
              </div>
            ))}
          </div>

          {/* Action items summary */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-3">Action Summary</p>
            {[
              { label: 'Follow-ups pending',     val: followUpCount,               color: 'text-copper-dark',  bg: 'bg-copper-soft'  },
              { label: 'Calls with objections',  val: calls.filter(c=>c.objections?.length).length,   color: 'text-crimson',    bg: 'bg-crimson-soft'    },
              { label: 'Offers presented',       val: calls.filter(c=>c.offer_presented).length,       color: 'text-teal-dark',   bg: 'bg-teal-soft'   },
              { label: 'Commitments secured',    val: calls.filter(c=>c.commitments?.length).length,   color: 'text-sage-brand',bg: 'bg-sage-soft'},
              { label: 'Competitor mentions',    val: calls.filter(c=>c.competitor_mentions?.length).length, color: 'text-copper-dark', bg: 'bg-copper-soft'},
            ].map(({ label, val, color, bg }) => (
              <div key={label} className={`flex items-center justify-between px-3 py-2 rounded-lg mb-1.5 ${bg}`}>
                <span className="text-[11px] text-slate-600">{label}</span>
                <span className={`text-[13px] font-black ${color}`}>{val}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main: call list + side detail panel */}
      <div className={`flex gap-4 min-h-0 flex-1 ${selected ? 'items-start' : ''}`}>
        {/* Call list */}
        <div className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col transition-all duration-200 ${selected ? 'w-[55%]' : 'flex-1'}`}>
          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
            <MessageSquare className="w-4 h-4 text-slate-400" />
            <span className="text-[13px] font-semibold text-slate-700 flex-1">All Calls</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customer…"
              className="px-3 py-1.5 text-[12px] rounded-lg border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-[var(--crimson)]/20 w-44" />
          </div>

          {/* Table header */}
          <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            <div className="flex-1">Customer</div>
            <div className="w-24">Date</div>
            <div className="w-20">Duration</div>
            <div className="w-28">Outcome</div>
            <div className="w-28">Sentiment</div>
            <div className="w-16">Flag</div>
          </div>

          {loading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Mic className="w-8 h-8 mb-3" />
              <p className="text-[14px] font-medium">No calls logged yet</p>
            </div>
          ) : (
            <div className="overflow-y-auto">
              {filtered.map(c => (
                <div key={c.id} onClick={() => setSelected(selected?.id === c.id ? null : c)}
                  className={`flex items-center gap-3 px-4 py-3.5 border-b border-slate-50 last:border-0 cursor-pointer transition-colors
                    ${selected?.id === c.id ? 'bg-[var(--crimson)]/5 border-l-2 border-l-[var(--crimson)]' : 'hover:bg-slate-50'}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-[var(--crimson)] truncate">{custName(c.customer_id)}</p>
                    <p className="text-[10px] text-slate-400">{c.customer_id}</p>
                  </div>
                  <div className="w-24 text-[11px] text-slate-500">
                    {new Date(c.started_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </div>
                  <div className="w-20 text-[11px] text-slate-500">
                    {c.duration_sec ? `${Math.floor(c.duration_sec / 60)}m` : '—'}
                  </div>
                  <div className="w-28">
                    {c.outcome
                      ? <span className={`text-[10px] font-semibold px-2 py-0.5 rounded capitalize ${OUTCOME_COLORS[c.outcome] || 'bg-slate-50 text-slate-600'}`}>{c.outcome}</span>
                      : <span className="text-[10px] text-slate-300">—</span>}
                  </div>
                  <div className="w-28">
                    {c.sentiment
                      ? <span className={`text-[10px] font-semibold px-2 py-0.5 rounded capitalize border ${SENTIMENT_COLORS[c.sentiment] || 'bg-slate-50 border-slate-200 text-slate-500'}`}>{c.sentiment}</span>
                      : <span className="text-[10px] text-slate-300">—</span>}
                  </div>
                  <div className="w-16">
                    {hasFlag(c)
                      ? <span className="flex items-center gap-1 text-[10px] font-semibold text-crimson"><AlertTriangle className="w-3 h-3" /> Flag</span>
                      : <span className="text-[10px] text-sage-brand font-medium">Clear</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="w-[45%] bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col" style={{ maxHeight: '520px' }}>
            <CallDetail call={selected} custName={custName(selected.customer_id)} onClose={() => setSelected(null)} />
          </div>
        )}
      </div>
    </div>
  );
}
