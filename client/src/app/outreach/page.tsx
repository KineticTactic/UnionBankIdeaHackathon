'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Send, CheckCircle, Clock, TrendingUp, Users, AlertCircle } from "lucide-react";
import { api } from '@/lib/api';
import { OutreachRecord, Campaign } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function OutreachPage() {
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [outreachRecords, setOutreachRecords] = useState<OutreachRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const { user } = useAuth();
    const canManage = user?.role === 'manager' || user?.role === 'admin';

    useEffect(() => {
        async function loadData() {
            try {
                setIsLoading(true);
                const [campaignsData, outreachData] = await Promise.all([
                    api.getCampaigns(),
                    api.getOutreach({ limit: 50 })
                ]);
                setCampaigns(campaignsData.data || campaignsData || []);
                setOutreachRecords(outreachData.data || outreachData || []);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load data');
            } finally {
                setIsLoading(false);
            }
        }
        loadData();
    }, []);

    const pendingRecords = outreachRecords.filter(r => r.status === 'failed' || r.status === 'sent');
    const totalSent = campaigns.reduce((acc, c) => acc + (c.stats?.sent || 0), 0);
    const totalDelivered = campaigns.reduce((acc, c) => acc + (c.stats?.delivered || 0), 0);
    const deliveryRate = totalSent > 0 ? Math.round((totalDelivered / totalSent) * 100) : 0;

    const channelPerformance = campaigns.reduce((acc, c) => {
        const records = outreachRecords.filter(r => r.campaign_id === c.campaign_id);
        const byChannel = records.reduce((channelAcc, r) => {
            channelAcc[r.channel] = (channelAcc[r.channel] || 0) + 1;
            return channelAcc;
        }, {} as Record<string, number>);
        Object.entries(byChannel).forEach(([channel, count]) => {
            if (!acc[channel]) acc[channel] = 0;
            acc[channel] += count;
        });
        return acc;
    }, {} as Record<string, number>);

    const channelData = Object.entries(channelPerformance).map(([channel, count]) => ({
        channel: channel.replace(/_/g, ' '),
        count
    }));

    const filteredRecords = statusFilter === 'all' 
        ? outreachRecords 
        : outreachRecords.filter(r => r.status === statusFilter);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'sent': return <Badge className="bg-slate-100 text-slate-700">Sent</Badge>;
            case 'delivered': return <Badge className="bg-blue-100 text-blue-700">Delivered</Badge>;
            case 'opened': return <Badge className="bg-purple-100 text-purple-700">Opened</Badge>;
            case 'clicked': return <Badge className="bg-green-100 text-green-700">Clicked</Badge>;
            case 'failed': return <Badge className="bg-red-100 text-red-700">Failed</Badge>;
            default: return <Badge>{status}</Badge>;
        }
    };

    const getCampaignStatusBadge = (status: string) => {
        switch (status) {
            case 'active': return <Badge className="bg-green-100 text-green-700">Active</Badge>;
            case 'completed': return <Badge className="bg-slate-100 text-slate-600">Completed</Badge>;
            case 'paused': return <Badge className="bg-amber-100 text-amber-700">Paused</Badge>;
            default: return <Badge>{status}</Badge>;
        }
    };

    return (
        <ProtectedRoute>
            <div className="flex flex-col gap-6 max-w-7xl">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                        <Send className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Outreach Hub</h1>
                        <p className="text-slate-500">Manage campaigns and outreach records</p>
                    </div>
                </div>

                {isLoading ? (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {[1, 2, 3].map(i => (
                            <Card key={i}><CardContent className="p-6 h-24 animate-pulse bg-slate-100" /></Card>
                        ))}
                    </div>
                ) : error ? (
                    <Card className="border-red-200 bg-red-50">
                        <CardContent className="p-4 text-red-600">{error}</CardContent>
                    </Card>
                ) : (
                    <>
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                            <Card>
                                <CardContent className="pt-6">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                            <Send className="w-5 h-5 text-blue-600" />
                                        </div>
                                        <div>
                                            <p className="text-2xl font-bold text-slate-900">{totalSent}</p>
                                            <p className="text-sm text-slate-500">Sent This Week</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardContent className="pt-6">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                                            <CheckCircle className="w-5 h-5 text-green-600" />
                                        </div>
                                        <div>
                                            <p className="text-2xl font-bold text-slate-900">{deliveryRate}%</p>
                                            <p className="text-sm text-slate-500">Delivery Rate</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardContent className="pt-6">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                                            <TrendingUp className="w-5 h-5 text-purple-600" />
                                        </div>
                                        <div>
                                            <p className="text-2xl font-bold text-slate-900">18.5%</p>
                                            <p className="text-sm text-slate-500">Avg Uplift</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardContent className="pt-6">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                                            <Clock className="w-5 h-5 text-amber-600" />
                                        </div>
                                        <div>
                                            <p className="text-2xl font-bold text-slate-900">{pendingRecords.length}</p>
                                            <p className="text-sm text-slate-500">Pending Review</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Active Campaigns</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        {campaigns.map((campaign) => (
                                            <div key={campaign.campaign_id} className="p-4 border border-slate-200 rounded-lg">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="font-medium text-slate-900">{campaign.campaign_name}</span>
                                                    {getCampaignStatusBadge(campaign.status)}
                                                </div>
                                                <p className="text-sm text-slate-500 mb-3">{campaign.campaign_id}</p>
<div className="grid grid-cols-4 gap-2 text-sm">
                                                        <div className="text-center p-2 bg-slate-50 rounded">
                                                            <p className="font-bold text-slate-900">{campaign.stats?.sent || 0}</p>
                                                            <p className="text-xs text-slate-500">Sent</p>
                                                        </div>
                                                        <div className="text-center p-2 bg-slate-50 rounded">
                                                            <p className="font-bold text-slate-900">{campaign.stats?.sent ? Math.round((campaign.stats?.delivered || 0) / campaign.stats.sent * 100) : 0}%</p>
                                                            <p className="text-xs text-slate-500">Delivered</p>
                                                        </div>
                                                        <div className="text-center p-2 bg-slate-50 rounded">
                                                            <p className="font-bold text-slate-900">{campaign.stats?.sent ? Math.round((campaign.stats?.opened || 0) / campaign.stats.sent * 100) : 0}%</p>
                                                            <p className="text-xs text-slate-500">Opened</p>
                                                        </div>
                                                        <div className="text-center p-2 bg-green-50 rounded">
                                                            <p className="font-bold text-green-700">+{campaign.stats?.uplift_pct || 0}%</p>
                                                            <p className="text-xs text-green-600">Uplift</p>
                                                        </div>
                                                    </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Channel Performance</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {channelData.length > 0 ? (
                                        <div className="h-64">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={channelData}>
                                                    <CartesianGrid strokeDasharray="3 3" />
                                                    <XAxis dataKey="channel" tick={{ fontSize: 12 }} />
                                                    <YAxis />
                                                    <Tooltip />
                                                    <Bar dataKey="count" fill="#22C55E" radius={[4, 4, 0, 0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    ) : (
                                        <p className="text-slate-500 text-center py-8">No channel data</p>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle>Recent Outreach Records</CardTitle>
                                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                                        <SelectTrigger className="w-[160px]">
                                            <SelectValue placeholder="Filter by status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Status</SelectItem>
                                            <SelectItem value="sent">Sent</SelectItem>
                                            <SelectItem value="delivered">Delivered</SelectItem>
                                            <SelectItem value="opened">Opened</SelectItem>
                                            <SelectItem value="clicked">Clicked</SelectItem>
                                            <SelectItem value="failed">Failed</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b">
                                                <th className="text-left py-2 px-3 font-medium text-slate-500">ID</th>
                                                <th className="text-left py-2 px-3 font-medium text-slate-500">Customer</th>
                                                <th className="text-left py-2 px-3 font-medium text-slate-500">Channel</th>
                                                <th className="text-left py-2 px-3 font-medium text-slate-500">Campaign</th>
                                                <th className="text-left py-2 px-3 font-medium text-slate-500">Status</th>
                                                <th className="text-left py-2 px-3 font-medium text-slate-500">Date</th>
                                                {canManage && <th className="text-right py-2 px-3 font-medium text-slate-500">Action</th>}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredRecords.slice(0, 20).map((record) => (
                                                <tr key={record.outreach_id} className="border-b border-slate-50 hover:bg-slate-50">
                                                    <td className="py-2 px-3 font-mono text-xs">{record.outreach_id}</td>
                                                    <td className="py-2 px-3">{record.customer_id}</td>
                                                    <td className="py-2 px-3 capitalize">{record.channel.replace(/_/g, ' ')}</td>
                                                    <td className="py-2 px-3 text-xs">{record.campaign_id || '-'}</td>
                                                    <td className="py-2 px-3">{getStatusBadge(record.status)}</td>
                                                    <td className="py-2 px-3 text-xs text-slate-500">
                                                        {new Date(record.dispatched_at).toLocaleDateString()}
                                                    </td>
                                                    {canManage && (
                                                        <td className="py-2 px-3 text-right">
                                                            <Button variant="ghost" size="sm" className="h-7 text-xs">
                                                                View
                                                            </Button>
                                                        </td>
                                                    )}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    </>
                )}
            </div>
        </ProtectedRoute>
    );
}
