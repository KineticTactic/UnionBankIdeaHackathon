"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RiskBadge } from "@/components/customers/RiskBadge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, CircleDashed, Cpu, Play, Search, Network, BrainCircuit, ListChecks } from "lucide-react";
import { AnalysisResult } from "@/types";
import { api } from "@/lib/api";

interface AnalysisPanelProps {
    customerId: string;
    onAnalysisComplete: (result: AnalysisResult) => void;
}

export function AnalysisPanel({ customerId, onAnalysisComplete }: AnalysisPanelProps) {
    const [isRunning, setIsRunning] = useState(false);
    const [progress, setProgress] = useState(0);
    const [stage, setStage] = useState(0);
    const [result, setResult] = useState<AnalysisResult | null>(null);

    const STAGES = [
        { label: "Fetching signals", icon: Search, duration: 800 },
        { label: "Running CUSUM & BOCPD detection", icon: Network, duration: 1200 },
        { label: "Scoring with XGBoost + Transformer", icon: BrainCircuit, duration: 1500 },
        { label: "LangGraph orchestration", icon: Cpu, duration: 1000 },
        { label: "Generating action plan", icon: ListChecks, duration: 600 }
    ];

    const runAnalysis = async () => {
        setIsRunning(true);
        setProgress(0);
        setStage(0);
        setResult(null);

        // Start background API call
        const apiCall = api.runAnalysis(customerId);

        // Simulate progress visually
        let currentProgress = 0;
        for (let i = 0; i < STAGES.length; i++) {
            setStage(i);
            const stepDuration = STAGES[i].duration;
            const chunks = 10;
            const progressPerChunk = 100 / STAGES.length / chunks;

            for (let j = 0; j < chunks; j++) {
                await new Promise(r => setTimeout(r, stepDuration / chunks));
                currentProgress += progressPerChunk;
                setProgress(currentProgress);
            }
        }

        try {
            const res = await apiCall;
            setProgress(100);
            setResult(res);
            onAnalysisComplete(res);
        } catch (err) {
            console.error(err);
            // Handle error states visually if needed
        } finally {
            setTimeout(() => {
                setIsRunning(false);
            }, 400);
        }
    };

    if (!isRunning && !result) {
        return (
            <Card className="shadow-sm border-blue-100 bg-blue-50/30">
                <CardContent className="flex flex-col md:flex-row items-center justify-between p-6 gap-6">
                    <div>
                        <h3 className="text-lg font-semibold text-slate-900 mb-1">AI Risk Analysis</h3>
                        <p className="text-sm text-slate-500">Run a full multi-signal analysis pipeline for this customer to determine churn risk and identify root causes.</p>
                    </div>
                    <Button onClick={runAnalysis} className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm shrink-0 h-10 px-6">
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
                            <span className="text-sm font-semibold text-blue-600 flex items-center">
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
                                            <Icon className="w-4 h-4 mr-3 text-blue-500" />
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

    if (result) {
        return (
            <Card className="shadow-sm border-green-200 bg-white">
                <CardHeader className="border-b border-slate-100 bg-slate-50 pb-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                                <CheckCircle2 className="w-5 h-5 text-green-600" />
                            </div>
                            <div>
                                <CardTitle className="text-base font-semibold text-slate-900">Analysis Complete</CardTitle>
                                <div className="text-xs text-slate-400 mt-0.5">Model: {result.model_version} • {result.analysis_duration_ms}ms</div>
                            </div>
                        </div>
                        <Button variant="outline" size="sm" onClick={runAnalysis} className="h-8 text-xs font-medium">
                            Re-run Analysis
                        </Button>
                    </div>
                </CardHeader>

                <CardContent className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="md:col-span-1 border-r border-slate-100 pr-4 flex flex-col items-center justify-center text-center">
                            <span className="text-xs font-medium text-slate-500 uppercase tracking-widest mb-3">AI Churn Score</span>
                            <span className="text-5xl font-extrabold text-slate-900 tracking-tighter mb-4">{Math.round(result.churn_score * 100)}%</span>
                            <RiskBadge tier={result.risk_tier} className="px-4 py-1.5 text-xs shadow-sm" />
                        </div>

                        <div className="md:col-span-2 flex flex-col justify-center gap-6 pl-4">
                            <div>
                                <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center">
                                    <ListChecks className="w-4 h-4 mr-2" />
                                    Primary Risk Factors
                                </h4>
                                <ol className="list-decimal pl-5 space-y-2">
                                    {result.reason_codes.map((rc, i) => (
                                        <li key={i} className="text-sm leading-snug text-slate-700">{rc}</li>
                                    ))}
                                </ol>
                            </div>

                            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Recommended Action</h4>
                                <div className="flex items-center gap-2 mb-2">
                                    <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-none uppercase text-[10px] tracking-wider font-bold">
                                        {result.recommended_action?.channel?.replace('_', ' ') || 'N/A'}
                                    </Badge>
                                    <span className="text-sm font-semibold text-slate-900">{result.recommended_action?.offer_code}</span>
                                    <span className="text-xs text-slate-500 mx-1">•</span>
                                    <span className="text-xs text-slate-500">{result.recommended_action?.timing?.replace(/_/g, ' ') || 'N/A'}</span>
                                </div>
                                <p className="text-sm text-slate-600">{result.recommended_action?.rationale}</p>
                            </div>
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
    )
}
