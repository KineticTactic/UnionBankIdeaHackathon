"use client";

import { usePortfolio } from "@/hooks/usePortfolio";
import { Users, AlertOctagon, AlertTriangle, TrendingUp } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { ChurnTrendChart } from "@/components/dashboard/ChurnTrendChart";
import { RiskDistributionChart } from "@/components/dashboard/RiskDistributionChart";
import { TopAtRiskTable } from "@/components/dashboard/TopAtRiskTable";
import { SignalBreakdownChart } from "@/components/dashboard/SignalBreakdownChart";
import { MarketSignalsCard } from "@/components/dashboard/MarketSignalsCard";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardPage() {
    const { stats, riskDistribution, churnTrend, signalBreakdown, topAtRisk, marketSignals, isLoading } = usePortfolio();

    if (isLoading) {
        return (
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
        );
    }

    return (
        <div className="flex flex-col gap-6 max-w-7xl">
            {/* Section A: Stat Cards */}
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

            {/* Section B: Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-[60%_minmax(0,1fr)] gap-6">
                <div className="w-full">
                    <ChurnTrendChart data={churnTrend} />
                </div>
                <div className="w-full">
                    <RiskDistributionChart data={riskDistribution} />
                </div>
            </div>

            {/* Section C: Tables & Signal Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-[55%_minmax(0,1fr)] gap-6 h-full pb-8">
                <div className="w-full flex flex-col gap-6">
                    <TopAtRiskTable data={topAtRisk} />
                    <MarketSignalsCard signals={marketSignals} />
                </div>
                <div className="w-full">
                    <SignalBreakdownChart data={signalBreakdown} />
                </div>
            </div>
        </div>
    );
}
