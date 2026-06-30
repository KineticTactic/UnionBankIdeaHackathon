'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import {
  Users, TrendingUp, AlertTriangle, Shield,
  Activity, Zap, BarChart3, RefreshCw,
  ArrowUpRight, CheckCircle2, Clock, ChevronRight, Radio,
} from 'lucide-react';

const TIER_COLORS: Record<string, string> = {
  PRIORITY: 'bg-red-500/15 text-red-400 border-red-500/30',
  ESCALATE: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  STANDARD: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  MONITOR:  'bg-blue-500/15 text-blue-400 border-blue-500/30',
  NONE:     'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
};

function PulseDot() {
  return (
    <span className="relative flex h-2 w-2">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
    </span>
  );
}

function StatCard({ label, value, sub, icon: Icon, accent }: { label: string; value: string | number; sub?: string; icon: React.ElementType; accent: string }) {
  return (
    <div className={`rounded-xl border bg-white/4 p-5 flex flex-col gap-3 ${accent}`}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-white/50">{label}</span>
        <Icon className="w-4 h-4 text-white/25" />
      </div>
      <div className="flex items-end gap-2">
        <span className="text-3xl font-bold text-white tabular-nums">{value}</span>
        {sub && <span className="text-[11px] text-white/40 mb-1">{sub}</span>}
      </div>
    </div>
  );
}

const LIVE_EVENTS = [
  'ARGUS → salary credit stopped · CUST-0008 · ESCALATE tier',
  'COMPASS → action plan: phone call + FD renewal offer · CUST-0001',
  'HERALD → email dispatched · CUST-0003 · consent verified',
  'VERDICT → email opened · CUST-0003 · +1 engagement event',
  'ARGUS → inactivity spike detected · CUST-0011 · MONITOR→STANDARD',
  'ORACLE → REFINE cycle: promoted 3 prompt variants',
  'HERALD → push notification sent · CUST-0019 · FCM OK',
  'COMPASS → suppressed · CUST-0007 · cooldown 7d active',
  'ARGUS → large outward transfer · CUST-0005 · PRIORITY tier',
  'VERDICT → retention outcome confirmed · CUST-0003 · +0.22 CATE',
];

export default function AdminCommandCenter() {
  const [stats,   setStats]   = useState<any>(null);
  const [health,  setHealth]  = useState<any>(null);
  const [kafka,   setKafka]   = useState<any>(null);
  const [mhealth, setMhealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tickIdx, setTickIdx] = useState(0);
  const router = useRouter();
  const tickRef = useRef(0);

  const load = async () => {
    setLoading(true);
    try {
      const [s, h, k, mh] = await Promise.all([
        api.getAdminStats(),
        api.getAdminHealth(),
        api.getKafkaStatus(),
        api.getModelHealth(),
      ]);
      setStats(s);
      setHealth(h);
      setKafka(k);
      setMhealth(mh);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Ticker
  useEffect(() => {
    const iv = setInterval(() => setTickIdx(i => (i + 1) % LIVE_EVENTS.length), 2200);
    return () => clearInterval(iv);
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-72 text-white/30 text-sm animate-pulse">Loading Command Center…</div>
  );

  const s = stats?.stats || {};
  const leaderboard: any[] = stats?.rm_leaderboard || [];
  const atRisk: any[] = stats?.top_at_risk || [];
  const layers: any[] = health?.layers || [];
  const tierDist = s.tier_distribution || {};
  const totalTier = Object.values(tierDist).reduce((a: number, b) => a + (b as number), 0) || 1;

  // Attention rail counts
  const pendingEsc = 3; // demo — from escalations data
  const pendingApprovals = kafka?.pendingApprovals ?? 1;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Command Center</h1>
          <p className="text-white/40 text-sm mt-0.5">Bank-wide live overview — PCOP v2 · Union Bank</p>
        </div>
        <button onClick={load}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/6 hover:bg-white/10 text-white/60 hover:text-white text-xs transition-all">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Attention rail */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Pending Approvals', value: pendingApprovals, href: '/admin/approvals', accent: 'border-amber-500/30 bg-amber-500/8', color: 'text-amber-400' },
          { label: 'Open Escalations',  value: pendingEsc,       href: '/admin/escalations', accent: 'border-red-500/20 bg-red-500/5', color: 'text-red-400' },
          { label: 'Active Signals',    value: s.active_signals_today ?? 32, href: '/signals', accent: 'border-sky-500/20 bg-sky-500/5', color: 'text-sky-400' },
          { label: 'Outreach (24h)',    value: s.outreach_sent_24h ?? '—', href: '/admin/approvals', accent: 'border-emerald-500/20 bg-emerald-500/5', color: 'text-emerald-400' },
        ].map(item => (
          <button key={item.label} onClick={() => router.push(item.href)}
            className={`rounded-xl border p-4 text-left hover:brightness-110 transition-all group ${item.accent}`}>
            <p className="text-[10px] text-white/40 uppercase tracking-widest font-semibold mb-1">{item.label}</p>
            <div className="flex items-end justify-between">
              <p className={`text-2xl font-bold tabular-nums ${item.color}`}>{item.value}</p>
              <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/50 transition-colors" />
            </div>
          </button>
        ))}
      </div>

      {/* Live Kafka ticker */}
      <div className="rounded-xl border border-white/8 bg-white/3 px-4 py-3 flex items-center gap-3 overflow-hidden">
        <div className="flex items-center gap-2 shrink-0">
          <PulseDot />
          <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">LIVE</span>
        </div>
        <div className="flex-1 overflow-hidden">
          <p key={tickIdx} className="text-[12px] text-sky-300/80 font-mono truncate animate-in slide-in-from-right duration-300">
            {LIVE_EVENTS[tickIdx]}
          </p>
        </div>
        <span className="text-[10px] text-white/20 shrink-0 tabular-nums">
          {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Customers"  value={s.total_customers ?? '—'} sub="portfolio"           icon={Users}        accent="border-white/8" />
        <StatCard label="At-Risk"          value={s.at_risk_count ?? '—'}   sub="PRIORITY+ESCALATE"  icon={AlertTriangle} accent="border-red-500/20" />
        <StatCard label="Saves (30d)"      value={s.saves_this_month ?? '—'} sub="retained/converted" icon={CheckCircle2} accent="border-emerald-500/20" />
        <StatCard label="Avg Churn Score"  value={s.avg_churn_score !== undefined ? `${Math.round(s.avg_churn_score*100)}%` : '—'} sub="portfolio avg" icon={TrendingUp} accent="border-purple-500/20" />
      </div>

      {/* Middle row: tier dist + model health + layer health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Tier distribution */}
        <div className="rounded-xl border border-white/8 bg-white/4 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-4">Risk Tier Distribution</p>
          <div className="space-y-2.5">
            {(['PRIORITY','ESCALATE','STANDARD','MONITOR','NONE'] as const).map(tier => {
              const count = tierDist[tier] || 0;
              const pct   = Math.round((count / totalTier) * 100);
              return (
                <div key={tier}>
                  <div className="flex items-center justify-between text-xs mb-0.5">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${TIER_COLORS[tier]}`}>{tier}</span>
                    <span className="text-white/40 tabular-nums">{count} <span className="text-white/25">({pct}%)</span></span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
                    <div className={`h-full rounded-full ${tier==='PRIORITY'?'bg-red-500':tier==='ESCALATE'?'bg-orange-500':tier==='STANDARD'?'bg-amber-500':tier==='MONITOR'?'bg-blue-500':'bg-emerald-500'}`}
                      style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Model health */}
        <div className="rounded-xl border border-white/8 bg-white/4 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-4">Model Health (CHRONOS)</p>
          {mhealth ? (
            <div className="space-y-2">
              {[
                { name: 'Ensemble (FusionX)', auc: mhealth.ensemble_auc ?? 0.93, weight: null },
                { name: 'TARE (GRU)',          auc: mhealth.tare_auc    ?? 0.91, weight: '35%' },
                { name: 'HABITAT (XGBoost)',   auc: mhealth.habitat_auc ?? 0.89, weight: '30%' },
                { name: 'GraphSAGE (GNN)',     auc: mhealth.graphsage_auc ?? 0.88, weight: '20%' },
                { name: 'GENESIS (LR)',        auc: mhealth.genesis_auc ?? 0.82, weight: '15%' },
              ].map(m => (
                <div key={m.name} className="flex items-center gap-2 py-1.5 border-b border-white/5 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] text-white/70 truncate">{m.name}</p>
                  </div>
                  {m.weight && <span className="text-[10px] text-white/30">{m.weight}</span>}
                  <span className="text-sm font-bold text-emerald-400 tabular-nums">{m.auc.toFixed(3)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {[['Ensemble (FusionX)','0.930'],['TARE','0.913'],['HABITAT','0.889'],['GraphSAGE','0.882'],['GENESIS','0.820']].map(([n,v]) => (
                <div key={n} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                  <span className="text-[12px] text-white/60">{n}</span>
                  <span className="text-sm font-bold text-emerald-400">{v}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Layer health */}
        <div className="rounded-xl border border-white/8 bg-white/4 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-4">System Health</p>
          <div className="space-y-1.5">
            {layers.map((l: any) => (
              <div key={l.id} className="flex items-center gap-2.5 py-1.5 border-b border-white/5 last:border-0">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                <span className="text-[12px] text-white/70 flex-1">{l.name}</span>
                <span className="text-[11px] text-white/35 tabular-nums">{l.latency_ms}ms</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* RM Leaderboard + Top At-Risk */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-white/8 bg-white/4 p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40">RM Leaderboard</p>
            <button onClick={() => router.push('/admin/rms')} className="text-[11px] text-white/30 hover:text-white transition-colors flex items-center gap-1">
              View all <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          {leaderboard.map((rm: any, i: number) => (
            <div key={rm.username} className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0">
              <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-[11px] font-bold shrink-0">{i+1}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{rm.rm_name}</p>
                <p className="text-[11px] text-white/35">{rm.book_size} customers · {rm.at_risk_count} at risk</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-emerald-400">{rm.saves}</p>
                <p className="text-[10px] text-white/25">saves</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-sky-400">{rm.task_completion_rate}%</p>
                <p className="text-[10px] text-white/25">tasks</p>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-white/8 bg-white/4 p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40">Top At-Risk</p>
            <Shield className="w-4 h-4 text-white/20" />
          </div>
          {atRisk.slice(0,8).map((c: any) => (
            <div key={c.customer_id} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{c.full_name}</p>
                <p className="text-[11px] text-white/35 truncate">{c.rm_name}</p>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border shrink-0 ${TIER_COLORS[c.risk_tier]}`}>{c.risk_tier}</span>
              <span className="text-sm font-bold text-white/60 tabular-nums shrink-0">{Math.round((c.churn_score||0)*100)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
