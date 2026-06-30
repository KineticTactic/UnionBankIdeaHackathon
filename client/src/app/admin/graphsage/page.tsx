'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import { RefreshCw, Info, Pause, Play, RotateCcw } from 'lucide-react';

/* ─────────────── constants ─────────────── */
const TIER_ORDER = ['PRIORITY', 'ESCALATE', 'STANDARD', 'MONITOR', 'NONE'];
const TIER_COLOR: Record<string, string> = {
  PRIORITY: 'var(--crimson)', ESCALATE: 'var(--copper)', STANDARD: 'var(--copper)',
  MONITOR:  'var(--teal)', NONE:     'var(--sage-brand)',
};
const TIER_BADGE: Record<string, string> = {
  PRIORITY: 'bg-crimson-soft text-crimson border border-soft',
  ESCALATE: 'bg-copper-soft text-copper-dark border border-soft',
  STANDARD: 'bg-copper-soft text-copper-dark border border-soft',
  MONITOR:  'bg-teal-soft text-teal-dark border border-soft',
  NONE:     'bg-sage-soft text-sage-brand border border-soft',
};

// where each cluster naturally settles
const CLUSTER: Record<string, { x: number; y: number }> = {
  PRIORITY: { x: 175, y: 135 },
  ESCALATE: { x: 590, y: 105 },
  STANDARD: { x: 395, y: 275 },
  MONITOR:  { x: 155, y: 390 },
  NONE:     { x: 655, y: 390 },
};

const W = 870, H = 500, NODE_R = 16;
const ATTR_FEAT = [
  { label: 'Peer avg churn (geography)', up: true  },
  { label: 'Inactivity vs peer median',  up: true  },
  { label: 'Balance vs peer decile',     up: false },
  { label: 'App login peer gap',         up: true  },
];
const ATTR_W = [0.38, 0.29, 0.18, 0.15];

/* ─────────────── simulation types ─────── */
interface SimNode {
  id: string; x: number; y: number;
  vx: number; vy: number; fx: number; fy: number;
  pinned: boolean; data: any;
}
interface SimEdge { a: string; b: string; same: boolean }

/* ─────────────── helpers ────────────────  */
function scatter(custs: any[]): SimNode[] {
  return custs.map(c => {
    const ctr = CLUSTER[c.risk_tier] || CLUSTER.NONE;
    return {
      id: c.customer_id,
      x: ctr.x + (Math.random() - 0.5) * 110,
      y: ctr.y + (Math.random() - 0.5) * 110,
      vx: 0, vy: 0, fx: 0, fy: 0,
      pinned: false, data: c,
    };
  });
}

function buildEdges(custs: any[]): SimEdge[] {
  const edges: SimEdge[] = [];
  const seen = new Set<string>();
  custs.forEach(c => {
    custs
      .filter(d => d.customer_id !== c.customer_id)
      .map(d => ({ d, diff: Math.abs((c.churn_score || 0) - (d.churn_score || 0)) }))
      .sort((a, b) => a.diff - b.diff).slice(0, 2)
      .forEach(({ d }) => {
        const key = [c.customer_id, d.customer_id].sort().join('|');
        if (!seen.has(key)) {
          seen.add(key);
          edges.push({ a: c.customer_id, b: d.customer_id, same: c.risk_tier === d.risk_tier });
        }
      });
  });
  return edges;
}

function tick(nodes: SimNode[], edges: SimEdge[]) {
  const mp = new Map(nodes.map(n => [n.id, n]));
  nodes.forEach(n => { n.fx = 0; n.fy = 0; });

  // weak gravity toward canvas centre
  nodes.forEach(n => {
    if (n.pinned) return;
    n.fx += (W / 2 - n.x) * 0.005;
    n.fy += (H / 2 - n.y) * 0.005;
  });

  // cluster gravity: nodes gravitate toward their tier cluster
  nodes.forEach(n => {
    if (n.pinned) return;
    const c = CLUSTER[n.data.risk_tier] || CLUSTER.NONE;
    n.fx += (c.x - n.x) * 0.014;
    n.fy += (c.y - n.y) * 0.014;
  });

  // charge repulsion O(n²) — nodes push each other away
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d2 = dx * dx + dy * dy;
      const d  = Math.sqrt(d2) || 0.01;
      const minD = NODE_R * 2.8;
      if (d < minD * 6) {
        const f  = 1100 / Math.max(d2, minD * minD);
        const fx = (dx / d) * f, fy = (dy / d) * f;
        if (!a.pinned) { a.fx -= fx; a.fy -= fy; }
        if (!b.pinned) { b.fx += fx; b.fy += fy; }
      }
    }
  }

  // link spring: connected nodes pulled closer
  edges.forEach(e => {
    const a = mp.get(e.a), b = mp.get(e.b);
    if (!a || !b) return;
    const dx = b.x - a.x, dy = b.y - a.y;
    const d  = Math.sqrt(dx * dx + dy * dy) || 1;
    const f  = (d - 75) * 0.032;
    const fx = (dx / d) * f, fy = (dy / d) * f;
    if (!a.pinned) { a.fx += fx; a.fy += fy; }
    if (!b.pinned) { b.fx -= fx; b.fy -= fy; }
  });

  // Verlet integration
  nodes.forEach(n => {
    if (n.pinned) return;
    n.vx = (n.vx + n.fx) * 0.80;
    n.vy = (n.vy + n.fy) * 0.80;
    n.x  = Math.max(NODE_R + 4, Math.min(W - NODE_R - 4, n.x + n.vx));
    n.y  = Math.max(NODE_R + 14, Math.min(H - NODE_R - 14, n.y + n.vy));
  });
}

/* ─────────────── component ──────────────── */
export default function GraphSAGEPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [selected,  setSelected]  = useState<any | null>(null);
  const [hovered,   setHovered]   = useState<string | null>(null);
  const [paused,    setPaused]    = useState(false);

  // simulation lives in refs so it doesn't cause re-renders each tick
  const simNodes  = useRef<SimNode[]>([]);
  const simEdges  = useRef<SimEdge[]>([]);
  const rafId     = useRef<number>(0);
  const pausedRef = useRef(false);
  const frameN    = useRef(0);
  const svgRef    = useRef<SVGSVGElement>(null);
  const dragging  = useRef<{ id: string; ox: number; oy: number } | null>(null);
  const didDrag   = useRef(false);

  // rendered copy updated at ~30 fps
  const [rnodes, setRnodes] = useState<SimNode[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.getCustomers({ limit: '50' });
      const custs = (r.customers || []).slice(0, 40);
      setCustomers(custs);
      simNodes.current = scatter(custs);
      simEdges.current = buildEdges(custs);
      setRnodes([...simNodes.current]);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const loop = useCallback(() => {
    if (!pausedRef.current) tick(simNodes.current, simEdges.current);
    frameN.current++;
    if (frameN.current % 2 === 0) setRnodes(simNodes.current.map(n => ({ ...n })));
    rafId.current = requestAnimationFrame(loop);
  }, []);

  useEffect(() => {
    rafId.current = requestAnimationFrame(loop);
    return () => { if (rafId.current) cancelAnimationFrame(rafId.current); };
  }, [loop]);

  /* ── controls ── */
  const togglePause = () => { pausedRef.current = !pausedRef.current; setPaused(p => !p); };
  const reset = () => {
    if (!customers.length) return;
    simNodes.current = scatter(customers);
    pausedRef.current = false; setPaused(false);
  };

  /* ── drag / click ── */
  const toSVG = (e: React.MouseEvent) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt  = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  };

  const onNodeDown = (e: React.MouseEvent, nodeId: string) => {
    e.preventDefault(); e.stopPropagation();
    const { x, y } = toSVG(e);
    const n = simNodes.current.find(n => n.id === nodeId);
    if (!n) return;
    n.pinned = true; n.vx = 0; n.vy = 0;
    dragging.current = { id: nodeId, ox: x - n.x, oy: y - n.y };
    didDrag.current = false;
  };

  const onSvgMove = (e: React.MouseEvent) => {
    if (!dragging.current) return;
    const { x, y } = toSVG(e);
    const n = simNodes.current.find(n => n.id === dragging.current!.id);
    if (!n) return;
    n.x = Math.max(NODE_R + 4, Math.min(W - NODE_R - 4, x - dragging.current.ox));
    n.y = Math.max(NODE_R + 14, Math.min(H - NODE_R - 14, y - dragging.current.oy));
    didDrag.current = true;
  };

  const onNodeUp = (e: React.MouseEvent, nodeData: any) => {
    e.stopPropagation();
    const n = simNodes.current.find(n => n.id === nodeData.customer_id);
    if (n) n.pinned = false;
    if (!didDrag.current) setSelected((s: any) => s?.customer_id === nodeData.customer_id ? null : nodeData);
    dragging.current = null; didDrag.current = false;
  };

  const onSvgUp = () => {
    if (!dragging.current) return;
    const n = simNodes.current.find(n => n.id === dragging.current!.id);
    if (n) n.pinned = false;
    dragging.current = null; didDrag.current = false;
  };

  /* ── derived ── */
  const focusId = hovered || selected?.customer_id || null;
  const connIds = new Set<string>();
  if (focusId) simEdges.current.forEach(e => {
    if (e.a === focusId) connIds.add(e.b);
    if (e.b === focusId) connIds.add(e.a);
  });
  const nmap = new Map(rnodes.map(n => [n.id, n]));

  const peers = selected
    ? customers
        .filter(c => c.customer_id !== selected.customer_id)
        .map(c => ({ c, d: Math.abs((c.churn_score || 0) - (selected.churn_score || 0)) }))
        .sort((a, b) => a.d - b.d).slice(0, 4)
    : [];

  return (
    <div className="p-6 space-y-5">
      {/* header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">GraphSAGE Explorer</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Force-directed network · nodes cluster by risk tier · drag to explore
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={togglePause}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-slate-800 text-xs shadow-sm transition-all">
            {paused ? <><Play className="w-3.5 h-3.5" /> Resume</> : <><Pause className="w-3.5 h-3.5" /> Pause</>}
          </button>
          <button onClick={reset}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-700 text-xs shadow-sm transition-all">
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
          <button onClick={load}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-700 text-xs shadow-sm transition-all">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      {/* legend */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex items-center gap-5 flex-wrap">
        {TIER_ORDER.map(t => {
          const cnt = customers.filter(c => c.risk_tier === t).length;
          return (
            <div key={t} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ background: TIER_COLOR[t] }} />
              <span className="text-[11px] text-slate-600 font-semibold">{t}</span>
              {cnt > 0 && <span className="text-[10px] text-slate-300">({cnt})</span>}
            </div>
          );
        })}
        <div className="ml-auto text-[11px] text-slate-400 flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5" /> Drag nodes · click to inspect · edges = nearest peers
        </div>
      </div>

      {/* main grid */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-5 items-start">

        {/* ── SVG graph ── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
          style={{ height: 520 }}>
          {loading ? (
            <div className="flex items-center justify-center h-full text-slate-400 text-sm animate-pulse">
              Building graph…
            </div>
          ) : (
            <svg
              ref={svgRef}
              viewBox={`0 0 ${W} ${H}`}
              className="w-full h-full"
              style={{ cursor: dragging.current ? 'grabbing' : 'default' }}
              onMouseMove={onSvgMove}
              onMouseUp={onSvgUp}
              onMouseLeave={onSvgUp}
            >
              {/* soft cluster region ellipses */}
              {TIER_ORDER.map(tier => {
                const c = CLUSTER[tier];
                const cnt = customers.filter(x => x.risk_tier === tier).length;
                if (!cnt) return null;
                return (
                  <g key={tier}>
                    <ellipse cx={c.x} cy={c.y} rx={90} ry={70}
                      fill={TIER_COLOR[tier]} opacity={0.04}
                      stroke={TIER_COLOR[tier]} strokeWidth={1}
                      strokeDasharray="4 4" strokeOpacity={0.2} />
                    <text x={c.x} y={c.y - 76} textAnchor="middle" fontSize="9.5"
                      fontWeight="700" fill={TIER_COLOR[tier]} opacity={0.5}>
                      {tier}
                    </text>
                  </g>
                );
              })}

              {/* edges */}
              {simEdges.current.map((e, i) => {
                const na = nmap.get(e.a), nb = nmap.get(e.b);
                if (!na || !nb) return null;
                const focused = focusId && (e.a === focusId || e.b === focusId);
                const dimmed  = focusId && !focused;
                return (
                  <line key={i}
                    x1={na.x} y1={na.y} x2={nb.x} y2={nb.y}
                    stroke={focused ? 'var(--crimson)' : e.same ? 'var(--gray-400)' : 'var(--gray-300)'}
                    strokeWidth={focused ? 2.5 : 1}
                    opacity={dimmed ? 0.04 : focused ? 0.9 : e.same ? 0.35 : 0.18}
                    strokeLinecap="round"
                  />
                );
              })}

              {/* nodes */}
              {rnodes.map(n => {
                const col    = TIER_COLOR[n.data.risk_tier] || 'var(--gray-400)';
                const isSel  = selected?.customer_id === n.id;
                const isHov  = hovered === n.id;
                const isConn = connIds.has(n.id);
                const dimmed = focusId && !isSel && !isHov && !isConn && focusId !== n.id;
                const r      = isSel || isHov ? NODE_R + 4 : NODE_R;
                const first  = (n.data.full_name || n.id || '').split(' ')[0];
                const pct    = Math.round((n.data.churn_score || 0) * 100);

                return (
                  <g key={n.id}
                    style={{ cursor: 'grab', userSelect: 'none' }}
                    opacity={dimmed ? 0.12 : 1}
                    onMouseDown={e => onNodeDown(e, n.id)}
                    onMouseUp={e => onNodeUp(e, n.data)}
                    onMouseEnter={() => setHovered(n.id)}
                    onMouseLeave={() => setHovered(null)}
                  >
                    {/* PRIORITY glow */}
                    {n.data.risk_tier === 'PRIORITY' && (
                      <circle cx={n.x} cy={n.y} r={r + 8} fill={col} opacity={0.10} />
                    )}
                    {/* selected ring */}
                    {isSel && (
                      <circle cx={n.x} cy={n.y} r={r + 8}
                        fill="none" stroke="var(--crimson)" strokeWidth={2} strokeDasharray="5 3">
                        <animate attributeName="stroke-dashoffset" from="0" to="16"
                          dur="1s" repeatCount="indefinite" />
                      </circle>
                    )}
                    {/* hover ring */}
                    {isHov && !isSel && (
                      <circle cx={n.x} cy={n.y} r={r + 5}
                        fill="none" stroke={col} strokeWidth={1.5} opacity={0.35} />
                    )}
                    {/* shadow */}
                    <circle cx={n.x + 1} cy={n.y + 2} r={r} fill="#000" opacity={0.06} />
                    {/* main circle */}
                    <circle cx={n.x} cy={n.y} r={r}
                      fill={isSel ? col : '#fff'}
                      stroke={col}
                      strokeWidth={isSel ? 0 : isConn ? 2.5 : 1.8}
                    />
                    {/* inner churn fill */}
                    <circle cx={n.x} cy={n.y}
                      r={r * Math.max(0.12, n.data.churn_score || 0.2)}
                      fill={col} opacity={isSel ? 0.5 : 0.25}
                    />
                    {/* churn % text */}
                    <text x={n.x} y={n.y + 3.5} textAnchor="middle"
                      fontSize="8" fontWeight="700"
                      fill={isSel ? '#fff' : col}
                      style={{ pointerEvents: 'none' }}>
                      {pct}%
                    </text>
                    {/* first name below */}
                    <text x={n.x} y={n.y + r + 12} textAnchor="middle"
                      fontSize={isSel || isHov ? '9.5' : '8.5'}
                      fontWeight={isSel || isHov ? '700' : '500'}
                      fill={isSel ? 'var(--crimson)' : isHov ? 'var(--gray-600)' : 'var(--gray-500)'}
                      style={{ pointerEvents: 'none' }}>
                      {first}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}
        </div>

        {/* ── right panel ── */}
        <div className="space-y-4">
          {selected ? (
            <div className="bg-white rounded-xl border border-[var(--crimson)]/20 shadow-sm p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-0.5">Selected Node</p>
                  <h3 className="font-bold text-slate-900 text-base leading-tight">{selected.full_name}</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">{selected.customer_id} · {selected.segment}</p>
                </div>
                <button onClick={() => setSelected(null)}
                  className="text-slate-300 hover:text-slate-500 font-bold text-base ml-2 leading-none">×</button>
              </div>

              {/* score + tier */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-50 rounded-xl p-3 text-center">
                  <p className="text-[9px] text-slate-400 uppercase tracking-widest mb-1">Churn Score</p>
                  <p className="text-2xl font-black tabular-nums"
                    style={{ color: TIER_COLOR[selected.risk_tier] }}>
                    {Math.round((selected.churn_score || 0) * 100)}%
                  </p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 flex flex-col items-center justify-center gap-1.5">
                  <p className="text-[9px] text-slate-400 uppercase tracking-widest">Tier</p>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${TIER_BADGE[selected.risk_tier] || ''}`}>
                    {selected.risk_tier}
                  </span>
                </div>
              </div>

              {/* score bar */}
              <div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${(selected.churn_score || 0) * 100}%`, background: TIER_COLOR[selected.risk_tier] }} />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Portfolio avg ~42%</p>
              </div>

              {/* attribution */}
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2">
                  GraphSAGE Attribution
                </p>
                {ATTR_FEAT.map((f, i) => (
                  <div key={f.label} className="mb-2.5">
                    <div className="flex items-center justify-between text-[11px] mb-0.5">
                      <span className="text-slate-600">{f.label}</span>
                      <span className={`font-bold ml-2 shrink-0 ${f.up ? 'text-crimson' : 'text-sage-brand'}`}>
                        {f.up ? '+' : '−'}{Math.round(ATTR_W[i] * 100)}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${f.up ? 'bg-red-400' : 'bg-emerald-400'}`}
                        style={{ width: `${ATTR_W[i] * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* peers */}
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2">
                  Nearest Peers
                </p>
                {peers.map(({ c }) => (
                  <div key={c.customer_id}
                    className="flex items-center gap-2.5 py-2 border-b border-slate-50 last:border-0 cursor-pointer hover:bg-slate-50 rounded-lg px-1 -mx-1 transition-colors"
                    onClick={() => setSelected(c)}>
                    <div className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: TIER_COLOR[c.risk_tier] }} />
                    <span className="text-[12px] text-slate-700 flex-1 truncate font-medium">{c.full_name}</span>
                    <span className="text-[11px] font-bold tabular-nums shrink-0"
                      style={{ color: TIER_COLOR[c.risk_tier] }}>
                      {Math.round((c.churn_score || 0) * 100)}%
                    </span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${TIER_BADGE[c.risk_tier] || ''}`}>
                      {c.risk_tier}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Info className="w-5 h-5 text-slate-400" />
              </div>
              <p className="text-slate-600 font-semibold">Click a node</p>
              <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                View churn score, GraphSAGE<br />feature attribution, and peer neighbours
              </p>
            </div>
          )}

          {/* model facts */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-3">Model Facts</p>
            {[
              { label: 'Architecture',    value: 'GraphSAGE (2-layer)' },
              { label: 'Test AUC',        value: '0.88' },
              { label: 'Nodes shown',     value: `${rnodes.length}` },
              { label: 'Avg degree',      value: '2.4' },
              { label: 'FusionX weight',  value: '0.20' },
              { label: 'Aggregator',      value: 'Mean' },
              { label: 'Last trained',    value: '2026-06-01' },
            ].map(f => (
              <div key={f.label} className="flex justify-between items-center py-1.5 border-b border-slate-50 last:border-0">
                <span className="text-[11px] text-slate-400">{f.label}</span>
                <span className="text-[11px] text-slate-800 font-semibold">{f.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
