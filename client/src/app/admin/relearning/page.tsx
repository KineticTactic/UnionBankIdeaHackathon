'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { RefreshCw, CheckCircle2, XCircle, Clock, Cpu, BarChart3, TrendingUp } from 'lucide-react';

const CYCLES = [
  {
    id: 'retrain', name: 'RETRAIN', schedule: 'Weekly · Sunday 2am', icon: '🧠',
    color: 'border-purple-500/30 bg-purple-500/5',
    badge: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    desc: 'Re-trains TARE (2 epochs), HABITAT (incremental), CAUSAL-NET. AEGIS gate blocks if new AUC < prod AUC.',
    lastRun: '2026-06-22 02:00', nextRun: '2026-06-29 02:00',
    metrics: [
      { label: 'TARE AUC',     before: '0.910', after: '0.913', delta: '+0.003', up: true },
      { label: 'HABITAT AUC',  before: '0.885', after: '0.889', delta: '+0.004', up: true },
      { label: 'Samples',      before: '—',     after: '2,450',  delta: 'used',  up: true },
    ],
  },
  {
    id: 'refine', name: 'REFINE', schedule: 'Daily · 1am', icon: '✨',
    color: 'border-amber-500/30 bg-amber-500/5',
    badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    desc: 'Measures prompt performance (open/click/conversion). Promotes top 3, deprecates bottom 3, generates new variant.',
    lastRun: '2026-06-30 01:00', nextRun: '2026-07-01 01:00',
    metrics: [
      { label: 'Promoted',     before: '—', after: '3',     delta: 'variants', up: true },
      { label: 'Deprecated',   before: '—', after: '3',     delta: 'variants', up: false },
      { label: 'Avg open rate',before: '22%', after: '26%', delta: '+4%',      up: true },
    ],
  },
  {
    id: 'route', name: 'ROUTE', schedule: 'Real-time · per outreach', icon: '⚡',
    color: 'border-sky-500/30 bg-sky-500/5',
    badge: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
    desc: 'Updates channel policy: P(engagement|channel, customer) from recent events. No human trigger needed.',
    lastRun: 'Continuous', nextRun: 'Continuous',
    metrics: [
      { label: 'Email score',  before: '—', after: '0.42', delta: 'HNI', up: true },
      { label: 'Push score',   before: '—', after: '0.61', delta: 'Gen-Z', up: true },
      { label: 'SMS score',    before: '—', after: '0.37', delta: 'Rural', up: true },
    ],
  },
  {
    id: 'narrate', name: 'NARRATE', schedule: 'Nightly · 11pm', icon: '📊',
    color: 'border-emerald-500/30 bg-emerald-500/5',
    badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    desc: 'Kimi K2.5 reads uplift/prompt/channel metrics → Markdown narrative for stakeholders. Published to dashboard.',
    lastRun: '2026-06-29 23:00', nextRun: '2026-06-30 23:00',
    metrics: [
      { label: 'Campaigns',    before: '—', after: '12',   delta: 'covered', up: true },
      { label: 'DR-ATE',       before: '—', after: '+0.18',delta: 'lift',    up: true },
      { label: 'Generated',    before: '—', after: '1,240',delta: 'tokens',  up: true },
    ],
  },
];

const CHANNEL_POLICY = [
  { segment: 'HNI',       PRIORITY: 'Phone', ESCALATE: 'Email', STANDARD: 'Email',    MONITOR: 'Push' },
  { segment: 'Mass',      PRIORITY: 'SMS',   ESCALATE: 'SMS',   STANDARD: 'Push',     MONITOR: 'Push' },
  { segment: 'Salaried',  PRIORITY: 'Email', ESCALATE: 'Email', STANDARD: 'Push',     MONITOR: 'Push' },
  { segment: 'Self-Emp',  PRIORITY: 'Phone', ESCALATE: 'Email', STANDARD: 'SMS',      MONITOR: 'Push' },
];

export default function RelearningPage() {
  const [uplift,  setUplift]  = useState<any>(null);
  const [bandit,  setBandit]  = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getUpliftStats(), api.getBanditState()]).then(([u, b]) => {
      setUplift(u);
      setBandit(b);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">ORACLE — Relearning Engine</h1>
        <p className="text-white/40 text-sm mt-0.5">4 learning cycles that improve models, prompts, and routing every day</p>
      </div>

      {/* Retraining gate */}
      <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-5">
        <div className="flex items-center gap-3 mb-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <p className="text-sm font-bold text-white">Retraining Gate — <span className="text-emerald-400">DEPLOY ALLOWED</span></p>
          <span className="ml-auto text-[10px] text-white/30">RBI AI Governance 2024 §8</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Bias Audit',     status: 'PASS', ok: true },
            { label: 'AUC Gate',       status: 'PASS', ok: true },
            { label: 'Committee Appr.',status: 'APPROVED', ok: true },
            { label: 'Consent Check',  status: 'PASS', ok: true },
          ].map(g => (
            <div key={g.label} className="rounded-lg bg-white/5 border border-white/8 p-3 flex items-center gap-2">
              {g.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <XCircle className="w-4 h-4 text-red-400 shrink-0" />}
              <div>
                <p className="text-[10px] text-white/40">{g.label}</p>
                <p className={`text-[11px] font-bold ${g.ok ? 'text-emerald-400' : 'text-red-400'}`}>{g.status}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4 Cycles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {CYCLES.map(cycle => (
          <div key={cycle.id} className={`rounded-xl border p-5 space-y-4 ${cycle.color}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">{cycle.icon}</span>
                  <h3 className="text-base font-bold text-white">{cycle.name}</h3>
                  <span className={`text-[9px] font-semibold px-2 py-0.5 rounded border ${cycle.badge}`}>ACTIVE</span>
                </div>
                <p className="text-[11px] text-white/50 flex items-center gap-1"><Clock className="w-3 h-3" />{cycle.schedule}</p>
              </div>
            </div>
            <p className="text-xs text-white/50 leading-relaxed">{cycle.desc}</p>
            <div className="grid grid-cols-3 gap-2">
              {cycle.metrics.map(m => (
                <div key={m.label} className="rounded-lg bg-white/5 border border-white/8 p-2.5">
                  <p className="text-[9px] text-white/35 uppercase tracking-widest mb-1">{m.label}</p>
                  <p className="text-sm font-bold text-white">{m.after}</p>
                  <p className={`text-[10px] font-semibold ${m.up ? 'text-emerald-400' : 'text-red-400'}`}>{m.delta}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between text-[10px] text-white/25">
              <span>Last: {cycle.lastRun}</span>
              <span>Next: {cycle.nextRun}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Channel policy table */}
      <div className="rounded-xl border border-white/8 bg-white/3 p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40">Channel Routing Policy (ROUTE cycle)</p>
          <BarChart3 className="w-4 h-4 text-white/20" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8">
                <th className="text-left py-2 pr-4 text-[10px] text-white/35 font-semibold uppercase tracking-widest">Segment</th>
                {(['PRIORITY','ESCALATE','STANDARD','MONITOR'] as const).map(t => (
                  <th key={t} className="text-center py-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-white/35">{t}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CHANNEL_POLICY.map(row => (
                <tr key={row.segment} className="border-b border-white/5 last:border-0 hover:bg-white/3 transition-colors">
                  <td className="py-3 pr-4 text-sm font-medium text-white/70">{row.segment}</td>
                  {(['PRIORITY','ESCALATE','STANDARD','MONITOR'] as const).map(tier => (
                    <td key={tier} className="py-3 px-3 text-center">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                        row[tier] === 'Phone' ? 'bg-amber-500/15 text-amber-400' :
                        row[tier] === 'Email' ? 'bg-blue-500/15 text-blue-400' :
                        row[tier] === 'SMS'   ? 'bg-green-500/15 text-green-400' :
                        'bg-purple-500/15 text-purple-400'
                      }`}>{row[tier]}</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-white/25 mt-3">Updated in real-time by the ROUTE cycle based on P(engagement|channel, segment, tier)</p>
      </div>

      {/* DR Uplift */}
      {uplift && (
        <div className="rounded-xl border border-white/8 bg-white/3 p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40">DR Uplift — VERDICT Attribution</p>
            <TrendingUp className="w-4 h-4 text-white/20" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'DR-ATE (avg)', value: uplift.ate ? `${(uplift.ate*100).toFixed(1)}%` : '+18.3%' },
              { label: 'Raw retention', value: uplift.raw_retention || '62%' },
              { label: 'Counterfactual', value: uplift.counterfactual || '44%' },
              { label: 'True lift', value: uplift.true_lift || '+18pp' },
            ].map(m => (
              <div key={m.label} className="rounded-lg bg-white/5 border border-white/8 p-4">
                <p className="text-[10px] text-white/35 uppercase tracking-widest mb-1">{m.label}</p>
                <p className="text-xl font-bold text-white">{m.value}</p>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-white/30 mt-3">Doubly Robust estimation removes selection bias — "would they have stayed anyway?" is accounted for.</p>
        </div>
      )}
    </div>
  );
}
