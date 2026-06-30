'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Scale, ShieldCheck, AlertTriangle, RefreshCw, CheckCircle2 } from 'lucide-react';

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className={`rounded-xl border bg-white/4 p-5 ${accent || 'border-white/8'}`}>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40 mb-2">{label}</p>
      <p className="text-3xl font-bold text-white tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-white/35 mt-1">{sub}</p>}
    </div>
  );
}

export default function ComplianceHubPage() {
  const [ledger, setLedger] = useState<any[]>([]);
  const [bias,   setBias]   = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'consent' | 'bias'>('consent');

  const load = async () => {
    setLoading(true);
    try {
      const [l, b] = await Promise.all([api.getConsentLedger(), api.getBiasAudit()]);
      setLedger(l.records || []);
      setBias(b);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-white/30 text-sm animate-pulse">Loading compliance data…</div>
  );

  const matrix: any[] = bias?.matrix || [];
  const flags: string[] = bias?.disparate_impact_flags || [];
  const portfolioRate = bias?.portfolio_priority_rate ?? 0;

  const optedOut = ledger.filter(r => r.opted_out).length;
  const dpdpaOk  = ledger.filter(r => r.dpdpa_consent).length;
  const traiOk   = ledger.filter(r => r.trai_consent).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Compliance Hub</h1>
          <p className="text-white/40 text-sm mt-0.5">DPDPA 2023 · TRAI TCCCPR 2025 · RBI AI Governance 2024</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/6 hover:bg-white/10 text-white/60 hover:text-white text-xs transition-all">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Records"   value={ledger.length}    sub="customers"             accent="border-white/8" />
        <StatCard label="DPDPA Consent"   value={dpdpaOk}          sub={`${Math.round((dpdpaOk/ledger.length||0)*100)}% coverage`} accent="border-emerald-500/20" />
        <StatCard label="TRAI Consent"    value={traiOk}           sub={`${Math.round((traiOk/ledger.length||0)*100)}% coverage`}  accent="border-sky-500/20" />
        <StatCard label="Opted Out"       value={optedOut}         sub="suppressed from all outreach" accent={optedOut > 0 ? 'border-red-500/20' : 'border-white/8'} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/4 border border-white/8 rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab('consent')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'consent' ? 'bg-white/12 text-white' : 'text-white/40 hover:text-white'}`}
        >
          Consent Ledger
        </button>
        <button
          onClick={() => setTab('bias')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'bias' ? 'bg-white/12 text-white' : 'text-white/40 hover:text-white'}`}
        >
          Bias Audit
          {flags.length > 0 && <span className="ml-2 inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-[9px] font-bold text-white">{flags.length}</span>}
        </button>
      </div>

      {tab === 'consent' && (
        <div className="rounded-xl border border-white/8 bg-white/4 overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-0 text-[10px] font-semibold uppercase tracking-widest text-white/30 px-5 py-3 border-b border-white/8">
            <span>Customer</span>
            <span className="w-28 text-center">Segment</span>
            <span className="w-24 text-center">DPDPA</span>
            <span className="w-24 text-center">TRAI</span>
            <span className="w-24 text-center">Opt-Out</span>
          </div>
          {ledger.slice(0, 50).map((r: any) => (
            <div key={r.customer_id} className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-0 items-center px-5 py-3 border-b border-white/5 last:border-0 hover:bg-white/4 transition-colors">
              <div>
                <p className="text-sm font-medium text-white">{r.full_name}</p>
                <p className="text-[11px] text-white/35">{r.customer_id}</p>
              </div>
              <div className="w-28 text-center text-xs text-white/50">{r.segment}</div>
              <div className="w-24 flex justify-center">
                {r.dpdpa_consent
                  ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  : <AlertTriangle className="w-4 h-4 text-red-400" />}
              </div>
              <div className="w-24 flex justify-center">
                {r.trai_consent
                  ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  : <AlertTriangle className="w-4 h-4 text-red-400" />}
              </div>
              <div className="w-24 flex justify-center">
                {r.opted_out
                  ? <span className="text-[10px] text-red-400 font-bold">OPTED OUT</span>
                  : <span className="text-[10px] text-emerald-400">Active</span>}
              </div>
            </div>
          ))}
          {ledger.length > 50 && (
            <p className="px-5 py-3 text-[11px] text-white/30">Showing 50 of {ledger.length} records</p>
          )}
        </div>
      )}

      {tab === 'bias' && (
        <div className="space-y-4">
          {flags.length > 0 && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/8 p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-300">Disparate Impact Detected</p>
                <p className="text-xs text-red-400/70 mt-0.5">
                  Segments with PRIORITY rate &gt;2× portfolio baseline ({Math.round(portfolioRate*100)}%): {flags.join(', ')}
                </p>
              </div>
            </div>
          )}
          {flags.length === 0 && (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
              <p className="text-sm text-emerald-300 font-medium">No disparate impact detected across segments</p>
            </div>
          )}

          <div className="rounded-xl border border-white/8 bg-white/4 overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-0 text-[10px] font-semibold uppercase tracking-widest text-white/30 px-5 py-3 border-b border-white/8">
              <span>Segment</span>
              <span className="w-20 text-right">Count</span>
              <span className="w-28 text-right">PRIORITY</span>
              <span className="w-28 text-right">ESCALATE</span>
              <span className="w-28 text-right">STANDARD</span>
              <span className="w-24 text-right">P-Rate</span>
            </div>
            {matrix.map((row: any) => {
              const isFlagged = flags.includes(row.segment);
              return (
                <div key={row.segment} className={`grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-0 items-center px-5 py-3 border-b border-white/5 last:border-0 ${isFlagged ? 'bg-red-500/5' : 'hover:bg-white/4'} transition-colors`}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{row.segment}</span>
                    {isFlagged && <AlertTriangle className="w-3.5 h-3.5 text-red-400" />}
                  </div>
                  <div className="w-20 text-right text-sm text-white/60 tabular-nums">{row.count}</div>
                  <div className="w-28 text-right text-sm font-bold text-red-400 tabular-nums">{row.tiers?.PRIORITY || 0}</div>
                  <div className="w-28 text-right text-sm text-orange-400 tabular-nums">{row.tiers?.ESCALATE || 0}</div>
                  <div className="w-28 text-right text-sm text-amber-400 tabular-nums">{row.tiers?.STANDARD || 0}</div>
                  <div className={`w-24 text-right text-sm font-bold tabular-nums ${isFlagged ? 'text-red-400' : 'text-white/60'}`}>
                    {Math.round(row.priority_rate * 100)}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
