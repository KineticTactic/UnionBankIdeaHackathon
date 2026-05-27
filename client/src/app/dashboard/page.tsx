'use client';

import { useState, useEffect } from "react";
import { usePortfolio } from "@/hooks/usePortfolio";
import { api } from "@/lib/api";
import { Users, AlertOctagon, AlertTriangle, TrendingUp, BrainCircuit, ShieldAlert } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { ChurnTrendChart } from "@/components/dashboard/ChurnTrendChart";
import { RiskDistributionChart } from "@/components/dashboard/RiskDistributionChart";
import { TopAtRiskTable } from "@/components/dashboard/TopAtRiskTable";
import { SignalBreakdownChart } from "@/components/dashboard/SignalBreakdownChart";
import { MarketSignalsCard } from "@/components/dashboard/MarketSignalsCard";
import { ChronosDashboardCard } from "@/components/dashboard/ChronosDashboardCard";
import { ChronosV2Card } from "@/components/dashboard/ChronosV2Card";
import { KnowledgeGraphCard } from "@/components/dashboard/KnowledgeGraphCard";
import { KafkaStreamCard } from "@/components/dashboard/KafkaStreamCard";
import { Skeleton } from "@/components/ui/skeleton";
import ProtectedRoute from "@/components/ProtectedRoute";
import { ChronosStats, ModelHealth, V2ModelHealth, PortfolioSurvival } from "@/types";

export default function DashboardPage() {
    const { stats, riskDistribution, churnTrend, signalBreakdown, topAtRisk, marketSignals, isLoading } = usePortfolio();
    const [chronosStats, setChronosStats] = useState<ChronosStats | null>(null);
    const [modelHealth, setModelHealth] = useState<ModelHealth | null>(null);
    const [chronosLoading, setChronosLoading] = useState(true);
    const [v2ModelHealth, setV2ModelHealth] = useState<V2ModelHealth | null>(null);
    const [portfolioSurvival, setPortfolioSurvival] = useState<PortfolioSurvival | null>(null);
    const [v2Loading, setV2Loading] = useState(true);

    useEffect(() => {
        async function loadChronos() {
            try {
                setChronosLoading(true);
                const [statsData, healthData] = await Promise.all([
                    api.getChronosStats(),
                    api.getChronosModelHealth(),
                ]);
                setChronosStats(statsData.data || statsData);
                setModelHealth(healthData);
            } catch {
                // CHRONOS might not be available
            } finally {
                setChronosLoading(false);
            }
        }

        async function loadV2() {
            try {
                setV2Loading(true);
                const [healthData, survivalData] = await Promise.all([
                    api.getV2ModelHealth().catch(() => null),
                    api.getV2PortfolioSurvival().catch(() => null),
                ]);
                setV2ModelHealth(healthData?.data ?? healthData);
                setPortfolioSurvival(survivalData?.data ?? survivalData);
            } catch {
                // v2 might not be available yet
            } finally {
                setV2Loading(false);
            }
        }

        loadChronos();
        loadV2();
    }, []);

    if (isLoading) {
        return (
            <ProtectedRoute>
                <div className="flex bg-slate-50 w-full h-full p-6 flex-col gap-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 max-w-7xl lg:grid-cols-4 gap-6">
                        <Skeleton className="h-[120px] w-full rounded-xl" />
                        <Skeleton className="h-[120px] w-full rounded-xl" />
                        <Skeleton className="h-[120px] w-full rounded-xl" />
                        <Skeleton className="h-[120px] w-full rounded-xl" />
                    </div>
                    <div className="grid grid-cols-1 max-w-7xl lg:grid-cols-[60%_40%] gap-6">
                        <Skeleton className="h-[300px] w-full rounded-xl" />
                        <Skeleton className="h-[300px] w-full rounded-xl" />
                    </div>
                </div>
            </ProtectedRoute>
        );
    }

    return (
        <ProtectedRoute>
            <div className="flex flex-col gap-6 max-w-7xl pb-8">
                {/* Section label */}
                <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Portfolio Snapshot</p>
                    <span className="text-[11px] text-slate-400">20 customers · Precision Risk Engine active</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard
                        title="Total Customers"
                        value={stats?.total_customers || 0}
                        subtitle="Across all segments"
                        icon={<Users className="w-4 h-4" />}
                        accent="blue"
                    />
                    <StatCard
                        title="Critical Risk"
                        value={stats?.critical_count || 0}
                        subtitle="Require immediate outreach"
                        icon={<AlertOctagon className="w-4 h-4" />}
                        accent="red"
                        valueClassName="text-red-600"
                    />
                    <StatCard
                        title="High Risk"
                        value={stats?.high_count || 0}
                        subtitle="Outreach within 24h"
                        icon={<AlertTriangle className="w-4 h-4" />}
                        accent="orange"
                        valueClassName="text-orange-600"
                    />
                    <StatCard
                        title="Avg Churn Score"
                        value={`${Math.round((stats?.avg_churn_score || 0) * 100)}%`}
                        subtitle="Portfolio average · Precision Risk Engine"
                        icon={<ShieldAlert className="w-4 h-4" />}
                        accent="default"
                    />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[58%_minmax(0,1fr)] gap-4">
                    <ChurnTrendChart data={churnTrend} />
                    <RiskDistributionChart data={riskDistribution} />
                </div>

                <KnowledgeGraphCard />
                <KafkaStreamCard />

                <div className="flex items-center gap-3 pt-2">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Risk Engine Performance</p>
                    <div className="flex-1 h-px bg-slate-200" />
                </div>

                <ChronosDashboardCard stats={chronosStats} modelHealth={modelHealth} isLoading={chronosLoading} />
                <ChronosV2Card modelHealth={v2ModelHealth} portfolioSurvival={portfolioSurvival} loading={v2Loading} />

                <div className="flex items-center gap-3 pt-2">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">At-Risk Customers</p>
                    <div className="flex-1 h-px bg-slate-200" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[55%_minmax(0,1fr)] gap-4">
                    <div className="flex flex-col gap-4">
                        <TopAtRiskTable data={topAtRisk} />
                        <MarketSignalsCard signals={marketSignals} />
                    </div>
                    <SignalBreakdownChart data={signalBreakdown} />
                </div>
            </div>
        </ProtectedRoute>
    );
}
