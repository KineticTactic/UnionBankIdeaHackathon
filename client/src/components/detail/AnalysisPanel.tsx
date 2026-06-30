"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RiskBadge } from "@/components/customers/RiskBadge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, CircleDashed, Cpu, Play, Search, Network, BrainCircuit, ListChecks, AlertCircle, BarChart3, Sigma, Shield, ChevronDown, ChevronRight, Gauge, Layers, Table2 } from "lucide-react";
import { AnalysisResult } from "@/types";
import { api } from "@/lib/api";

interface AnalysisPanelProps {
    customerId: string;
    onAnalysisComplete: (result: AnalysisResult | null) => void;
}

export function AnalysisPanel({ customerId, onAnalysisComplete }: AnalysisPanelProps) {
    const [isRunning, setIsRunning] = useState(false);
    const [progress, setProgress] = useState(0);
    const [stage, setStage] = useState(0);
    const [result, setResult] = useState<AnalysisResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showPipeline, setShowPipeline] = useState(false);

    const STAGES = [
        { label: "Querying CHRONOS pipeline", icon: Search, duration: 600 },
        { label: "Loading TARE encoder features", icon: Sigma, duration: 800 },
        { label: "Scoring with HABITAT Pass 1", icon: BarChart3, duration: 1000 },
        { label: "FusionX & AEGIS reconciliation", icon: Shield, duration: 700 },
        { label: "Generating PRISM action plan", icon: ListChecks, duration: 500 },
    ];

    const runAnalysis = async () => {
        setIsRunning(true);
        setProgress(0);
        setStage(0);
        setResult(null);
        setError(null);

        const apiCall = api.analyzeCustomer(customerId);

        let currentProgress = 0;
        for (let i = 0; i < STAGES.length; i++) {
            setStage(i);
            const stepDuration = STAGES[i].duration;
            const chunks = 8;
            const progressPerChunk = 100 / STAGES.length / chunks;
            for (let j = 0; j < chunks; j++) {
                await new Promise(r => setTimeout(r, stepDuration / chunks));
                currentProgress += progressPerChunk;
                setProgress(currentProgress);
            }
        }

        try {
            const res = await apiCall;
            const analysisRes: AnalysisResult = {
                customer_id: res.customer_id,
                churn_score: res.final_score,
                risk_tier: res.risk_tier,
                active_signals: [],
                life_events: [],
                recommended_action: res.reason_codes_v2?.[0] ? `${res.reason_codes_v2[0].category.replace(/_/g, " ").toUpperCase()} — ${res.reason_codes_v2[0].description}` : "No action recommended",
                reason_codes: (res.reason_codes_v2 || []).map((rc: { category: string; description: string }) =>
                    `${rc.category.replace(/_/g, " ")} — ${rc.description}`),
                analysis_duration_ms: 3600,
                model_version: `chronos-${res.model_version}`,
                scored_at: res.scored_at,
                tare_score: res.tare_score ?? null,
                habitat_score: res.habitat_score ?? null,
                token_count: res.token_count ?? 0,
                tabular_features: res.tabular_features ?? {},
                attention_weights: (res.attention_weights || []).map((a: { position: number; token: string; weight: number }) => ({ position: a.position, token: a.token, weight: a.weight })),
                shap_values: (res.shap_values || []).map((s: { feature: string; shap_value: number; direction: string }) => ({ feature: s.feature, shap_value: s.shap_value, direction: s.direction })),
                fusion_tare_weight: res.fusion_tare_weight ?? 0,
                fusion_habitat_weight: res.fusion_habitat_weight ?? 0,
                fusion_ci_lower: res.fusion_ci_lower ?? 0,
                fusion_ci_upper: res.fusion_ci_upper ?? 0,
                tare_duration_ms: res.tare_duration_ms ?? 0,
                habitat_duration_ms: res.habitat_duration_ms ?? 0,
                fusion_duration_ms: res.fusion_duration_ms ?? 0,
                prism_duration_ms: res.prism_duration_ms ?? 0,
            };
            setProgress(100);
            setResult(analysisRes);
            onAnalysisComplete(analysisRes);
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Failed to get CHRONOS score";
            setError(msg);
            setResult(null);
            onAnalysisComplete(null);
        } finally {
            setTimeout(() => setIsRunning(false), 400);
        }
    };

    if (!isRunning && !result && !error) {
        return (
            <Card className="shadow-sm border-indigo-100 bg-gradient-to-br from-indigo-50/40 to-purple-50/40">
                <CardContent className="flex flex-col md:flex-row items-center justify-between p-6 gap-6">
                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-teal-soft flex items-center justify-center shrink-0">
                            <BrainCircuit className="w-5 h-5 text-teal-dark" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-slate-900 mb-1">CHRONOS Neural Risk Analysis</h3>
                            <p className="text-sm text-slate-500 max-w-md">
                                Run the full multi-signal pipeline — TARE, HABITAT, FusionX, and AEGIS — to score this customer&apos;s churn risk and surface interpretable reason codes.
                            </p>
                        </div>
                    </div>
                    <Button onClick={runAnalysis} className="bg-teal-dark hover:bg-teal-dark text-white shadow-sm shrink-0 h-10 px-6">
                        <Play className="w-4 h-4 mr-2" />
                        Run Analysis
                    </Button>
                </CardContent>
            </Card>
        );
    }

    if (isRunning || (progress > 0 && progress < 100)) {
        return (
            <Card className="shadow-sm border-slate-200">
                <CardContent className="p-8">
                    <div className="flex flex-col items-center max-w-xl mx-auto py-4">
                        <div className="w-full flex justify-between items-end mb-4">
                            <span className="text-sm font-semibold text-teal-dark flex items-center">
                                <SpinnerIcon className="w-4 h-4 mr-2 animate-spin" />
                                {STAGES[stage]?.label || "Finalizing..."}
                            </span>
                            <span className="text-sm font-medium text-slate-400">{Math.round(progress)}%</span>
                        </div>

                        <Progress value={progress} className="h-2 w-full bg-slate-100" />

                        <div className="w-full mt-8 space-y-3">
                            {STAGES.map((s, idx) => {
                                const Icon = s.icon;
                                const isPast = idx < stage;
                                const isCurrent = idx === stage;

                                return (
                                    <div key={idx} className={`flex items-center text-sm transition-all duration-300 ${isPast ? 'text-slate-400' : isCurrent ? 'text-slate-900 font-medium scale-[1.02] transform origin-left' : 'text-slate-300'}`}>
                                        {isPast ? (
                                            <CheckCircle2 className="w-4 h-4 mr-3 text-sage-brand" />
                                        ) : isCurrent ? (
                                            <Icon className="w-4 h-4 mr-3 text-teal" />
                                        ) : (
                                            <CircleDashed className="w-4 h-4 mr-3" />
                                        )}
                                        {s.label}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card className="shadow-sm border-soft bg-white">
                <CardContent className="p-6">
                    <div className="flex flex-col items-center text-center max-w-md mx-auto gap-3">
                        <div className="w-10 h-10 rounded-full bg-copper-soft flex items-center justify-center">
                            <AlertCircle className="w-5 h-5 text-copper-dark" />
                        </div>
                        <div>
                            <h3 className="text-base font-semibold text-slate-900 mb-1">Analysis Unavailable</h3>
                            <p className="text-sm text-slate-500">{error}</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={runAnalysis} className="mt-2">
                            Retry
                        </Button>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (result) {
        const totalMs = Number(result.tare_duration_ms || 0) + Number(result.habitat_duration_ms || 0) + Number(result.fusion_duration_ms || 0) + Number(Number(result.prism_duration_ms) || 0);
        return (
            <>
                <Card className="shadow-sm border-soft bg-white">
                    <CardHeader className="border-b border-indigo-100 bg-gradient-to-r from-indigo-50/60 to-purple-50/60 pb-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-teal-soft flex items-center justify-center">
                                    <BrainCircuit className="w-5 h-5 text-teal-dark" />
                                </div>
                                <div>
                                    <CardTitle className="text-base font-semibold text-slate-900">CHRONOS Analysis Complete</CardTitle>
                                    <div className="text-xs text-slate-400 mt-0.5">
                                        <span className="font-mono">{String(result.model_version)}</span>
                                        <span className="mx-1.5">•</span>
                                        {Math.round(totalMs)}ms
                                        <span className="mx-1.5">•</span>
                                        {Number(result.token_count)} tokens
                                    </div>
                                </div>
                            </div>
                            <Button variant="outline" size="sm" onClick={runAnalysis} className="h-8 text-xs font-medium">
                                Re-run Analysis
                            </Button>
                        </div>
                    </CardHeader>

                    <CardContent className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            <div className="md:col-span-1 border-r border-indigo-100 pr-4 flex flex-col items-center justify-center text-center">
                                <span className="text-xs font-medium text-slate-500 uppercase tracking-widest mb-3">CHRONOS Churn Score</span>
                                <span className="text-5xl font-extrabold text-slate-900 tracking-tighter mb-4">{Math.round(Number(result.churn_score) * 100)}%</span>
                                <RiskBadge tier={result.risk_tier as any} className="px-4 py-1.5 text-xs" />
                                <div className="flex gap-4 mt-3 text-xs text-slate-500">
                                    <span>TARE: {Number(result.tare_score) != null ? (Number(result.tare_score) * 100).toFixed(1) + '%' : '—'}</span>
                                    <span>HABITAT: {Number(result.habitat_score) != null ? (Number(result.habitat_score) * 100).toFixed(1) + '%' : '—'}</span>
                                </div>
                                {String(result.scored_at) && (
                                    <span className="text-[10px] text-slate-400 mt-3 font-mono">
                                        {new Date(String(result.scored_at)).toLocaleString()}
                                    </span>
                                )}
                            </div>

                            <div className="md:col-span-2 flex flex-col justify-center gap-6 pl-4">
                                <div>
                                    <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center">
                                        <ListChecks className="w-4 h-4 mr-2 text-teal" />
                                        PRISM Risk Factors
                                    </h4>
                                    {(result.reason_codes as string[]).length > 0 ? (
                                        <ol className="list-decimal pl-5 space-y-2">
                                            {(result.reason_codes as string[]).map((rc, i) => (
                                                <li key={i} className="text-sm leading-snug text-slate-700">{rc}</li>
                                            ))}
                                        </ol>
                                    ) : (
                                        <p className="text-sm text-slate-400 italic">No reason codes available</p>
                                    )}
                                </div>

                                {result.recommended_action && (
                                    <div className="bg-gradient-to-br from-indigo-50/80 to-purple-50/80 rounded-lg p-4 border border-indigo-100">
                                        <h4 className="text-xs font-semibold text-teal-dark uppercase tracking-wider mb-2">Recommended Action</h4>
                                        <p className="text-sm text-slate-700">{String(result.recommended_action)}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Pipeline Details */}
                <Card className="shadow-sm border-slate-200 bg-white mt-4">
                    <button
                        onClick={() => setShowPipeline(!showPipeline)}
                        className="w-full flex items-center justify-between px-6 py-4 text-sm font-semibold text-slate-800 hover:bg-slate-50 transition-colors"
                    >
                        <span className="flex items-center gap-2">
                            <Layers className="w-4 h-4 text-teal" />
                            Pipeline Details
                        </span>
                        {showPipeline ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>

                    {showPipeline && (
                        <CardContent className="px-6 pb-6 pt-2 space-y-6 border-t border-slate-100">

                            {/* Timing */}
                            <div>
                                <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <Gauge className="w-3.5 h-3.5" /> Stage Timing
                                </h5>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {[
                                        { label: 'TARE', ms: result.tare_duration_ms, color: 'bg-teal' },
                                        { label: 'HABITAT', ms: result.habitat_duration_ms, color: 'bg-sage-brand' },
                                        { label: 'FusionX', ms: result.fusion_duration_ms, color: 'bg-copper' },
                                        { label: 'PRISM', ms: Number(result.prism_duration_ms), color: 'bg-teal' },
                                    ].map(s => (
                                        <div key={s.label} className="bg-slate-50 rounded p-3">
                                            <div className="text-xs text-slate-400">{s.label}</div>
                                            <div className="text-sm font-semibold text-slate-800">{Number(s.ms).toFixed(1)}ms</div>
                                            <div className="mt-1.5 h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                                                <div className={`h-full rounded-full ${String(s.color)}`} style={{ width: `${(Number(s.ms) / Math.max(totalMs, 1)) * 100}%` }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Tabular Features */}
                            <div>
                                <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <Table2 className="w-3.5 h-3.5" /> Tabular Features
                                </h5>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                                    {Object.entries(result.tabular_features as Record<string, unknown>).slice(0, 14).map(([key, val]) => (
                                        <div key={key} className="bg-slate-50 rounded px-3 py-2 text-xs">
                                            <span className="text-slate-400 block truncate">{key.replace(/_/g, ' ')}</span>
                                            <span className="font-mono font-semibold text-slate-800">{typeof val === 'number' ? val.toFixed(4) : String(val)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* TARE Attention */}
                            {(result.attention_weights as any[]).length > 0 && (
                                <div>
                                    <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                        <Sigma className="w-3.5 h-3.5" /> TARE Top Attention Tokens
                                    </h5>
                                    <div className="space-y-1.5">
                                        {(result.attention_weights as any[]).map((a, i) => (
                                            <div key={i} className="flex items-center gap-3">
                                                <span className="text-xs font-mono text-slate-400 w-6 text-right">{a.position}</span>
                                                <Badge className="bg-teal-soft text-teal-dark hover:border-soft border-none text-[10px] font-mono w-28 justify-center shrink-0">
                                                    {a.token}
                                                </Badge>
                                                <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-indigo-400 rounded-full"
                                                        style={{ width: `${a.weight * 100}%` }}
                                                    />
                                                </div>
                                                <span className="text-xs font-mono text-slate-500 w-12 text-right">{(a.weight * 100).toFixed(1)}%</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* HABITAT SHAP Values */}
                            {(result.shap_values as any[]).length > 0 && (
                                <div>
                                    <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                        <BarChart3 className="w-3.5 h-3.5" /> HABITAT SHAP Contributions
                                    </h5>
                                    <div className="space-y-1.5">
                                        {(result.shap_values as any[]).slice(0, 8).map((sv, i) => {
                                            const isPositive = sv.shap_value > 0;
                                            const barWidth = Math.min(Math.abs(sv.shap_value) * 500, 100);
                                            return (
                                                <div key={i} className="flex items-center gap-3 text-xs">
                                                    <span className="text-slate-600 w-36 truncate text-right">{sv.feature.replace(/_/g, ' ')}</span>
                                                    <div className="flex-1 flex items-center gap-1">
                                                        <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden relative">
                                                            <div
                                                                className={`h-full rounded-full ${isPositive ? 'bg-red-400 ml-auto' : 'bg-emerald-400'}`}
                                                                style={{ width: `${barWidth}%`, marginLeft: isPositive ? `${100 - barWidth}%` : undefined }}
                                                            />
                                                        </div>
                                                    </div>
                                                    <span className={`font-mono w-20 text-right ${isPositive ? 'text-crimson' : 'text-sage-brand'}`}>
                                                        {isPositive ? '+' : ''}{sv.shap_value.toFixed(5)}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Fusion */}
                            <div>
                                <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <Cpu className="w-3.5 h-3.5" /> FusionX Blending
                                </h5>
                                <div className="bg-slate-50 rounded-lg p-4">
                                    <div className="flex gap-6 text-sm mb-3">
                                        <div>
                                            <span className="text-slate-400 text-xs">TARE weight</span>
                                            <div className="font-semibold text-teal-dark">{(Number(result.fusion_tare_weight) * 100).toFixed(0)}%</div>
                                        </div>
                                        <div>
                                            <span className="text-slate-400 text-xs">HABITAT weight</span>
                                            <div className="font-semibold text-sage-brand">{(Number(result.fusion_habitat_weight) * 100).toFixed(0)}%</div>
                                        </div>
                                        <div>
                                            <span className="text-slate-400 text-xs">95% CI</span>
                                            <div className="font-mono text-slate-700 text-xs">[{(Number(result.fusion_ci_lower) * 100).toFixed(1)}%, {(Number(result.fusion_ci_upper) * 100).toFixed(1)}%]</div>
                                        </div>
                                    </div>
                                    <div className="h-3 bg-slate-200 rounded-full overflow-hidden flex">
                                        <div className="bg-indigo-400 h-full" style={{ width: `${Number(result.fusion_tare_weight) * 100}%` }} />
                                        <div className="bg-emerald-400 h-full" style={{ width: `${Number(result.fusion_habitat_weight) * 100}%` }} />
                                    </div>
                                </div>
                            </div>

                        </CardContent>
                    )}
                </Card>
            </>
        );
    }

    return null;
}

function SpinnerIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
    );
}
