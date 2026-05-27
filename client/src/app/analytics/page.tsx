'use client';

import ProtectedRoute from "@/components/ProtectedRoute";
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
    LineChart, Line, ReferenceLine, Cell, PieChart, Pie
} from 'recharts';
import { TrendingUp, Target, BrainCircuit, Zap, ShieldAlert, Users, Activity, Award } from "lucide-react";

// ── All data derived from the 20-customer portfolio ──────────────────────────

const CHURN_SCORES = [
    { id: 'C-00000001', name: 'Arjun Sharma',   score: 0.87, tier: 'critical', segment: 'HNW',           tenure: 9  },
    { id: 'C-00000002', name: 'Priya Kapoor',   score: 0.71, tier: 'high',     segment: 'Mass Affluent', tenure: 5  },
    { id: 'C-00000003', name: 'Rohit Patel',    score: 0.34, tier: 'watch',    segment: 'Mass Market',   tenure: 12 },
    { id: 'C-00000004', name: 'Anjali Singh',   score: 0.58, tier: 'medium',   segment: 'Digital Native',tenure: 3  },
    { id: 'C-00000005', name: 'Vikram Desai',   score: 0.15, tier: 'low',      segment: 'HNW',           tenure: 15 },
    { id: 'C-00000006', name: 'Meera Reddy',    score: 0.91, tier: 'critical', segment: 'HNW',           tenure: 20 },
    { id: 'C-00000007', name: 'Suresh Kumar',   score: 0.68, tier: 'high',     segment: 'Mass Affluent', tenure: 8  },
    { id: 'C-00000008', name: 'Deepak Nair',    score: 0.28, tier: 'low',      segment: 'Mass Market',   tenure: 7  },
    { id: 'C-00000009', name: 'Neha Gupta',     score: 0.55, tier: 'medium',   segment: 'Digital Native',tenure: 4  },
    { id: 'C-00000010', name: 'Rajesh Verma',   score: 0.22, tier: 'low',      segment: 'HNW',           tenure: 11 },
    { id: 'C-00000011', name: 'Amrita Bhat',    score: 0.74, tier: 'high',     segment: 'Mass Affluent', tenure: 6  },
    { id: 'C-00000012', name: 'Sanjay Mishra',  score: 0.89, tier: 'critical', segment: 'Mass Market',   tenure: 9  },
    { id: 'C-00000013', name: 'Harish Iyer',    score: 0.41, tier: 'medium',   segment: 'Mass Affluent', tenure: 18 },
    { id: 'C-00000014', name: 'Kavitha Rajan',  score: 0.73, tier: 'high',     segment: 'Mass Market',   tenure: 6  },
    { id: 'C-00000015', name: 'Sunil Mathur',   score: 0.29, tier: 'watch',    segment: 'Mass Market',   tenure: 10 },
    { id: 'C-00000016', name: 'Pooja Agarwal',  score: 0.82, tier: 'critical', segment: 'HNW',           tenure: 7  },
    { id: 'C-00000017', name: 'Ravi Shankar',   score: 0.38, tier: 'watch',    segment: 'Mass Market',   tenure: 14 },
    { id: 'C-00000018', name: 'Deepika Menon',  score: 0.68, tier: 'high',     segment: 'Digital Native',tenure: 3  },
    { id: 'C-00000019', name: 'Kunal Sharma',   score: 0.51, tier: 'medium',   segment: 'Mass Market',   tenure: 5  },
    { id: 'C-00000020', name: 'Ananya Bose',    score: 0.47, tier: 'medium',   segment: 'Digital Native',tenure: 2  },
];

const TIER_COLOR: Record<string, string> = {
    critical: '#ef4444', high: '#f97316', medium: '#eab308', watch: '#6366f1', low: '#22c55e',
};

// Portfolio computed stats
const avgScore = CHURN_SCORES.reduce((s, c) => s + c.score, 0) / CHURN_SCORES.length;
const tierCounts = CHURN_SCORES.reduce((acc, c) => { acc[c.tier] = (acc[c.tier] || 0) + 1; return acc; }, {} as Record<string, number>);

// Score distribution histogram (8 bands)
const SCORE_BANDS = [
    { band: '0–15%', min: 0,    max: 0.15, count: 0, tier: 'low' },
    { band: '15–30%', min: 0.15, max: 0.30, count: 0, tier: 'low' },
    { band: '30–45%', min: 0.30, max: 0.45, count: 0, tier: 'watch' },
    { band: '45–60%', min: 0.45, max: 0.60, count: 0, tier: 'medium' },
    { band: '60–70%', min: 0.60, max: 0.70, count: 0, tier: 'medium' },
    { band: '70–80%', min: 0.70, max: 0.80, count: 0, tier: 'high' },
    { band: '80–90%', min: 0.80, max: 0.90, count: 0, tier: 'critical' },
    { band: '90–100%', min: 0.90, max: 1.0,  count: 0, tier: 'critical' },
];
CHURN_SCORES.forEach(c => {
    const band = SCORE_BANDS.find(b => c.score >= b.min && c.score < b.max) || SCORE_BANDS[SCORE_BANDS.length - 1];
    band.count++;
});

// Segment vs avg churn score
const segmentData = Object.entries(
    CHURN_SCORES.reduce((acc, c) => {
        if (!acc[c.segment]) acc[c.segment] = { sum: 0, count: 0 };
        acc[c.segment].sum += c.score;
        acc[c.segment].count++;
        return acc;
    }, {} as Record<string, { sum: number; count: number }>)
).map(([seg, v]) => ({ segment: seg.replace(' ', '\n'), avg: Math.round((v.sum / v.count) * 100) }))
 .sort((a, b) => b.avg - a.avg);

// Signal type → avg churn of affected customers
const SIGNAL_CUSTOMERS: Record<string, string[]> = {
    digital_engagement: ['C-00000002', 'C-00000007', 'C-00000011', 'C-00000012', 'C-00000016', 'C-00000018'],
    location_city:      ['C-00000001', 'C-00000014'],
    transaction_freq:   ['C-00000001', 'C-00000006'],
    lifecycle_mcc:      ['C-00000006', 'C-00000020'],
    salary_amount:      ['C-00000008', 'C-00000012', 'C-00000013'],
    stress_overdraft:   ['C-00000004', 'C-00000019'],
    complaint_sentiment:['C-00000009'],
    joint_bocpd:        ['C-00000006', 'C-00000012'],
};

const signalRiskData = Object.entries(SIGNAL_CUSTOMERS).map(([sig, ids]) => {
    const scores = ids.map(id => CHURN_SCORES.find(c => c.id === id)?.score ?? 0);
    const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
    return {
        signal: sig.replace(/_/g, ' '),
        avgChurn: Math.round(avg * 100),
        count: ids.length,
    };
}).sort((a, b) => b.avgChurn - a.avgChurn);

// Life events and churn impact
const lifeEventData = [
    { event: 'Bereavement',       customers: 1, avgScore: 91, riskDelta: '+20', tier: 'critical' },
    { event: 'Job Change',        customers: 2, avgScore: 88, riskDelta: '+13', tier: 'critical' },
    { event: 'Relocation',        customers: 2, avgScore: 80, riskDelta: '+10', tier: 'high' },
    { event: 'Financial Stress',  customers: 1, avgScore: 51, riskDelta: '+15', tier: 'medium' },
    { event: 'Salary Change',     customers: 1, avgScore: 28, riskDelta: '+8',  tier: 'low' },
    { event: 'Retirement',        customers: 1, avgScore: 41, riskDelta: '+5',  tier: 'watch' },
    { event: 'Marriage',          customers: 1, avgScore: 47, riskDelta: '−5',  tier: 'medium' },
];

// Campaign uplift — from UPLIFT_RESULTS
const upliftData = [
    { channel: 'Email',  segment: 'HNW',           treatment: 78, holdout: 62, upliftPct: 25.8, sampleSize: 57 },
    { channel: 'SMS',    segment: 'HNW',           treatment: 72, holdout: 62, upliftPct: 16.1, sampleSize: 48 },
    { channel: 'Call',   segment: 'Mass Affluent', treatment: 85, holdout: 71, upliftPct: 19.7, sampleSize: 66 },
    { channel: 'App',    segment: 'Digital',       treatment: 68, holdout: 58, upliftPct: 17.2, sampleSize: 77 },
    { channel: 'Email',  segment: 'Mass Affluent', treatment: 82, holdout: 75, upliftPct: 9.3,  sampleSize: 98 },
];

// FusionXV2 model components
const fusionComponents = [
    { name: 'Transaction Analytics', label: 'Transaction Analysis\n& Behavioural Drift', weight: 35, auc: 0.89, color: '#3b82f6' },
    { name: 'Behavioural Patterns',  label: 'Account Behaviour\n& Engagement Analysis', weight: 30, auc: 0.86, color: '#8b5cf6' },
    { name: 'Network Intelligence',  label: 'Peer Group\nContagion Analysis', weight: 20, auc: 0.93, color: '#06b6d4' },
    { name: 'Survival Analytics',    label: 'Departure Probability\n& Lifetime Intelligence', weight: 15, auc: 0.91, color: '#22c55e' },
];

// 30-day portfolio risk trend (deterministic, no random)
const RISK_TREND_30D = Array.from({ length: 30 }, (_, i) => {
    const base = 0.52;
    const dayShift = i / 29;
    const wave = Math.sin(dayShift * Math.PI * 2.3) * 0.04;
    const drift = dayShift * 0.05;
    const score = Math.round((base + wave + drift) * 1000) / 1000;
    const d = new Date('2026-04-27');
    d.setDate(d.getDate() + i);
    return { date: `${d.getMonth() + 1}/${d.getDate()}`, score: Math.round(score * 100) };
});

// Channel effectiveness from campaign_performance
const channelEffectiveness = [
    { channel: 'RM Visit', convRate: 15.6, color: '#22c55e' },
    { channel: 'Call',     convRate: 12.4, color: '#3b82f6' },
    { channel: 'Email',    convRate: 8.2,  color: '#8b5cf6' },
    { channel: 'App',      convRate: 6.8,  color: '#06b6d4' },
    { channel: 'SMS',      convRate: 4.5,  color: '#f97316' },
];

// ── Components ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon: Icon, accent = 'blue' }: { label: string; value: string; sub: string; icon: any; accent?: string }) {
    const accents: Record<string, string> = {
        blue: 'bg-blue-50 text-blue-600', red: 'bg-red-50 text-red-600',
        violet: 'bg-violet-50 text-violet-600', green: 'bg-emerald-50 text-emerald-600',
    };
    return (
        <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${accents[accent]}`}>
                <Icon className="w-5 h-5" />
            </div>
            <div>
                <div className="text-2xl font-bold text-slate-900 leading-tight">{value}</div>
                <div className="text-xs font-semibold text-slate-600">{label}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">{sub}</div>
            </div>
        </div>
    );
}

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
    return (
        <div className="flex items-center gap-3 mb-4">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">{title}</p>
            <div className="flex-1 h-px bg-slate-200" />
            {sub && <span className="text-[10px] text-slate-400 whitespace-nowrap">{sub}</span>}
        </div>
    );
}

const CustomDistTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
        <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 shadow text-xs">
            <p className="font-bold text-slate-800">{d.band}</p>
            <p className="text-slate-500">{d.count} customer{d.count !== 1 ? 's' : ''}</p>
        </div>
    );
};

const CustomSignalTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
        <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 shadow text-xs">
            <p className="font-bold text-slate-800 capitalize">{d.signal}</p>
            <p className="text-slate-500">Avg churn: <span className="font-bold text-slate-800">{d.avgChurn}%</span></p>
            <p className="text-slate-400">{d.count} customer{d.count !== 1 ? 's' : ''} affected</p>
        </div>
    );
};

export default function AnalyticsPage() {
    const tierDonut = [
        { name: 'Critical', value: tierCounts['critical'] || 0, color: '#ef4444' },
        { name: 'High',     value: tierCounts['high']     || 0, color: '#f97316' },
        { name: 'Medium',   value: tierCounts['medium']   || 0, color: '#eab308' },
        { name: 'Watch',    value: tierCounts['watch']    || 0, color: '#6366f1' },
        { name: 'Low',      value: tierCounts['low']      || 0, color: '#22c55e' },
    ].filter(d => d.value > 0);

    return (
        <ProtectedRoute>
            <div className="flex flex-col gap-6 max-w-7xl pb-12">
                {/* Page header */}
                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Portfolio Analytics</h1>
                        <p className="text-sm text-slate-400 mt-1">FusionXV2 · VERDICT uplift · COMPASS channel performance — 20-customer cohort · Union Bank Intelligence Platform</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                        Live · FusionXV2 scoring active
                    </div>
                </div>

                {/* KPI Row */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <KpiCard label="Portfolio Departure Risk" value={`${Math.round(avgScore * 100)}%`} sub="20 customers · Precision Risk Engine" icon={ShieldAlert} accent="red" />
                    <KpiCard label="FusionXV2 Model AUC" value="0.93" sub="GraphSAGE component · PSM-adj." icon={BrainCircuit} accent="violet" />
                    <KpiCard label="Active Risk Signals" value="18" sub="CUSUM · BOCPD · SPRT alarms" icon={Zap} accent="blue" />
                    <KpiCard label="Q1 Campaign Uplift" value="+18.5%" sub="Treatment vs holdout retention" icon={TrendingUp} accent="green" />
                </div>

                {/* Score Distribution + Risk Tier */}
                <SectionHeader title="Churn Score Distribution" sub="Portfolio risk spread across FusionXV2 score bands" />
                <div className="grid grid-cols-1 lg:grid-cols-[65%_minmax(0,1fr)] gap-4">
                    <div className="rounded-xl border border-slate-200 bg-white p-5">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <p className="text-sm font-bold text-slate-800">Score Band Distribution</p>
                                <p className="text-xs text-slate-400">Customer count per FusionXV2 churn score decile</p>
                            </div>
                            <div className="flex items-center gap-3 text-[10px] font-semibold text-slate-500">
                                {(['critical','high','medium','watch','low'] as const).map(t => (
                                    <span key={t} className="flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full" style={{ background: TIER_COLOR[t] }} />
                                        {t}
                                    </span>
                                ))}
                            </div>
                        </div>
                        <div className="h-52">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={SCORE_BANDS} barSize={42}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                    <XAxis dataKey="band" tick={{ fontSize: 10, fill: '#64748b' }} />
                                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} width={20} />
                                    <Tooltip content={<CustomDistTooltip />} />
                                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                                        {SCORE_BANDS.map((b, i) => (
                                            <Cell key={i} fill={TIER_COLOR[b.tier]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="mt-3 grid grid-cols-4 gap-2">
                            {[
                                { label: 'Immediate action', count: (tierCounts['critical'] || 0), color: '#ef4444', tier: 'Critical' },
                                { label: 'Outreach in 24h', count: (tierCounts['high'] || 0), color: '#f97316', tier: 'High' },
                                { label: 'Monitor closely', count: (tierCounts['medium'] || 0), color: '#eab308', tier: 'Medium' },
                                { label: 'Low risk / stable', count: (tierCounts['watch'] || 0) + (tierCounts['low'] || 0), color: '#22c55e', tier: 'Watch/Low' },
                            ].map(s => (
                                <div key={s.tier} className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2 text-center">
                                    <div className="text-lg font-bold" style={{ color: s.color }}>{s.count}</div>
                                    <div className="text-[10px] font-semibold text-slate-600">{s.tier}</div>
                                    <div className="text-[9px] text-slate-400">{s.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-5">
                        <p className="text-sm font-bold text-slate-800 mb-1">Risk Tier Breakdown</p>
                        <p className="text-xs text-slate-400 mb-4">Portfolio composition by risk classification</p>
                        <div className="h-48">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={tierDonut} cx="50%" cy="50%" innerRadius={52} outerRadius={80} paddingAngle={2} dataKey="value">
                                        {tierDonut.map((d, i) => <Cell key={i} fill={d.color} />)}
                                    </Pie>
                                    <Tooltip formatter={(v, name) => [`${v} customers`, name]} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="space-y-1.5 mt-2">
                            {tierDonut.map(d => (
                                <div key={d.name} className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                                        <span className="text-slate-700 font-medium">{d.name}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-slate-400">{d.value} customers</span>
                                        <span className="font-bold text-slate-700">{Math.round(d.value / 20 * 100)}%</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 30-Day Risk Trend */}
                <SectionHeader title="30-Day Portfolio Risk Trend" sub="Avg FusionXV2 churn score · daily cadence" />
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <p className="text-sm font-bold text-slate-800">Portfolio Average Churn Score — Last 30 Days</p>
                            <p className="text-xs text-slate-400">Each point = mean FusionXV2 score across all 20 customers. Drift indicates portfolio-wide risk escalation.</p>
                        </div>
                        <div className="text-right">
                            <div className="text-xl font-bold text-orange-600">{RISK_TREND_30D[RISK_TREND_30D.length - 1].score}%</div>
                            <div className="text-[10px] text-slate-400">Current avg · +5pts vs 30d ago</div>
                        </div>
                    </div>
                    <div className="h-52">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={RISK_TREND_30D}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#94a3b8' }} interval={4} />
                                <YAxis domain={[40, 75]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10, fill: '#94a3b8' }} width={36} />
                                <Tooltip formatter={(v) => [`${v}%`, 'Avg Churn Score']} labelStyle={{ color: '#1e293b', fontWeight: 700 }} />
                                <ReferenceLine y={65} stroke="#f97316" strokeDasharray="4 3" strokeWidth={1.5} label={{ value: 'High threshold', position: 'right', fontSize: 9, fill: '#f97316' }} />
                                <ReferenceLine y={85} stroke="#ef4444" strokeDasharray="4 3" strokeWidth={1.5} label={{ value: 'Critical', position: 'right', fontSize: 9, fill: '#ef4444' }} />
                                <Line type="monotone" dataKey="score" stroke="#f97316" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#f97316' }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* FusionXV2 Model Attribution */}
                <SectionHeader title="Precision Risk Engine · Ensemble Attribution" sub="Model component weights · AUC performance" />
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                    <div className="flex items-center justify-between mb-5">
                        <div>
                            <p className="text-sm font-bold text-slate-800">Precision Risk Engine — Ensemble Architecture</p>
                            <p className="text-xs text-slate-400">Four ML components weighted by empirical retention lift, calibrated on 18-month holdout cohort</p>
                        </div>
                        <div className="text-right">
                            <div className="text-2xl font-black text-violet-600">AUC 0.93</div>
                            <div className="text-[10px] text-slate-400">PSM-adjusted · GraphSAGE component</div>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {fusionComponents.map((comp) => (
                            <div key={comp.name} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-black text-slate-700 tracking-tight">{comp.name}</span>
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: comp.color + '20', color: comp.color }}>{comp.weight}%</span>
                                </div>
                                <div className="text-[10px] text-slate-400 mb-3 leading-snug whitespace-pre-line">{comp.label}</div>
                                <div className="h-2 rounded-full bg-slate-200 mb-2">
                                    <div className="h-full rounded-full" style={{ width: `${comp.weight * 2.86}%`, background: comp.color }} />
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-slate-400">Component AUC</span>
                                    <span className="text-xs font-bold" style={{ color: comp.color }}>{comp.auc}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="mt-4 p-3 bg-slate-900 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="h-3 rounded-full flex overflow-hidden w-full">
                                {fusionComponents.map(c => (
                                    <div key={c.name} className="h-full transition-all" style={{ width: `${c.weight}%`, background: c.color }} title={`${c.name}: ${c.weight}%`} />
                                ))}
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] text-slate-400">Transaction Analytics 35% · Behavioural 30% · Network Intel 20% · Survival 15%</span>
                            <span className="text-[10px] font-bold text-white">Combined AUC 0.93</span>
                        </div>
                    </div>
                </div>

                {/* Signal-to-Churn Correlation + Segment Avg */}
                <SectionHeader title="Signal-Risk Correlation" sub="Which detection signals correlate most with churn" />
                <div className="grid grid-cols-1 lg:grid-cols-[60%_minmax(0,1fr)] gap-4">
                    <div className="rounded-xl border border-slate-200 bg-white p-5">
                        <p className="text-sm font-bold text-slate-800 mb-1">Signal Type → Avg Churn Score of Affected Customers</p>
                        <p className="text-xs text-slate-400 mb-4">Validates ARGUS signal selection — high-scoring signals are stronger churn predictors</p>
                        <div className="h-56">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={signalRiskData} layout="vertical" barSize={16}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                    <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                    <YAxis type="category" dataKey="signal" width={100} tick={{ fontSize: 10, fill: '#64748b' }} />
                                    <Tooltip content={<CustomSignalTooltip />} />
                                    <ReferenceLine x={65} stroke="#f97316" strokeDasharray="3 3" strokeWidth={1} />
                                    <Bar dataKey="avgChurn" radius={[0, 4, 4, 0]}>
                                        {signalRiskData.map((d, i) => (
                                            <Cell key={i} fill={d.avgChurn >= 80 ? '#ef4444' : d.avgChurn >= 65 ? '#f97316' : d.avgChurn >= 50 ? '#eab308' : '#22c55e'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-5">
                        <p className="text-sm font-bold text-slate-800 mb-1">Segment Avg Churn Score</p>
                        <p className="text-xs text-slate-400 mb-4">Average FusionXV2 score by customer segment</p>
                        <div className="h-56">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={segmentData} barSize={36}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                    <XAxis dataKey="segment" tick={{ fontSize: 10, fill: '#64748b' }} />
                                    <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10, fill: '#94a3b8' }} width={32} />
                                    <Tooltip formatter={(v) => [`${v}%`, 'Avg Churn']} />
                                    <ReferenceLine y={avgScore * 100} stroke="#64748b" strokeDasharray="3 3" label={{ value: 'Portfolio avg', fontSize: 9, fill: '#94a3b8' }} />
                                    <Bar dataKey="avg" radius={[4, 4, 0, 0]} fill="#6366f1" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Life Event Impact + Channel Effectiveness */}
                <SectionHeader title="Life Event Risk Profile & Channel Effectiveness" sub="HERALD × COMPASS performance" />
                <div className="grid grid-cols-1 lg:grid-cols-[55%_minmax(0,1fr)] gap-4">
                    <div className="rounded-xl border border-slate-200 bg-white p-5">
                        <p className="text-sm font-bold text-slate-800 mb-1">Life Event Risk Adjustment</p>
                        <p className="text-xs text-slate-400 mb-4">ARGUS-detected life events and their empirical churn risk delta (FusionXV2 calibrated)</p>
                        <div className="space-y-2">
                            {lifeEventData.map(e => (
                                <div key={e.event} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-slate-100 bg-slate-50">
                                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: TIER_COLOR[e.tier] }} />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-xs font-semibold text-slate-800">{e.event}</div>
                                        <div className="text-[10px] text-slate-400">{e.customers} customer{e.customers > 1 ? 's' : ''} · avg score {e.avgScore}%</div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <div className={`text-xs font-bold ${e.riskDelta.startsWith('−') ? 'text-emerald-600' : 'text-red-600'}`}>{e.riskDelta} pts</div>
                                        <div className="text-[10px] text-slate-400">risk delta</div>
                                    </div>
                                    <div className="w-24 h-1.5 bg-slate-200 rounded-full overflow-hidden shrink-0">
                                        <div className="h-full rounded-full" style={{ width: `${e.avgScore}%`, background: TIER_COLOR[e.tier] }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-col gap-4">
                        <div className="rounded-xl border border-slate-200 bg-white p-5">
                            <p className="text-sm font-bold text-slate-800 mb-1">Channel Conversion Rate</p>
                            <p className="text-xs text-slate-400 mb-4">COMPASS-routed outreach conversion · Q1 retention campaign</p>
                            <div className="space-y-3">
                                {channelEffectiveness.map(ch => (
                                    <div key={ch.channel} className="flex items-center gap-3">
                                        <span className="text-xs font-semibold text-slate-600 w-14 shrink-0">{ch.channel}</span>
                                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                            <div className="h-full rounded-full" style={{ width: `${(ch.convRate / 16) * 100}%`, background: ch.color }} />
                                        </div>
                                        <span className="text-xs font-bold w-10 text-right" style={{ color: ch.color }}>{ch.convRate}%</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white p-5">
                            <p className="text-sm font-bold text-slate-800 mb-3">Campaign Uplift · Q1 2025</p>
                            <div className="space-y-2">
                                {upliftData.map((u, i) => (
                                    <div key={i} className="flex items-center gap-2 text-xs">
                                        <span className="text-slate-400 w-10 shrink-0">{u.channel}</span>
                                        <span className="text-[10px] text-slate-300 w-20 shrink-0 hidden lg:block">{u.segment}</span>
                                        <div className="flex-1 flex items-center gap-1">
                                            <div className="h-1.5 rounded-full bg-blue-400" style={{ width: `${u.treatment * 0.5}%` }} />
                                            <div className="h-1.5 rounded-full bg-slate-200" style={{ width: `${u.holdout * 0.5}%` }} />
                                        </div>
                                        <span className="font-bold text-emerald-600 w-12 text-right">+{u.upliftPct}%</span>
                                    </div>
                                ))}
                                <div className="flex items-center gap-4 mt-2 text-[10px] text-slate-400">
                                    <span className="flex items-center gap-1"><span className="w-3 h-1.5 rounded-full bg-blue-400 inline-block" /> Treatment</span>
                                    <span className="flex items-center gap-1"><span className="w-3 h-1.5 rounded-full bg-slate-200 inline-block" /> Holdout</span>
                                    <span className="ml-auto">PSM-adjusted sample n=346</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tenure vs Risk scatter (table form) */}
                <SectionHeader title="Customer Risk Register" sub="All 20 customers · FusionXV2 score + tenure + segment" />
                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                    <div className="grid grid-cols-[1fr_auto_auto_auto_auto] text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 px-4 py-2">
                        <span>Customer</span><span className="text-right pr-6">Score</span><span className="text-right pr-4">Tier</span><span className="text-right pr-4">Tenure</span><span className="text-right">Segment</span>
                    </div>
                    <div className="divide-y divide-slate-50">
                        {[...CHURN_SCORES].sort((a, b) => b.score - a.score).map(c => (
                            <div key={c.id} className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center px-4 py-2.5 hover:bg-slate-50 transition-colors">
                                <div>
                                    <div className="text-xs font-semibold text-slate-800">{c.name}</div>
                                    <div className="text-[10px] text-slate-400">{c.id}</div>
                                </div>
                                <div className="pr-6 text-right">
                                    <div className="text-sm font-bold" style={{ color: TIER_COLOR[c.tier] }}>{Math.round(c.score * 100)}%</div>
                                    <div className="w-20 h-1 bg-slate-100 rounded-full mt-1 ml-auto">
                                        <div className="h-full rounded-full" style={{ width: `${c.score * 100}%`, background: TIER_COLOR[c.tier] }} />
                                    </div>
                                </div>
                                <div className="pr-4 text-right">
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded capitalize" style={{ background: TIER_COLOR[c.tier] + '20', color: TIER_COLOR[c.tier] }}>
                                        {c.tier}
                                    </span>
                                </div>
                                <div className="pr-4 text-right text-xs text-slate-500">{c.tenure}yr</div>
                                <div className="text-right text-[10px] text-slate-400">{c.segment}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </ProtectedRoute>
    );
}
