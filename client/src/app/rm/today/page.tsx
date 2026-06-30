'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import RiskBadge from '@/components/RiskBadge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertTriangle, CheckSquare, TrendingUp, Phone,
  ArrowRight, RefreshCw, Calendar, Clock, Users, BookOpen,
  ShieldCheck, ShieldOff,
} from 'lucide-react';

function fmtDate(d?: string) {
  if (!d) return '—';
  try { return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short' }).format(new Date(d)); }
  catch { return d; }
}
function isOverdue(d?: string) { return !!d && new Date(d) < new Date(); }
function isDueToday(d?: string) {
  if (!d) return false;
  const t = new Date(d), n = new Date();
  return t.toDateString() === n.toDateString();
}

function StatCard({ label, value, icon: Icon, accent = 'blue', loading }: {
  label: string; value: number | string; icon: React.ElementType;
  accent?: 'blue' | 'red' | 'orange' | 'emerald'; loading?: boolean;
}) {
  const border = { blue: 'border-l-[var(--crimson)]', red: 'border-l-red-500', orange: 'border-l-orange-500', emerald: 'border-l-emerald-500' }[accent];
  const icon   = { blue: 'text-[var(--crimson)]',     red: 'text-crimson',     orange: 'text-copper',     emerald: 'text-sage-brand'   }[accent];
  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm p-5 border-l-4 ${border}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{label}</p>
          {loading
            ? <Skeleton className="h-8 w-16 mt-1" />
            : <p className="text-2xl font-bold text-slate-900 tabular-nums">{value}</p>}
        </div>
        <div className={`w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center ${icon}`}>
          <Icon className="w-4.5 h-4.5" />
        </div>
      </div>
    </div>
  );
}

export default function TodayPage() {
  const { user } = useAuth();
  const [summary,   setSummary]   = useState<any>(null);
  const [tasks,     setTasks]     = useState<any[]>([]);
  const [escalations, setEscalations] = useState<{ approved: any[]; deescalated: any[] }>({ approved: [], deescalated: [] });
  const [loading,   setLoading]   = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [s, t, rev] = await Promise.all([api.getRmBookSummary(), api.getRmTasks(), api.getReviews()]);
      setSummary(s);
      setTasks(t.tasks || []);
      const all: any[] = rev.reviews || [];
      setEscalations({
        approved:     all.filter(r => r.status === 'approved'),
        deescalated:  all.filter(r => r.status === 'rejected'),
      });
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const today   = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const sm      = summary?.summary || {};
  const dueTasks = tasks.filter(t => t.status === 'pending' && (isOverdue(t.due_date) || isDueToday(t.due_date)));
  const upcoming = tasks.filter(t => t.status === 'pending' && !isOverdue(t.due_date) && !isDueToday(t.due_date)).slice(0, 4);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Good morning, {user?.name?.split(' ')[0] || 'RM'} 👋</h1>
          <p className="text-slate-400 text-sm mt-0.5 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" /> {today}
          </p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-700 text-xs shadow-sm transition-all">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Book Size"        value={sm.book_size || 0}          icon={Users}         accent="blue"    loading={loading} />
        <StatCard label="At-Risk"          value={sm.at_risk_count || 0}       icon={AlertTriangle} accent="red"     loading={loading} />
        <StatCard label="Due Today"        value={dueTasks.length}             icon={Clock}         accent="orange"  loading={loading} />
        <StatCard label="Saves This Month" value={sm.saves_this_month || 0}    icon={TrendingUp}    accent="emerald" loading={loading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Top at-risk */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-700">Top At-Risk Customers</h2>
            <Link href="/rm/book" className="text-xs text-[var(--crimson)] hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {loading ? (
            <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : (sm.top_at_risk || []).length === 0 ? (
            <p className="text-slate-400 text-sm py-6 text-center">No high-risk customers today</p>
          ) : (
            <div className="divide-y divide-slate-50">
              {(sm.top_at_risk || []).map((c: any) => (
                <Link key={c.customer_id} href={`/rm/customers/${c.customer_id}`}
                  className="flex items-center gap-3 py-3 hover:bg-slate-50 px-1 rounded-lg transition-colors -mx-1">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[11px] font-bold text-slate-600 shrink-0">
                    {c.full_name.split(' ').map((n: string) => n[0]).join('').slice(0,2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{c.full_name}</p>
                    <p className="text-[11px] text-slate-400">{c.city} · {c.segment}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-slate-900 tabular-nums">{Math.round((c.churn_score||0)*100)}%</p>
                    <RiskBadge tier={c.risk_tier} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Tasks due today */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-700">Due Today / Overdue</h2>
              {dueTasks.length > 0 && (
                <span className="bg-crimson-soft text-crimson text-[10px] font-bold px-1.5 py-0.5 rounded-full">{dueTasks.length}</span>
              )}
            </div>
            <Link href="/rm/tasks" className="text-xs text-[var(--crimson)] hover:underline flex items-center gap-1">
              All tasks <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {loading ? (
            <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : dueTasks.length === 0 ? (
            <div className="py-8 text-center">
              <CheckSquare className="w-8 h-8 text-sage-brand mx-auto mb-2 opacity-60" />
              <p className="text-sage-brand text-sm font-semibold">All clear!</p>
              <p className="text-slate-400 text-xs mt-1">No tasks due today</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {dueTasks.slice(0, 5).map(t => (
                <div key={t.id} className={`py-3 flex items-start gap-3 ${isOverdue(t.due_date) ? 'text-crimson' : 'text-copper-dark'}`}>
                  <Clock className="w-4 h-4 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{t.note || t.type}</p>
                    <p className="text-[11px] text-slate-400">{t.customer_id} · Due {fmtDate(t.due_date)}</p>
                  </div>
                  {isOverdue(t.due_date) && <span className="text-[9px] font-bold bg-crimson-soft text-crimson px-1.5 py-0.5 rounded shrink-0">OVERDUE</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Manager-approved escalations */}
      {escalations.approved.length > 0 && (
        <div className="bg-white rounded-xl border-2 border-soft shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 bg-sage-soft border-b border-soft">
            <ShieldCheck className="w-4 h-4 text-sage-brand shrink-0" />
            <h2 className="text-sm font-bold text-emerald-800">Manager-Cleared Actions ({escalations.approved.length})</h2>
            <span className="text-[10px] text-sage-brand bg-sage-soft px-2 py-0.5 rounded-full font-semibold">Action Required</span>
          </div>
          <div className="divide-y divide-slate-50">
            {escalations.approved.map((r: any) => {
              const initials = r.full_name.split(' ').map((n: string) => n[0]).join('').slice(0,2);
              return (
                <div key={r.id} className="flex items-start gap-4 px-5 py-4 hover:bg-slate-50/50 transition-colors">
                  <div className="w-9 h-9 rounded-full bg-sage-soft flex items-center justify-center text-[11px] font-bold text-sage-brand shrink-0">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-slate-900">{r.full_name}</span>
                      <RiskBadge tier={r.risk_tier} />
                      <span className="text-[10px] font-semibold text-copper-dark bg-copper-soft px-1.5 py-0.5 rounded">
                        {r.action?.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Approved by <strong>{r.reviewer}</strong> · {fmtDate(r.reviewed_at)}
                    </p>
                    {r.notes && (
                      <p className="text-[11px] text-slate-600 mt-1 bg-slate-50 rounded-lg px-2.5 py-1.5 border border-slate-100">
                        Manager note: "{r.notes}"
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-black text-slate-800">{Math.round((r.churn_score||0)*100)}%</p>
                    <p className="text-[10px] text-slate-400">churn risk</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* De-escalated — info only, no action needed */}
      {escalations.deescalated.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 bg-slate-50 border-b border-slate-200">
            <ShieldOff className="w-4 h-4 text-slate-400 shrink-0" />
            <h2 className="text-sm font-semibold text-slate-600">Manager De-escalated ({escalations.deescalated.length})</h2>
            <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full font-semibold">No action needed</span>
          </div>
          <div className="divide-y divide-slate-50">
            {escalations.deescalated.map((r: any) => (
              <div key={r.id} className="flex items-center gap-4 px-5 py-3">
                <ShieldOff className="w-4 h-4 text-slate-300 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-600">{r.full_name}</span>
                    <RiskBadge tier={r.risk_tier} />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Manager reviewed and de-escalated · {r.reviewer}
                    {r.notes ? ` — "${r.notes}"` : ''}
                  </p>
                </div>
                <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-semibold shrink-0">STAND DOWN</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { href: '/rm/book',        icon: BookOpen,     label: 'My Book',        sub: `${sm.book_size||0} customers` },
            { href: '/rm/calls',       icon: Phone,        label: 'Log a Call',     sub: `${sm.calls_this_week||0} this week` },
            { href: '/rm/tasks',       icon: CheckSquare,  label: 'Follow-ups',     sub: `${dueTasks.length} due today` },
            { href: '/rm/performance', icon: TrendingUp,   label: 'My Performance', sub: `${sm.saves_this_month||0} saves` },
          ].map(a => (
            <Link key={a.href} href={a.href}
              className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 hover:border-[var(--crimson)]/30 hover:bg-slate-50 transition-all">
              <a.icon className="w-5 h-5 text-[var(--crimson)] shrink-0" />
              <div>
                <p className="text-sm font-semibold text-slate-800">{a.label}</p>
                <p className="text-[11px] text-slate-400">{a.sub}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Upcoming This Week</h2>
          <div className="divide-y divide-slate-50">
            {upcoming.map(t => (
              <div key={t.id} className="flex items-center gap-3 py-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--crimson)] shrink-0" />
                <p className="text-sm text-slate-700 flex-1 truncate">{t.note || t.type}</p>
                <span className="text-[11px] text-slate-400 shrink-0">{fmtDate(t.due_date)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
