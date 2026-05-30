"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { ExternalLink, MapPin, Building2, Briefcase } from "lucide-react";

interface CustomerData {
    customer: {
        customer_id: string;
        full_name: string;
        age: number;
        city: string;
        segment: string;
        tenure_years: number;
        churn_score: number;
        risk_tier: string;
        active_signals: string[];
        life_events: string[];
        employment_type?: string;
        employer_name?: string;
    };
    accounts: { account_type: string; balance: number; status: string }[];
    engagement: { days_since_last_login: number; total_sessions_30d: number };
}

export function CustomerSnapshot({ customerId }: { customerId: string }) {
    const [data, setData] = useState<CustomerData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!customerId) return;
        setLoading(true);
        api.getCustomerById(customerId)
            .then((res) => setData(res.data))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [customerId]);

    if (loading) {
        return (
            <div className="space-y-3 p-4">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-24" />
            </div>
        );
    }

    if (!data) {
        return <p className="text-xs text-slate-400 p-4">Customer data unavailable</p>;
    }

    const c = data.customer;
    const tierColor: Record<string, string> = {
        critical: "bg-red-100 text-red-800",
        high: "bg-orange-100 text-orange-800",
        medium: "bg-blue-100 text-blue-800",
        watch: "bg-amber-100 text-amber-800",
        low: "bg-emerald-100 text-emerald-800",
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <Link href={`/customers/${c.customer_id}`} className="flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:underline">
                        {c.full_name}
                        <ExternalLink className="w-3 h-3" />
                    </Link>
                    <p className="text-[10px] text-slate-400 mt-0.5">{c.customer_id}</p>
                </div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${tierColor[c.risk_tier] || ""}`}>
                    {c.risk_tier}
                </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1.5 text-slate-600">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    {c.city}
                </div>
                <div className="flex items-center gap-1.5 text-slate-600">
                    <Building2 className="w-3 h-3 text-slate-400" />
                    {c.segment}
                </div>
                {c.employer_name && (
                    <div className="flex items-center gap-1.5 text-slate-600 col-span-2">
                        <Briefcase className="w-3 h-3 text-slate-400" />
                        {c.employer_name}
                    </div>
                )}
            </div>

            <div className="space-y-2">
                <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase">Churn Score</p>
                    <p className="text-lg font-bold text-slate-800">{(c.churn_score * 100).toFixed(0)}%</p>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5">
                    <div
                        className={`h-1.5 rounded-full ${
                            c.churn_score > 0.85 ? "bg-red-500" : c.churn_score > 0.65 ? "bg-orange-500" : c.churn_score > 0.4 ? "bg-blue-500" : "bg-emerald-500"
                        }`}
                        style={{ width: `${Math.min(100, c.churn_score * 100)}%` }}
                    />
                </div>
            </div>

            {c.active_signals.length > 0 && (
                <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase mb-1.5">Active Signals</p>
                    <div className="flex flex-wrap gap-1">
                        {c.active_signals.map((s) => (
                            <Badge key={s} variant="outline" className="text-[10px] font-medium">
                                {s.replace(/_/g, " ")}
                            </Badge>
                        ))}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-xs text-slate-600">
                <div>
                    <p className="text-[10px] font-semibold text-slate-400">Accounts</p>
                    <p>{data.accounts.filter((a) => a.status === "active").length} active</p>
                </div>
                <div>
                    <p className="text-[10px] font-semibold text-slate-400">Engagement</p>
                    <p>{data.engagement.days_since_last_login}d since last login</p>
                </div>
            </div>
        </div>
    );
}
