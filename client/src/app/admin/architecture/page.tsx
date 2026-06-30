'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { RefreshCw } from 'lucide-react';

const LAYERS = [
  { id: 'l1',      x: 20,  y: 140, label: 'L1 Bank API',    sub: 'Data Ingestion',          color: '#64748b' },
  { id: 'argus',   x: 210, y: 140, label: 'L2 ARGUS',       sub: '9 Signal Detectors',      color: '#0f2d5c' },
  { id: 'chronos', x: 400, y: 140, label: 'L3 CHRONOS',     sub: 'ML Ensemble + GraphSAGE', color: '#0f2d5c' },
  { id: 'compass', x: 590, y: 140, label: 'L4 COMPASS',     sub: 'LangGraph Orchestration', color: '#0f2d5c' },
  { id: 'herald',  x: 780, y: 140, label: 'L5 HERALD',      sub: 'Content Generation',      color: '#1d4ed8' },
  { id: 'verdict', x: 590, y: 300, label: 'L6 VERDICT',     sub: 'DR Uplift Measurement',   color: '#7c3aed' },
  { id: 'oracle',  x: 400, y: 300, label: 'L7 ORACLE',      sub: 'Continuous Learning',     color: '#059669' },
];
const EDGES = [
  { from: 'l1', to: 'argus',        label: 'raw events',            ly: 120 },
  { from: 'argus', to: 'chronos',   label: 'pcop.alarms.v1',        ly: 120 },
  { from: 'chronos', to: 'compass', label: 'risk scores',           ly: 120 },
  { from: 'compass', to: 'herald',  label: 'pcop.action_plans.v1',  ly: 120 },
];
const FEEDBACK = [
  { from: 'herald', to: 'verdict',  label: 'pcop.dispatched.v1' },
  { from: 'verdict', to: 'oracle',  label: 'pcop.measurements.v1' },
  { from: 'oracle', to: 'chronos',  label: 'retrained models' },
];
const DETAIL: Record<string, { desc: string; facts: string[] }> = {
  l1:      { desc: 'Ingests bank data from CBS, mobile app, and transaction systems.', facts: ['50 customers (demo)', 'Balance, transactions, KYC', 'Real-time + batch modes', 'DPDPA consent gating'] },
  argus:   { desc: '9 specialist signal agents flag behavioural anomalies.', facts: ['CFSI, Beta-CUSUM, Adaptive SR', 'Inactivity, salary, sentiment', 'Fires pcop.alarms.v1', 'AUC: 0.91 per-signal'] },
  chronos: { desc: 'FusionX ensemble scores every customer. Includes GraphSAGE GNN.', facts: ['FusionX AUC: 0.930', 'GraphSAGE GNN (0.88)', 'TARE gradient boost (0.91)', 'DeepHit survival model'] },
  compass: { desc: '7-node LangGraph agent plans the best action per customer.', facts: ['NBA: Next Best Action', 'Channel selection logic', 'Fatigue suppression', 'Cooldown enforcement'] },
  herald:  { desc: '5-node content pipeline generates personalised outreach via LLM.', facts: ['DeepSeek-V3 via Azure', 'Email / SMS / Push / Call', 'Multi-language support', 'Human-in-loop gate'] },
  verdict: { desc: 'Measures true causal lift using Doubly Robust estimator.', facts: ['DR-ATE: +18pp avg lift', 'Removes selection bias', 'CATE per customer', 'Feeds ORACLE weekly'] },
  oracle:  { desc: '4 learning cycles continuously improve every component.', facts: ['RETRAIN: weekly AUC gate', 'REFINE: daily prompt perf', 'ROUTE: real-time channel', 'NARRATE: LLM stakeholder'] },
};
const NW = 150, NH = 64;

export default function ArchitecturePage() {
  const [health,   setHealth]   = useState<any[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  const reload = () => api.getAdminHealth().then(r => setHealth(r.layers || [])).catch(() => {});
  useEffect(() => { reload(); }, []);

  const hMap = Object.fromEntries(health.map((l: any) => [l.id, l]));
  const nx = (id: string) => LAYERS.find(l => l.id === id)?.x ?? 0;
  const ny = (id: string) => LAYERS.find(l => l.id === id)?.y ?? 0;
  const sel  = selected ? DETAIL[selected] : null;
  const selL = selected ? LAYERS.find(l => l.id === selected) : null;
  const selH = selected ? hMap[selected] : null;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Architecture Map</h1>
          <p className="text-slate-400 text-sm mt-0.5">Live 7-layer PCOP pipeline — click any node for details</p>
        </div>
        <button onClick={reload} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-700 text-xs shadow-sm transition-all">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <svg viewBox="0 0 980 420" className="w-full" style={{ height: 400 }}>
          <defs>
            <marker id="a1" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="#94a3b8" /></marker>
            <marker id="a2" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="#f97316" /></marker>
          </defs>

          {EDGES.map((e, i) => {
            const x1 = nx(e.from) + NW, y1 = ny(e.from) + NH / 2;
            const x2 = nx(e.to),        y2 = ny(e.to)   + NH / 2;
            return (
              <g key={i}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#cbd5e1" strokeWidth={2} markerEnd="url(#a1)" />
                <text x={(x1+x2)/2} y={e.ly} textAnchor="middle" fontSize="11" fill="#94a3b8">{e.label}</text>
                <circle r="4" fill="#0f2d5c">
                  <animateMotion dur={`${2.2 + i * 0.4}s`} repeatCount="indefinite" path={`M${x1},${y1} L${x2},${y2}`} />
                </circle>
              </g>
            );
          })}

          {FEEDBACK.map((e, i) => {
            const x1 = nx(e.from) + NW/2, y1 = ny(e.from) + NH;
            const x2 = nx(e.to)   + NW/2, y2 = ny(e.to)   + NH;
            const my = 410;
            return (
              <g key={i}>
                <path d={`M${x1},${y1} L${x1},${my} L${x2},${my} L${x2},${y2}`}
                  fill="none" stroke="#f97316" strokeWidth={1.8} strokeDasharray="6 4" markerEnd="url(#a2)" />
                <text x={(x1+x2)/2} y={my - 6} textAnchor="middle" fontSize="10" fill="#f97316">{e.label}</text>
              </g>
            );
          })}

          {LAYERS.map(l => {
            const h = hMap[l.id];
            const isSel = selected === l.id;
            return (
              <g key={l.id} onClick={() => setSelected(s => s === l.id ? null : l.id)} className="cursor-pointer" style={{ userSelect: 'none' }}>
                <rect x={l.x} y={l.y} width={NW} height={NH} rx={10}
                  fill={isSel ? l.color : '#f8fafc'} stroke={isSel ? l.color : '#e2e8f0'} strokeWidth={isSel ? 2.5 : 1.5} />
                <text x={l.x+NW/2} y={l.y+24} textAnchor="middle" fontSize="12" fontWeight="700" fill={isSel ? '#fff' : '#1e293b'}>{l.label}</text>
                <text x={l.x+NW/2} y={l.y+42} textAnchor="middle" fontSize="10" fill={isSel ? 'rgba(255,255,255,0.7)' : '#94a3b8'}>{l.sub}</text>
                {h && <circle cx={l.x+NW-10} cy={l.y+10} r={5} fill={h.status==='live'?'#10b981':'#ef4444'} />}
              </g>
            );
          })}
        </svg>
      </div>

      {sel && selL && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-[10px] font-black shrink-0" style={{ background: selL.color }}>
              {selL.id.slice(0,2).toUpperCase()}
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">{selL.label}
                {selH && <span className={`ml-2 text-[10px] font-bold px-2 py-0.5 rounded ${selH.status==='live'?'bg-emerald-100 text-emerald-700':'bg-red-100 text-red-700'}`}>{selH.status?.toUpperCase()} · {selH.latency_ms}ms</span>}
              </h3>
              <p className="text-sm text-slate-500">{sel.desc}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {sel.facts.map((f, i) => (
              <div key={i} className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-[12px] text-slate-600">{f}</div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2 shrink-0">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
          </span>
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">Kafka Sim · DEMO</span>
        </div>
        {['pcop.alarms.v1','pcop.action_plans.v1','pcop.dispatched.v1','pcop.measurements.v1'].map(t => (
          <span key={t} className="text-[11px] font-mono bg-slate-100 text-[#0f2d5c] px-2.5 py-1 rounded-lg border border-slate-200">{t}</span>
        ))}
      </div>
    </div>
  );
}
