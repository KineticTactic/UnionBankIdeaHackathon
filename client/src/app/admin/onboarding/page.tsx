'use client';

import { useState, useMemo, useEffect } from 'react';
import { api } from '@/lib/api';
import {
  Activity, AlertTriangle, CheckCircle, ChevronRight, Inbox,
  SlidersHorizontal, RefreshCw, Building2, Smartphone,
  Globe, Plus, UserCheck, Sparkles, Clock, TrendingUp, Award,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Application {
  id: string;
  full_name: string;
  age: number;
  city: string;
  balance: number;
  income: number;
  product_count: number;
  channel: 'branch' | 'online' | 'mobile';
  arrived_at: string;
  suggested_segment: string;
  status: 'pending' | 'assigned';
  assigned_rm?: string;
  customer_id?: string;
}

// ── Mock Kafka feed (core-banking-events topic) ───────────────────────────────
const mkTime = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

const INITIAL_FEED: Application[] = [
  { id: 'APP-2847', full_name: 'Kavita Mehta',  age: 42, city: 'Mumbai',    balance: 5_000_000,  income: 3_600_000, product_count: 3, channel: 'branch', arrived_at: mkTime(2),  suggested_segment: 'HNW',           status: 'pending' },
  { id: 'APP-2846', full_name: 'Raju Prasad',   age: 27, city: 'Hyderabad', balance: 80_000,     income: 240_000,   product_count: 1, channel: 'online', arrived_at: mkTime(7),  suggested_segment: 'Mass Market',   status: 'pending' },
  { id: 'APP-2845', full_name: 'Vivek Agarwal', age: 38, city: 'Delhi',     balance: 1_200_000,  income: 1_800_000, product_count: 2, channel: 'online', arrived_at: mkTime(14), suggested_segment: 'Mass Affluent', status: 'pending' },
  { id: 'APP-2844', full_name: 'Meera Nair',    age: 45, city: 'Bangalore', balance: 850_000,    income: 2_400_000, product_count: 4, channel: 'branch', arrived_at: mkTime(31), suggested_segment: 'SME',           status: 'pending' },
  { id: 'APP-2843', full_name: 'Arjun Singh',   age: 55, city: 'Chennai',   balance: 12_000_000, income: 8_000_000, product_count: 6, channel: 'mobile', arrived_at: mkTime(58), suggested_segment: 'HNW',           status: 'assigned', assigned_rm: 'Priya Menon', customer_id: 'CUST-049' },
];

const SIM_QUEUE: Application[] = [
  { id: 'APP-2848', full_name: 'Divya Krishnan', age: 33, city: 'Pune',      balance: 450_000,   income: 900_000,   product_count: 2, channel: 'mobile', arrived_at: '', suggested_segment: 'Mass Affluent', status: 'pending' },
  { id: 'APP-2849', full_name: 'Suresh Reddy',   age: 50, city: 'Hyderabad', balance: 7_500_000, income: 5_000_000, product_count: 5, channel: 'branch', arrived_at: '', suggested_segment: 'HNW',           status: 'pending' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(iso: string) {
  if (!iso) return '';
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ${m % 60}m ago`;
}
function fmtBal(n: number) {
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(1)} Cr`;
  if (n >= 100_000)    return `₹${(n / 100_000).toFixed(1)} L`;
  if (n >= 1_000)      return `₹${(n / 1_000).toFixed(0)}K`;
  return `₹${n}`;
}
function normW(w: { fit: number; capacity: number; fairness: number }) {
  const s = w.fit + w.capacity + w.fairness || 1;
  return { fit: w.fit / s, capacity: w.capacity / s, fairness: w.fairness / s };
}
function liveTotal(rm: any, w: { fit: number; capacity: number; fairness: number }) {
  return w.fit * rm.breakdown.fit + w.capacity * rm.breakdown.capacity + w.fairness * rm.breakdown.fairness;
}
const initials = (n: string) => n.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();

const CHANNEL = {
  branch: { icon: Building2,  label: 'Branch' },
  online: { icon: Globe,      label: 'Online' },
  mobile: { icon: Smartphone, label: 'Mobile' },
} as const;

const SEGMENTS = ['HNW', 'Mass Affluent', 'SME', 'Mass Market'] as const;

const SEG_PILL: Record<string, string> = {
  HNW:            'bg-[#6B132B]/[0.08] text-[#6B132B]',
  'Mass Affluent':'bg-[#B46B3E]/[0.10] text-[#B46B3E]',
  SME:            'bg-[#FAF0E6] text-[#B46B3E]',
  'Mass Market':  'bg-[#F5F4F2] text-[#4A4644]',
};
const SEG_SELECTED: Record<string, string> = {
  HNW:            'bg-[#6B132B] border-[#6B132B] text-white',
  'Mass Affluent':'bg-[#B46B3E] border-[#B46B3E] text-white',
  SME:            'bg-[#2A161B] border-[#2A161B] text-white',
  'Mass Market':  'bg-[#4A4644] border-[#4A4644] text-white',
};
const TIER: Record<string, { badge: string; dot: string }> = {
  PRIORITY: { badge: 'bg-[#B46B3E]/[0.10] text-[#B46B3E] border-[#B46B3E]/20',       dot: 'bg-[#B46B3E]' },
  ESCALATE: { badge: 'bg-[#6B132B]/[0.08] text-[#6B132B] border-[#6B132B]/20', dot: 'bg-[#6B132B]' },
  STANDARD: { badge: 'bg-[#FAF0E6] text-[#B46B3E] border-[#F4D9C0]',  dot: 'bg-[#F4D9C0]' },
  MONITOR:  { badge: 'bg-[#6B132B]/[0.08] text-[#6B132B] border-[#6B132B]/20',     dot: 'bg-[#6B132B]' },
  NONE:     { badge: 'bg-[#F5F4F2] text-[#6B6562] border-[#E5E0DF]', dot: 'bg-[#C9C3C0]' },
};

// ── Reusable bars ─────────────────────────────────────────────────────────────
function ScoreBar({ label, value, dark }: { label: string; value: number; dark?: boolean }) {
  const COLOR: Record<string, string> = { Fit: 'bg-[#6B132B]', Capacity: 'bg-[#B46B3E]', Fairness: 'bg-[#2A161B]' };
  return (
    <div className="flex items-center gap-2">
      <span className={`text-[11px] w-16 shrink-0 ${dark ? 'text-white/50' : 'text-[#8B8481]'}`}>{label}</span>
      <div className={`flex-1 h-2 rounded-full overflow-hidden ${dark ? 'bg-white/10' : 'bg-[#F5F4F2]'}`}>
        <div className={`h-full rounded-full transition-all duration-500 ${COLOR[label]}`} style={{ width: `${Math.round(value * 100)}%` }} />
      </div>
      <span className={`text-[11px] font-bold w-7 text-right ${dark ? 'text-white/70' : 'text-[#6B6562]'}`}>{Math.round(value * 100)}</span>
    </div>
  );
}

function RankRow({ rm, w, maxT, rank, top }: { rm: any; w: any; maxT: number; rank: number; top: boolean }) {
  const wn = normW(w);
  const f = rm.breakdown.fit * wn.fit, c = rm.breakdown.capacity * wn.capacity, fa = rm.breakdown.fairness * wn.fairness;
  const tot = f + c + fa, sc = maxT > 0 ? 100 / maxT : 100;
  return (
    <div className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${top ? 'bg-[#6B132B]/5 ring-1 ring-[#6B132B]/10' : 'hover:bg-[#FAFAF9]'}`}>
      <span className="text-[11px] text-[#C9C3C0] w-3 shrink-0">{rank}</span>
      <span className={`text-[12px] w-24 truncate shrink-0 ${top ? 'font-bold text-[#6B132B]' : 'text-[#6B6562] font-medium'}`}>
        {rm.rmName}{top && <Award className="w-3 h-3 inline ml-1 text-[#B46B3E]" />}
      </span>
      <div className="flex-1 h-3 bg-[#F5F4F2] rounded-full overflow-hidden flex min-w-0">
        <div className="h-full bg-[#6B132B] transition-all duration-500 shrink-0" style={{ width: `${f * sc}%` }} />
        <div className="h-full bg-[#B46B3E] transition-all duration-500 shrink-0"    style={{ width: `${c * sc}%` }} />
        <div className="h-full bg-[#2A161B] transition-all duration-500 shrink-0" style={{ width: `${fa * sc}%` }} />
      </div>
      <span className={`text-[12px] font-bold w-9 text-right shrink-0 tabular-nums ${top ? 'text-[#6B132B]' : 'text-[#8B8481]'}`}>{Math.round(tot * 100)}%</span>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const [feed, setFeed]       = useState<Application[]>(INITIAL_FEED);
  const [simIdx, setSimIdx]   = useState(0);
  const [selId, setSelId]     = useState<string | null>(null);
  const [segment, setSegment] = useState('');
  const [segDirty, setSegDirty] = useState(false);
  const [weights, setWeights] = useState({ fit: 0.35, capacity: 0.40, fairness: 0.25 });
  const [result, setResult]   = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [overrideRM, setOverrideRM] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [toast, setToast]     = useState('');

  const sel = feed.find(a => a.id === selId) || null;

  useEffect(() => {
    api.getAssignmentWeights()
      .then((r: any) => { if (r?.weights) setWeights(r.weights); else if (r?.fit != null) setWeights(r); })
      .catch(() => {});
  }, []);

  const reranked = useMemo(() => {
    if (!result?.all) return [];
    const wn = normW(weights);
    return [...result.all].map((rm: any) => ({ ...rm, lt: liveTotal(rm, wn) })).sort((a: any, b: any) => b.lt - a.lt);
  }, [result, weights]);

  const top1 = reranked[0], top2 = reranked[1], top3 = reranked[2];
  const maxT = top1?.lt ?? 1;
  const wn = normW(weights);
  const wPct = { fit: Math.round(wn.fit * 100), capacity: Math.round(wn.capacity * 100), fairness: Math.round(wn.fairness * 100) };

  // KPIs
  const pending  = feed.filter(a => a.status === 'pending').length;
  const assignedN = feed.filter(a => a.status === 'assigned').length;

  // ── Handlers ─────────────────────────────────────────────────────────────
  const callRecommend = async (app: Application, seg: string) => {
    setLoading(true); setResult(null); setOverrideRM(null);
    try {
      const data = await api.recommendRM({
        full_name: app.full_name, segment: seg, balance: app.balance, income: app.income,
        city: app.city, product_count: app.product_count, age: app.age,
      });
      setResult(data);
    } catch { /* demo resilient */ }
    finally { setLoading(false); }
  };

  const selectApp = (app: Application) => {
    setSelId(app.id); setResult(null); setOverrideRM(null); setOverrideReason('');
    setSegDirty(false); setSegment(app.suggested_segment);
    if (app.status === 'pending') callRecommend(app, app.suggested_segment);
  };

  const handleSegChange = (seg: string) => {
    if (seg === segment) return;
    setSegment(seg);
    setSegDirty(seg !== sel?.suggested_segment);
    if (sel?.status === 'pending') callRecommend(sel, seg);
  };

  const handleAssign = async (rmName: string, overridden: boolean) => {
    if (!sel || (overridden && !overrideReason.trim())) return;
    setAssigning(true);
    try {
      const customer = {
        ...(result?.customer || {}), full_name: sel.full_name, segment,
        balance: sel.balance, income: sel.income, city: sel.city,
        product_count: sel.product_count, age: sel.age,
      };
      const res = await api.assignRM(customer, rmName, overridden, overrideReason || undefined);
      setFeed(prev => prev.map(a => a.id === sel.id ? { ...a, status: 'assigned', assigned_rm: rmName, customer_id: res.customer_id } : a));
      setToast(`${res.customer_id} assigned to ${rmName}`);
      setTimeout(() => setToast(''), 5000);
    } catch { /* silent */ }
    finally { setAssigning(false); setOverrideRM(null); setOverrideReason(''); }
  };

  const simulate = () => {
    if (simIdx >= SIM_QUEUE.length) return;
    setFeed(prev => [{ ...SIM_QUEUE[simIdx], arrived_at: new Date().toISOString() }, ...prev]);
    setSimIdx(i => i + 1);
  };

  return (
    <div className="p-6 space-y-5">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#2A161B] flex items-center gap-2.5">
            New Account Onboarding
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#B46B3E]/[0.10] border border-[#B46B3E]/20 text-[10px] font-bold text-[#B46B3E] uppercase tracking-widest">
              <span className="w-1.5 h-1.5 rounded-full bg-[#B46B3E] animate-pulse" /> Kafka Live
            </span>
          </h1>
          <p className="text-[#8B8481] text-sm mt-0.5">
            Review incoming applications · classify segment · assign the right RM
          </p>
        </div>
        <div className="flex items-center gap-3">
          {toast && (
            <span className="flex items-center gap-1.5 px-3 py-2 bg-[#B46B3E]/[0.10] border border-[#B46B3E]/20 rounded-md text-[12px] font-semibold text-[#B46B3E]">
              <CheckCircle className="w-3.5 h-3.5" /> {toast}
            </span>
          )}
          <button onClick={simulate} disabled={simIdx >= SIM_QUEUE.length}
            className="flex items-center gap-2 px-3 py-2 rounded-md border border-[#E5E0DF] bg-white text-[#6B6562] hover:text-[#2A161B] text-xs transition-all disabled:opacity-40">
            <Plus className="w-3.5 h-3.5" /> Simulate Arrival
          </button>
        </div>
      </div>

      {/* ── KPI row ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Pending Review',  value: pending,   icon: Inbox,        accent: 'border-l-[#B46B3E]' },
          { label: 'Assigned',        value: assignedN, icon: UserCheck,    accent: 'border-l-[#6B132B]' },
          { label: 'Topic',           value: 'core-banking-events', icon: Activity, accent: 'border-l-[#6B132B]' },
          { label: 'RMs Available',   value: 8,         icon: TrendingUp,   accent: 'border-l-[#B46B3E]' },
        ].map(c => (
          <div key={c.label} className={`bg-white rounded-md border border-[#E5E0DF] p-5 border-l-4 ${c.accent}`}>
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-[#8B8481] uppercase tracking-wide mb-1">{c.label}</p>
                <p className="font-bold text-[#2A161B] text-2xl tabular-nums">{c.value}</p>
              </div>
              <c.icon className="w-5 h-5 text-[#C9C3C0] mt-1 shrink-0" />
            </div>
          </div>
        ))}
      </div>

      {/* ── Master-detail ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[340px_1fr] gap-5 items-start">

        {/* LEFT — Feed */}
        <div className="bg-white rounded-md border border-[#E5E0DF] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E5E0DF] flex items-center justify-between">
            <p className="text-[12px] font-bold text-[#2A161B] uppercase tracking-wide">Application Queue</p>
            <span className="text-[11px] font-semibold text-[#B46B3E] bg-[#FAF0E6] px-2 py-0.5 rounded-full">{pending} pending</span>
          </div>
          <div className="divide-y divide-[#E5E0DF] max-h-[640px] overflow-y-auto">
            {feed.map(app => {
              const C = CHANNEL[app.channel];
              const active = selId === app.id;
              return (
                <button key={app.id} onClick={() => selectApp(app)}
                  className={`w-full text-left px-4 py-3.5 transition-all relative ${active ? 'bg-[#6B132B]/[0.04]' : 'hover:bg-[#FAFAF9]'}`}>
                  {active && <span className="absolute left-0 top-0 bottom-0 w-1 bg-[#6B132B]" />}
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${app.status === 'assigned' ? 'bg-[#B46B3E]/[0.10] text-[#B46B3E]' : 'bg-[#6B132B] text-white'}`}>
                      {initials(app.full_name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[13px] font-bold text-[#2A161B] truncate">{app.full_name}</p>
                        <span className="text-[10px] text-[#8B8481] shrink-0 flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" />{timeAgo(app.arrived_at)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-[#8B8481] mt-0.5">
                        <C.icon className="w-3 h-3 shrink-0" />
                        <span className="text-[10px]">{app.id}</span>
                        <span>·</span>
                        <span className="font-semibold text-[#6B6562]">{fmtBal(app.balance)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2 pl-12">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${SEG_PILL[app.suggested_segment]}`}>
                      {app.suggested_segment}
                    </span>
                    {app.status === 'assigned'
                      ? <span className="flex items-center gap-1 text-[10px] font-bold text-[#B46B3E]"><UserCheck className="w-3 h-3" /> {app.assigned_rm?.split(' ')[0]}</span>
                      : <span className="flex items-center gap-1 text-[10px] font-bold text-[#B46B3E]"><span className="w-1.5 h-1.5 rounded-full bg-[#B46B3E] animate-pulse" /> Pending</span>
                    }
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* RIGHT — Detail */}
        {!sel ? (
          <div className="bg-white rounded-md border border-[#E5E0DF] flex flex-col items-center justify-center py-24 text-[#C9C3C0] gap-3">
            <Inbox className="w-14 h-14" />
            <p className="text-[15px] font-semibold text-[#8B8481]">Select an application to review</p>
            <p className="text-[12px] text-[#8B8481]">GENESIS scores cold-start risk · RM ranking follows instantly</p>
          </div>
        ) : (
          <div className="space-y-5">

            {/* Customer header card */}
            <div className="bg-white rounded-md border border-[#E5E0DF] p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 min-w-0">
                  <div className="w-14 h-14 rounded-full bg-[#6B132B] flex items-center justify-center text-white text-base font-bold shrink-0">
                    {initials(sel.full_name)}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-[22px] font-bold text-[#2A161B] leading-tight">{sel.full_name}</h2>
                    <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-[12px] text-[#8B8481] mt-1">
                      <span>{sel.id}</span><span>·</span>
                      <span className="capitalize flex items-center gap-1">{(() => { const I = CHANNEL[sel.channel].icon; return <I className="w-3 h-3" />; })()}{CHANNEL[sel.channel].label}</span><span>·</span>
                      <span>{timeAgo(sel.arrived_at)}</span>
                    </div>
                  </div>
                </div>
                {sel.status === 'assigned' && (
                  <div className="shrink-0 flex items-center gap-2.5 px-3 py-2 bg-[#B46B3E]/[0.10] border border-[#B46B3E]/20 rounded-md">
                    <UserCheck className="w-5 h-5 text-[#B46B3E]" />
                    <div>
                      <p className="text-[9px] text-[#B46B3E] font-bold uppercase tracking-wide">Assigned</p>
                      <p className="text-[13px] font-bold text-[#2A161B] leading-tight">{sel.assigned_rm}</p>
                      {sel.customer_id && <p className="text-[10px] text-[#B46B3E]">{sel.customer_id}</p>}
                    </div>
                  </div>
                )}
              </div>

              {/* Quick facts */}
              <div className="grid grid-cols-4 gap-3 mt-5">
                {[
                  { label: 'Balance',  value: fmtBal(sel.balance) },
                  { label: 'Income/yr',value: sel.income ? fmtBal(sel.income) : '—' },
                  { label: 'Age',      value: sel.age },
                  { label: 'Products', value: sel.product_count },
                ].map(f => (
                  <div key={f.label} className="bg-[#FAFAF9] rounded-lg p-3 text-center">
                    <p className="text-[16px] font-bold text-[#2A161B] tabular-nums">{f.value}</p>
                    <p className="text-[10px] text-[#8B8481] uppercase tracking-wide mt-0.5">{f.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Classify segment */}
            <div className="bg-white rounded-md border border-[#E5E0DF] p-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[13px] font-bold text-[#2A161B]">Classify Customer Segment</p>
                <span className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full bg-[#FAF0E6] border border-[#F4D9C0] text-[#B46B3E] font-semibold">
                  <Sparkles className="w-3 h-3" /> AI suggests {sel.suggested_segment}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {SEGMENTS.map(seg => {
                  const active = segment === seg;
                  return (
                    <button key={seg} onClick={() => handleSegChange(seg)} disabled={sel.status === 'assigned'}
                      className={`py-3 px-2 rounded-md border-2 text-[13px] font-bold transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
                        active ? `${SEG_SELECTED[seg]}` : 'bg-white border-[#E5E0DF] text-[#6B6562] hover:border-[#C9C3C0] hover:bg-[#FAFAF9]'
                      }`}>
                      {seg}
                    </button>
                  );
                })}
              </div>
              {segDirty && (
                <p className="text-[11px] text-[#B46B3E] mt-3 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> Overriding AI suggestion ({sel.suggested_segment} → {segment}) — recommendation updated.
                </p>
              )}
            </div>

            {/* Loading */}
            {loading && (
              <div className="bg-white rounded-md border border-[#E5E0DF] flex items-center justify-center gap-3 py-12 text-[#8B8481]">
                <RefreshCw className="w-5 h-5 animate-spin text-[#6B132B]" />
                <span className="text-[13px] font-medium">GENESIS scoring · ranking 8 RMs…</span>
              </div>
            )}

            {/* Results */}
            {result && !loading && (
              <>
                {/* Cold-start + ranking card */}
                <div className="bg-white rounded-md border border-[#E5E0DF] p-6 space-y-5">
                  {/* Cold-start */}
                  {result.customer && (() => {
                    const t = TIER[result.customer.risk_tier] || TIER.NONE;
                    return (
                      <div className="flex items-center justify-between pb-5 border-b border-[#E5E0DF]">
                        <div>
                          <p className="text-[12px] font-bold text-[#2A161B] flex items-center gap-1.5">
                            <Activity className="w-3.5 h-3.5 text-[#6B132B]" /> GENESIS Cold-start Estimate
                          </p>
                          <p className="text-[11px] text-[#8B8481] mt-0.5">Demographic-only · no behavioural history yet</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-bold ${t.badge}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${t.dot}`} /> {result.customer.risk_tier}
                          </span>
                          <div className="text-right">
                            <p className="text-[26px] font-bold text-[#2A161B] leading-none tabular-nums">
                              {Math.round((result.customer.churn_score || 0) * 100)}<span className="text-[14px] font-normal text-[#8B8481]">%</span>
                            </p>
                            <p className="text-[10px] text-[#8B8481]">churn risk</p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Ranking */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[13px] font-bold text-[#2A161B]">RM Ranking — all 8 relationship managers</p>
                      <div className="flex gap-3 text-[10px] font-semibold">
                        {[['bg-[#6B132B]', 'text-[#6B132B]', 'Fit'], ['bg-[#B46B3E]', 'text-[#B46B3E]', 'Capacity'], ['bg-[#2A161B]', 'text-[#2A161B]', 'Fairness']].map(([bg, tc, l]) => (
                          <span key={l} className={`flex items-center gap-1 ${tc}`}><span className={`w-2.5 h-2.5 rounded-sm ${bg}`} />{l}</span>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1">
                      {reranked.map((rm: any, i: number) => <RankRow key={rm.rmName} rm={rm} w={weights} maxT={maxT} rank={i + 1} top={i === 0} />)}
                    </div>
                  </div>

                  {/* Weight sliders */}
                  <div className="pt-5 border-t border-[#E5E0DF]">
                    <p className="text-[12px] font-semibold text-[#6B6562] flex items-center gap-1.5 mb-3">
                      <SlidersHorizontal className="w-3.5 h-3.5" /> Tune priorities — weights auto-normalize, ranking updates live
                    </p>
                    <div className="grid grid-cols-3 gap-5">
                      {([
                        { key: 'fit' as const,      label: 'Fit',      pct: wPct.fit,      acc: 'accent-[#6B132B]' },
                        { key: 'capacity' as const, label: 'Capacity', pct: wPct.capacity, acc: 'accent-[#B46B3E]' },
                        { key: 'fairness' as const, label: 'Fairness', pct: wPct.fairness, acc: 'accent-[#2A161B]' },
                      ]).map(({ key, label, pct, acc }) => (
                        <div key={key}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] font-semibold text-[#4A4644]">{label}</span>
                            <span className="text-[12px] font-bold text-[#6B132B] tabular-nums">{pct}%</span>
                          </div>
                          <input type="range" min="0" max="1" step="0.01" value={weights[key]}
                            onChange={e => setWeights(p => ({ ...p, [key]: parseFloat(e.target.value) }))}
                            className={`w-full h-1.5 rounded-full cursor-pointer ${acc}`} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Recommended RM */}
                {top1 && sel.status === 'pending' && (
                  <div className="bg-[#6B132B] rounded-md text-white p-6">
                    <div className="flex items-start justify-between gap-4 mb-5">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-12 h-12 rounded-full bg-white/15 flex items-center justify-center text-[14px] font-bold shrink-0">
                          {initials(top1.rmName)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold text-[#F4D9C0] uppercase tracking-widest flex items-center gap-1"><Award className="w-3 h-3" /> Recommended</p>
                          <p className="text-[19px] font-bold leading-tight truncate">{top1.rmName}</p>
                          <p className="text-[11px] text-white/40">{top1.dominantSegment} specialist · {top1.bookSize} clients · {top1.atRiskPct}% at-risk</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[34px] font-bold leading-none tabular-nums">{Math.round(top1.lt * 100)}<span className="text-[16px] font-normal text-white/40">%</span></p>
                        <p className="text-[10px] text-white/30 uppercase tracking-wide">match</p>
                      </div>
                    </div>

                    <div className="space-y-2 mb-5">
                      <ScoreBar label="Fit"      value={top1.breakdown.fit}      dark />
                      <ScoreBar label="Capacity" value={top1.breakdown.capacity} dark />
                      <ScoreBar label="Fairness" value={top1.breakdown.fairness} dark />
                    </div>

                    <p className="text-[12px] text-white/60 italic border-t border-white/10 pt-4 mb-5 leading-relaxed">{top1.rationale}</p>

                    <button onClick={() => handleAssign(top1.rmName, false)} disabled={assigning}
                      className="w-full py-3 rounded-md bg-white text-[#6B132B] text-[13px] font-bold hover:bg-white/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                      {assigning && !overrideRM ? <><RefreshCw className="w-4 h-4 animate-spin" /> Assigning…</> : <><CheckCircle className="w-4 h-4" /> Confirm — Assign to {top1.rmName}</>}
                    </button>
                  </div>
                )}

                {/* Alternatives */}
                {sel.status === 'pending' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[top2, top3].filter(Boolean).map((rm: any, idx: number) => (
                      <div key={rm.rmName} className="bg-white rounded-md border border-[#E5E0DF] p-5">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-9 h-9 rounded-full bg-[#F5F4F2] text-[#6B6562] flex items-center justify-center text-[11px] font-bold shrink-0">{initials(rm.rmName)}</div>
                            <div className="min-w-0">
                              <p className="text-[9px] font-bold text-[#8B8481] uppercase tracking-widest">Alternative {idx + 2}</p>
                              <p className="text-[14px] font-bold text-[#2A161B] truncate leading-tight">{rm.rmName}</p>
                            </div>
                          </div>
                          <p className="text-[18px] font-bold text-[#8B8481] tabular-nums shrink-0">{Math.round(rm.lt * 100)}%</p>
                        </div>
                        <div className="space-y-1.5 mb-3">
                          <ScoreBar label="Fit"      value={rm.breakdown.fit} />
                          <ScoreBar label="Capacity" value={rm.breakdown.capacity} />
                          <ScoreBar label="Fairness" value={rm.breakdown.fairness} />
                        </div>
                        <p className="text-[11px] text-[#8B8481] italic mb-3 leading-relaxed line-clamp-2">{rm.rationale}</p>

                        {overrideRM === rm.rmName ? (
                          <div className="space-y-2">
                            <textarea value={overrideReason} onChange={e => setOverrideReason(e.target.value)} rows={2}
                              placeholder="Override reason (required for audit log)…"
                              className="w-full px-3 py-2 border border-[#E5E0DF] rounded-md text-[12px] focus:outline-none focus:ring-2 focus:ring-[#B46B3E]/30 resize-none" />
                            <div className="flex gap-2">
                              <button onClick={() => handleAssign(rm.rmName, true)} disabled={assigning || !overrideReason.trim()}
                                className="flex-1 py-2 rounded-md bg-[#6B132B] text-white text-[12px] font-bold hover:bg-[#6B132B]/90 disabled:opacity-50 transition-colors">
                                {assigning ? 'Assigning…' : 'Confirm Override'}
                              </button>
                              <button onClick={() => { setOverrideRM(null); setOverrideReason(''); }}
                                className="px-3 py-2 rounded-md border border-[#E5E0DF] text-[12px] text-[#6B6562] hover:bg-[#FAFAF9]">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => { setOverrideRM(rm.rmName); setOverrideReason(''); }}
                            className="w-full py-2 rounded-md border border-[#E5E0DF] text-[12px] font-semibold text-[#6B6562] hover:bg-[#FAFAF9] transition-colors flex items-center justify-center gap-1">
                            <ChevronRight className="w-3.5 h-3.5" /> Assign instead (override)
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Footer caveat */}
                <p className="text-[10px] text-[#8B8481] text-center px-6 leading-relaxed">
                  8-RM / 50-customer demo. Recommendations weigh fit, capacity, and fairness — admin confirms every assignment (human-in-the-loop).
                  Overrides are audit-logged with reason. At production scale, weights can be learned from retention outcomes (VERDICT roadmap).
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
