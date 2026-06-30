'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getToken, api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import RiskBadge from '@/components/RiskBadge';
import ScoreBar from '@/components/ScoreBar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CalendarDays, AlertTriangle, Send, CheckSquare,
  ArrowRight, TrendingUp, Phone, RefreshCw,
} from 'lucide-react';


interface BookSummary {
  rm_name: string;
  summary: {
    book_size: number;
    at_risk_count: number;
    avg_churn_score: number;
    tasks_due_this_week: number;
    outreach_pending: number;
    saves_this_month: number;
    calls_this_week: number;
    top_at_risk: Array<{
      customer_id: string; full_name: string; risk_tier: string;
      churn_score: number; city: string; segment: string;
    }>;
  };
}

interface Task {
  id: string; customer_id: string; due_date: string; note: string; type: string; status: string;
}

function StatCard({ label, value, sub, icon: Icon, accent = 'default' }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; accent?: 'default' | 'red' | 'orange' | 'emerald' | 'blue';
}) {
  const accentMap = {
    default: 'border-[#0f2d5c]',
    red:     'border-red-500',
    orange:  'border-orange-500',
    emerald: 'border-emerald-500',
    blue:    'border-blue-500',
  };
  const iconMap = {
    default: 'text-[#0f2d5c]',
    red:     'text-red-500',
    orange:  'text-orange-500',
    emerald: 'text-emerald-500',
    blue:    'text-blue-500',
  };
  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm p-4 border-l-4 ${accentMap[accent]}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{label}</p>
          <p className="text-[28px] font-black text-slate-900 leading-none">{value}</p>
          {sub && <p className="text-[11px] text-slate-400 mt-1">{sub}</p>}
        </div>
        <div className={`p-2 rounded-lg bg-slate-50 ${iconMap[accent]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

function greet(name: string) {
  const h = new Date().getHours();
  const time = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
  return `Good ${time}, ${name.split(' ')[0]}`;
}

export default function MyDayPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [summary, setSummary] = useState<BookSummary | null>(null);
  const [tasks,   setTasks]   = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    if (!getToken()) { router.push('/login'); return; }
    setLoading(true);
    Promise.all([
      api.getRmBookSummary(),
      api.getRmTasks('pending'),
    ]).then(([s, t]) => {
      setSummary(s);
      setTasks(t.tasks || []);
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const s = summary?.summary;
  const rmDisplayName = summary?.rm_name || user?.name || 'RM';

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <CalendarDays className="w-5 h-5 text-[#0f2d5c]" />
            <h1 className="text-[22px] font-black text-slate-900">My Day</h1>
          </div>
          {loading ? <Skeleton className="h-4 w-48" /> : (
            <p className="text-[13px] text-slate-500">
              {greet(rmDisplayName)} — {new Date().toLocaleDateString('en-IN', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
            </p>
          )}
        </div>
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-[12px] text-slate-500 hover:bg-slate-50 transition-colors">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* KPI Cards */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {Array.from({length:4}).map((_,i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard label="Book Size"            value={s?.book_size ?? 0}             sub="your customers"          icon={TrendingUp}    accent="default" />
          <StatCard label="Needs Attention"      value={s?.at_risk_count ?? 0}          sub="priority + escalate"     icon={AlertTriangle} accent="red"     />
          <StatCard label="Tasks Due This Week"  value={s?.tasks_due_this_week ?? 0}    sub="follow-ups pending"      icon={CheckSquare}   accent="orange"  />
          <StatCard label="Saves This Month"     value={s?.saves_this_month ?? 0}       sub="retained + converted"    icon={Phone}         accent="emerald" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Priority Queue */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div>
              <h2 className="text-[14px] font-bold text-slate-900">Priority Queue</h2>
              <p className="text-[11px] text-slate-400">Customers needing action — highest risk first</p>
            </div>
            <Link href="/rm/book" className="text-[11px] text-[#0f2d5c] font-semibold hover:underline flex items-center gap-1">
              Full book <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({length:5}).map((_,i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
            </div>
          ) : (s?.top_at_risk || []).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <TrendingUp className="w-8 h-8 mb-2" />
              <p className="text-[13px]">No priority customers — great work!</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {(s?.top_at_risk || []).map(c => (
                <div key={c.customer_id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 shrink-0">
                    {c.full_name.split(' ').map(n=>n[0]).join('').slice(0,2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-slate-800 truncate">{c.full_name}</p>
                    <p className="text-[10px] text-slate-400">{c.segment} · {c.city}</p>
                  </div>
                  <div className="w-28 flex items-center gap-2">
                    <ScoreBar score={c.churn_score} tier={c.risk_tier as any} height={4} showLabel />
                  </div>
                  <RiskBadge tier={c.risk_tier as any} size="sm" />
                  <Link href={`/rm/customers/${c.customer_id}`}
                    className="ml-1 px-2.5 py-1 rounded-lg bg-[#0f2d5c] text-white text-[11px] font-semibold hover:bg-[#1a3f7a] transition-colors whitespace-nowrap">
                    Act
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tasks Due */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div>
              <h2 className="text-[14px] font-bold text-slate-900">Follow-ups Due</h2>
              <p className="text-[11px] text-slate-400">Your pending callbacks</p>
            </div>
            <Link href="/rm/tasks" className="text-[11px] text-[#0f2d5c] font-semibold hover:underline flex items-center gap-1">
              All <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {loading ? (
            <div className="p-4 space-y-2">
              {Array.from({length:4}).map((_,i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
            </div>
          ) : tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400">
              <CheckSquare className="w-7 h-7 mb-2" />
              <p className="text-[12px]">No pending tasks</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {tasks.slice(0, 6).map(t => {
                const isOverdue = new Date(t.due_date) < new Date();
                return (
                  <div key={t.id} className="px-4 py-3">
                    <div className="flex items-start gap-2">
                      <CheckSquare className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${isOverdue ? 'text-red-400' : 'text-slate-300'}`} />
                      <div className="min-w-0">
                        <p className="text-[12px] text-slate-700 font-medium leading-snug line-clamp-2">{t.note}</p>
                        <p className={`text-[10px] mt-0.5 font-medium ${isOverdue ? 'text-red-500' : 'text-slate-400'}`}>
                          {isOverdue ? '⚠ Overdue · ' : ''}{new Date(t.due_date).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}
                        </p>
                      </div>
                    </div>
                    <Link href={`/rm/customers/${t.customer_id}`}
                      className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-[#0f2d5c] font-semibold hover:underline">
                      View customer <ArrowRight className="w-2.5 h-2.5" />
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { href: '/rm/book',        label: 'View My Book',     icon: TrendingUp,  desc: `${s?.book_size || 0} customers assigned` },
          { href: '/rm/outcomes',    label: 'Log an Outcome',   icon: CheckSquare, desc: 'Record what happened' },
          { href: '/rm/calls',       label: 'Call Log',         icon: Phone,       desc: `${s?.calls_this_week || 0} calls this week` },
          { href: '/rm/performance', label: 'My Performance',   icon: Send,        desc: 'View your stats' },
        ].map(a => (
          <Link key={a.href} href={a.href}
            className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:border-[#0f2d5c]/30 hover:shadow-md transition-all group flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#0f2d5c]/8 flex items-center justify-center group-hover:bg-[#0f2d5c] transition-colors">
              <a.icon className="w-4.5 h-4.5 text-[#0f2d5c] group-hover:text-white transition-colors" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-slate-800 group-hover:text-[#0f2d5c] transition-colors">{a.label}</p>
              <p className="text-[10px] text-slate-400">{a.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
