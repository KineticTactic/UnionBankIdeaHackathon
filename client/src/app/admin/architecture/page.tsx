'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { ExternalLink } from 'lucide-react';

const LAYERS = [
  { id: 'l1', name: 'L1 Bank API',    sub: 'Data Ingestion',        color: '#64748b', x: 50,  y: 60  },
  { id: 'l2', name: 'L2 ARGUS',       sub: '9 Signal Detectors',    color: '#3b82f6', x: 200, y: 60  },
  { id: 'l3', name: 'L3 CHRONOS',     sub: 'ML Ensemble + GraphSAGE', color: '#8b5cf6', x: 380, y: 60 },
  { id: 'l4', name: 'L4 COMPASS',     sub: 'LangGraph Orchestration',color: '#f59e0b', x: 560, y: 60 },
  { id: 'l5', name: 'L5 HERALD',      sub: 'Content Generation',    color: '#10b981', x: 740, y: 60  },
  { id: 'l6', name: 'L6 VERDICT',     sub: 'DR Uplift Measurement', color: '#f43f5e', x: 560, y: 200 },
  { id: 'l7', name: 'L7 ORACLE',      sub: 'Continuous Learning',   color: '#f97316', x: 380, y: 200 },
];

const EDGES = [
  { from: 'l1', to: 'l2', label: 'raw events',       feedback: false },
  { from: 'l2', to: 'l3', label: 'pcop.alarms.v1',   feedback: false },
  { from: 'l3', to: 'l4', label: 'risk scores',       feedback: false },
  { from: 'l4', to: 'l5', label: 'pcop.action_plans.v1', feedback: false },
  { from: 'l5', to: 'l6', label: 'pcop.dispatched.v1',   feedback: false },
  { from: 'l6', to: 'l7', label: 'pcop.measurements.v1', feedback: true },
  { from: 'l7', to: 'l3', label: 'retrained models',  feedback: true },
];

const LAYER_LINKS: Record<string, string> = {
  l3: '/models',
  l4: '/pipeline',
  l5: '/pipeline',
  l6: '/admin/relearning',
  l7: '/admin/relearning',
};

const HEALTH_IDS: Record<string, string> = {
  l2: 'argus', l3: 'chronos', l4: 'compass', l5: 'herald', l6: 'verdict', l7: 'oracle',
};

function getPos(id: string) {
  return LAYERS.find(l => l.id === id)!;
}

function edgePath(from: string, to: string) {
  const f = getPos(from);
  const t = getPos(to);
  const mx = (f.x + t.x) / 2;
  const my = (f.y + t.y) / 2;
  return `M ${f.x + 70} ${f.y + 26} Q ${mx} ${my} ${t.x} ${t.y + 26}`;
}

export default function ArchitecturePage() {
  const [health, setHealth]     = useState<any[]>([]);
  const [kafka,  setKafka]      = useState<any>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [packet, setPacket]     = useState<number | null>(null);
  const router = useRouter();
  const tickRef = useRef(0);

  useEffect(() => {
    Promise.all([api.getAdminHealth(), api.getKafkaStatus()]).then(([h, k]) => {
      setHealth(h.layers || []);
      setKafka(k);
    }).catch(() => {});
  }, []);

  // Animate a data packet along the forward edges every 4s
  useEffect(() => {
    const iv = setInterval(() => {
      setPacket(p => (p === null ? 0 : (p + 1) % 5));
    }, 1800);
    return () => clearInterval(iv);
  }, []);

  const healthMap: Record<string, any> = {};
  health.forEach(h => { healthMap[h.id] = h; });

  const sel = selected ? LAYERS.find(l => l.id === selected) : null;
  const selHealth = sel ? healthMap[HEALTH_IDS[sel.id]] : null;

  const W = 880, H = 300;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Architecture Map</h1>
        <p className="text-white/40 text-sm mt-0.5">Live 7-layer PCOP pipeline — click any layer for details</p>
      </div>

      {/* Main diagram */}
      <div className="rounded-2xl border border-white/8 bg-white/3 p-6 overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[600px]" style={{ height: 280 }}>
          <defs>
            <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L0,6 L8,3 z" fill="rgba(255,255,255,0.25)" />
            </marker>
            <marker id="arrow-feed" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L0,6 L8,3 z" fill="#f97316" />
            </marker>
          </defs>

          {/* Edges */}
          {EDGES.map((e, i) => {
            const f = getPos(e.from);
            const t = getPos(e.to);
            const isFeed = e.feedback;
            const isActive = packet === i % 5;
            return (
              <g key={i}>
                <path
                  d={edgePath(e.from, e.to)}
                  fill="none"
                  stroke={isFeed ? '#f97316' : 'rgba(255,255,255,0.15)'}
                  strokeWidth={isFeed ? 1.5 : 1}
                  strokeDasharray={isFeed ? '5 4' : 'none'}
                  markerEnd={isFeed ? 'url(#arrow-feed)' : 'url(#arrow)'}
                />
                {/* Animated packet */}
                {isActive && !isFeed && (
                  <circle r="4" fill="#38bdf8" opacity="0.9">
                    <animateMotion dur="1.5s" repeatCount="indefinite"
                      path={`M ${f.x + 70} ${f.y + 26} Q ${(f.x+t.x)/2} ${(f.y+t.y)/2} ${t.x} ${t.y + 26}`}
                    />
                  </circle>
                )}
                {/* Edge label */}
                <text
                  x={(f.x + t.x) / 2 + 35}
                  y={(f.y + t.y) / 2 + (isFeed ? -8 : -6)}
                  textAnchor="middle"
                  fontSize="8"
                  fill={isFeed ? '#f97316' : 'rgba(255,255,255,0.3)'}
                  className="select-none"
                >{e.label}</text>
              </g>
            );
          })}

          {/* Layer nodes */}
          {LAYERS.map((layer) => {
            const hKey = HEALTH_IDS[layer.id];
            const h = hKey ? healthMap[hKey] : null;
            const isOk = !h || h.status === 'live';
            const isSelected = selected === layer.id;
            return (
              <g
                key={layer.id}
                transform={`translate(${layer.x}, ${layer.y})`}
                className="cursor-pointer"
                onClick={() => setSelected(s => s === layer.id ? null : layer.id)}
              >
                <rect
                  width={140} height={52} rx={10}
                  fill={isSelected ? layer.color + '33' : 'rgba(255,255,255,0.05)'}
                  stroke={isSelected ? layer.color : 'rgba(255,255,255,0.12)'}
                  strokeWidth={isSelected ? 2 : 1}
                />
                {/* Health dot */}
                {hKey && (
                  <circle cx={130} cy={10} r={4} fill={isOk ? '#4ade80' : '#f87171'}>
                    {isOk && <animate attributeName="opacity" values="1;0.4;1" dur="2s" repeatCount="indefinite" />}
                  </circle>
                )}
                <text x={70} y={22} textAnchor="middle" fontSize="11" fontWeight="bold" fill="white" className="select-none">
                  {layer.name}
                </text>
                <text x={70} y={38} textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.45)" className="select-none">
                  {layer.sub}
                </text>
              </g>
            );
          })}

          {/* Feedback loop label */}
          <text x={440} y={290} textAnchor="middle" fontSize="9" fill="#f97316" opacity="0.7" className="select-none">
            ↺ Continuous learning feedback loop (VERDICT → ORACLE → CHRONOS)
          </text>
        </svg>
      </div>

      {/* Selected layer detail */}
      {sel && (
        <div className="rounded-xl border p-5 transition-all" style={{ borderColor: sel.color + '40', background: sel.color + '0d' }}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-3 h-3 rounded-full" style={{ background: sel.color }} />
                <h2 className="text-lg font-bold text-white">{sel.name}</h2>
                {selHealth && (
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${selHealth.status === 'live' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-red-500/15 text-red-400 border-red-500/30'}`}>
                    {selHealth.status?.toUpperCase()} · {selHealth.latency_ms}ms
                  </span>
                )}
              </div>
              <p className="text-white/50 text-sm">{sel.sub}</p>
            </div>
            {LAYER_LINKS[sel.id] && (
              <button onClick={() => router.push(LAYER_LINKS[sel.id])}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/8 hover:bg-white/12 text-white/60 hover:text-white text-xs transition-all shrink-0">
                <ExternalLink className="w-3 h-3" /> Open
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            {LAYER_DETAIL[sel.id]?.map((f: any) => (
              <div key={f.label} className="rounded-lg bg-white/5 border border-white/8 p-3">
                <p className="text-[10px] text-white/35 uppercase tracking-widest font-semibold mb-1">{f.label}</p>
                <p className="text-sm font-semibold text-white">{f.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Kafka status strip */}
      {kafka && (
        <div className="rounded-xl border border-white/8 bg-white/3 p-4 flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span className="text-xs font-semibold text-white/60">Kafka Simulation</span>
            <span className="text-xs text-emerald-400 font-bold">{kafka.mode || 'DEMO'}</span>
          </div>
          {['pcop.alarms.v1','pcop.action_plans.v1','pcop.dispatched.v1','pcop.measurements.v1'].map(t => (
            <span key={t} className="text-[10px] text-white/30 font-mono">{t}</span>
          ))}
        </div>
      )}
    </div>
  );
}

const LAYER_DETAIL: Record<string, { label: string; value: string }[]> = {
  l1: [
    { label: 'Source', value: 'Core Banking API' },
    { label: 'Events', value: 'Txn, Login, CRM' },
    { label: 'Interval', value: '8s (demo sim)' },
    { label: 'Protocol', value: 'Kafka Producer' },
  ],
  l2: [
    { label: 'Detectors', value: '9 signal agents' },
    { label: 'Methods', value: 'CUSUM, SPRT, EWMA' },
    { label: 'Output', value: 'pcop.alarms.v1' },
    { label: 'Latency', value: '< 20ms' },
  ],
  l3: [
    { label: 'Models', value: 'TARE, HABITAT, GraphSAGE' },
    { label: 'Ensemble AUC', value: '0.93' },
    { label: 'GraphSAGE wt', value: '0.20' },
    { label: 'Output', value: 'Churn score + tier' },
  ],
  l4: [
    { label: 'Framework', value: 'LangGraph 7-node' },
    { label: 'LLM', value: 'Kimi K2.6 / K2.5' },
    { label: 'Output', value: 'Action plan (NBA)' },
    { label: 'Gate', value: 'Cooldown + Consent' },
  ],
  l5: [
    { label: 'Framework', value: 'LangGraph 5-node' },
    { label: 'LLM', value: 'DeepSeek V3' },
    { label: 'Channels', value: 'Email, SMS, Push, RM' },
    { label: 'Compliance', value: 'RBI 2024 gated' },
  ],
  l6: [
    { label: 'Method', value: 'Doubly Robust' },
    { label: 'Holdout', value: '20% control group' },
    { label: 'Windows', value: '7d / 14d / 30d' },
    { label: 'Output', value: 'CATE per customer' },
  ],
  l7: [
    { label: 'Cycles', value: '4 (weekly–realtime)' },
    { label: 'RETRAIN', value: 'Sunday 2am' },
    { label: 'REFINE', value: 'Daily 1am' },
    { label: 'NARRATE', value: 'Nightly 11pm' },
  ],
};
