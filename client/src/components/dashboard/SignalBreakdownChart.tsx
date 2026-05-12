"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SignalBreakdownChartProps {
    data: { signal_type: string; count: number }[];
}

const COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#F43F5E', '#F97316', '#EAB308', '#22C55E', '#14B8A6'];

export function SignalBreakdownChart({ data = [] }: SignalBreakdownChartProps) {
    // Sort data descending by count
    const sortedData = [...data].sort((a, b) => b.count - a.count);

    return (
        <Card className="shadow-sm border-gray-200 h-full">
            <CardHeader>
                <CardTitle className="text-base font-semibold text-slate-900">Active Signal Distribution</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-[300px] w-full pt-4">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                        <BarChart data={sortedData} layout="vertical" margin={{ top: 0, right: 20, left: 30, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                            <XAxis type="number" hide />
                            <YAxis
                                type="category"
                                dataKey="signal_type"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 11, fill: '#475569' }}
                                width={140}
                                tickFormatter={(val: string) => val.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                            />
                            <Tooltip
                                cursor={{ fill: '#F1F5F9' }}
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                formatter={(value) => [value, 'Customers']}
                                labelFormatter={(label) => String(label).split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                            />
                            <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={24}>
                                {sortedData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
