"use client";

import { useEffect, useRef, useState } from "react";
import { getToken } from "@/lib/api";
import { Database, Activity, ArrowDownUp, Wifi, WifiOff, RefreshCw } from "lucide-react";

interface StreamEvent {
    id: number;
    topic: string;
    customerId: string;
    description: string;
    ts: string;
}

interface KafkaStatus {
    mode: 'kafka' | 'simulation' | 'initialising';
    connected: boolean;
    brokers?: string[];
    messagesProcessed: number;
    lastEventAt: string | null;
    recentEvents: StreamEvent[];
    topicsConsumed: string[];
    liveOverrides: { scores: number; signals: number; transactions: number; crm: number };
}

const TOPIC_LABEL: Record<string, { short: string; color: string }> = {
    'cbs.transactions':      { short: 'Transaction',    color: '#B46B3E' },
    'cbs.account_updates':   { short: 'Account',        color: '#8B8481' },
    'crm.customer_events':   { short: 'CRM',            color: '#8E5026' },
    'risk.signal_detections':{ short: 'Risk Signal',    color: '#6B132B' },
    'risk.score_updates':    { short: 'Score Refresh',  color: '#8E5026' },
    'engagement.activity':   { short: 'Engagement',     color: '#6B6562' },
};

function topicLabel(topic: string) {
    return TOPIC_LABEL[topic] || { short: topic.split('.').pop() || topic, color: '#8B8481' };
}

function timeAgo(iso: string) {
    const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 5) return 'just now';
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s/60)}m ago`;
    return `${Math.floor(s/3600)}h ago`;
}

export function KafkaStreamCard() {
    const [status, setStatus] = useState<KafkaStatus | null>(null);
    const [events, setEvents] = useState<StreamEvent[]>([]);
    const [connected, setConnected] = useState(false);
    const [tick, setTick] = useState(0);
    const esRef = useRef<EventSource | null>(null);

    useEffect(() => {
        const timer = setInterval(() => setTick(t => t + 1), 5000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const token = getToken();
        if (!token) return;

        const streamUrl = `/api/kafka/stream`;
        let retryDelay = 3000;
        let retryTimer: ReturnType<typeof setTimeout> | null = null;

        function connect() {
            if (esRef.current) esRef.current.close();
            const es = new EventSource(streamUrl);
            esRef.current = es;

            es.onmessage = (e) => {
                retryDelay = 3000;
                try {
                    const data = JSON.parse(e.data);
                    if (data.type === 'status' || data.type === 'heartbeat') {
                        if (data.mode) setStatus(data as KafkaStatus);
                        setConnected(true);
                    } else if (data.type === 'event') {
                        setEvents(prev => [data as StreamEvent, ...prev].slice(0, 25));
                        setStatus(prev => prev ? { ...prev, messagesProcessed: (prev.messagesProcessed || 0) + 1, lastEventAt: data.ts } : prev);
                    }
                } catch { /* ignore parse errors */ }
            };

            es.onerror = () => {
                setConnected(false);
                es.close();
                retryDelay = Math.min(retryDelay * 1.5, 30000);
                retryTimer = setTimeout(connect, retryDelay);
            };
        }

        fetch('/api/kafka/status', {
            headers: { Authorization: `Bearer ${token}` },
        }).then(r => r.json()).then(d => {
            if (d.data) {
                setStatus(d.data);
                setEvents(d.data.recentEvents || []);
            }
        }).catch(() => {});

        connect();

        return () => {
            if (retryTimer) clearTimeout(retryTimer);
            esRef.current?.close();
        };
    }, []);

    const isSimulation = status?.mode === 'simulation';
    const isKafka      = status?.mode === 'kafka';

    return (
        <div className="rounded-md border border-soft bg-white overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-soft flex items-center justify-between bg-[#F9F9F7]">
                <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-crimson" />
                    <span className="text-sm font-bold text-[#2A161B] font-heading">Live Data Pipeline</span>
                    <span className="text-[10px] text-[#8B8481]">Core Banking Stream</span>
                </div>
                <div className="flex items-center gap-2">
                    {isKafka ? (
                        <span className="flex items-center gap-1.5 text-[10px] font-bold text-crimson bg-crimson-soft border border-crimson px-2 py-1 rounded-md">
                            <Wifi className="w-3 h-3" /> Kafka Connected
                        </span>
                    ) : isSimulation ? (
                        <span className="flex items-center gap-1.5 text-[10px] font-bold text-[#8E5026] bg-copper-soft border border-copper px-2 py-1 rounded-md">
                            <RefreshCw className="w-3 h-3 animate-spin" style={{ animationDuration: '3s' }} /> Stream Simulation
                        </span>
                    ) : (
                        <span className="flex items-center gap-1.5 text-[10px] font-bold text-[#6B6562] bg-[#F5F4F2] border border-soft px-2 py-1 rounded-md">
                            <WifiOff className="w-3 h-3" /> Connecting…
                        </span>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] divide-y lg:divide-y-0 lg:divide-x divide-[#E5E0DF]">
                {/* Left: stats */}
                <div className="p-4 min-w-44 flex flex-col gap-4">
                    <div>
                        <div className="text-2xl font-black text-[#2A161B] font-heading">{status?.messagesProcessed ?? 0}</div>
                        <div className="text-[10px] text-[#8B8481] uppercase tracking-widest font-semibold">Events Ingested</div>
                    </div>
                    <div className="space-y-2">
                        {[
                            { label: 'Score Refreshes', value: status?.liveOverrides?.scores ?? 0 },
                            { label: 'Signal Updates',  value: status?.liveOverrides?.signals ?? 0 },
                            { label: 'Transactions',    value: status?.liveOverrides?.transactions ?? 0 },
                            { label: 'CRM Events',      value: status?.liveOverrides?.crm ?? 0 },
                        ].map(s => (
                            <div key={s.label} className="flex items-center justify-between">
                                <span className="text-[10px] text-[#8B8481]">{s.label}</span>
                                <span className="text-xs font-bold text-[#2A161B]">{s.value}</span>
                            </div>
                        ))}
                    </div>
                    <div className="pt-2 border-t border-soft">
                        <div className="text-[9px] text-[#8B8481] uppercase tracking-widest font-semibold mb-1">Topics</div>
                        <div className="space-y-1">
                            {(status?.topicsConsumed || []).map(t => {
                                const { short, color } = topicLabel(t);
                                return (
                                    <div key={t} className="flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
                                        <span className="text-[9px] text-[#6B6562]">{short}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Right: event feed */}
                <div className="flex flex-col">
                    <div className="px-4 py-2 border-b border-soft flex items-center gap-2">
                        <Activity className="w-3.5 h-3.5 text-[#8B8481]" />
                        <span className="text-[11px] font-semibold text-[#6B6562] uppercase tracking-widest">Live Event Feed</span>
                        {status?.lastEventAt && (
                            <span className="ml-auto text-[9px] text-[#8B8481]">Last: {timeAgo(status.lastEventAt)}</span>
                        )}
                    </div>
                    <div className="flex-1 overflow-y-auto max-h-52 divide-y divide-[#E5E0DF]">
                        {events.length === 0 && (
                            <div className="flex items-center justify-center h-20 text-xs text-[#8B8481]">
                                Awaiting first event…
                            </div>
                        )}
                        {events.map((evt, i) => {
                            const { short, color } = topicLabel(evt.topic);
                            return (
                                <div key={evt.id ?? i} className="flex items-start gap-2 px-4 py-2 hover:bg-[#F9F9F7] transition-colors">
                                    <span className="mt-0.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color }}>{short}</span>
                                            <span className="text-[10px] text-[#6B6562] font-medium truncate">{evt.customerId}</span>
                                        </div>
                                        <p className="text-[10px] text-[#2A161B] leading-snug mt-0.5 line-clamp-1">{evt.description}</p>
                                    </div>
                                    <span className="text-[9px] text-[#8B8481] shrink-0 mt-0.5">{timeAgo(evt.ts)}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="border-t border-soft px-4 py-2 bg-[#F9F9F7] flex items-center gap-2">
                <ArrowDownUp className="w-3 h-3 text-[#8B8481]" />
                <span className="text-[10px] text-[#8B8481]">
                    {isKafka
                        ? `Connected to ${status?.brokers?.[0] || 'kafka'} · ${status?.topicsConsumed?.length || 0} topics`
                        : isSimulation
                        ? 'Simulation mode — connect a Kafka broker at localhost:9092 for live CBS feed'
                        : 'Initialising stream connection…'}
                </span>
            </div>
        </div>
    );
}
