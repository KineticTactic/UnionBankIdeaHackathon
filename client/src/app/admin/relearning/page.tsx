'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { CheckCircle2, XCircle, Clock, TrendingUp, BarChart3 } from 'lucide-react';

const CYCLES = [
  {
    id: 'retrain', name: 'RETRAIN', schedule: 'Weekly · Sunday 2am',
    borderC: '#6B132B', badge: 'bg-[#6B132B] text-white',
    desc: 'Re-trains TARE (2 epochs), HABITAT (incremental), CAUSAL-NET. AEGIS gate blocks if new AUC < prod AUC.',
    lastRun: '2026-06-22 02:00', nextRun: '2026-06-29 02:00',
    metrics: [
      { label: 'TARE AUC',  before: '0.910', after: '0.913', delta: '+0.003', up: true },
      { label: 'HABITAT',   before: '0.885', after: '0.889', delta: '+0.004', up: true },
      { label: 'Samples',   before: '—',     after: '2,450', delta: 'used',   up: true },
    ],
  },
  {
    id: 'refine', name: 'REFINE', schedule: 'Daily · 1am',
    borderC: '#B46B3E', badge: 'bg-[#B46B3E] text-white',
    desc: 'Measures prompt performance (open/click/conversion). Promotes top 3, deprecates bottom 3, generates new variant.',
    lastRun: '2026-06-30 01:00', nextRun: '2026-07-01 01:00',
    metrics: [
      { label: 'Promoted',     before: '—',   after: '3',    delta: 'variants', up: true  },
      { label: 'Deprecated',   before: '—',   after: '3',    delta: 'variants', up: false },
      { label: 'Avg open rate',before: '22%', after: '26%',  delta: '+4%',      up: true  },
    ],
  },
  {
    id: 'route', name: 'ROUTE', schedule: 'Real-time · per outreach',
    borderC: '#6B132B', badge: 'bg-[#6B132B] text-white',
    desc: 'Updates channel policy P(engagement|channel, customer) from recent events. No human trigger needed.',
    lastRun: 'Continuous', nextRun: 'Continuous',
    metrics: [
      { label: 'Email score', before: '—', after: '0.42', delta: 'HNI',   up: true },
      { label: 'Push score',  before: '—', after: '0.61', delta: 'Gen-Z', up: true },
      { label: 'SMS score',   before: '—', after: '0.37', delta: 'Rural', up: true },
    ],
  },
  {
    id: 'narrate', name: 'NARRATE', schedule: 'Nightly · 11pm',
    borderC: '#B46B3E', badge: 'bg-[#B46B3E] text-white',
    desc: 'LLM reads uplift/prompt/channel metrics → Markdown narrative for stakeholders. Published to dashboard.',
    lastRun: '2026-06-29 23:00', nextRun: '2026-06-30 23:00',
    metrics: [
      { label: 'Campaigns',  before: '—', after: '12',    delta: 'covered', up: true },
      { label: 'DR-ATE',     before: '—', after: '+0.18', delta: 'lift',    up: true },
      { label: 'Generated',  before: '—', after: '1,240', delta: 'tokens',  up: true },
    ],
  },
];

const CHANNEL_POLICY = [
  { segment: 'HNI',      PRIORITY: 'Phone', ESCALATE: 'Email', STANDARD: 'Email', MONITOR: 'Push' },
  { segment: 'Mass',     PRIORITY: 'SMS',   ESCALATE: 'SMS',   STANDARD: 'Push',  MONITOR: 'Push' },
  { segment: 'Salaried', PRIORITY: 'Email', ESCALATE: 'Email', STANDARD: 'Push',  MONITOR: 'Push' },
  { segment: 'Self-Emp', PRIORITY: 'Phone', ESCALATE: 'Email', STANDARD: 'SMS',   MONITOR: 'Push' },
];

const CHANNEL_STYLE: Record<string, string> = {
  Phone: 'bg-[#B46B3E] text-white',
  Email: 'bg-[#6B132B] text-white',
  SMS:   'bg-[#2A161B] text-white',
  Push:  'bg-[#F4D9C0] text-[#2A161B]',
};

export default function RelearningPage() {
  const [uplift, setUplift] = useState<any>(null);

  useEffect(() => {
    api.getUpliftStats().then(u => setUplift(u)).catch(() => {});
  }, []);

  return (
    <div className="p-6 space-y-6 bg-[#F9F9F7] min-h-screen">
      <div>
        <h1 className="text-[22px] font-black text-[#2A161B] font-heading">ORACLE — Relearning Engine</h1>
        <p className="text-[13px] text-[#6B6562] mt-0.5">4 learning cycles that improve models, prompts, and routing every day</p>
      </div>

      {/* Retraining gate */}
      <div className="bg-white rounded-md border border-soft p-5">
        <div className="flex items-center gap-3 mb-3">
          <CheckCircle2 className="w-5 h-5 text-[#6B132B]" />
          <p className="font-bold text-[#2A161B] text-sm">Retraining Gate — <span className="text-[#6B132B]">DEPLOY ALLOWED</span></p>
          <span className="ml-auto text-[10px] text-[#8B8481]">RBI AI Governance 2024 §8</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Bias Audit',      status: 'PASS',     ok: true },
            { label: 'AUC Gate',        status: 'PASS',     ok: true },
            { label: 'Committee Appr.', status: 'APPROVED', ok: true },
            { label: 'Consent Check',   status: 'PASS',     ok: true },
          ].map(g => (
            <div key={g.label} className="bg-[#F9F9F7] rounded-md border border-soft p-3 flex items-center gap-2">
              {g.ok ? <CheckCircle2 className="w-4 h-4 text-[#6B132B] shrink-0" /> : <XCircle className="w-4 h-4 text-[#6B132B] shrink-0" />}
              <div>
                <p className="text-[10px] text-[#6B6562]">{g.label}</p>
                <p className={`text-[11px] font-bold ${g.ok ? 'text-[#6B132B]' : 'text-[#B46B3E]'}`}>{g.status}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4 Cycles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {CYCLES.map(cycle => (
          <div key={cycle.id} className="bg-white rounded-md border border-soft p-5 space-y-4" style={{borderLeftWidth: 4, borderLeftColor: cycle.borderC}}>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-[#2A161B]">{cycle.name}</h3>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${cycle.badge}`}>ACTIVE</span>
                </div>
                <p className="text-[11px] text-[#6B6562] flex items-center gap-1"><Clock className="w-3 h-3" />{cycle.schedule}</p>
              </div>
            </div>
            <p className="text-[12px] text-[#6B6562] leading-relaxed">{cycle.desc}</p>
            <div className="grid grid-cols-3 gap-2">
              {cycle.metrics.map(m => (
                <div key={m.label} className="bg-[#F9F9F7] rounded-md p-2.5">
                  <p className="text-[9px] text-[#6B6562] uppercase tracking-widest mb-1">{m.label}</p>
                  <p className="text-sm font-bold text-[#2A161B]">{m.after}</p>
                  <p className={`text-[10px] font-semibold ${m.up ? 'text-[#6B132B]' : 'text-[#B46B3E]'}`}>{m.delta}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between text-[10px] text-[#8B8481]">
              <span>Last: {cycle.lastRun}</span>
              <span>Next: {cycle.nextRun}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Channel policy */}
      <div className="bg-white rounded-md border border-soft p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-[#2A161B]">Channel Routing Policy (ROUTE cycle)</h2>
          <BarChart3 className="w-4 h-4 text-[#8B8481]" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-soft">
                <th className="text-left py-2 pr-4 text-[10px] font-bold text-[#6B6562] uppercase tracking-wider">Segment</th>
                {(['PRIORITY','ESCALATE','STANDARD','MONITOR'] as const).map(t => (
                  <th key={t} className="text-center py-2 px-3 text-[10px] font-bold text-[#6B6562] uppercase tracking-wider">{t}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-soft">
              {CHANNEL_POLICY.map(row => (
                <tr key={row.segment} className="hover:bg-[#F9F9F7] transition-colors">
                  <td className="py-3 pr-4 font-semibold text-[#2A161B]">{row.segment}</td>
                  {(['PRIORITY','ESCALATE','STANDARD','MONITOR'] as const).map(tier => (
                    <td key={tier} className="py-3 px-3 text-center">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${CHANNEL_STYLE[row[tier]] || 'bg-[#F9F9F7] text-[#6B6562]'}`}>{row[tier]}</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* DR Uplift */}
      <div className="bg-white rounded-md border border-soft p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-[#2A161B]">DR Uplift — VERDICT Attribution</h2>
          <TrendingUp className="w-4 h-4 text-[#8B8481]" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'DR-ATE (avg)',    value: uplift?.ate ? `${(uplift.ate*100).toFixed(1)}%` : '+18.3%' },
            { label: 'Raw retention',   value: uplift?.raw_retention   || '62%' },
            { label: 'Counterfactual',  value: uplift?.counterfactual  || '44%' },
            { label: 'True lift',       value: uplift?.true_lift       || '+18pp' },
          ].map(m => (
            <div key={m.label} className="bg-[#F9F9F7] rounded-md border border-soft p-4">
              <p className="text-[10px] text-[#6B6562] uppercase tracking-wider font-bold mb-1">{m.label}</p>
              <p className="text-2xl font-black text-[#2A161B]">{m.value}</p>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-[#6B6562] mt-3">Doubly Robust estimation removes selection bias — "would they have stayed anyway?" is accounted for.</p>
      </div>
    </div>
  );
}
