'use client';

import { useState, useEffect } from "react";
import { usePortfolio } from "@/hooks/usePortfolio";
import { api } from "@/lib/api";
import { Users, AlertOctagon, AlertTriangle, TrendingUp, BrainCircuit } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { ChurnTrendChart } from "@/components/dashboard/ChurnTrendChart";
import { RiskDistributionChart } from "@/components/dashboard/RiskDistributionChart";
import { TopAtRiskTable } from "@/components/dashboard/TopAtRiskTable";
import { SignalBreakdownChart } from "@/components/dashboard/SignalBreakdownChart";
import { MarketSignalsCard } from "@/components/dashboard/MarketSignalsCard";
import { ChronosDashboardCard } from "@/components/dashboard/ChronosDashboardCard";
import { Skeleton } from "@/components/ui/skeleton";
import ProtectedRoute from "@/components/ProtectedRoute";
import { ChronosStats, ModelHealth } from "@/types";

export default function DashboardPage() {
    const { stats, riskDistribution, churnTrend, signalBreakdown, topAtRisk, marketSignals, isLoading } = usePortfolio();
    const [chronosStats, setChronosStats] = useState<ChronosStats | null>(null);
    const [modelHealth, setModelHealth] = useState<ModelHealth | null>(null);
    const [chronosLoading, setChronosLoading] = useState(true);

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
        loadChronos();
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard
                        title="Total Customers"
                        value={stats?.total_customers || 0}
                        subtitle="Across all segments"
                        icon={<Users className="w-4 h-4" />}
                    />
                    <StatCard
                        title="Critical Risk"
                        value={stats?.critical_count || 0}
                        subtitle="Require immediate outreach"
                        icon={<AlertOctagon className="w-4 h-4 text-red-500" />}
                        valueClassName="text-red-600"
                    />
                    <StatCard
                        title="High Risk"
                        value={stats?.high_count || 0}
                        subtitle="Outreach within 24h"
                        icon={<AlertTriangle className="w-4 h-4 text-orange-500" />}
                        valueClassName="text-orange-600"
                    />
                    <StatCard
                        title="Avg Churn Score"
                        value={`${Math.round((stats?.avg_churn_score || 0) * 100)}%`}
                        subtitle="Portfolio average"
                        icon={<TrendingUp className="w-4 h-4" />}
                    />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[60%_minmax(0,1fr)] gap-6">
                    <div className="w-full">
                        <ChurnTrendChart data={churnTrend} />
                    </div>
                    <div className="w-full">
                        <RiskDistributionChart data={riskDistribution} />
                    </div>
                </div>

                <ChronosDashboardCard stats={chronosStats} modelHealth={modelHealth} isLoading={chronosLoading} />

                <div className="grid grid-cols-1 lg:grid-cols-[55%_minmax(0,1fr)] gap-6">
                    <div className="w-full flex flex-col gap-6">
                        <TopAtRiskTable data={topAtRisk} />
                        <MarketSignalsCard signals={marketSignals} />
                    </div>
                    <div className="w-full">
                        <SignalBreakdownChart data={signalBreakdown} />
                    </div>
                </div>
            </div>
        </ProtectedRoute>
    );
}
