"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ChurnTrendChartProps {
    data: { week: string; avg_score: number }[];
}

export function ChurnTrendChart({ data = [] }: ChurnTrendChartProps) {
    return (
        <Card className="shadow-sm border-gray-200 h-full">
            <CardHeader>
                <CardTitle className="text-base font-semibold text-slate-900">Portfolio Churn Score Trend</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-[220px] w-full">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                        <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                            <XAxis
                                dataKey="week"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 12, fill: '#64748B' }}
                                dy={10}
                            />
                            <YAxis
                                domain={[0, 1]}
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 12, fill: '#64748B' }}
                                tickFormatter={(val: number) => `${(val * 100).toFixed(0)}%`}
                            />
                            <Tooltip
                                formatter={(value) => [`${(Number(value) * 100).toFixed(1)}%`, 'Avg Score']}
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                labelStyle={{ fontWeight: 'bold', color: '#1E293B', marginBottom: '4px' }}
                            />
                            <Line
                                type="monotone"
                                dataKey="avg_score"
                                stroke="#2E75B6"
                                strokeWidth={3}
                                dot={{ r: 0 }}
                                activeDot={{ r: 6, fill: "#2E75B6", stroke: "#fff", strokeWidth: 2 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
