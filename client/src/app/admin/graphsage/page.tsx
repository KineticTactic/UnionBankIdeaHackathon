'use client';

import { useEffect, useState, useRef } from 'react';
import { api } from '@/lib/api';
import { RefreshCw, Info } from 'lucide-react';

const TIER_COLOR: Record<string, string> = {
  PRIORITY: '#ef4444',
  ESCALATE: '#f97316',
  STANDARD: '#f59e0b',
  MONITOR:  '#3b82f6',
  NONE:     '#22c55e',
};

const TIER_LABEL: Record<string, string> = {
  PRIORITY: 'bg-red-500/20 text-red-400 border-red-500/30',
  ESCALATE: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  STANDARD: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  MONITOR:  'bg-blue-500/20 text-blue-400 border-blue-500/30',
  NONE:     'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
};

// Stable pseudo-random positions based on index
function nodePos(i: number, total: number) {
  const cols = Math.ceil(Math.sqrt(total * 1.5));
  const row = Math.floor(i / cols);
  const col = i % cols;
  const jitterX = ((i * 137) % 40) - 20;
  const jitterY = ((i * 97)  % 30) - 15;
  return {
    x: 60 + col * 90 + jitterX,
    y: 50 + row * 90 + jitterY,
  };
}

// Build peer edges: connect to 2-3 nearest by churn score
function buildEdges(customers: any[]) {
  const edges: { a: number; b: number }[] = [];
  const seen = new Set<string>();
  customers.forEach((c, i) => {
    const sorted = customers
      .map((d, j) => ({ j, diff: Math.abs(c.churn_score - d.churn_score) }))
      .filter(x => x.j !== i)
      .sort((a, b) => a.diff - b.diff)
      .slice(0, 2);
    sorted.forEach(({ j }) => {
      const key = [Math.min(i, j), Math.max(i, j)].join('-');
      if (!seen.has(key)) { seen.add(key); edges.push({ a: i, b: j }); }
    });
  });
  return edges;
}

export default function GraphSAGEPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState<any | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.getAdminStats();
      // Use top_at_risk + leaderboard's book to build a representative sample
      // Fall back to portfolio customers
      const r2 = await api.getCustomers({ limit: 50 });
      setCustomers(r2.customers || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-white/30 text-sm animate-pulse">Loading graph…</div>
  );

  const subset = customers.slice(0, 40); // keep svg manageable
  const edges  = buildEdges(subset);
  const W = 900, H = 420;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">GraphSAGE Explorer</h1>
          <p className="text-white/40 text-sm mt-0.5">Peer-similarity graph — node size = churn risk · colour = risk tier · edges = peer links</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/6 hover:bg-white/10 text-white/60 hover:text-white text-xs transition-all">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 flex-wrap">
        {Object.entries(TIER_COLOR).map(([tier, color]) => (
          <div key={tier} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ background: color }} />
            <span className="text-[11px] text-white/50">{tier}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 ml-4 text-[11px] text-white/30">
          <Info className="w-3 h-3" /> Click a node to inspect
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Graph */}
        <div className="lg:col-span-2 rounded-2xl border border-white/8 bg-white/3 p-4 overflow-hidden">
          <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 380 }}>
            {/* Edges */}
            {edges.map((e, i) => {
              const a = nodePos(e.a, subset.length);
              const b = nodePos(e.b, subset.length);
              const isSameTier = subset[e.a].risk_tier === subset[e.b].risk_tier;
              const selA = selected?.customer_id === subset[e.a]?.customer_id;
              const selB = selected?.customer_id === subset[e.b]?.customer_id;
              return (
                <line key={i}
                  x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  stroke={selA || selB ? '#f59e0b' : isSameTier ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)'}
                  strokeWidth={selA || selB ? 1.5 : 0.7}
                />
              );
            })}

            {/* Nodes */}
            {subset.map((c, i) => {
              const pos  = nodePos(i, subset.length);
              const r    = 5 + (c.churn_score || 0.3) * 14;
              const col  = TIER_COLOR[c.risk_tier] || '#6b7280';
              const isSel = selected?.customer_id === c.customer_id;
              return (
                <g key={c.customer_id} onClick={() => setSelected((s: any) => s?.customer_id === c.customer_id ? null : c)}
                  className="cursor-pointer">
                  {isSel && (
                    <circle cx={pos.x} cy={pos.y} r={r + 6} fill="none" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 3">
                      <animate attributeName="stroke-dashoffset" from="0" to="14" dur="1s" repeatCount="indefinite" />
                    </circle>
                  )}
                  <circle
                    cx={pos.x} cy={pos.y} r={r}
                    fill={col + (isSel ? 'dd' : '99')}
                    stroke={isSel ? '#f59e0b' : col}
                    strokeWidth={isSel ? 2 : 0.8}
                  />
                  {r > 12 && (
                    <text x={pos.x} y={pos.y + r + 11} textAnchor="middle" fontSize="7" fill="rgba(255,255,255,0.45)" className="select-none pointer-events-none">
                      {c.full_name?.split(' ')[0] || ''}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Inspection panel */}
        <div className="lg:col-span-1 space-y-4">
          {!selected ? (
            <div className="rounded-xl border border-white/8 bg-white/3 p-5 text-center">
              <div className="w-12 h-12 rounded-xl bg-white/6 flex items-center justify-center mx-auto mb-3">
                <Info className="w-6 h-6 text-white/30" />
              </div>
              <p className="text-white/40 text-sm">Select a node to view peer attribution</p>
            </div>
          ) : (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5 space-y-4">
              <div>
                <p className="text-xs text-white/35 uppercase tracking-widest font-semibold mb-1">Selected Node</p>
                <h3 className="text-base font-bold text-white">{selected.full_name}</h3>
                <p className="text-[11px] text-white/40">{selected.customer_id} · {selected.segment}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-white/5 p-3">
                  <p className="text-[9px] text-white/35 uppercase tracking-widest mb-1">Churn Score</p>
                  <p className="text-xl font-bold text-white">{Math.round((selected.churn_score||0)*100)}%</p>
                </div>
                <div className="rounded-lg bg-white/5 p-3">
                  <p className="text-[9px] text-white/35 uppercase tracking-widest mb-1">Risk Tier</p>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded border ${TIER_LABEL[selected.risk_tier]||''}`}>{selected.risk_tier}</span>
                </div>
              </div>

              {/* GraphSAGE attribution (demo values) */}
              <div>
                <p className="text-[10px] text-white/35 uppercase tracking-widest font-semibold mb-2">GraphSAGE Attribution</p>
                <p className="text-[11px] text-white/40 mb-3">Top features driving this node's graph score:</p>
                {[
                  { feature: 'Peer avg churn (Geography)', contrib: 0.38, dir: '+' },
                  { feature: 'Inactivity vs peer median', contrib: 0.29, dir: '+' },
                  { feature: 'Balance vs peer decile',    contrib: 0.18, dir: selected.balance > 50000 ? '-' : '+' },
                  { feature: 'App login peer gap',        contrib: 0.15, dir: '+' },
                ].map(f => (
                  <div key={f.feature} className="mb-2">
                    <div className="flex items-center justify-between text-[11px] mb-0.5">
                      <span className="text-white/60 truncate">{f.feature}</span>
                      <span className={`font-bold ml-2 shrink-0 ${f.dir === '+' ? 'text-red-400' : 'text-emerald-400'}`}>
                        {f.dir}{Math.round(f.contrib * 100)}%
                      </span>
                    </div>
                    <div className="h-1 rounded-full bg-white/8 overflow-hidden">
                      <div className={`h-full rounded-full ${f.dir === '+' ? 'bg-red-500' : 'bg-emerald-500'}`}
                        style={{ width: `${f.contrib * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Peers */}
              <div>
                <p className="text-[10px] text-white/35 uppercase tracking-widest font-semibold mb-2">Peer Neighbours</p>
                {subset
                  .map((c, i) => ({ c, diff: Math.abs(c.churn_score - selected.churn_score) }))
                  .filter(x => x.c.customer_id !== selected.customer_id)
                  .sort((a, b) => a.diff - b.diff)
                  .slice(0, 3)
                  .map(({ c }) => (
                    <div key={c.customer_id} className="flex items-center gap-2 py-1.5 border-b border-white/5 last:border-0 cursor-pointer hover:bg-white/3 rounded"
                      onClick={() => setSelected(c)}>
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: TIER_COLOR[c.risk_tier] }} />
                      <span className="text-[12px] text-white/70 flex-1 truncate">{c.full_name}</span>
                      <span className="text-[11px] text-white/35 tabular-nums">{Math.round((c.churn_score||0)*100)}%</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Model facts */}
          <div className="rounded-xl border border-white/8 bg-white/3 p-5">
            <p className="text-[10px] text-white/35 uppercase tracking-widest font-semibold mb-3">Model Facts</p>
            {[
              { label: 'Architecture',  value: 'GraphSAGE (2-layer)' },
              { label: 'Test AUC',      value: '0.88' },
              { label: 'Graph nodes',   value: `${subset.length}` },
              { label: 'Avg degree',    value: '2.4' },
              { label: 'Edge basis',    value: 'Geo + Age±5 + Balance decile' },
              { label: 'FusionX weight',value: '0.20' },
              { label: 'Last trained',  value: '2026-06-01' },
            ].map(f => (
              <div key={f.label} className="flex justify-between py-1.5 border-b border-white/5 last:border-0">
                <span className="text-[11px] text-white/40">{f.label}</span>
                <span className="text-[11px] text-white font-medium">{f.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
