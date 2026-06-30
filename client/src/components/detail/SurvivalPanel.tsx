"use client";

import { V2Score, UrgencyHorizon } from "@/types";
import { Activity, Network, AlertCircle, CheckCircle, Info } from "lucide-react";

interface SurvivalPanelProps {
    score: V2Score | null;
    loading?: boolean;
}

function urgencyColor(h: UrgencyHorizon) {
    if (h === "7d")  return { bar: "var(--crimson)", text: "text-crimson",  bg: "bg-crimson-soft",  border: "border-soft",  label: "7-Day Alert",   dot: "bg-crimson"  };
    if (h === "30d") return { bar: "var(--copper-dark)", text: "text-copper-dark", bg: "bg-copper-soft", border: "border-soft", label: "30-Day Risk",   dot: "bg-copper" };
    if (h === "90d") return { bar: "#CA8A04", text: "text-copper-dark", bg: "bg-copper-pale", border: "border-soft", label: "90-Day Watch",  dot: "bg-yellow-500" };
    return            { bar: "var(--sage-brand)", text: "text-sage-brand", bg: "bg-sage-soft", border: "border-soft", label: "Low Risk",      dot: "bg-sage-brand" };
}

function SurvivalBar({ label, value, color, horizon }: { label: string; value: number; color: string; horizon: UrgencyHorizon }) {
    const pct = Math.round(value * 100);
    const c = urgencyColor(horizon);
    return (
        <div className="space-y-1.5">
            <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</span>
                <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${c.text}`}>{pct}%</span>
                    {pct >= 40 && <span className={`w-1.5 h-1.5 rounded-full ${c.dot} animate-pulse`} />}
                </div>
            </div>
            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, backgroundColor: color }}
                />
            </div>
        </div>
    );
}

function ModelBar({ label, value, color }: { label: string; value: number; color: string }) {
    const pct = Math.round(value * 100);
    return (
        <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider w-16 shrink-0">{label}</span>
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
            </div>
            <span className="text-xs font-semibold text-slate-600 w-9 text-right">{pct}%</span>
        </div>
    );
}

export function SurvivalPanel({ score, loading }: SurvivalPanelProps) {
    if (loading) {
        return (
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 animate-pulse">
                <div className="h-4 bg-slate-200 rounded w-40" />
                <div className="space-y-3">
                    {[1,2,3].map(i => <div key={i} className="h-6 bg-slate-100 rounded" />)}
                </div>
            </div>
        );
    }

    if (!score) {
        return (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 flex items-center gap-3 text-slate-500">
                <Info className="w-4 h-4 shrink-0" />
                <span className="text-sm">Retention Intelligence scores not available for this customer.</span>
            </div>
        );
    }

    const h = score.urgency_horizon;
    const c = h ? urgencyColor(h) : { bar: '#8B8481', text: 'text-[#8B8481]', bg: 'bg-[#F5F4F2]', border: 'border-[#E5E0DF]', label: '—', dot: 'bg-[#8B8481]' };
    const disagreeHigh = Number(score.ensemble_disagreement || 0) >= 0.15;

    return (
        <div className={`rounded-xl border ${c.border} bg-white overflow-hidden`}>
            {/* Header */}
            <div className={`px-5 py-3 ${c.bg} border-b ${c.border} flex items-center justify-between`}>
                <div className="flex items-center gap-2.5">
                    <Activity className={`w-4 h-4 ${c.text}`} />
                    <span className="text-sm font-bold text-slate-800">Retention Intelligence · Departure Analytics</span>
                </div>
                <div className="flex items-center gap-2">
                    {h ? (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.bg} ${c.text} border ${c.border} uppercase tracking-wider`}>
                            {c.label}
                        </span>
                    ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sage-soft text-sage-brand border border-soft uppercase tracking-wider flex items-center gap-1">
                            <CheckCircle className="w-2.5 h-2.5" /> Stable
                        </span>
                    )}
                </div>
            </div>

            <div className="p-5 space-y-5">
                {/* Survival bars */}
                <div className="space-y-3">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Departure Probability · Time Horizon</p>
                    <SurvivalBar label="Next 7 days" value={Number(score.survival_7d)}
                        color={Number(score.survival_7d) >= 0.40 ? "var(--crimson)" : "var(--gray-400)"}
                        horizon={Number(score.survival_7d) >= 0.40 ? "7d" : null} />
                    <SurvivalBar label="Next 30 days" value={Number(score.survival_30d)}
                        color={Number(score.survival_30d) >= 0.45 ? "var(--copper-dark)" : "var(--gray-400)"}
                        horizon={Number(score.survival_30d) >= 0.45 ? "30d" : null} />
                    <SurvivalBar label="Next 90 days" value={Number(score.survival_90d)}
                        color={Number(score.survival_90d) >= 0.50 ? "#CA8A04" : "var(--gray-400)"}
                        horizon={Number(score.survival_90d) >= 0.50 ? "90d" : null} />
                </div>

                <div className="border-t border-slate-100 pt-4 space-y-3">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Precision Risk Engine · Attribution</p>
                    <ModelBar label="Txn Analytics" value={Number(score.tare_score)}    color="var(--teal)" />
                    <ModelBar label="Behavioural"   value={Number(score.habitat_score)} color="var(--teal)" />
                    <ModelBar label="Network Intel"  value={Number(score.graph_score)} color="#EC4899" />
                </div>

                {/* Graph score + CI row */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                        <div className="flex items-center gap-1.5 mb-1">
                            <Network className="w-3 h-3 text-crimson" />
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Network Risk Score</span>
                        </div>
                        <span className="text-xl font-bold text-slate-800">{Math.round(Number(score.graph_score) * 100)}%</span>
                        <p className="text-[10px] text-slate-400 mt-0.5">Peer network propagation</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                        <div className="flex items-center gap-1.5 mb-1">
                            {disagreeHigh
                                ? <AlertCircle className="w-3 h-3 text-copper" />
                                : <CheckCircle className="w-3 h-3 text-sage-brand" />}
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Model Agree</span>
                        </div>
                        <span className={`text-xl font-bold ${disagreeHigh ? "text-copper-dark" : "text-sage-brand"}`}>
                            {disagreeHigh ? "LOW" : "HIGH"}
                        </span>
                        <p className="text-[10px] text-slate-400 mt-0.5">Spread: ±{Math.round(Number(score.ensemble_disagreement) * 100)}%</p>
                    </div>
                </div>

                {/* Conformal CI */}
                <div className="bg-teal-soft rounded-lg p-3 border border-indigo-100">
                    <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1.5">Statistical Confidence Interval · 90%</p>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-teal-dark">{Math.round(Number(score.conformal_lower) * 100)}%</span>
                        <div className="flex-1 h-2 bg-teal-soft rounded-full relative overflow-hidden">
                            <div
                                className="absolute h-full bg-indigo-400 rounded-full opacity-40"
                                style={{ left: `${Number(score.conformal_lower) * 100}%`, right: `${(1 - Number(score.conformal_upper)) * 100}%` }}
                            />
                            <div
                                className="absolute h-full w-0.5 bg-teal-dark"
                                style={{ left: `${Number(score.final_score) * 100}%` }}
                            />
                        </div>
                        <span className="text-xs font-semibold text-teal-dark">{Math.round(Number(score.conformal_upper) * 100)}%</span>
                    </div>
                    <p className="text-[10px] text-indigo-400 mt-1">Point estimate: <strong className="text-teal-dark">{Math.round(Number(score.final_score) * 100)}%</strong></p>
                </div>
            </div>
        </div>
    );
}
