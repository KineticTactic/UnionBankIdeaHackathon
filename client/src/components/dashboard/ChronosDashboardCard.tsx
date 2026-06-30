"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BrainCircuit, CheckCircle2, AlertTriangle, XCircle, Activity, Sigma, Cpu, BarChart3, Layers, Shield } from "lucide-react";

interface ChronosStats {
    components: Array<{ name: string; status: string; latency_ms: number; last_run: string }>;
    total_runs: number;
    avg_latency_ms: number;
    health_score: number;
    last_scored_at?: string;
    total_customers_scored?: number;
    active_alerts?: number;
    drift_detected?: number;
    avg_churn_score?: number;
    model_versions?: string[];
    tier_distribution?: Record<string, number>;
    precision?: number;
    recall?: number;
    f1?: number;
    drift?: number;
}

interface ModelHealth {
    auc: number;
    precision: number;
    recall: number;
    f1: number;
    drift: number;
    aegis_drift_status?: string;
    components?: Array<{ name: string; status: string; latency_ms: number; last_updated?: string }>;
}

interface ChronosDashboardCardProps {
    stats: ChronosStats | null;
    modelHealth: ModelHealth | null;
    isLoading: boolean;
}

const COMPONENT_ICONS: Record<string, React.ReactNode> = {
    "tare-encoder": <Sigma className="w-3.5 h-3.5" />,
    "habitat-pass1": <BarChart3 className="w-3.5 h-3.5" />,
    "genesis-scorer": <Cpu className="w-3.5 h-3.5" />,
    "aegis-detector": <Shield className="w-3.5 h-3.5" />,
    "fusion-x": <Layers className="w-3.5 h-3.5" />,
};

const COMPONENT_LABELS: Record<string, string> = {
    "tare-encoder":   "Transaction Analytics",
    "habitat-pass1":  "Behavioural Patterns",
    "genesis-scorer": "Risk Scoring Engine",
    "aegis-detector": "Anomaly Detector",
    "fusion-x":       "Ensemble Fusion",
};

function StatusIcon({ status }: { status: string }) {
    switch (status) {
        case "healthy": return <CheckCircle2 className="w-3.5 h-3.5 text-sage-brand" />;
        case "degraded": return <AlertTriangle className="w-3.5 h-3.5 text-copper" />;
        case "error": return <XCircle className="w-3.5 h-3.5 text-crimson" />;
        default: return <Activity className="w-3.5 h-3.5 text-slate-400" />;
    }
}

function formatDate(dateStr: string | null) {
    if (!dateStr) return "Never";
    try { return new Date(dateStr).toLocaleString(); } catch { return dateStr; }
}

export function ChronosDashboardCard({ stats, modelHealth, isLoading }: ChronosDashboardCardProps) {
    if (isLoading) {
        return (
            <Card className="shadow-sm border-soft/60 bg-white overflow-hidden">
                <CardHeader className="border-b border-indigo-100/50 bg-gradient-to-r from-indigo-50/50 to-purple-50/50 pb-4">
                    <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
                        <BrainCircuit className="w-5 h-5 text-teal-dark" />
                        Precision Risk Engine · Scoring Suite
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-5 space-y-4">
                    <Skeleton className="h-16 w-full rounded-lg" />
                    <Skeleton className="h-20 w-full rounded-lg" />
                </CardContent>
            </Card>
        );
    }

    const tierColors: Record<string, string> = {
        critical: "bg-crimson-soft text-crimson border-soft",
        high: "bg-copper-soft text-copper-dark border-soft",
        medium: "bg-copper-pale text-copper-dark border-soft",
        low: "bg-sage-soft text-sage-brand border-soft",
    };

    return (
        <Card className="shadow-sm border-soft/60 bg-white overflow-hidden">
            <CardHeader className="border-b border-indigo-100/50 bg-gradient-to-r from-indigo-50/50 to-purple-50/50 pb-4">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
                        <BrainCircuit className="w-5 h-5 text-teal-dark" />
                        Precision Risk Engine · Scoring Suite
                    </CardTitle>
                    {stats?.last_scored_at && (
                        <span className="text-[10px] text-slate-400 font-mono">
                            Last run: {formatDate(stats.last_scored_at)}
                        </span>
                    )}
                </div>
            </CardHeader>
            <CardContent className="p-5 space-y-5">
                {/* Stats row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-teal-soft/60 rounded-lg p-3 border border-indigo-100/50">
                        <div className="text-[10px] font-semibold text-teal uppercase tracking-wider mb-1">Scored</div>
                        <div className="text-xl font-bold text-slate-900">{stats?.total_customers_scored ?? 0}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">customers</div>
                    </div>
                    <div className="bg-teal-soft/60 rounded-lg p-3 border border-indigo-100/50">
                        <div className="text-[10px] font-semibold text-teal uppercase tracking-wider mb-1">Avg Score</div>
                        <div className="text-xl font-bold text-slate-900">{stats && stats.avg_churn_score !== undefined ? `${Math.round(stats.avg_churn_score * 100)}%` : "—"}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">portfolio-wide</div>
                    </div>
                    <div className="bg-teal-soft/60 rounded-lg p-3 border border-indigo-100/50">
                        <div className="text-[10px] font-semibold text-teal uppercase tracking-wider mb-1">Model</div>
                        <div className="text-xl font-bold text-slate-900 truncate text-sm font-mono">
                            {stats?.model_versions?.[0]?.split("-")?.[0] ?? "—"}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                            {stats?.model_versions?.length ?? 0} version{(stats?.model_versions?.length ?? 0) !== 1 ? "s" : ""}
                        </div>
                    </div>
                    <div className="bg-teal-soft/60 rounded-lg p-3 border border-indigo-100/50">
                        <div className="text-[10px] font-semibold text-teal uppercase tracking-wider mb-1">Drift</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <div className={`w-2 h-2 rounded-full ${modelHealth?.aegis_drift_status === "normal" ? "bg-sage-brand" : "bg-copper"}`} />
                            <span className="text-sm font-semibold text-slate-900 capitalize">{modelHealth?.aegis_drift_status ?? "unknown"}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">AEGIS drift</div>
                    </div>
                </div>

                {/* Score distribution */}
                {stats?.tier_distribution && (() => {
                    const tierDist = stats.tier_distribution || {};
                    return (
                    <div>
                        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Score Distribution</div>
                        <div className="flex gap-1.5 h-6">
                            {["critical", "high", "medium", "low"].map((tier) => {
                                const count = tierDist[tier] || 0;
                                const total = Object.values(tierDist).reduce((a: number, b: any) => a + (b as number), 0);
                                const pct = total > 0 ? (count / total) * 100 : 0;
                                const colors: Record<string, string> = {
                                    critical: "bg-crimson", high: "bg-copper", medium: "bg-yellow-500", low: "bg-sage-brand",
                                };
                                return (
                                    <div key={tier} className="relative flex-1 flex flex-col items-center">
                                        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                                            <div className={`h-full rounded-full transition-all duration-500 ${colors[tier] || "bg-slate-400"}`}
                                                style={{ width: `${pct}%` }} />
                                        </div>
                                        <span className="text-[9px] font-medium text-slate-500 mt-1 capitalize">{tier} ({count})</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    );
                })()}

                {/* Model health grid */}
                {modelHealth?.components && (
                    <div>
                        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Pipeline Components</div>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                            {modelHealth.components.map((comp) => (
                                <div key={comp.name}
                                    className="bg-slate-50 rounded-lg p-2.5 border border-slate-100 flex flex-col items-center text-center gap-1">
                                    <div className="flex items-center gap-1 text-slate-600">
                                        {COMPONENT_ICONS[comp.name] || <Activity className="w-3.5 h-3.5" />}
                                        <StatusIcon status={comp.status} />
                                    </div>
                                    <span className="text-[10px] font-medium text-slate-700 leading-tight">
                                        {COMPONENT_LABELS[comp.name] || comp.name}
                                    </span>
                                    {comp.last_updated && (
                                        <span className="text-[8px] text-slate-400 font-mono">
                                            {new Date(comp.last_updated).toLocaleDateString()}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
