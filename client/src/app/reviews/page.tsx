"use client";

import { useState } from "react";
import { Shield, Clock, CheckCircle, XCircle, TrendingUp } from "lucide-react";
import { ReviewQueueTable } from "@/components/reviews/ReviewQueueTable";
import { useReviews, useReviewStats } from "@/hooks/useReviews";

export default function ReviewsPage() {
    const [statusFilter, setStatusFilter] = useState("");
    const [typeFilter, setTypeFilter] = useState("");
    const [priorityFilter, setPriorityFilter] = useState("");

    const { cases, total, loading } = useReviews({
        status: statusFilter || undefined,
        type: typeFilter || undefined,
        priority: priorityFilter || undefined,
    });

    const { stats } = useReviewStats();

    const statCards = [
        { label: "Pending", value: stats?.pending ?? 0, icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
        { label: "In Review", value: stats?.in_review ?? 0, icon: Shield, color: "text-blue-600", bg: "bg-blue-50" },
        { label: "Approved", value: stats?.approved ?? 0, icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50" },
        { label: "Rejected", value: stats?.rejected ?? 0, icon: XCircle, color: "text-red-600", bg: "bg-red-50" },
        { label: "Avg Resolution", value: `${stats?.avg_resolution_hours ?? 0}h`, icon: TrendingUp, color: "text-violet-600", bg: "bg-violet-50" },
    ];

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-slate-900">Review Queue</h1>
                    <p className="text-sm text-slate-500 mt-1">Pending officer review cases ({total} total)</p>
                </div>
            </div>

            <div className="grid grid-cols-5 gap-4">
                {statCards.map((card) => {
                    const Icon = card.icon;
                    return (
                        <div key={card.label} className="border border-slate-200 rounded-lg p-4 bg-white">
                            <div className="flex items-center gap-3">
                                <div className={`w-9 h-9 rounded-lg ${card.bg} flex items-center justify-center`}>
                                    <Icon className={`w-4 h-4 ${card.color}`} />
                                </div>
                                <div>
                                    <p className="text-lg font-bold text-slate-800">{card.value}</p>
                                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">{card.label}</p>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-5">
                <ReviewQueueTable
                    cases={cases}
                    loading={loading}
                    activeStatus={statusFilter}
                    activeType={typeFilter}
                    activePriority={priorityFilter}
                    onStatusFilter={setStatusFilter}
                    onTypeFilter={setTypeFilter}
                    onPriorityFilter={setPriorityFilter}
                />
            </div>
        </div>
    );
}
