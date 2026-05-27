"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Network, AlertTriangle, TrendingDown, User, Zap } from "lucide-react";

interface KGNode {
    id: string;
    label: string;
    type: "customer" | "peer" | "signal" | "life_event" | "rm";
    risk?: string;
    score?: number;
    x: number;
    y: number;
    r: number;
}

interface KGEdge {
    source: string;
    target: string;
    weight: number;
    type: "peer_contagion" | "signal" | "managed_by" | "life_event";
}

const TIER_COLOR: Record<string, string> = {
    critical: "#ef4444",
    high:     "#f97316",
    medium:   "#eab308",
    watch:    "#6366f1",
    low:      "#22c55e",
};

const CUSTOMERS = [
    { id: "C-00000001", name: "Arjun Sharma",   score: 0.87, tier: "critical", segment: "HNW", signal: "location_city" },
    { id: "C-00000002", name: "Priya Mehta",    score: 0.71, tier: "high",     segment: "retail", signal: "digital_engagement" },
    { id: "C-00000006", name: "Meera Reddy",    score: 0.91, tier: "critical", segment: "HNW", signal: "lifecycle_mcc" },
    { id: "C-00000007", name: "Ravi Kumar",     score: 0.78, tier: "high",     segment: "retail", signal: "digital_engagement" },
    { id: "C-00000011", name: "Deepa Nair",     score: 0.66, tier: "high",     segment: "SME", signal: "digital_engagement" },
    { id: "C-00000012", name: "Suresh Patel",   score: 0.89, tier: "critical", segment: "SME", signal: "salary_amount" },
    { id: "C-00000014", name: "Anjali Singh",   score: 0.73, tier: "high",     segment: "retail", signal: "location_city" },
    { id: "C-00000016", name: "Vikram Bose",    score: 0.82, tier: "critical", segment: "HNW", signal: "digital_engagement" },
    { id: "C-00000018", name: "Lakshmi Iyer",   score: 0.68, tier: "high",     segment: "retail", signal: "digital_engagement" },
];

function buildGraph(centerX: number, centerY: number, W: number, H: number): { nodes: KGNode[]; edges: KGEdge[] } {
    const nodes: KGNode[] = [];
    const edges: KGEdge[] = [];

    // Place customers in a circular layout
    const r = Math.min(W, H) * 0.36;
    CUSTOMERS.forEach((c, i) => {
        const angle = (i / CUSTOMERS.length) * Math.PI * 2 - Math.PI / 2;
        const dist  = c.tier === "critical" ? r * 0.62 : r;
        nodes.push({
            id: c.id, label: c.name.split(" ")[0], type: "customer",
            risk: c.tier, score: c.score,
            x: centerX + Math.cos(angle) * dist,
            y: centerY + Math.sin(angle) * dist,
            r: 20 + c.score * 14,
        });
    });

    // Add RM node
    nodes.push({ id: "RM-001", label: "RM Team", type: "rm", x: centerX, y: centerY - 30, r: 22 });

    // Signal cluster node
    nodes.push({ id: "SIG-BOCPD", label: "BOCPD\nAlarm", type: "signal", x: centerX - 60, y: centerY + 50, r: 18 });
    nodes.push({ id: "SIG-CUSUM", label: "CUSUM\nAlarm", type: "signal", x: centerX + 60, y: centerY + 50, r: 18 });

    // Edges: peer contagion between high-risk
    const criticals = CUSTOMERS.filter(c => c.tier === "critical");
    const highs     = CUSTOMERS.filter(c => c.tier === "high");

    criticals.forEach(a => {
        criticals.forEach(b => {
            if (a.id < b.id) edges.push({ source: a.id, target: b.id, weight: 0.85, type: "peer_contagion" });
        });
        highs.slice(0, 2).forEach(b => edges.push({ source: a.id, target: b.id, weight: 0.55, type: "peer_contagion" }));
    });

    // Signal edges
    ["C-00000006", "C-00000001"].forEach(id => edges.push({ source: id, target: "SIG-BOCPD", weight: 0.9, type: "signal" }));
    ["C-00000002", "C-00000007", "C-00000011", "C-00000012"].forEach(id => edges.push({ source: id, target: "SIG-CUSUM", weight: 0.7, type: "signal" }));

    // RM edges to all
    CUSTOMERS.slice(0, 5).forEach(c => edges.push({ source: "RM-001", target: c.id, weight: 0.4, type: "managed_by" }));

    return { nodes, edges };
}

function getNodeColor(node: KGNode) {
    if (node.type === "rm")         return "#3b82f6";
    if (node.type === "signal")     return "#8b5cf6";
    if (node.type === "life_event") return "#f59e0b";
    return TIER_COLOR[node.risk || "low"] || "#94a3b8";
}

function getEdgeStyle(edge: KGEdge): { stroke: string; strokeWidth: number; opacity: number; dash?: string } {
    if (edge.type === "peer_contagion") return { stroke: "#ef4444", strokeWidth: 1.5 + edge.weight * 2, opacity: 0.3 + edge.weight * 0.3 };
    if (edge.type === "signal")         return { stroke: "#8b5cf6", strokeWidth: 1, opacity: 0.5, dash: "4,3" };
    return { stroke: "#94a3b8", strokeWidth: 1, opacity: 0.25, dash: "3,4" };
}

export function KnowledgeGraphCard() {
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [dims, setDims] = useState({ w: 700, h: 420 });
    const [hovered, setHovered] = useState<KGNode | null>(null);

    useEffect(() => {
        const obs = new ResizeObserver(entries => {
            const el = entries[0];
            if (el) setDims({ w: el.contentRect.width, h: Math.max(380, el.contentRect.width * 0.55) });
        });
        if (containerRef.current) obs.observe(containerRef.current);
        return () => obs.disconnect();
    }, []);

    const cx = dims.w / 2;
    const cy = dims.h / 2;
    const { nodes, edges } = buildGraph(cx, cy, dims.w, dims.h);

    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    return (
        <Card className="shadow-sm border-slate-200 overflow-hidden">
            <CardHeader className="pb-3 border-b border-slate-100">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                        <Network className="w-4 h-4 text-indigo-500" />
                        Network Risk Intelligence · Contagion Map
                    </CardTitle>
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] bg-red-50 text-red-600 border-red-200 font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5 inline-block" />
                            Contagion Risk Detected
                        </Badge>
                    </div>
                </div>
                <p className="text-xs text-slate-400 mt-1">Peer network graph — departure risk propagation through high-value customer groups</p>
            </CardHeader>

            <CardContent className="p-0">
                <div ref={containerRef} className="relative w-full">
                    <svg
                        ref={svgRef}
                        width={dims.w}
                        height={dims.h}
                        className="w-full"
                        style={{ height: dims.h }}
                    >
                        <defs>
                            <radialGradient id="bgGrad" cx="50%" cy="50%" r="50%">
                                <stop offset="0%" stopColor="#f8fafc" />
                                <stop offset="100%" stopColor="#f1f5f9" />
                            </radialGradient>
                            <filter id="glow">
                                <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                                <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
                            </filter>
                            {CUSTOMERS.map(c => (
                                <radialGradient key={c.id} id={`g-${c.id}`} cx="40%" cy="35%" r="65%">
                                    <stop offset="0%" stopColor={TIER_COLOR[c.tier]} stopOpacity="0.9" />
                                    <stop offset="100%" stopColor={TIER_COLOR[c.tier]} stopOpacity="0.7" />
                                </radialGradient>
                            ))}
                        </defs>

                        <rect width={dims.w} height={dims.h} fill="url(#bgGrad)" />

                        {/* Grid dots */}
                        {Array.from({ length: 12 }).map((_, i) =>
                            Array.from({ length: 8 }).map((__, j) => (
                                <circle key={`${i}-${j}`} cx={i * (dims.w / 11)} cy={j * (dims.h / 7)} r={1} fill="#e2e8f0" />
                            ))
                        )}

                        {/* Edges */}
                        {edges.map((e, idx) => {
                            const s = nodeMap.get(e.source);
                            const t = nodeMap.get(e.target);
                            if (!s || !t) return null;
                            const style = getEdgeStyle(e);
                            const mx = (s.x + t.x) / 2 + (s.y - t.y) * 0.15;
                            const my = (s.y + t.y) / 2 - (s.x - t.x) * 0.15;
                            return (
                                <path
                                    key={idx}
                                    d={`M${s.x},${s.y} Q${mx},${my} ${t.x},${t.y}`}
                                    fill="none"
                                    stroke={style.stroke}
                                    strokeWidth={style.strokeWidth}
                                    strokeOpacity={style.opacity}
                                    strokeDasharray={style.dash}
                                />
                            );
                        })}

                        {/* Nodes */}
                        {nodes.map(node => {
                            const color = getNodeColor(node);
                            const isHovered = hovered?.id === node.id;
                            return (
                                <g
                                    key={node.id}
                                    transform={`translate(${node.x},${node.y})`}
                                    onMouseEnter={() => setHovered(node)}
                                    onMouseLeave={() => setHovered(null)}
                                    style={{ cursor: "pointer" }}
                                >
                                    {/* Pulse ring for critical */}
                                    {node.risk === "critical" && (
                                        <circle r={node.r + 6} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={0.25} />
                                    )}
                                    <circle
                                        r={node.r}
                                        fill={node.type === "customer" ? `url(#g-${node.id})` : color}
                                        fillOpacity={node.type !== "customer" ? 0.85 : 1}
                                        filter={isHovered ? "url(#glow)" : undefined}
                                        stroke="white"
                                        strokeWidth={2}
                                    />
                                    {node.type === "customer" && node.score !== undefined && (
                                        <text textAnchor="middle" dy="0.35em" fontSize={10} fontWeight="700" fill="white">
                                            {Math.round(node.score * 100)}
                                        </text>
                                    )}
                                    {node.type === "rm" && (
                                        <text textAnchor="middle" dy="0.35em" fontSize={9} fontWeight="700" fill="white">RM</text>
                                    )}
                                    {node.type === "signal" && (
                                        <text textAnchor="middle" dy="0.35em" fontSize={8} fontWeight="700" fill="white">SIG</text>
                                    )}
                                    <text
                                        textAnchor="middle"
                                        dy={node.r + 14}
                                        fontSize={10}
                                        fontWeight="600"
                                        fill="#475569"
                                    >
                                        {node.label}
                                    </text>
                                </g>
                            );
                        })}

                        {/* Hover tooltip */}
                        {hovered && hovered.type === "customer" && (
                            <g transform={`translate(${Math.min(hovered.x + hovered.r + 8, dims.w - 160)},${Math.max(hovered.y - 40, 8)})`}>
                                <rect width={150} height={70} rx={6} fill="white" stroke="#e2e8f0" strokeWidth={1} filter="url(#glow)" />
                                <text x={10} y={20} fontSize={11} fontWeight="700" fill="#0f172a">{hovered.label}</text>
                                <text x={10} y={36} fontSize={10} fill="#64748b">Score: {Math.round((hovered.score || 0) * 100)}%</text>
                                <text x={10} y={50} fontSize={10} fill={TIER_COLOR[hovered.risk || "low"]} fontWeight="600">
                                    {(hovered.risk || "").toUpperCase()}
                                </text>
                                <text x={10} y={64} fontSize={9} fill="#94a3b8">{hovered.id}</text>
                            </g>
                        )}
                    </svg>

                    {/* Legend */}
                    <div className="absolute bottom-3 left-4 flex flex-wrap gap-3">
                        {[
                            { color: "#ef4444", label: "Critical" },
                            { color: "#f97316", label: "High" },
                            { color: "#6366f1", label: "Watch" },
                            { color: "#8b5cf6", label: "Signal Node" },
                            { color: "#3b82f6", label: "RM" },
                        ].map(l => (
                            <div key={l.label} className="flex items-center gap-1">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ background: l.color }} />
                                <span className="text-[10px] text-slate-500">{l.label}</span>
                            </div>
                        ))}
                        <div className="flex items-center gap-1 ml-2">
                            <div className="w-6 h-px bg-red-400 opacity-60" />
                            <span className="text-[10px] text-slate-500">Peer contagion</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <div className="w-6 h-px border-t border-dashed border-purple-400" />
                            <span className="text-[10px] text-slate-500">Signal link</span>
                        </div>
                    </div>
                </div>

                {/* Stats bar */}
                <div className="border-t border-slate-100 grid grid-cols-3 divide-x divide-slate-100">
                    {[
                        { icon: AlertTriangle, label: "Propagation Paths", value: "12", color: "text-red-600" },
                        { icon: Zap,           label: "Risk Signals",     value: "8",  color: "text-violet-600" },
                        { icon: User,          label: "Nodes Mapped",    value: `${nodes.length}`, color: "text-blue-600" },
                    ].map(s => (
                        <div key={s.label} className="flex items-center gap-3 px-5 py-3">
                            <s.icon className={`w-4 h-4 ${s.color} shrink-0`} />
                            <div>
                                <div className="text-base font-bold text-slate-900">{s.value}</div>
                                <div className="text-[10px] text-slate-400 uppercase tracking-wide">{s.label}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
