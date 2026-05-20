"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RiskBadge } from "@/components/customers/RiskBadge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, CircleDashed, Cpu, Play, Search, Network, BrainCircuit, ListChecks, AlertCircle, BarChart3, Sigma, Shield } from "lucide-react";
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

        const apiCall = api.getChronosScore(customerId);

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
                recommended_action: res.reason_codes_v2?.[0] ? {
                    channel: "email",
                    offer_code: res.reason_codes_v2[0].category.replace(/_/g, " ").toUpperCase(),
                    timing: "next_24_hours",
                    rationale: res.reason_codes_v2[0].description,
                } : null,
                reason_codes: (res.reason_codes_v2 || []).map((rc: { category: string; description: string }) =>
                    `${rc.category.replace(/_/g, " ")} — ${rc.description}`),
                analysis_duration_ms: 3600,
                model_version: `chronos-${res.model_version}`,
                scored_at: res.scored_at,
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
                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                            <BrainCircuit className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-slate-900 mb-1">CHRONOS Neural Risk Analysis</h3>
                            <p className="text-sm text-slate-500 max-w-md">
                                Run the full multi-signal pipeline — TARE, HABITAT, FusionX, and AEGIS — to score this customer&apos;s churn risk and surface interpretable reason codes.
                            </p>
                        </div>
                    </div>
                    <Button onClick={runAnalysis} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shrink-0 h-10 px-6">
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
                            <span className="text-sm font-semibold text-indigo-600 flex items-center">
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
                                            <CheckCircle2 className="w-4 h-4 mr-3 text-green-500" />
                                        ) : isCurrent ? (
                                            <Icon className="w-4 h-4 mr-3 text-indigo-500" />
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
            <Card className="shadow-sm border-amber-200 bg-white">
                <CardContent className="p-6">
                    <div className="flex flex-col items-center text-center max-w-md mx-auto gap-3">
                        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                            <AlertCircle className="w-5 h-5 text-amber-600" />
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
        return (
            <Card className="shadow-sm border-indigo-200 bg-white">
                <CardHeader className="border-b border-indigo-100 bg-gradient-to-r from-indigo-50/60 to-purple-50/60 pb-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                                <BrainCircuit className="w-5 h-5 text-indigo-600" />
                            </div>
                            <div>
                                <CardTitle className="text-base font-semibold text-slate-900">CHRONOS Analysis Complete</CardTitle>
                                <div className="text-xs text-slate-400 mt-0.5">
                                    <span className="font-mono">{result.model_version}</span>
                                    <span className="mx-1.5">•</span>
                                    {result.analysis_duration_ms}ms
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
                            <span className="text-5xl font-extrabold text-slate-900 tracking-tighter mb-4">{Math.round(result.churn_score * 100)}%</span>
                            <RiskBadge tier={result.risk_tier} className="px-4 py-1.5 text-xs shadow-sm" />
                            {result.scored_at && (
                                <span className="text-[10px] text-slate-400 mt-3 font-mono">
                                    {new Date(result.scored_at).toLocaleString()}
                                </span>
                            )}
                        </div>

                        <div className="md:col-span-2 flex flex-col justify-center gap-6 pl-4">
                            <div>
                                <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center">
                                    <ListChecks className="w-4 h-4 mr-2 text-indigo-500" />
                                    PRISM Risk Factors
                                </h4>
                                {result.reason_codes.length > 0 ? (
                                    <ol className="list-decimal pl-5 space-y-2">
                                        {result.reason_codes.map((rc, i) => (
                                            <li key={i} className="text-sm leading-snug text-slate-700">{rc}</li>
                                        ))}
                                    </ol>
                                ) : (
                                    <p className="text-sm text-slate-400 italic">No reason codes available</p>
                                )}
                            </div>

                            {result.recommended_action && (
                                <div className="bg-gradient-to-br from-indigo-50/80 to-purple-50/80 rounded-lg p-4 border border-indigo-100">
                                    <h4 className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-2">Recommended Action</h4>
                                    <div className="flex items-center gap-2 mb-2">
                                        <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200 border-none uppercase text-[10px] tracking-wider font-bold">
                                            {result.recommended_action.channel?.replace(/_/g, " ")}
                                        </Badge>
                                        <span className="text-sm font-semibold text-slate-900">{result.recommended_action.offer_code}</span>
                                        <span className="text-xs text-slate-400 mx-1">•</span>
                                        <span className="text-xs text-slate-500">{result.recommended_action.timing?.replace(/_/g, " ")}</span>
                                    </div>
                                    <p className="text-sm text-slate-600">{result.recommended_action.rationale}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
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
