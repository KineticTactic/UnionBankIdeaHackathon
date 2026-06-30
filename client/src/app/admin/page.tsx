'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Users, AlertTriangle, TrendingUp, Activity, RefreshCw, ArrowUpRight, Radio, BarChart3, Zap } from 'lucide-react';

const TIER_BADGE: Record<string, string> = {
  PRIORITY: 'bg-crimson-soft text-crimson border border-soft',
  ESCALATE: 'bg-copper-soft text-copper-dark border border-soft',
  STANDARD: 'bg-copper-soft text-copper-dark border border-soft',
  MONITOR:  'bg-teal-soft text-teal-dark border border-soft',
  NONE:     'bg-sage-soft text-sage-brand border border-soft',
};
const TIER_BAR: Record<string, string> = {
  PRIORITY: 'bg-crimson', ESCALATE: 'bg-copper', STANDARD: 'bg-copper',
  MONITOR: 'bg-teal', NONE: 'bg-sage-brand',
};

const LIVE_EVENTS = [
  'ARGUS → salary credit stopped · CUST-0008 · ESCALATE tier',
  'COMPASS → action plan: phone call + FD renewal offer · CUST-0001',
  'HERALD → email dispatched · CUST-0003 · consent verified',
  'VERDICT → email opened · CUST-0003 · +1 engagement event',
  'ARGUS → inactivity spike · CUST-0011 · MONITOR→STANDARD',
  'ORACLE → REFINE cycle: promoted 3 prompt variants',
  'HERALD → push notification sent · CUST-0019 · FCM OK',
  'COMPASS → suppressed · CUST-0007 · cooldown 7d active',
  'ARGUS → large outward transfer · CUST-0005 · PRIORITY tier',
  'VERDICT → retention outcome confirmed · CUST-0003 · +0.22 CATE',
];

function StatCard({ label, value, sub, icon: Icon, accent }: {
  label: string; value: string | number; sub?: string; icon: React.ElementType; accent: string;
}) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm p-5 border-l-4 ${accent}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{label}</p>
          <p className="text-2xl font-bold text-slate-900 tabular-nums">{value}</p>
          {sub && <p className="text-[11px] text-slate-400 mt-1">{sub}</p>}
        </div>
        <Icon className="w-5 h-5 text-slate-300 mt-1" />
      </div>
    </div>
  );
}

export default function AdminCommandCenter() {
  const [stats,   setStats]   = useState<any>(null);
  const [health,  setHealth]  = useState<any>(null);
  const [kafka,   setKafka]   = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tickIdx, setTickIdx] = useState(0);
  const tickRef = useRef(0);

  const load = async () => {
    setLoading(true);
    try {
      const [s, h, k] = await Promise.all([api.getAdminStats(), api.getAdminHealth(), api.getKafkaStatus()]);
      setStats(s); setHealth(h); setKafka(k);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const iv = setInterval(() => { tickRef.current = (tickRef.current + 1) % LIVE_EVENTS.length; setTickIdx(tickRef.current); }, 2200);
    return () => clearInterval(iv);
  }, []);

  const st  = stats?.stats || {};
  const tiers = st.tier_distribution || {};
  const total = st.total_customers || 1;
  const layers: any[] = health?.layers || [];
  const leaderboard: any[] = stats?.rm_leaderboard || [];
  const topAtRisk: any[] = stats?.top_at_risk || [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Command Center</h1>
          <p className="text-slate-400 text-sm mt-0.5">Live overview of the PCOP platform</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-700 text-xs shadow-sm transition-all">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Live Kafka ticker */}
      <div className="bg-[var(--crimson)] rounded-xl p-3 flex items-center gap-3 overflow-hidden">
        <div className="flex items-center gap-2 shrink-0">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          <Radio className="w-3.5 h-3.5 text-white/60" />
          <span className="text-[11px] font-semibold text-white/60 uppercase tracking-widest">Live</span>
        </div>
        <p className="text-[12px] text-white/80 truncate font-mono">{LIVE_EVENTS[tickIdx]}</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Customers" value={loading ? '—' : st.total_customers || 0} icon={Users}         accent="border-l-[var(--crimson)]" />
        <StatCard label="At Risk"         value={loading ? '—' : st.at_risk_count || 0}   icon={AlertTriangle} accent="border-l-red-500"     sub="PRIORITY + ESCALATE" />
        <StatCard label="Saves (30d)"     value={loading ? '—' : st.saves_this_month || 0} icon={TrendingUp}   accent="border-l-emerald-500" />
        <StatCard label="Avg Churn Score" value={loading ? '—' : `${Math.round((st.avg_churn_score||0)*100)}%`} icon={Activity} accent="border-l-amber-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Tier distribution */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Tier Distribution</h2>
          <div className="space-y-3">
            {['PRIORITY','ESCALATE','STANDARD','MONITOR','NONE'].map(tier => {
              const count = tiers[tier] || 0;
              const pct   = Math.round(count / total * 100);
              return (
                <div key={tier}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${TIER_BADGE[tier]}`}>{tier}</span>
                    <span className="text-[11px] text-slate-500 tabular-nums">{count} <span className="text-slate-300">({pct}%)</span></span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${TIER_BAR[tier]}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Model health */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Model Health</h2>
          <div className="space-y-2.5">
            {[
              { label: 'FusionX Ensemble', auc: 0.930 },
              { label: 'TARE (gradient boost)', auc: 0.910 },
              { label: 'HABITAT (survival)', auc: 0.890 },
              { label: 'GraphSAGE GNN', auc: 0.880 },
              { label: 'CAUSAL-NET', auc: 0.820 },
              { label: 'DeepHit', auc: 0.870 },
            ].map(m => (
              <div key={m.label} className="flex items-center justify-between">
                <span className="text-[12px] text-slate-600 truncate">{m.label}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[var(--crimson)] rounded-full" style={{ width: `${m.auc * 100}%` }} />
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 tabular-nums w-10 text-right">{m.auc.toFixed(3)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Layer health */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Layer Health</h2>
          <div className="space-y-2">
            {loading ? (
              [1,2,3,4,5].map(i => <div key={i} className="h-8 bg-slate-50 rounded animate-pulse" />)
            ) : layers.map((l: any) => (
              <div key={l.id} className="flex items-center gap-2.5 py-1.5 border-b border-slate-50 last:border-0">
                <span className={`w-2 h-2 rounded-full shrink-0 ${l.status === 'live' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                <span className="text-[12px] text-slate-700 flex-1">{l.name}</span>
                <span className="text-[11px] text-slate-400 tabular-nums">{l.latency_ms}ms</span>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${l.status === 'live' ? 'bg-sage-soft text-sage-brand' : 'bg-crimson-soft text-crimson'}`}>
                  {l.status?.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* RM Leaderboard */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-700">RM Leaderboard</h2>
            <Link href="/admin/rms" className="text-xs text-[var(--crimson)] hover:underline flex items-center gap-1">
              Manage RMs <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          {loading ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-10 bg-slate-50 rounded animate-pulse" />)}</div>
          ) : (
            <div className="divide-y divide-slate-50">
              {leaderboard.slice(0, 6).map((rm: any, i: number) => (
                <div key={rm.username} className="flex items-center gap-3 py-2.5">
                  <span className="w-5 text-[11px] font-bold text-slate-300 text-right shrink-0">{i+1}</span>
                  <div className="w-7 h-7 rounded-full bg-[var(--crimson)] flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                    {rm.rm_name?.split(' ').map((n: string) => n[0]).join('').slice(0,2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-slate-800 truncate">{rm.rm_name}</p>
                    <p className="text-[10px] text-slate-400">{rm.book_size} customers</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-sage-brand">{rm.saves}</p>
                    <p className="text-[9px] text-slate-400">saves</p>
                  </div>
                  <div className="text-right shrink-0 w-10">
                    <p className="text-sm font-bold text-crimson">{rm.at_risk_count}</p>
                    <p className="text-[9px] text-slate-400">at-risk</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top at-risk */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-700">Top At-Risk</h2>
            <Zap className="w-4 h-4 text-slate-300" />
          </div>
          {loading ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-10 bg-slate-50 rounded animate-pulse" />)}</div>
          ) : (
            <div className="divide-y divide-slate-50">
              {topAtRisk.slice(0, 6).map((c: any) => (
                <div key={c.customer_id} className="flex items-center gap-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-slate-800 truncate">{c.full_name}</p>
                    <p className="text-[10px] text-slate-400">{c.city} · {c.segment}</p>
                  </div>
                  <span className="text-sm font-bold text-slate-900 tabular-nums">{Math.round((c.churn_score||0)*100)}%</span>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${TIER_BADGE[c.risk_tier]||''}`}>{c.risk_tier}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
