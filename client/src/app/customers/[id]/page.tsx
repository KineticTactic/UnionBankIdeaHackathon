'use client';

import { useState, use } from "react";
import { useCustomerDetail } from "@/hooks/useCustomerDetail";
import { CustomerHeader } from "@/components/detail/CustomerHeader";
import { RiskScoreCard } from "@/components/detail/RiskScoreCard";
import { SignalPanel } from "@/components/detail/SignalPanel";
import { TransactionChart } from "@/components/detail/TransactionChart";
import { CrmNotesPanel } from "@/components/detail/CrmNotesPanel";
import { AnalysisPanel } from "@/components/detail/AnalysisPanel";
import { OutreachPanel } from "@/components/detail/OutreachPanel";
import { InsightCard } from "@/components/detail/InsightCard";
import { Skeleton } from "@/components/ui/skeleton";
import { BrainCircuit } from "lucide-react";
import { AnalysisResult } from "@/types";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const unwrappedParams = use(params);
    const id = unwrappedParams.id;

    const { snapshot, signals, transactions, insights, isLoading, error } = useCustomerDetail(id);
    const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);

    if (isLoading) {
        return (
            <ProtectedRoute>
                <div className="flex flex-col gap-6 max-w-7xl animate-pulse">
                    <div className="h-24 bg-slate-200 rounded-lg w-full mb-4"></div>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 h-96 bg-slate-200 rounded-lg w-full"></div>
                        <div className="h-96 bg-slate-200 rounded-lg w-full"></div>
                    </div>
                </div>
            </ProtectedRoute>
        );
    }

    if (error || !snapshot) {
        return (
            <ProtectedRoute>
                <div className="flex flex-col items-center justify-center h-[60vh] text-center max-w-lg mx-auto">
                    <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4 text-2xl">!</div>
                    <h2 className="text-xl font-bold text-slate-900 mb-2">Customer Not Found</h2>
                    <p className="text-slate-500 mb-6">We couldn&apos;t load the data for customer ID {id}. They may not exist or the service is temporarily unavailable.</p>
                    <button onClick={() => window.history.back()} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-md transition-colors">
                        Go Back
                    </button>
                </div>
            </ProtectedRoute>
        );
    }

    const initialAnalysisResult = analysisResult || (snapshot.customer.reason_codes && snapshot.customer.reason_codes.length > 0 ? {
        customer_id: snapshot.customer.customer_id,
        churn_score: snapshot.customer.churn_score,
        risk_tier: snapshot.customer.risk_tier,
        active_signals: snapshot.customer.active_signals,
        life_events: snapshot.customer.life_events || [],
        recommended_action: snapshot.customer.preferred_channel ? {
            channel: snapshot.customer.preferred_channel,
            offer_code: snapshot.customer.reason_codes[0] || 'High churn risk detected',
            timing: 'next_24_hours',
            rationale: snapshot.customer.reason_codes[0] || 'High churn risk detected'
        } : null,
        reason_codes: snapshot.customer.reason_codes,
        analysis_duration_ms: 0,
        model_version: "pre-computed",
        scored_at: new Date().toISOString()
    } as AnalysisResult : null);

    return (
        <ProtectedRoute>
            <div className="flex flex-col gap-8 max-w-7xl bg-slate-50 min-h-full pb-12">
                <CustomerHeader customer={snapshot.customer} />

                <div className="grid grid-cols-1 xl:grid-cols-[65%_minmax(0,1fr)] gap-8">
                    <div className="flex flex-col gap-8">
                        <section>
                            <h2 className="text-lg font-bold text-slate-900 tracking-tight mb-4 flex items-center gap-2">
                                <BrainCircuit className="w-5 h-5 text-blue-600" />
                                AI Insight & Strategy
                            </h2>
                            <AnalysisPanel
                                customerId={snapshot.customer.customer_id}
                                onAnalysisComplete={setAnalysisResult}
                            />

                            {initialAnalysisResult && (
                                <div className="mt-4">
                                    <OutreachPanel
                                        customerId={snapshot.customer.customer_id}
                                        analysisResult={initialAnalysisResult}
                                    />
                                </div>
                            )}
                        </section>

                        <section>
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-bold text-slate-900 tracking-tight">Active Predictive Signals</h2>
                                <span className="text-xs font-semibold px-2 py-1 rounded bg-slate-200 text-slate-600 uppercase tracking-wider">
                                    {signals.length} Detected
                                </span>
                            </div>
                            <SignalPanel signals={signals} />
                        </section>

                        <section>
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-bold text-slate-900 tracking-tight">Financial Timeline</h2>
                                <span className="text-xs font-semibold px-2 py-1 rounded bg-slate-200 text-slate-600 uppercase tracking-wider">
                                    Last 60 Days
                                </span>
                            </div>
                            <TransactionChart transactions={transactions} />
                        </section>

                        <section className="mt-4 pt-8 border-t border-slate-200">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-lg font-bold text-slate-900 tracking-tight">Behavioral & Holistic Insights</h2>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700 uppercase tracking-tighter">
                                    Multi-Store Linked
                                </span>
                            </div>
                            <InsightCard insights={insights} />
                        </section>
                    </div>

                    <div className="flex flex-col gap-8 h-full">
                        <section className="sticky top-20">
                            <h2 className="text-lg font-bold text-slate-900 tracking-tight mb-4">Risk Summary</h2>
                            <RiskScoreCard
                                score={analysisResult?.churn_score ?? snapshot.customer.churn_score}
                                tier={analysisResult?.risk_tier ?? snapshot.customer.risk_tier}
                                recommendedAction={analysisResult?.recommended_action?.offer_code ?? snapshot.customer.reason_codes?.[0]}
                                reasonCodes={analysisResult?.reason_codes ?? snapshot.customer.reason_codes ?? []}
                            />

                            <div className="mt-8">
                                <CrmNotesPanel notes={snapshot.crm_summary ? {
                                    total_complaints: snapshot.crm_summary.total_complaints || 0,
                                    unresolved_count: snapshot.crm_summary.unresolved_count || 0
                                } : null} />
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </ProtectedRoute>
    );
}
