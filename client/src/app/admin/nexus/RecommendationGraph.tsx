'use client';

/**
 * RecommendationGraph — bipartite customer↔product graph that visualizes the
 * collaborative-filtering / GNN recommendation logic.
 *
 *  · Products = anchored hub nodes (rounded squares), sized by adoption.
 *  · Customers = free force nodes, pulled toward products they hold + same-segment peers.
 *  · Select a customer → message-passing animation: pulses travel from peers who
 *    hold a product the customer lacks → through the product → to the customer,
 *    literally showing "customers like you also hold X → we recommend X".
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { Play, Pause, RotateCcw, Zap, Sparkles } from 'lucide-react';

const W = 900, H = 560;
const CUST_R = 9, PROD_R = 26;

const CAT_COLOR: Record<string, string> = {
  card: '#6B132B', loan: '#6B132B', deposit: '#B46B3E',
  investment: '#B46B3E', insurance: '#2A161B',
};
const SEG_COLOR: Record<string, string> = {
  HNW: '#6B132B', 'Mass Affluent': '#B46B3E', SME: '#2A161B', 'Mass Market': '#8B8481',
};

interface CNode { id: string; x: number; y: number; vx: number; vy: number; fx: number; fy: number; pinned: boolean; d: any; }
interface PNode { id: string; x: number; y: number; d: any; }

interface Props {
  graph: any;                        // {products, customers, holds_edges, peer_edges}
  recommendation?: any;              // detail.top_offer (for highlight)
  recommendations?: any[];           // detail.recommendations
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function RecommendationGraph({ graph, recommendation, recommendations, selectedId, onSelect }: Props) {
  const cnodes = useRef<CNode[]>([]);
  const pnodes = useRef<Map<string, PNode>>(new Map());
  const raf = useRef<number | undefined>(undefined);
  const pausedRef = useRef(false);
  const frame = useRef(0);
  const [rnodes, setRnodes] = useState<CNode[]>([]);
  const [paused, setPaused] = useState(false);
  const [pulseT, setPulseT] = useState(0);     // 0..1 animation clock for message passing
  const svgRef = useRef<SVGSVGElement>(null);

  // Anchor products in an ellipse around the perimeter so they surround customers
  const layoutProducts = useCallback((products: any[]) => {
    const m = new Map<string, PNode>();
    const n = products.length;
    const cx = W / 2, cy = H / 2;
    const rx = 370, ry = 200;
    products.forEach((p, i) => {
      const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
      const x = cx + rx * Math.cos(angle);
      const y = cy + ry * Math.sin(angle);
      m.set(p.id, { id: p.id, x, y, d: p });
    });
    return m;
  }, []);

  // Init
  useEffect(() => {
    if (!graph?.customers) return;
    pnodes.current = layoutProducts(graph.products);
    cnodes.current = graph.customers.map((c: any) => ({
      id: c.id,
      x: W / 2 + (Math.random() - 0.5) * 120,
      y: H / 2 + (Math.random() - 0.5) * 80,
      vx: 0, vy: 0, fx: 0, fy: 0, pinned: false, d: c,
    }));
    setRnodes([...cnodes.current]);
  }, [graph, layoutProducts]);

  // Physics
  const tick = useCallback(() => {
    const cs = cnodes.current;
    const ps = pnodes.current;
    const holdsByCust: Record<string, string[]> = {};
    (graph?.holds_edges || []).forEach((e: any) => {
      (holdsByCust[e.c] ||= []).push(e.p);
    });

    cs.forEach(n => { n.fx = 0; n.fy = 0; });

    // strong centering — keep customers clustered in the middle
    cs.forEach(n => {
      if (n.pinned) return;
      n.fx += (W / 2 - n.x) * 0.006;
      n.fy += (H / 2 - n.y) * 0.006;
    });

    // holds-edge springs: pull customer toward products they hold (weaker, so they stay centered)
    cs.forEach(n => {
      if (n.pinned) return;
      const held = holdsByCust[n.id] || [];
      held.forEach(pid => {
        const p = ps.get(pid);
        if (!p) return;
        const dx = p.x - n.x, dy = p.y - n.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const f = (d - 80) * 0.006;
        n.fx += (dx / d) * f; n.fy += (dy / d) * f;
      });
    });

    // customer-customer repulsion (only nearby, capped)
    for (let i = 0; i < cs.length; i++) {
      for (let j = i + 1; j < cs.length; j++) {
        const a = cs[i], b = cs[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > 20000) continue;
        const d = Math.sqrt(d2) || 0.1;
        const f = 180 / Math.max(d2, 100);
        const fx = (dx / d) * f, fy = (dy / d) * f;
        if (!a.pinned) { a.fx -= fx; a.fy -= fy; }
        if (!b.pinned) { b.fx += fx; b.fy += fy; }
      }
    }

    // integrate
    cs.forEach(n => {
      if (n.pinned) return;
      n.vx = (n.vx + n.fx) * 0.82;
      n.vy = (n.vy + n.fy) * 0.82;
      n.x = Math.max(CUST_R + 4, Math.min(W - CUST_R - 4, n.x + n.vx));
      n.y = Math.max(CUST_R + 4, Math.min(H - CUST_R - 4, n.y + n.vy));
    });
  }, [graph]);

  const loop = useCallback(() => {
    if (!pausedRef.current) tick();
    frame.current++;
    setPulseT(t => (t + 0.012) % 1);
    if (frame.current % 2 === 0) setRnodes(cnodes.current.map(n => ({ ...n })));
    raf.current = requestAnimationFrame(loop);
  }, [tick]);

  useEffect(() => {
    raf.current = requestAnimationFrame(loop);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [loop]);

  const togglePause = () => { pausedRef.current = !pausedRef.current; setPaused(p => !p); };
  const reset = () => {
    cnodes.current.forEach(n => {
      n.x = W / 2 + (Math.random() - 0.5) * 120;
      n.y = H / 2 + (Math.random() - 0.5) * 80;
      n.vx = 0; n.vy = 0; n.pinned = false;
    });
  };

  // Derived: focus customer + their peers + recommended product
  const sel = rnodes.find(n => n.id === selectedId) || null;
  const recProduct = recommendation?.product || recommendations?.[0]?.product || null;

  // peers (same segment) who HOLD the recommended product → the "evidence"
  const peerEdges = graph?.peer_edges || [];
  const peerIds = new Set<string>();
  if (selectedId) peerEdges.forEach((e: any) => {
    if (e.a === selectedId) peerIds.add(e.b);
    if (e.b === selectedId) peerIds.add(e.a);
  });
  const evidencePeers = sel && recProduct
    ? rnodes.filter(n => peerIds.has(n.id) && (n.d.products || []).includes(recProduct))
    : [];

  const heldSet = new Set<string>(sel?.d.products || []);
  const cmap = new Map(rnodes.map(n => [n.id, n]));

  return (
    <div className="bg-white rounded-md border border-[#E5E0DF] overflow-hidden">
      {/* toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#E5E0DF]">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#6B132B]" />
          <span className="text-[12px] font-bold text-[#2A161B]">Recommendation Graph</span>
          <span className="text-[10px] text-[#8B8481]">· bipartite customer ↔ product · live force simulation</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={togglePause} className="flex items-center gap-1 px-2 py-1 rounded-md border border-[#E5E0DF] text-[11px] text-[#6B6562] hover:bg-[#FAFAF9]">
            {paused ? <><Play className="w-3 h-3" /> Resume</> : <><Pause className="w-3 h-3" /> Pause</>}
          </button>
          <button onClick={reset} className="flex items-center gap-1 px-2 py-1 rounded-md border border-[#E5E0DF] text-[11px] text-[#6B6562] hover:bg-[#FAFAF9]">
            <RotateCcw className="w-3 h-3" /> Reshuffle
          </button>
        </div>
      </div>

      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 560, background: 'radial-gradient(circle at 50% 40%, #FAFAF9, #F5F4F2)' }}>
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* holds edges (faint) */}
        {(graph?.holds_edges || []).map((e: any, i: number) => {
          const c = cmap.get(e.c); const p = pnodes.current.get(e.p);
          if (!c || !p) return null;
          const focus = selectedId && e.c === selectedId;
          if (selectedId && !focus) return (
            <line key={i} x1={c.x} y1={c.y} x2={p.x} y2={p.y} stroke="#E5E0DF" strokeWidth={0.4} opacity={0.06} />
          );
          return (
            <line key={i} x1={c.x} y1={c.y} x2={p.x} y2={p.y}
              stroke={focus ? CAT_COLOR[p.d.category] : '#E5E0DF'}
              strokeWidth={focus ? 2 : 0.5} opacity={focus ? 0.7 : 0.10} strokeLinecap="round" />
          );
        })}

        {/* ── message-passing animation: peers → recommended product → customer ── */}
        {sel && recProduct && (() => {
          const p = pnodes.current.get(recProduct);
          if (!p) return null;
          return (
            <g>
              {/* peer → product pulses */}
              {evidencePeers.map((peer, k) => {
                const t = (pulseT + k / Math.max(evidencePeers.length, 1)) % 1;
                const px = peer.x + (p.x - peer.x) * t;
                const py = peer.y + (p.y - peer.y) * t;
                return (
                  <g key={'pp' + peer.id}>
                    <line x1={peer.x} y1={peer.y} x2={p.x} y2={p.y} stroke="#B46B3E" strokeWidth={1.5} opacity={0.35} strokeDasharray="3 4" />
                    <circle cx={px} cy={py} r={3} fill="#B46B3E" opacity={0.9} />
                  </g>
                );
              })}
              {/* product → selected customer pulse (the recommendation) */}
              {(() => {
                const t2 = pulseT;
                const rx = p.x + (sel.x - p.x) * t2;
                const ry = p.y + (sel.y - p.y) * t2;
                return (
                  <g>
                    <line x1={p.x} y1={p.y} x2={sel.x} y2={sel.y} stroke={CAT_COLOR[p.d.category]} strokeWidth={2.5} opacity={0.6} />
                    <circle cx={rx} cy={ry} r={4.5} fill={CAT_COLOR[p.d.category]} filter="url(#glow)" />
                  </g>
                );
              })()}
            </g>
          );
        })()}

        {/* product nodes */}
        {graph?.products?.map((prod: any) => {
          const p = pnodes.current.get(prod.id);
          if (!p) return null;
          const col = CAT_COLOR[prod.category] || '#94a3b8';
          const isRec = recProduct === prod.id && !!sel;
          const isHeld = heldSet.has(prod.id);
          const size = PROD_R + Math.min(prod.adoption, 18);
          const dim = selectedId && !isRec && !isHeld;
          return (
            <g key={prod.id} opacity={dim ? 0.3 : 1}>
              {isRec && (
                <rect x={p.x - size - 8} y={p.y - size - 8} width={(size + 8) * 2} height={(size + 8) * 2} rx={14}
                  fill="none" stroke={col} strokeWidth={2} strokeDasharray="6 4">
                  <animate attributeName="stroke-dashoffset" from="0" to="20" dur="0.9s" repeatCount="indefinite" />
                </rect>
              )}
              <rect x={p.x - size} y={p.y - size} width={size * 2} height={size * 2} rx={11}
                fill={col} opacity={isRec ? 1 : 0.92} filter={isRec ? 'url(#glow)' : undefined} />
              <text x={p.x} y={p.y - 2} textAnchor="middle" fontSize="9" fontWeight="800" fill="#fff" style={{ pointerEvents: 'none' }}>
                {prod.label.split(' ').map((w: string) => w[0]).join('').slice(0, 3)}
              </text>
              <text x={p.x} y={p.y + 9} textAnchor="middle" fontSize="7" fill="#fff" opacity={0.85} style={{ pointerEvents: 'none' }}>
                {prod.adoption}
              </text>
                <text x={p.x} y={p.y + size + 12} textAnchor="middle" fontSize="8.5" fontWeight="600" fill="#6B6562" style={{ pointerEvents: 'none' }}>
                {prod.label}
              </text>
              {isRec && recommendation?.score != null && (
                <g>
                  <rect x={p.x - 20} y={p.y - size - 30} width={40} height={18} rx={9} fill={col} />
                  <text x={p.x} y={p.y - size - 17} textAnchor="middle" fontSize="10" fontWeight="800" fill="#fff">
                    {Math.round(recommendation.score * 100)}%
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* customer nodes */}
        {rnodes.map(n => {
          const isSel = selectedId === n.id;
          const isPeer = peerIds.has(n.id);
          const isEvidence = evidencePeers.some(p => p.id === n.id);
          const dim = selectedId && !isSel && !isPeer;
          const col = SEG_COLOR[n.d.segment] || '#8B8481';
          const r = isSel ? CUST_R + 4 : isEvidence ? CUST_R + 2 : CUST_R;
          return (
            <g key={n.id} opacity={dim ? 0.18 : 1} style={{ cursor: 'pointer' }}
              onClick={() => onSelect(n.id)}>
              {isSel && (
                <circle cx={n.x} cy={n.y} r={r + 6} fill="none" stroke="#6B132B" strokeWidth={2} strokeDasharray="4 3">
                  <animate attributeName="stroke-dashoffset" from="0" to="14" dur="1s" repeatCount="indefinite" />
                </circle>
              )}
              {isEvidence && <circle cx={n.x} cy={n.y} r={r + 4} fill="#B46B3E" opacity={0.18} />}
              <circle cx={n.x} cy={n.y} r={r} fill={isSel ? '#6B132B' : '#fff'} stroke={col} strokeWidth={isSel ? 0 : 2} />
              <circle cx={n.x} cy={n.y} r={r * 0.45} fill={col} opacity={isSel ? 0.4 : 0.55} />
              {(isSel || isEvidence) && (
                <text x={n.x} y={n.y - r - 4} textAnchor="middle" fontSize="8.5" fontWeight="700"
                  fill={isSel ? '#6B132B' : '#B46B3E'} style={{ pointerEvents: 'none' }}>
                  {n.d.first_name}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* caption / legend */}
      <div className="px-4 py-3 border-t border-[#E5E0DF] flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          {Object.entries(SEG_COLOR).map(([s, c]) => (
            <span key={s} className="flex items-center gap-1 text-[10px] text-[#6B6562]">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: c }} /> {s}
            </span>
          ))}
          <span className="text-[#C9C3C0]">|</span>
          <span className="text-[10px] text-[#6B6562] flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#8B8481]" /> product (sized by adoption)
          </span>
        </div>
        {sel && recProduct ? (
          <span className="text-[11px] text-[#B46B3E] font-semibold flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5" />
            {evidencePeers.length} similar customers hold {recommendation?.label || recProduct} → recommended to {sel.d.first_name}
          </span>
        ) : (
          <span className="text-[11px] text-[#8B8481]">Click any customer node to trace its recommendation</span>
        )}
      </div>
    </div>
  );
}
