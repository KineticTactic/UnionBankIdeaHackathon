"use client";

import { useRouter } from "next/navigation";

interface TopAtRiskTableProps {
    data: any[];
}

const TIER_STYLE: Record<string, string> = {
    critical: "bg-crimson-soft text-crimson",
    high:     "bg-copper-soft text-copper-dark",
    medium:   "bg-copper-pale text-copper-dark",
    watch:    "bg-teal-soft text-teal-dark",
    low:      "bg-sage-soft text-sage-brand",
};

const TIER_BAR: Record<string, string> = {
    critical: "var(--crimson)",
    high:     "var(--copper)",
    medium:   "#EAB308",
    watch:    "var(--teal)",
    low:      "var(--sage-brand)",
};

export function TopAtRiskTable({ data = [] }: TopAtRiskTableProps) {
    const router = useRouter();

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-800">Top At-Risk Customers</p>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-crimson-soft text-crimson border border-red-100 uppercase tracking-wider">
                    {data.filter(d => d.risk_tier === 'critical').length} critical
                </span>
            </div>
            <div className="divide-y divide-slate-50">
                {data.length === 0 && (
                    <p className="text-center text-sm text-slate-400 py-10">No at-risk customers found.</p>
                )}
                {data.map((c) => (
                    <div
                        key={c.id}
                        onClick={() => router.push(`/customers/${c.id}`)}
                        className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50 cursor-pointer transition-colors group"
                    >
                        {/* Avatar initial */}
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0">
                            {c.full_name?.charAt(0) || "?"}
                        </div>

                        {/* Name + ID */}
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate group-hover:text-teal-dark transition-colors">{c.full_name}</p>
                            <p className="text-[10px] font-mono text-slate-400">{c.id} · {c.segment}</p>
                        </div>

                        {/* Score bar */}
                        <div className="flex items-center gap-2 shrink-0">
                            <div className="w-20">
                                <div className="flex justify-between items-center mb-0.5">
                                    <span className="text-xs font-bold text-slate-700">{Math.round(c.churn_score * 100)}%</span>
                                </div>
                                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full rounded-full"
                                        style={{ width: `${c.churn_score * 100}%`, backgroundColor: TIER_BAR[c.risk_tier] || 'var(--gray-400)' }}
                                    />
                                </div>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${TIER_STYLE[c.risk_tier] || 'bg-slate-100 text-slate-600'}`}>
                                {c.risk_tier}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
            {data.length > 0 && (
                <div className="px-5 py-3 border-t border-slate-100 text-center">
                    <button
                        onClick={() => router.push('/customers')}
                        className="text-xs font-semibold text-teal-dark hover:text-teal-dark transition-colors"
                    >
                        View all customers →
                    </button>
                </div>
            )}
        </div>
    );
}
