'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import {
  Users, TrendingUp, AlertTriangle, Shield,
  Activity, Zap, BarChart3, RefreshCw,
  ArrowUpRight, CheckCircle2, Clock, ChevronRight,
} from 'lucide-react';

const TIER_COLORS: Record<string, string> = {
  PRIORITY: 'bg-red-500/15 text-red-400 border-red-500/30',
  ESCALATE: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  STANDARD: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  MONITOR:  'bg-blue-500/15 text-blue-400 border-blue-500/30',
  NONE:     'bg-green-500/15 text-green-400 border-green-500/30',
};

const LAYER_COLORS: Record<string, string> = {
  live:    'bg-emerald-500',
  warning: 'bg-amber-500',
  down:    'bg-red-500',
};

function StatCard({ label, value, sub, icon: Icon, accent }: { label: string; value: string | number; sub?: string; icon: React.ElementType; accent: string }) {
  return (
    <div className={`rounded-xl border bg-white/4 p-5 flex flex-col gap-3 ${accent}`}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-white/50">{label}</span>
        <Icon className="w-4 h-4 text-white/30" />
      </div>
      <div className="flex items-end gap-2">
        <span className="text-3xl font-bold text-white tabular-nums">{value}</span>
        {sub && <span className="text-[11px] text-white/40 mb-1">{sub}</span>}
      </div>
    </div>
  );
}

function PulseDot({ status }: { status: string }) {
  const color = status === 'live' ? 'bg-emerald-400' : status === 'warning' ? 'bg-amber-400' : 'bg-red-400';
  return (
    <span className="relative flex h-2 w-2">
      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-60 ${color}`} />
      <span className={`relative inline-flex h-2 w-2 rounded-full ${color}`} />
    </span>
  );
}

export default function AdminCommandCenter() {
  const [stats, setStats]   = useState<any>(null);
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [s, h] = await Promise.all([api.getAdminStats(), api.getAdminHealth()]);
      setStats(s);
      setHealth(h);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-72 text-white/30 text-sm animate-pulse">
      Loading Command Center…
    </div>
  );

  const s = stats?.stats || {};
  const leaderboard: any[] = stats?.rm_leaderboard || [];
  const atRisk: any[] = stats?.top_at_risk || [];
  const layers: any[] = health?.layers || [];

  const tierDist = s.tier_distribution || {};
  const totalTier = Object.values(tierDist).reduce((a: number, b) => a + (b as number), 0) || 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Command Center</h1>
          <p className="text-white/40 text-sm mt-0.5">Real-time portfolio overview — PCOP v2</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/6 hover:bg-white/10 text-white/60 hover:text-white text-xs transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Customers"      value={s.total_customers ?? '—'}   sub="in portfolio"            icon={Users}         accent="border-white/8" />
        <StatCard label="At-Risk Today"        value={s.at_risk_count ?? '—'}      sub="PRIORITY + ESCALATE"     icon={AlertTriangle}  accent="border-red-500/20" />
        <StatCard label="Saves This Month"     value={s.saves_this_month ?? '—'}   sub="retained / converted"    icon={CheckCircle2}   accent="border-emerald-500/20" />
        <StatCard label="Signals Today"        value={s.active_signals_today ?? '—'} sub="active ARGUS signals"  icon={Activity}       accent="border-sky-500/20" />
      </div>

      {/* Layer health + Tier dist */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Layer health */}
        <div className="lg:col-span-1 rounded-xl border border-white/8 bg-white/4 p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-white/50">System Health</span>
            <Zap className="w-4 h-4 text-white/20" />
          </div>
          <div className="space-y-2">
            {layers.map((l: any) => (
              <div key={l.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                <div className="flex items-center gap-2">
                  <PulseDot status={l.status} />
                  <span className="text-sm text-white font-medium">{l.name}</span>
                </div>
                <span className="text-xs text-white/40 tabular-nums">{l.latency_ms}ms</span>
              </div>
            ))}
          </div>
        </div>

        {/* Risk tier breakdown */}
        <div className="lg:col-span-2 rounded-xl border border-white/8 bg-white/4 p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-white/50">Portfolio Tier Distribution</span>
            <BarChart3 className="w-4 h-4 text-white/20" />
          </div>
          <div className="space-y-3">
            {(['PRIORITY','ESCALATE','STANDARD','MONITOR','NONE'] as const).map(tier => {
              const count = tierDist[tier] || 0;
              const pct   = Math.round((count / (totalTier || 1)) * 100);
              return (
                <div key={tier} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${TIER_COLORS[tier]}`}>{tier}</span>
                    <span className="text-white/50 tabular-nums">{count} <span className="text-white/30">({pct}%)</span></span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${tier === 'PRIORITY' ? 'bg-red-500' : tier === 'ESCALATE' ? 'bg-orange-500' : tier === 'STANDARD' ? 'bg-amber-500' : tier === 'MONITOR' ? 'bg-blue-500' : 'bg-emerald-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* RM Leaderboard + Top At-Risk */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* RM Leaderboard */}
        <div className="rounded-xl border border-white/8 bg-white/4 p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-white/50">RM Leaderboard</span>
            <TrendingUp className="w-4 h-4 text-white/20" />
          </div>
          {leaderboard.length === 0 && <p className="text-white/30 text-sm">No RM data</p>}
          {leaderboard.map((rm: any, i) => (
            <div key={rm.username} className="flex items-center gap-3 py-3 border-b border-white/5 last:border-0">
              <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-[11px] font-bold shrink-0">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{rm.rm_name}</p>
                <p className="text-[11px] text-white/40">{rm.book_size} customers · {rm.at_risk_count} at risk</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-emerald-400">{rm.saves}</p>
                <p className="text-[10px] text-white/30">saves</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-sky-400">{rm.task_completion_rate}%</p>
                <p className="text-[10px] text-white/30">tasks done</p>
              </div>
            </div>
          ))}
        </div>

        {/* Top at-risk */}
        <div className="rounded-xl border border-white/8 bg-white/4 p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-white/50">Top At-Risk Customers</span>
            <Shield className="w-4 h-4 text-white/20" />
          </div>
          {atRisk.length === 0 && <p className="text-white/30 text-sm">No at-risk data</p>}
          {atRisk.slice(0, 8).map((c: any) => (
            <div key={c.customer_id} className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{c.full_name}</p>
                <p className="text-[11px] text-white/40 truncate">{c.rm_name}</p>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border shrink-0 ${TIER_COLORS[c.risk_tier]}`}>
                {c.risk_tier}
              </span>
              <span className="text-sm font-bold text-white/70 tabular-nums shrink-0">
                {Math.round((c.churn_score || 0) * 100)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Outreach stats footer */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="rounded-xl border border-white/8 bg-white/4 p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-sky-500/15 flex items-center justify-center">
            <ArrowUpRight className="w-5 h-5 text-sky-400" />
          </div>
          <div>
            <p className="text-xl font-bold text-white tabular-nums">{s.outreach_sent_24h ?? '—'}</p>
            <p className="text-[11px] text-white/40">Outreach sent (24h)</p>
          </div>
        </div>
        <div className="rounded-xl border border-white/8 bg-white/4 p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-purple-500/15 flex items-center justify-center">
            <Clock className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <p className="text-xl font-bold text-white tabular-nums">{s.avg_churn_score !== undefined ? `${Math.round(s.avg_churn_score * 100)}%` : '—'}</p>
            <p className="text-[11px] text-white/40">Avg churn score</p>
          </div>
        </div>
        <div className="rounded-xl border border-white/8 bg-white/4 p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/15 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <p className="text-xl font-bold text-white tabular-nums">{s.saves_this_month ?? '—'}</p>
            <p className="text-[11px] text-white/40">Total saves (30d)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
