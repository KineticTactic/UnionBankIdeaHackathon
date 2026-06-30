"use client";

import { useRouter } from "next/navigation";
import { Customer } from "@/types";
import { RiskBadge } from "@/components/customers/RiskBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";

interface CustomerTableProps {
    customers: Customer[];
    isLoading: boolean;
    v2ScoreMap?: Record<string, Record<string, unknown>>;
}

const URGENCY_STYLE: Record<string, { label: string; cls: string }> = {
    "7d":  { label: "7d Alert",  cls: "bg-crimson-soft text-crimson border-crimson" },
    "30d": { label: "30d Risk",  cls: "bg-copper-soft text-copper border-copper" },
    "90d": { label: "90d Watch", cls: "bg-[#F4D9C0] text-[#2A161B] border-[#F4D9C0]" },
};

function UrgencyBadge({ horizon }: { horizon: string | null | undefined }) {
    if (!horizon) return <span className="text-[10px] text-[#8B8481]">—</span>;
    const cfg = URGENCY_STYLE[horizon];
    if (!cfg) return null;
    return (
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${cfg.cls} uppercase tracking-wider`}>
            {cfg.label}
        </span>
    );
}

export function CustomerTable({ customers, isLoading, v2ScoreMap = {} }: CustomerTableProps) {
    const router = useRouter();

    const formatSignals = (signals: string[]) => {
        if (!signals || signals.length === 0) return null;
        const items = signals.slice(0, 2).map(s =>
            s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
        );
        const extra = signals.length > 2 ? `+${signals.length - 2} more` : '';

        return (
            <div className="flex flex-wrap gap-1">
                {items.map((item, idx) => (
                    <span key={idx} className="bg-[#F5F4F2] text-[#6B6562] text-[10px] px-1.5 py-0.5 rounded-sm whitespace-nowrap">
                        {item}
                    </span>
                ))}
                {extra && <span className="text-[10px] text-[#6B6562] ml-1 italic">{extra}</span>}
            </div>
        );
    };

    if (isLoading) {
        return (
            <div className="w-full h-64 flex items-center justify-center border border-soft rounded-md bg-white">
                <p className="text-sm text-[#6B6562]">Loading customers...</p>
            </div>
        );
    }

    if (customers.length === 0) {
        return (
            <div className="w-full h-64 flex flex-col items-center justify-center border border-soft rounded-md bg-white">
                <p className="text-sm text-[#6B6562] font-medium pb-1">No customers found</p>
                <p className="text-xs text-[#8B8481]">Try adjusting your filters.</p>
            </div>
        );
    }

    return (
        <div className="border border-soft rounded-md bg-white overflow-hidden">
            <Table>
                <TableHeader className="bg-[#F9F9F7]">
                    <TableRow>
                        <TableHead className="w-[120px] font-semibold text-[#2A161B]">Customer ID</TableHead>
                        <TableHead className="font-semibold text-[#2A161B]">Name</TableHead>
                        <TableHead className="font-semibold text-[#2A161B]">Segment / Location</TableHead>
                        <TableHead className="font-semibold text-[#2A161B]">Tenure</TableHead>
                        <TableHead className="w-[140px] font-semibold text-[#2A161B]">Churn Score</TableHead>
                        <TableHead className="w-[100px] font-semibold text-[#2A161B]">Risk Tier</TableHead>
                        <TableHead className="w-[200px] font-semibold text-[#2A161B]">Active Signals</TableHead>
                        <TableHead className="w-[90px] font-semibold text-[#2A161B]">Urgency</TableHead>
                        <TableHead className="text-right font-semibold text-[#2A161B]">Action</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {customers.map((c) => (
                        <TableRow
                            key={c.customer_id}
                            className="cursor-pointer hover:bg-[#F9F9F7] transition-colors"
                            onClick={() => router.push(`/customers/${c.customer_id}`)}
                        >
                            <TableCell className="font-mono text-xs text-[#6B6562]">{c.customer_id}</TableCell>
                            <TableCell className="font-medium text-sm text-[#2A161B]">{c.full_name}</TableCell>
                            <TableCell>
                                <div className="text-sm text-[#2A161B]">{c.segment}</div>
                                <div className="text-xs text-[#8B8481]">{c.city}</div>
                            </TableCell>
                            <TableCell className="text-sm text-[#6B6562]">{Math.floor((c.tenure_months || 0) / 12)} yrs</TableCell>
                            <TableCell>
                                <div className="w-full pr-4">
                                    <div className="flex justify-between items-end mb-1">
                                        <span className="text-sm font-semibold text-[#2A161B]">{Math.round(c.churn_score * 100)}%</span>
                                    </div>
                                    <div className="w-full bg-[#F5F4F2] rounded-full h-1.5">
                                        <div
                                            className="h-1.5 rounded-full"
                                            style={{
                                                width: `${c.churn_score * 100}%`,
                                                backgroundColor: c.risk_tier === 'ESCALATE' ? '#6B132B' :
                                                    c.risk_tier === 'PRIORITY' ? '#B46B3E' :
                                                        c.risk_tier === 'STANDARD' ? '#F4D9C0' :
                                                            c.risk_tier === 'MONITOR' ? '#8B8481' : '#6B6562'
                                            }}
                                        ></div>
                                    </div>
                                </div>
                            </TableCell>
                            <TableCell>
                                <RiskBadge tier={c.risk_tier} />
                            </TableCell>
                            <TableCell>
                                {formatSignals((c as any).active_signals || (c as any).signals || [])}
                            </TableCell>
                            <TableCell>
                                <UrgencyBadge horizon={v2ScoreMap[c.customer_id]?.urgency_horizon as string | null | undefined} />
                            </TableCell>
                            <TableCell className="text-right">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 md:px-2 lg:px-4 text-crimson hover:text-crimson hover:bg-crimson-soft"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        router.push(`/customers/${c.customer_id}`);
                                    }}
                                >
                                    View
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
