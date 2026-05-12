"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const COLORS: Record<string, string> = {
    critical: "#EF4444",
    high: "#F97316",
    medium: "#EAB308",
    watch: "#3B82F6",
    low: "#22C55E",
};

interface RiskDistributionChartProps {
    data: { tier: string; count: number; percentage: number }[];
}

export function RiskDistributionChart({ data = [] }: RiskDistributionChartProps) {
    return (
        <Card className="shadow-sm border-gray-200">
            <CardHeader>
                <CardTitle className="text-base font-semibold text-slate-900">Risk Distribution</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-[220px] w-full">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                        <PieChart>
                            <Pie
                                data={data}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={100}
                                paddingAngle={2}
                                dataKey="count"
                                nameKey="tier"
                            >
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[entry.tier] || "#94a3b8"} />
                                ))}
                            </Pie>
                            <Tooltip
                                formatter={(value, name) => [value, String(name).charAt(0).toUpperCase() + String(name).slice(1)]}
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            />
                            <Legend
                                verticalAlign="bottom"
                                height={36}
                                formatter={(value) => <span className="text-xs font-medium text-slate-600 capitalize">{value}</span>}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
