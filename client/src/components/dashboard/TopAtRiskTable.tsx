"use client";

import { useRouter } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface TopAtRiskTableProps {
    data: any[];
}

export function TopAtRiskTable({ data = [] }: TopAtRiskTableProps) {
    const router = useRouter();

    const getTierColor = (tier: string) => {
        switch (tier) {
            case 'critical': return 'bg-red-500 hover:bg-red-600';
            case 'high': return 'bg-orange-500 hover:bg-orange-600';
            case 'medium': return 'bg-yellow-500 hover:bg-yellow-600';
            case 'watch': return 'bg-blue-500 hover:bg-blue-600';
            case 'low': return 'bg-green-500 hover:bg-green-600';
            default: return 'bg-slate-500';
        }
    };

    const formatSignal = (signal: string) => {
        return signal ? signal.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'None';
    };

    return (
        <Card className="shadow-sm border-gray-200 h-full">
            <CardHeader>
                <CardTitle className="text-base font-semibold text-slate-900">Top At-Risk Customers</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-b border-gray-100 pb-2">
                                <TableHead className="text-xs font-medium text-slate-500">Name</TableHead>
                                <TableHead className="text-xs font-medium text-slate-500">Segment</TableHead>
                                <TableHead className="text-xs font-medium text-slate-500">Score</TableHead>
                                <TableHead className="text-xs font-medium text-slate-500">Top Signal</TableHead>
                                <TableHead className="text-xs font-medium text-slate-500 text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.map((customer) => (
                                <TableRow
                                    key={customer.id}
                                    className="cursor-pointer hover:bg-slate-50 border-b border-gray-50 transition-colors"
                                    onClick={() => router.push(`/customers/${customer.id}`)}
                                >
                                    <TableCell>
                                        <div className="font-medium text-sm text-slate-900">{customer.full_name}</div>
                                        <div className="text-xs text-slate-500 font-mono">{customer.id}</div>
                                    </TableCell>
                                    <TableCell className="text-sm text-slate-600">{customer.segment}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-semibold">{Math.round(customer.churn_score * 100)}%</span>
                                            <Badge className={`${getTierColor(customer.risk_tier)} text-white border-none uppercase text-[10px] px-1.5 py-0`}>
                                                {customer.risk_tier}
                                            </Badge>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-xs text-slate-600">
                                        {customer.active_signals?.length > 0 ? formatSignal(customer.active_signals[0]) : '-'}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="sm" className="h-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50">View</Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {data.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-slate-500 text-sm">No at-risk customers found.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
