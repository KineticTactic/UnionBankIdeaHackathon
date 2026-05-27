'use client';

import { useState, useEffect } from 'react';
import ProtectedRoute from "@/components/ProtectedRoute";
import { api } from '@/lib/api';
import { Warning } from '@/types';
import { Zap, AlertCircle, Activity, BarChart3, Cpu, TrendingUp, ExternalLink } from "lucide-react";
import Link from 'next/link';

// ── Embedded signal intelligence data ─────────────────────────────────────────

const CHURN_DATA: Record<string, { name: string; score: number; tier: string; segment: string }> = {
    'C-00000001': { name: 'Arjun Sharma',  score: 0.87, tier: 'critical', segment: 'HNW' },
    'C-00000002': { name: 'Priya Kapoor',  score: 0.71, tier: 'high',     segment: 'Mass Affluent' },
    'C-00000003': { name: 'Rohit Patel',   score: 0.34, tier: 'watch',    segment: 'Mass Market' },
    'C-00000004': { name: 'Anjali Singh',  score: 0.58, tier: 'medium',   segment: 'Digital Native' },
    'C-00000005': { name: 'Vikram Desai',  score: 0.15, tier: 'low',      segment: 'HNW' },
    'C-00000006': { name: 'Meera Reddy',   score: 0.91, tier: 'critical', segment: 'HNW' },
    'C-00000007': { name: 'Suresh Kumar',  score: 0.68, tier: 'high',     segment: 'Mass Affluent' },
    'C-00000008': { name: 'Deepak Nair',   score: 0.28, tier: 'low',      segment: 'Mass Market' },
    'C-00000009': { name: 'Neha Gupta',    score: 0.55, tier: 'medium',   segment: 'Digital Native' },
    'C-00000010': { name: 'Rajesh Verma',  score: 0.22, tier: 'low',      segment: 'HNW' },
    'C-00000011': { name: 'Amrita Bhat',   score: 0.74, tier: 'high',     segment: 'Mass Affluent' },
    'C-00000012': { name: 'Sanjay Mishra', score: 0.89, tier: 'critical', segment: 'Mass Market' },
    'C-00000013': { name: 'Harish Iyer',   score: 0.41, tier: 'medium',   segment: 'Mass Affluent' },
    'C-00000014': { name: 'Kavitha Rajan', score: 0.73, tier: 'high',     segment: 'Mass Market' },
    'C-00000015': { name: 'Sunil Mathur',  score: 0.29, tier: 'watch',    segment: 'Mass Market' },
    'C-00000016': { name: 'Pooja Agarwal', score: 0.82, tier: 'critical', segment: 'HNW' },
    'C-00000017': { name: 'Ravi Shankar',  score: 0.38, tier: 'watch',    segment: 'Mass Market' },
    'C-00000018': { name: 'Deepika Menon', score: 0.68, tier: 'high',     segment: 'Digital Native' },
    'C-00000019': { name: 'Kunal Sharma',  score: 0.51, tier: 'medium',   segment: 'Mass Market' },
    'C-00000020': { name: 'Ananya Bose',   score: 0.47, tier: 'medium',   segment: 'Digital Native' },
};

const ALL_SIGNALS = [
    { customerId: 'C-00000001', signalType: 'location_city',       confidence: 0.92, cusumValue: 4.2, threshold: 3.5, method: 'CUSUM',  evidence: 'City shift Mumbai→Bangalore. >60% txns in new city.' },
    { customerId: 'C-00000001', signalType: 'transaction_frequency',confidence: 0.85, cusumValue: 3.8, threshold: 3.0, method: 'CUSUM',  evidence: 'Frequency dropped 35% over 6-week window.' },
    { customerId: 'C-00000002', signalType: 'digital_engagement',   confidence: 0.78, cusumValue: 3.2, threshold: 3.0, method: 'CUSUM',  evidence: 'App logins down 40%. Feature views declined.' },
    { customerId: 'C-00000004', signalType: 'stress_overdraft',     confidence: 0.72, cusumValue: 2.9, threshold: 2.5, method: 'BOCPD',  evidence: '3 overdraft events in 30 days. Stress pattern.' },
    { customerId: 'C-00000006', signalType: 'lifecycle_mcc',        confidence: 0.95, cusumValue: 5.1, threshold: 3.0, method: 'BOCPD',  evidence: 'MCC 7261 funeral service. Probate note in CRM.' },
    { customerId: 'C-00000006', signalType: 'transaction_frequency',confidence: 0.88, cusumValue: 6.2, threshold: 3.0, method: 'CUSUM',  evidence: 'Transaction volume collapsed 90% in 2 weeks.' },
    { customerId: 'C-00000007', signalType: 'digital_engagement',   confidence: 0.81, cusumValue: 3.5, threshold: 3.0, method: 'CUSUM',  evidence: 'Feature views down 50%. No app login in 18 days.' },
    { customerId: 'C-00000008', signalType: 'salary_amount',        confidence: 0.90, cusumValue: 4.0, threshold: 3.0, method: 'CUSUM',  evidence: 'Salary dropped 18% (₹65k→₹53k). Same employer.' },
    { customerId: 'C-00000009', signalType: 'complaint_sentiment',  confidence: 0.76, cusumValue: 2.8, threshold: 2.5, method: 'CUSUM',  evidence: 'Negative sentiment in CRM notes. 2 open tickets.' },
    { customerId: 'C-00000011', signalType: 'digital_engagement',   confidence: 0.74, cusumValue: 3.1, threshold: 3.0, method: 'CUSUM',  evidence: 'App engagement down 45%. Churner pattern.' },
    { customerId: 'C-00000012', signalType: 'salary_amount',        confidence: 0.88, cusumValue: 4.5, threshold: 3.0, method: 'CUSUM',  evidence: 'Employer reference changed. Salary source shift.' },
    { customerId: 'C-00000012', signalType: 'digital_engagement',   confidence: 0.92, cusumValue: 5.0, threshold: 3.0, method: 'BOCPD',  evidence: 'All engagement signals firing simultaneously.' },
    { customerId: 'C-00000013', signalType: 'salary_amount',        confidence: 0.68, cusumValue: 2.2, threshold: 2.5, method: 'CUSUM',  evidence: 'Mild salary drift. Retirement signal age 68.' },
    { customerId: 'C-00000014', signalType: 'location_city',        confidence: 0.91, cusumValue: 4.8, threshold: 3.5, method: 'CUSUM',  evidence: 'City shift Hyderabad→Pune. MCC 6552 real estate.' },
    { customerId: 'C-00000016', signalType: 'digital_engagement',   confidence: 0.89, cusumValue: 4.2, threshold: 3.0, method: 'SPRT',   evidence: 'Engagement signals active. SPRT complaint alarm.' },
    { customerId: 'C-00000018', signalType: 'digital_engagement',   confidence: 0.77, cusumValue: 3.3, threshold: 3.0, method: 'CUSUM',  evidence: 'Decay across all digital channels. 30-day trend.' },
    { customerId: 'C-00000019', signalType: 'stress_overdraft',     confidence: 0.73, cusumValue: 2.7, threshold: 2.5, method: 'BOCPD',  evidence: 'Overdraft events + CRM repayment difficulty.' },
    { customerId: 'C-00000020', signalType: 'lifecycle_mcc',        confidence: 0.82, cusumValue: 3.4, threshold: 3.0, method: 'rule_ml',evidence: 'MCC 5944 jewellery + 7011 hotel. Wedding pattern.' },
];

const SIGNAL_TYPES = ['transaction_frequency','salary_amount','digital_engagement','complaint_sentiment','stress_overdraft','location_city','lifecycle_mcc','joint_bocpd'] as const;

const TIER_COLOR: Record<string, string> = {
    critical: '#ef4444', high: '#f97316', medium: '#eab308', watch: '#6366f1', low: '#22c55e',
};
const TIER_BG: Record<string, string> = {
    critical: 'bg-red-50 border-red-200 text-red-700', high: 'bg-orange-50 border-orange-200 text-orange-700',
    medium: 'bg-yellow-50 border-yellow-200 text-yellow-700', watch: 'bg-violet-50 border-violet-200 text-violet-700',
    low: 'bg-emerald-50 border-emerald-200 text-emerald-700',
};

const METHOD_COLORS: Record<string, string> = {
    CUSUM: '#3b82f6', BOCPD: '#8b5cf6', SPRT: '#f97316', rule_ml: '#06b6d4',
};

const methodCounts = ALL_SIGNALS.reduce((acc, s) => {
    acc[s.method] = (acc[s.method] || 0) + 1; return acc;
}, {} as Record<string, number>);

const signalTypeCounts = ALL_SIGNALS.reduce((acc, s) => {
    acc[s.signalType] = (acc[s.signalType] || 0) + 1; return acc;
}, {} as Record<string, number>);

const avgCusumExcess = ALL_SIGNALS.reduce((s, sig) => s + (sig.cusumValue - sig.threshold), 0) / ALL_SIGNALS.length;

// Customer signal coverage matrix
const CUSTOMER_IDS = Object.keys(CHURN_DATA);
const signalMatrix: Record<string, Record<string, number>> = {};
CUSTOMER_IDS.forEach(id => { signalMatrix[id] = {}; });
ALL_SIGNALS.forEach(s => { signalMatrix[s.customerId][s.signalType] = s.confidence; });

function timeAgo(isoDate: string) {
    const diff = Date.now() - new Date(isoDate).getTime();
    const h = Math.floor(diff / 3600000);
    if (h < 1) return 'Just now';
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
}

export default function SignalsPage() {
    const [warnings, setWarnings] = useState<Warning[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'alarms' | 'matrix' | 'coverage'>('alarms');

    useEffect(() => {
        async function load() {
            try {
                const data = await api.getWarnings();
                setWarnings(data.data || data || []);
            } catch { /* use embedded data */ }
            finally { setIsLoading(false); }
        }
        load();
        const t = setInterval(load, 60000);
        return () => clearInterval(t);
    }, []);

    const criticalAlarms = ALL_SIGNALS.filter(s => {
        const c = CHURN_DATA[s.customerId];
        return c && (c.tier === 'critical' || c.tier === 'high');
    });

    const byScore = [...CUSTOMER_IDS].sort((a, b) => (CHURN_DATA[b]?.score || 0) - (CHURN_DATA[a]?.score || 0));
    const activeCustomers = byScore.filter(id => ALL_SIGNALS.some(s => s.customerId === id));
    const cleanCustomers = byScore.filter(id => !ALL_SIGNALS.some(s => s.customerId === id));

    return (
        <ProtectedRoute>
            <div className="flex flex-col gap-6 max-w-7xl pb-12">
                {/* Header */}
                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Signal Monitor</h1>
                        <p className="text-sm text-slate-400 mt-1">ARGUS Layer 2 — CUSUM · BOCPD · SPRT detection across 20-customer portfolio</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse inline-block" />
                        {criticalAlarms.filter(s => CHURN_DATA[s.customerId]?.tier === 'critical').length} Critical Alarms Active
                    </div>
                </div>

                {/* KPIs */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                        { label: 'Active Risk Signals', value: String(ALL_SIGNALS.length), sub: 'Across all detection methods', icon: Zap, color: 'text-violet-600 bg-violet-50' },
                        { label: 'Critical + High Alerts', value: String(criticalAlarms.length), sub: `${criticalAlarms.filter(s=>CHURN_DATA[s.customerId]?.tier==='critical').length} critical requiring action`, icon: AlertCircle, color: 'text-red-600 bg-red-50' },
                        { label: 'Avg CUSUM Excess', value: `+${avgCusumExcess.toFixed(2)}σ`, sub: 'Signal strength above alarm threshold', icon: Activity, color: 'text-orange-600 bg-orange-50' },
                        { label: 'Customers Monitored', value: '20', sub: `${activeCustomers.length} with active signals`, icon: Cpu, color: 'text-blue-600 bg-blue-50' },
                    ].map(k => (
                        <div key={k.label} className="rounded-xl border border-slate-200 bg-white p-4 flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${k.color}`}>
                                <k.icon className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-slate-900 leading-tight">{k.value}</div>
                                <div className="text-xs font-semibold text-slate-600">{k.label}</div>
                                <div className="text-[10px] text-slate-400 mt-0.5">{k.sub}</div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Detection Method Stats */}
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <p className="text-sm font-bold text-slate-800">Detection Method Distribution</p>
                            <p className="text-xs text-slate-400">Statistical alarm methods powering ARGUS Layer 2</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {Object.entries(methodCounts).map(([method, count]) => {
                            const color = METHOD_COLORS[method] || '#94a3b8';
                            const pct = Math.round(count / ALL_SIGNALS.length * 100);
                            const descriptions: Record<string, string> = {
                                CUSUM: 'Drift Monitor — detects gradual behavioural drift in time-series features over rolling windows.',
                                BOCPD: 'Behavioural Shift Detector — identifies abrupt distributional shifts in account activity patterns.',
                                SPRT: 'Alert Sequencer — complaint frequency monitoring with configurable statistical confidence bounds.',
                                rule_ml: 'Intelligent Rule Engine — domain-specific banking rules with ML scoring for transaction category patterns.',
                            };
                            return (
                                <div key={method} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-black" style={{ color }}>{method}</span>
                                        <span className="text-lg font-bold text-slate-900">{count}</span>
                                    </div>
                                    <div className="h-1.5 bg-slate-200 rounded-full mb-2 overflow-hidden">
                                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                                    </div>
                                    <p className="text-[10px] text-slate-500 leading-snug">{descriptions[method]}</p>
                                    <div className="mt-2 text-[10px] font-bold" style={{ color }}>{pct}% of alarms</div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Signal Type Breakdown */}
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                    <p className="text-sm font-bold text-slate-800 mb-1">Signal Type Alarm Count</p>
                    <p className="text-xs text-slate-400 mb-4">How many times each ARGUS signal type fired across the portfolio</p>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        {SIGNAL_TYPES.map(type => {
                            const count = signalTypeCounts[type] || 0;
                            const affectedScores = ALL_SIGNALS.filter(s => s.signalType === type).map(s => CHURN_DATA[s.customerId]?.score || 0);
                            const avgScore = affectedScores.length ? Math.round(affectedScores.reduce((a, b) => a + b) / affectedScores.length * 100) : 0;
                            const tier = avgScore >= 80 ? 'critical' : avgScore >= 65 ? 'high' : avgScore >= 45 ? 'medium' : 'low';
                            return (
                                <div key={type} className="flex items-start gap-3 p-3 rounded-lg border border-slate-100 bg-slate-50">
                                    <div className="w-8 h-8 rounded-md flex items-center justify-center shrink-0 text-white text-sm font-black" style={{ background: TIER_COLOR[tier] }}>
                                        {count}
                                    </div>
                                    <div>
                                        <div className="text-xs font-semibold text-slate-700 capitalize">{type.replace(/_/g, ' ')}</div>
                                        {count > 0 && <div className="text-[10px] text-slate-400">Avg churn {avgScore}%</div>}
                                        {count === 0 && <div className="text-[10px] text-slate-300">No active alarms</div>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg w-fit">
                    {(['alarms', 'matrix', 'coverage'] as const).map(tab => (
                        <button key={tab} onClick={() => setActiveTab(tab)}
                            className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-colors ${activeTab === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                            {tab === 'alarms' ? 'Active Alarms' : tab === 'matrix' ? 'Customer Risk Grid' : 'Signal Coverage Map'}
                        </button>
                    ))}
                </div>

                {/* ACTIVE ALARMS TAB */}
                {activeTab === 'alarms' && (
                    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                            <div>
                                <p className="text-sm font-bold text-slate-800">CUSUM / BOCPD / SPRT Alarm Feed</p>
                                <p className="text-xs text-slate-400">All {ALL_SIGNALS.length} active signals · sorted by CUSUM excess (σ above threshold)</p>
                            </div>
                            <div className="text-[10px] text-slate-400">Auto-refreshes · 60s</div>
                        </div>
                        <div className="divide-y divide-slate-50">
                            {[...ALL_SIGNALS].sort((a, b) => (b.cusumValue - b.threshold) - (a.cusumValue - a.threshold)).map((sig, i) => {
                                const cust = CHURN_DATA[sig.customerId];
                                const excess = sig.cusumValue - sig.threshold;
                                const fillPct = Math.min(100, (sig.cusumValue / (sig.threshold * 2)) * 100);
                                return (
                                    <div key={i} className="px-5 py-3.5 hover:bg-slate-50 transition-colors">
                                        <div className="flex items-start gap-4">
                                            <div className="shrink-0 text-center w-10">
                                                <div className="text-xs font-black" style={{ color: TIER_COLOR[cust?.tier || 'low'] }}>
                                                    {cust ? Math.round(cust.score * 100) : 0}%
                                                </div>
                                                <div className="text-[9px] text-slate-400">score</div>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                    <span className="text-xs font-bold text-slate-900">{cust?.name || sig.customerId}</span>
                                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${TIER_BG[cust?.tier || 'low']}`}>
                                                        {cust?.tier?.toUpperCase()}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400">{sig.customerId}</span>
                                                    <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: METHOD_COLORS[sig.method] + '20', color: METHOD_COLORS[sig.method] }}>
                                                        {sig.method}
                                                    </span>
                                                </div>
                                                <div className="text-xs font-semibold text-slate-600 capitalize mb-1">{sig.signalType.replace(/_/g, ' ')}</div>
                                                <div className="text-[10px] text-slate-400 mb-2">{sig.evidence}</div>
                                                <div className="flex items-center gap-3">
                                                    <div className="flex-1 max-w-48">
                                                        <div className="flex items-center justify-between text-[9px] text-slate-400 mb-0.5">
                                                            <span>CUSUM: {sig.cusumValue.toFixed(1)}σ</span>
                                                            <span>Threshold: {sig.threshold.toFixed(1)}σ</span>
                                                        </div>
                                                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                            <div className="h-full rounded-full" style={{ width: `${fillPct}%`, background: excess > 2 ? '#ef4444' : excess > 1 ? '#f97316' : '#eab308' }} />
                                                        </div>
                                                    </div>
                                                    <span className="text-xs font-bold" style={{ color: excess > 2 ? '#ef4444' : excess > 1 ? '#f97316' : '#eab308' }}>
                                                        +{excess.toFixed(1)}σ excess
                                                    </span>
                                                    <span className="text-[10px] text-slate-400">Conf: {Math.round(sig.confidence * 100)}%</span>
                                                    <Link href={`/customers/${sig.customerId}`} className="ml-auto text-[10px] text-blue-600 hover:text-blue-800 flex items-center gap-1">
                                                        View <ExternalLink className="w-2.5 h-2.5" />
                                                    </Link>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* CUSTOMER RISK GRID TAB */}
                {activeTab === 'matrix' && (
                    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
                            <p className="text-sm font-bold text-slate-800">All 20 Customers · Risk Status</p>
                            <p className="text-xs text-slate-400">FusionXV2 score · active signal count · click to view customer detail</p>
                        </div>
                        <div className="p-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
                            {[...CUSTOMER_IDS].sort((a, b) => (CHURN_DATA[b]?.score || 0) - (CHURN_DATA[a]?.score || 0)).map(id => {
                                const c = CHURN_DATA[id];
                                const signals = ALL_SIGNALS.filter(s => s.customerId === id);
                                const color = TIER_COLOR[c.tier];
                                return (
                                    <Link key={id} href={`/customers/${id}`}>
                                        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-[10px] font-bold text-slate-400">{id.replace('C-0000', 'C-')}</span>
                                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: color + '20', color }}>
                                                    {c.tier.toUpperCase()}
                                                </span>
                                            </div>
                                            <div className="text-sm font-bold text-slate-800 mb-0.5 truncate">{c.name}</div>
                                            <div className="text-[10px] text-slate-400 mb-2">{c.segment}</div>
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                                    <div className="h-full rounded-full" style={{ width: `${c.score * 100}%`, background: color }} />
                                                </div>
                                                <span className="text-xs font-black" style={{ color }}>{Math.round(c.score * 100)}%</span>
                                            </div>
                                            {signals.length > 0 ? (
                                                <div className="mt-2 flex flex-wrap gap-1">
                                                    {signals.slice(0, 3).map((s, i) => (
                                                        <span key={i} className="text-[8px] font-semibold px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 capitalize">
                                                            {s.signalType.split('_')[0]}
                                                        </span>
                                                    ))}
                                                    {signals.length > 3 && <span className="text-[8px] text-slate-400">+{signals.length - 3}</span>}
                                                </div>
                                            ) : (
                                                <div className="mt-2 text-[9px] text-emerald-600 font-semibold flex items-center gap-1">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" /> No active signals
                                                </div>
                                            )}
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* SIGNAL COVERAGE MAP TAB */}
                {activeTab === 'coverage' && (
                    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
                            <p className="text-sm font-bold text-slate-800">Signal Coverage Matrix</p>
                            <p className="text-xs text-slate-400">Customer × Signal type · cell intensity = detection confidence. Blank = no alarm fired.</p>
                        </div>
                        <div className="overflow-x-auto p-5">
                            <table className="text-[10px] border-collapse w-full">
                                <thead>
                                    <tr>
                                        <th className="text-left text-slate-400 font-semibold pr-4 pb-2 w-32">Customer</th>
                                        {SIGNAL_TYPES.map(t => (
                                            <th key={t} className="text-center font-semibold text-slate-500 pb-2 px-1 w-16">
                                                <div className="writing-vertical" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap', maxHeight: 80, overflow: 'hidden' }}>
                                                    {t.replace(/_/g, ' ')}
                                                </div>
                                            </th>
                                        ))}
                                        <th className="text-right pl-4 pb-2 text-slate-400 font-semibold">Score</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {byScore.map(id => {
                                        const c = CHURN_DATA[id];
                                        return (
                                            <tr key={id} className="border-t border-slate-50 hover:bg-slate-50 transition-colors">
                                                <td className="pr-4 py-1.5">
                                                    <div className="font-semibold text-slate-700">{c.name.split(' ')[0]}</div>
                                                    <div className="text-slate-400">{id.replace('C-0000', 'C-')}</div>
                                                </td>
                                                {SIGNAL_TYPES.map(type => {
                                                    const conf = signalMatrix[id]?.[type];
                                                    return (
                                                        <td key={type} className="px-1 py-1.5 text-center">
                                                            {conf ? (
                                                                <div className="mx-auto w-8 h-8 rounded-md flex items-center justify-center font-bold"
                                                                    style={{ background: TIER_COLOR[c.tier] + Math.round(conf * 255).toString(16).padStart(2, '0'), color: conf > 0.7 ? 'white' : TIER_COLOR[c.tier] }}>
                                                                    {Math.round(conf * 100)}
                                                                </div>
                                                            ) : (
                                                                <div className="mx-auto w-8 h-8 rounded-md bg-slate-100" />
                                                            )}
                                                        </td>
                                                    );
                                                })}
                                                <td className="pl-4 py-1.5 text-right">
                                                    <span className="font-black" style={{ color: TIER_COLOR[c.tier] }}>{Math.round(c.score * 100)}%</span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            <div className="mt-4 flex items-center gap-4 text-[10px] text-slate-400">
                                <span>Cell value = detection confidence (%). Colour intensity scales with confidence.</span>
                                <div className="flex items-center gap-2 ml-auto">
                                    {Object.entries(TIER_COLOR).map(([tier, color]) => (
                                        <span key={tier} className="flex items-center gap-1">
                                            <span className="w-2 h-2 rounded" style={{ background: color }} />
                                            {tier}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Live Warnings Feed from API */}
                {warnings.length > 0 && (
                    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                            <p className="text-sm font-bold text-slate-800">Live Warning Feed</p>
                            <span className="text-xs text-slate-400">· {warnings.length} active · from ARGUS API</span>
                        </div>
                        <div className="divide-y divide-slate-50 max-h-80 overflow-y-auto">
                            {warnings.map((w, i) => (
                                <div key={i} className="px-5 py-3 flex items-start gap-3">
                                    <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${w.severity === 'critical' ? 'bg-red-500' : w.severity === 'high' ? 'bg-orange-500' : 'bg-yellow-500'}`} />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-xs font-semibold text-slate-800">{w.title}</span>
                                            <span className="text-[9px] text-slate-400 shrink-0">{timeAgo(w.timestamp)}</span>
                                        </div>
                                        <p className="text-[10px] text-slate-500 mt-0.5">{w.description}</p>
                                        <div className="flex items-center gap-3 mt-1 text-[9px] text-slate-400">
                                            <span className="capitalize">{w.signal_type?.replace(/_/g, ' ')}</span>
                                            <span>{w.affected_customers} customer{w.affected_customers !== 1 ? 's' : ''}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </ProtectedRoute>
    );
}
