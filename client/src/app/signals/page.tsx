'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Bell, TrendingUp, AlertTriangle, AlertCircle, Info } from "lucide-react";
import { api } from '@/lib/api';
import { Warning } from '@/types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function SignalsPage() {
    const [warnings, setWarnings] = useState<Warning[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function loadWarnings() {
            try {
                setIsLoading(true);
                const data = await api.getWarnings();
                setWarnings(data.data || data || []);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load warnings');
            } finally {
                setIsLoading(false);
            }
        }
        loadWarnings();
        
        const interval = setInterval(loadWarnings, 30000);
        return () => clearInterval(interval);
    }, []);

    const getSeverityIcon = (severity: string) => {
        switch (severity) {
            case 'critical': return <AlertCircle className="w-5 h-5 text-red-600" />;
            case 'medium': return <AlertTriangle className="w-5 h-5 text-amber-600" />;
            default: return <Info className="w-5 h-5 text-blue-600" />;
        }
    };

    const getSeverityStyle = (severity: string) => {
        switch (severity) {
            case 'critical': return 'bg-red-50 border-red-200';
            case 'medium': return 'bg-amber-50 border-amber-200';
            default: return 'bg-blue-50 border-blue-200';
        }
    };

    const getSeverityBadgeStyle = (severity: string) => {
        switch (severity) {
            case 'critical': return 'bg-red-200 text-red-800';
            case 'medium': return 'bg-amber-200 text-amber-800';
            default: return 'bg-blue-200 text-blue-800';
        }
    };

    const signalBreakdown = warnings.reduce((acc, w) => {
        acc[w.signal_type] = (acc[w.signal_type] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const breakdownData = Object.entries(signalBreakdown).map(([signal, count]) => ({
        signal: signal.replace(/_/g, ' '),
        count
    }));

    return (
        <ProtectedRoute>
            <div className="flex flex-col gap-6 max-w-7xl">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                        <Bell className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Signal Monitor</h1>
                        <p className="text-slate-500">Real-time monitoring of predictive signals</p>
                    </div>
                </div>

                {isLoading ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card><CardContent className="p-6 h-64 animate-pulse bg-slate-100" /></Card>
                        <Card><CardContent className="p-6 h-64 animate-pulse bg-slate-100" /></Card>
                    </div>
                ) : error ? (
                    <Card className="border-red-200 bg-red-50">
                        <CardContent className="p-4 text-red-600">{error}</CardContent>
                    </Card>
                ) : (
                    <>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <AlertCircle className="w-4 h-4 text-red-600" />
                                        Active Alarms ({warnings.filter(w => w.severity === 'critical').length})
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-3 max-h-80 overflow-y-auto">
                                        {warnings.filter(w => w.severity === 'critical').map((warning, idx) => (
                                            <div key={idx} className={`p-3 border rounded-lg ${getSeverityStyle(warning.severity)}`}>
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="font-medium text-sm">{warning.signal_type.replace(/_/g, ' ')}</span>
                                                    <span className={`text-xs px-2 py-0.5 rounded ${getSeverityBadgeStyle(warning.severity)}`}>
                                                        {warning.severity}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-slate-600 mt-1">{warning.description}</p>
                                                <p className="text-xs text-slate-400 mt-2">
                                                    {new Date(warning.timestamp).toLocaleString()}
                                                </p>
                                            </div>
                                        ))}
                                        {warnings.filter(w => w.severity === 'critical').length === 0 && (
                                            <p className="text-slate-500 text-center py-4">No critical alarms</p>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <TrendingUp className="w-4 h-4" />
                                        Signal Breakdown
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {breakdownData.length > 0 ? (
                                        <div className="h-72">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={breakdownData} layout="vertical">
                                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                                    <XAxis type="number" />
                                                    <YAxis type="category" dataKey="signal" width={120} tick={{ fontSize: 12 }} />
                                                    <Tooltip />
                                                    <Bar dataKey="count" fill="#F97316" radius={[0, 4, 4, 0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    ) : (
                                        <p className="text-slate-500 text-center py-8">No signal data</p>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Bell className="w-4 h-4" />
                                    All Warnings ({warnings.length})
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {warnings.map((warning, idx) => (
                                        <div key={idx} className={`p-3 border rounded-lg ${getSeverityStyle(warning.severity)}`}>
                                            <div className="flex items-center gap-3">
                                                {getSeverityIcon(warning.severity)}
                                                <div className="flex-1">
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-medium">{warning.title}</span>
                                                        <span className={`text-xs px-2 py-0.5 rounded ${getSeverityBadgeStyle(warning.severity)}`}>
                                                            {warning.severity}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-slate-600 mt-1">{warning.description}</p>
                                                    <div className="flex gap-4 mt-2 text-xs text-slate-500">
                                                        <span>Signal: {warning.signal_type}</span>
                                                        <span>Affected: {warning.affected_customers} customer(s)</span>
                                                        <span>{new Date(warning.timestamp).toLocaleString()}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </>
                )}
            </div>
        </ProtectedRoute>
    );
}
