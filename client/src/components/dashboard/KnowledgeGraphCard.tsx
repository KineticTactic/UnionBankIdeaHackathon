"use client";

import { useEffect, useRef, useState } from "react";
import { api, getToken } from "@/lib/api";
import { Network, AlertTriangle, Zap, User } from "lucide-react";
import { tierColor } from "@/components/RiskBadge";
import type { RiskTier } from "@/types";

interface CustomerNode {
  id:         string;
  label:      string;
  fullName:   string;
  risk_tier:  RiskTier;
  score:      number;
  segment:    string;
  signals:    string[];
  x:          number;
  y:          number;
  r:          number;
}

interface SignalNode {
  id:    string;
  label: string;
  type:  'signal';
  x:     number;
  y:     number;
  r:     number;
}

type Node = CustomerNode | SignalNode;

interface Edge {
  source: string;
  target: string;
  weight: number;
  type:   'peer_contagion' | 'signal_link';
}

interface GraphData {
  nodes:    Node[];
  edges:    Edge[];
  sigTypes: string[];
}

function buildGraph(
  customers: CustomerNode[],
  sigTypes:  string[],
  W: number,
  H: number,
): GraphData {
  const nodes: Node[]  = [];
  const edges: Edge[]  = [];
  const cx = W / 2;
  const cy = H / 2;

  const r = Math.min(W, H) * 0.37;
  customers.forEach((c, i) => {
    const angle = (i / customers.length) * Math.PI * 2 - Math.PI / 2;
    const dist = c.risk_tier === 'PRIORITY' ? r * 0.55 : c.risk_tier === 'ESCALATE' ? r * 0.78 : r;
    nodes.push({
      ...c,
      x: cx + Math.cos(angle) * dist,
      y: cy + Math.sin(angle) * dist,
      r: 18 + c.score * 16,
    });
  });

  const topSignals = sigTypes.slice(0, 4);
  topSignals.forEach((st, i) => {
    const angle = (i / topSignals.length) * Math.PI * 2 - Math.PI / 2;
    nodes.push({
      id:    `SIG-${st}`,
      label: st.replace(/_/g, ' '),
      type:  'signal',
      x:     cx + Math.cos(angle) * r * 0.28,
      y:     cy + Math.sin(angle) * r * 0.28 + 20,
      r:     14,
    });
  });

  for (let i = 0; i < customers.length; i++) {
    for (let j = i + 1; j < customers.length; j++) {
      const shared = customers[i].signals.filter(s => customers[j].signals.includes(s));
      if (shared.length > 0) {
        edges.push({
          source: customers[i].id,
          target: customers[j].id,
          weight: Math.min(0.5 + shared.length * 0.15, 1),
          type:   'peer_contagion',
        });
      }
    }
  }

  customers.forEach(c => {
    topSignals.forEach(st => {
      if (c.signals.includes(st)) {
        edges.push({ source: c.id, target: `SIG-${st}`, weight: 0.6, type: 'signal_link' });
      }
    });
  });

  return { nodes, edges, sigTypes: topSignals };
}

function isCustomerNode(n: Node): n is CustomerNode {
  return 'risk_tier' in n;
}

export function KnowledgeGraphCard() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims,    setDims]    = useState({ w: 700, h: 420 });
  const [hovered, setHovered] = useState<CustomerNode | null>(null);
  const [graph,   setGraph]   = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const obs = new ResizeObserver(entries => {
      const el = entries[0];
      if (el) setDims({ w: el.contentRect.width, h: Math.max(380, el.contentRect.width * 0.55) });
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!getToken()) return;
    Promise.all([
      api.getTopAtRisk(14),
      api.getV2Signals(),
    ]).then(([atRiskRes, sigRes]) => {
      const customers = (atRiskRes.data || atRiskRes.customers || []) as {
        customer_id: string; full_name: string; churn_score: number;
        risk_tier: RiskTier; segment: string; alarm_count: number;
      }[];

      const sigMap: Record<string, string[]> = {};
      const sigCountMap: Record<string, number> = {};
      for (const entry of (sigRes.data || [])) {
        sigMap[entry.customer_id] = (entry.signals || []).map((s: { signal_type: string }) => s.signal_type);
        for (const s of (entry.signals || [])) {
          sigCountMap[s.signal_type] = (sigCountMap[s.signal_type] || 0) + 1;
        }
      }

      const topSigTypes = Object.entries(sigCountMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([st]) => st);

      const customerNodes: CustomerNode[] = customers.slice(0, 12).map(c => ({
        id:       c.customer_id,
        label:    c.full_name.split(' ')[0],
        fullName: c.full_name,
        risk_tier: c.risk_tier,
        score:    c.churn_score,
        segment:  c.segment,
        signals:  sigMap[c.customer_id] || [],
        x: 0, y: 0, r: 0,
      }));

      setGraph(buildGraph(customerNodes, topSigTypes, dims.w, dims.h));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!graph) return;
    const customers = graph.nodes.filter(isCustomerNode) as CustomerNode[];
    const sigTypes  = graph.sigTypes;
    setGraph(buildGraph(customers, sigTypes, dims.w, dims.h));
  }, [dims]);

  const propagationPaths = graph?.edges.filter(e => e.type === 'peer_contagion').length ?? 0;
  const signalLinks      = graph?.edges.filter(e => e.type === 'signal_link').length ?? 0;
  const totalNodes       = graph?.nodes.length ?? 0;

  const nodeMap = new Map(graph?.nodes.map(n => [n.id, n]) ?? []);

  return (
    <div className="bg-white rounded-md border border-[#E5E0DF] overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-[#E5E0DF] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Network className="w-4 h-4 text-crimson" />
          <p className="text-[14px] font-bold text-[#2A161B] font-heading">GraphSAGE · Peer Contagion Network</p>
          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-crimson-soft text-crimson border border-crimson uppercase tracking-wide">
            Live Data
          </span>
        </div>
        <p className="text-[11px] text-[#8B8481]">Top {graph?.nodes.filter(isCustomerNode).length ?? '…'} at-risk customers · k=15 cosine similarity</p>
      </div>

      {/* Graph */}
      <div ref={containerRef} className="relative w-full">
        {loading ? (
          <div className="flex items-center justify-center" style={{ height: dims.h }}>
            <div className="flex flex-col items-center gap-2 text-[#8B8481]">
              <div className="w-6 h-6 border-2 border-crimson border-t-transparent rounded-full animate-spin" />
              <span className="text-[12px]">Building knowledge graph…</span>
            </div>
          </div>
        ) : (
          <svg width={dims.w} height={dims.h} className="w-full" style={{ height: dims.h }}>
            <rect width={dims.w} height={dims.h} fill="#F9F9F7" />

            {/* Grid dots */}
            {Array.from({ length: 14 }).map((_, i) =>
              Array.from({ length: 9 }).map((_, j) => (
                <circle key={`${i}-${j}`} cx={i * (dims.w / 13)} cy={j * (dims.h / 8)} r={1} fill="#E5E0DF" />
              ))
            )}

            {/* Edges */}
            {(graph?.edges ?? []).map((e, idx) => {
              const s = nodeMap.get(e.source);
              const t = nodeMap.get(e.target);
              if (!s || !t) return null;
              const isPeer   = e.type === 'peer_contagion';
              const mx = (s.x + t.x) / 2 + (s.y - t.y) * 0.12;
              const my = (s.y + t.y) / 2 - (s.x - t.x) * 0.12;
              return (
                <path
                  key={idx}
                  d={`M${s.x},${s.y} Q${mx},${my} ${t.x},${t.y}`}
                  fill="none"
                  stroke={isPeer ? '#6B132B' : '#8E5026'}
                  strokeWidth={isPeer ? 1 + e.weight * 2 : 1}
                  strokeOpacity={isPeer ? 0.25 + e.weight * 0.25 : 0.4}
                  strokeDasharray={isPeer ? undefined : '4,3'}
                />
              );
            })}

            {/* Nodes */}
            {(graph?.nodes ?? []).map(node => {
              const isCust    = isCustomerNode(node);
              const color     = isCust ? tierColor(node.risk_tier) : '#8E5026';
              const isHovered = isCust && hovered?.id === node.id;

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x},${node.y})`}
                  onMouseEnter={() => isCust ? setHovered(node as CustomerNode) : null}
                  onMouseLeave={() => setHovered(null)}
                  style={{ cursor: isCust ? 'pointer' : 'default' }}
                >
                  {isCust && (node as CustomerNode).risk_tier === 'PRIORITY' && (
                    <circle r={node.r + 7} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={0.25} />
                  )}
                  <circle
                    r={node.r}
                    fill={color}
                    fillOpacity={isCust ? 0.9 : 0.8}
                    stroke="white"
                    strokeWidth={2}
                  />
                  {isCust ? (
                    <text textAnchor="middle" dy="0.35em" fontSize={10} fontWeight="700" fill="white">
                      {Math.round((node as CustomerNode).score * 100)}
                    </text>
                  ) : (
                    <text textAnchor="middle" dy="0.35em" fontSize={8} fontWeight="700" fill="white">SIG</text>
                  )}
                  <text textAnchor="middle" dy={node.r + 14} fontSize={10} fontWeight="600" fill="#2A161B">
                    {isCust ? node.label : (node as SignalNode).label.split(' ')[0]}
                  </text>
                </g>
              );
            })}

            {/* Hover tooltip */}
            {hovered && (
              <g transform={`translate(${Math.min(hovered.x + hovered.r + 10, dims.w - 170)},${Math.max(hovered.y - 45, 8)})`}>
                <rect width={162} height={82} rx={6} fill="white" stroke="#E5E0DF" strokeWidth={1} />
                <text x={10} y={20} fontSize={12} fontWeight="700" fill="#2A161B">{hovered.fullName}</text>
                <text x={10} y={35} fontSize={10} fill="#6B6562">{hovered.segment}</text>
                <text x={10} y={50} fontSize={11} fontWeight="700" fill={tierColor(hovered.risk_tier)}>
                  {hovered.risk_tier} — {Math.round(hovered.score * 100)}%
                </text>
                <text x={10} y={65} fontSize={9} fill="#8B8481">{hovered.signals.length} active signals</text>
                <text x={10} y={78} fontSize={9} fill="#8B8481">{hovered.id}</text>
              </g>
            )}
          </svg>
        )}

        {/* Legend */}
        {!loading && (
          <div className="absolute bottom-3 left-4 flex flex-wrap gap-3">
            {[
              { color: '#B46B3E', label: 'Priority' },
              { color: '#6B132B', label: 'Escalate' },
              { color: '#F4D9C0', label: 'Watch' },
              { color: '#8E5026', label: 'Signal node' },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: l.color }} />
                <span className="text-[10px] text-[#6B6562]">{l.label}</span>
              </div>
            ))}
            <div className="flex items-center gap-1 ml-1">
              <div className="w-5 h-px bg-crimson opacity-60" />
              <span className="text-[10px] text-[#6B6562]">Peer contagion</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-5 h-px border-t border-dashed border-[#8E5026]" />
              <span className="text-[10px] text-[#6B6562]">Signal link</span>
            </div>
          </div>
        )}
      </div>

      {/* Stats bar */}
      <div className="border-t border-[#E5E0DF] grid grid-cols-3 divide-x divide-[#E5E0DF]">
        {[
          { icon: AlertTriangle, label: 'Contagion Paths', value: propagationPaths, color: 'text-crimson' },
          { icon: Zap,           label: 'Signal Links',   value: signalLinks,      color: 'text-[#8E5026]' },
          { icon: User,          label: 'Nodes Mapped',   value: totalNodes,       color: 'text-[#6B6562]' },
        ].map(s => (
          <div key={s.label} className="flex items-center gap-3 px-5 py-3">
            <s.icon className={`w-4 h-4 ${s.color} shrink-0`} />
            <div>
              <div className="text-[18px] font-black text-[#2A161B] font-heading">{s.value}</div>
              <div className="text-[10px] text-[#8B8481] uppercase tracking-wide">{s.label}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
