'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ProtectedRoute from "@/components/ProtectedRoute";
import { BarChart3, TrendingUp, Target, Activity } from "lucide-react";
import { api } from '@/lib/api';
import { DashboardData } from '@/types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line, Legend, PieChart, Pie, Cell } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';

const COLORS = ['#3B82F6', '#22C55E', '#F97316', '#A855F7'];

export default function AnalyticsPage() {
    const [dashboard, setDashboard] = useState<DashboardData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function loadData() {
            try {
                setIsLoading(true);
                const data = await api.getDashboard();
                setDashboard(data.data || data);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load analytics');
            } finally {
                setIsLoading(false);
            }
        }
        loadData();
    }, []);

    const segmentUplift = [
        { segment: 'HNW', treatment: 78, holdout: 62 },
        { segment: 'Mass Affluent', treatment: 85, holdout: 71 },
        { segment: 'Mass Market', treatment: 72, holdout: 62 },
        { segment: 'Digital Native', treatment: 68, holdout: 58 },
    ];

    if (isLoading) {
        return (
            <ProtectedRoute>
                <div className="flex flex-col gap-6 max-w-7xl">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Skeleton className="h-80" />
                        <Skeleton className="h-80" />
                    </div>
                    <Skeleton className="h-64" />
                </div>
            </ProtectedRoute>
        );
    }

    if (error) {
        return (
            <ProtectedRoute>
                <Card className="border-red-200 bg-red-50">
                    <CardContent className="p-4 text-red-600">{error}</CardContent>
                </Card>
            </ProtectedRoute>
        );
    }

    const riskDistData = dashboard?.risk_distribution 
        ? Object.entries(dashboard.risk_distribution).map(([tier, count]) => ({ tier, count }))
        : [];

    const channelPerfData = dashboard?.campaign_performance?.map(cp => ({
        channel: cp.channel.replace(/_/g, ' '),
        rate: Math.round(cp.conversion_rate * 100)
    })) || [];

    const trendData = dashboard?.risk_trend_30d?.map(rt => ({
        date: rt.date.slice(5),
        score: Math.round(rt.avg_score * 100)
    })) || [];

    return (
        <ProtectedRoute>
            <div className="flex flex-col gap-6 max-w-7xl">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                        <BarChart3 className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
                        <p className="text-slate-500">Campaign performance and uplift analysis</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <TrendingUp className="w-4 h-4" />
                                Uplift by Segment (Treatment vs Holdout)
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="h-72">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={segmentUplift}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="segment" tick={{ fontSize: 12 }} />
                                        <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                                        <Tooltip formatter={(value) => [`${value}%`]} />
                                        <Legend />
                                        <Bar dataKey="treatment" name="Treatment" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="holdout" name="Holdout" fill="#94A3B8" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Target className="w-4 h-4" />
                                Channel Conversion Rate
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {channelPerfData.length > 0 ? (
                                <div className="h-72">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={channelPerfData} layout="vertical">
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis type="number" tickFormatter={(v) => `${v}%`} />
                                            <YAxis type="category" dataKey="channel" width={80} tick={{ fontSize: 12 }} />
                                            <Tooltip formatter={(value) => [`${value}%`]} />
                                            <Bar dataKey="rate" fill="#22C55E" radius={[0, 4, 4, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <div className="h-72 flex items-center justify-center text-slate-400">
                                    No channel data available
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Activity className="w-4 h-4" />
                                30-Day Risk Trend
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {trendData.length > 0 ? (
                                <div className="h-72">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={trendData}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                                            <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                                            <Tooltip formatter={(value) => [`${value}%`]} />
                                            <Line type="monotone" dataKey="score" stroke="#F97316" strokeWidth={2} dot={false} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <div className="h-72 flex items-center justify-center text-slate-400">
                                    No trend data available
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <PieChart className="w-4 h-4" />
                                Risk Distribution
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {riskDistData.length > 0 ? (
                                <div className="h-72 flex items-center justify-center">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={riskDistData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={90}
                                                paddingAngle={2}
                                                dataKey="count"
                                                nameKey="tier"
                                                label={({ name, value }) => `${name}: ${value}`}
                                            >
                                                {riskDistData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <div className="h-72 flex items-center justify-center text-slate-400">
                                    No risk data available
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Insight Cards</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {dashboard?.insight_cards?.map((card, idx) => (
                                <div
                                    key={idx}
                                    className={`p-4 border rounded-lg ${
                                        card.severity === 'critical' ? 'bg-red-50 border-red-200' :
                                        card.severity === 'warning' ? 'bg-amber-50 border-amber-200' :
                                        'bg-blue-50 border-blue-200'
                                    }`}
                                >
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className={`w-2 h-2 rounded-full ${
                                            card.severity === 'critical' ? 'bg-red-500' :
                                            card.severity === 'warning' ? 'bg-amber-500' :
                                            'bg-blue-500'
                                        }`} />
                                        <span className="text-xs font-medium uppercase">{card.severity}</span>
                                    </div>
                                    <h4 className="font-medium text-slate-900 mb-1">{card.title}</h4>
                                    <p className="text-sm text-slate-600">{card.description}</p>
                                    <p className="text-xs text-slate-400 mt-2">
                                        {card.timestamp ? new Date(card.timestamp).toLocaleString() : 'Just now'}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Model Drift Monitor</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-64 flex items-center justify-center text-slate-400">
                            <p>Model drift visualization placeholder</p>
                            <p className="text-sm mt-2">Showing predicted score vs actual churn rate over time</p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Cohort Outcome Heatmap</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-64 flex items-center justify-center text-slate-400">
                            <p>Cohort heatmap visualization placeholder</p>
                            <p className="text-sm mt-2">Retention rate by channel × life event type</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </ProtectedRoute>
    );
}
