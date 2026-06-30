'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getToken, api } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CheckSquare, Plus, X, Loader2, AlertTriangle,
  Clock, RefreshCw, CheckCircle, CalendarDays, ListTodo,
} from 'lucide-react';

const TYPE_LABELS: Record<string, string> = {
  callback: 'Callback', follow_up: 'Follow-up', internal: 'Internal', other: 'Other',
};
const TYPE_COLORS: Record<string, string> = {
  callback:  'bg-teal-soft text-teal-dark',
  follow_up: 'bg-teal-soft text-teal-dark',
  internal:  'bg-slate-100 text-slate-500',
  other:     'bg-copper-soft text-copper-dark',
};

function StatCard({ label, value, sub, icon: Icon, accent }: {
  label: string; value: number; sub: string;
  icon: React.ElementType; accent: 'navy' | 'red' | 'emerald' | 'amber';
}) {
  const border = { navy: 'border-[var(--crimson)]', red: 'border-red-500', emerald: 'border-emerald-500', amber: 'border-amber-500' };
  const ic     = { navy: 'text-[var(--crimson)]',   red: 'text-crimson',   emerald: 'text-sage-brand',   amber: 'text-copper' };
  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm p-4 border-l-4 ${border[accent]}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{label}</p>
          <p className="text-[28px] font-black text-slate-900 leading-none">{value}</p>
          <p className="text-[11px] text-slate-400 mt-1">{sub}</p>
        </div>
        <div className={`p-2 rounded-lg bg-slate-50 ${ic[accent]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

function AddTaskModal({ customers, onClose, onSaved }: {
  customers: any[]; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({ customer_id: '', due_date: '', note: '', type: 'callback' });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const save = async () => {
    if (!form.customer_id || !form.due_date) { setError('Customer and due date are required.'); return; }
    setLoading(true); setError('');
    try { await api.createRmTask(form); onSaved(); onClose(); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-[var(--crimson)]" />
            <h2 className="text-[14px] font-bold text-slate-900">Add Follow-up</h2>
          </div>
          <button onClick={onClose}><X className="w-4 h-4 text-slate-400" /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          {error && <div className="bg-crimson-soft border border-red-100 rounded-lg px-3 py-2 text-[12px] text-crimson">{error}</div>}
          <div>
            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Customer</label>
            <select value={form.customer_id} onChange={e => setForm(f => ({ ...f, customer_id: e.target.value }))}
              className="w-full px-3 py-2 text-[13px] rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[var(--crimson)]/20">
              <option value="">Select…</option>
              {customers.map(c => <option key={c.customer_id} value={c.customer_id}>{c.full_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Type</label>
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
              className="w-full px-3 py-2 text-[13px] rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[var(--crimson)]/20">
              {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Due Date</label>
            <input type="datetime-local" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
              className="w-full px-3 py-2 text-[13px] rounded-lg border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-[var(--crimson)]/20" />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Note</label>
            <textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} rows={3}
              placeholder="What to follow up on…"
              className="w-full px-3 py-2 text-[13px] rounded-lg border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-[var(--crimson)]/20 resize-none" />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 text-[12px] text-slate-600 hover:bg-slate-50">Cancel</button>
          <button onClick={save} disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--crimson)] text-white text-[12px] font-semibold hover:bg-[var(--crimson-dark)] disabled:opacity-50 transition-colors">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Add Task
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TasksPage() {
  const router = useRouter();
  const [tasks,     setTasks]     = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filter,    setFilter]    = useState<'all' | 'pending' | 'done'>('pending');

  const load = () => {
    if (!getToken()) { router.push('/login'); return; }
    setLoading(true);
    Promise.all([api.getRmTasks(), api.getRmBook()])
      .then(([t, b]) => { setTasks(t.tasks || []); setCustomers(b.customers || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const markDone = async (id: string) => {
    await api.updateRmTask(id, { status: 'done', updated_at: new Date().toISOString() });
    load();
  };
  const snooze = async (id: string) => {
    const d = new Date(); d.setDate(d.getDate() + 3);
    await api.updateRmTask(id, { status: 'snoozed', due_date: d.toISOString() });
    load();
  };

  const custName = (id: string) => customers.find(c => c.customer_id === id)?.full_name || id;

  const pending  = tasks.filter(t => t.status === 'pending');
  const done     = tasks.filter(t => t.status === 'done');
  const snoozed  = tasks.filter(t => t.status === 'snoozed');
  const overdue  = pending.filter(t => new Date(t.due_date) < new Date());
  const dueToday = pending.filter(t => {
    const d = new Date(t.due_date); const now = new Date();
    return d.toDateString() === now.toDateString();
  });

  const filtered = tasks.filter(t => filter === 'all' ? true : t.status === filter);

  // Type distribution
  const types = [...new Set(tasks.map(t => t.type))];
  const typeDist = types.map(type => ({ type, count: tasks.filter(t => t.type === type).length }));

  // Upcoming (next 7 days, pending)
  const upcoming = pending
    .filter(t => {
      const d = new Date(t.due_date); const now = new Date();
      const week = new Date(); week.setDate(week.getDate() + 7);
      return d >= now && d <= week;
    })
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

  return (
    <div className="p-6 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <CheckSquare className="w-5 h-5 text-[var(--crimson)]" />
            <h1 className="text-[22px] font-black text-slate-900">Follow-ups</h1>
          </div>
          <p className="text-[13px] text-slate-400">
            {pending.length} pending · {overdue.length > 0
              ? <span className="text-crimson font-semibold">{overdue.length} overdue</span>
              : <span className="text-sage-brand font-medium">none overdue</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-[12px] text-slate-500 hover:bg-slate-50 transition-colors">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--crimson)] text-white text-[12px] font-semibold hover:bg-[var(--crimson-dark)] transition-colors">
            <Plus className="w-3.5 h-3.5" /> Add Task
          </button>
        </div>
      </div>

      {/* KPI cards */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Pending"    value={pending.length}   sub="awaiting action"    icon={ListTodo}     accent="navy"    />
          <StatCard label="Overdue"    value={overdue.length}   sub="past due date"      icon={AlertTriangle} accent={overdue.length > 0 ? 'red' : 'emerald'} />
          <StatCard label="Due Today"  value={dueToday.length}  sub="on today's schedule" icon={CalendarDays} accent="amber"   />
          <StatCard label="Completed"  value={done.length}      sub="marked done"        icon={CheckCircle}  accent="emerald" />
        </div>
      )}

      {/* Main 2-col layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Task list — 2/3 width */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          {/* Filter tabs */}
          <div className="flex items-center gap-0 px-4 border-b border-slate-100">
            {(['pending', 'all', 'done'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-4 py-3 text-[12px] font-medium capitalize border-b-2 -mb-px transition-colors ${filter === f ? 'border-[var(--crimson)] text-[var(--crimson)]' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                {f === 'all' ? 'All Tasks' : f === 'pending' ? 'Pending' : 'Done'}
                <span className="ml-1.5 text-[10px] text-slate-300">
                  ({tasks.filter(t => f === 'all' ? true : t.status === f).length})
                </span>
              </button>
            ))}
          </div>

          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <CheckSquare className="w-8 h-8 mb-3" />
              <p className="text-[14px] font-medium">No {filter === 'all' ? '' : filter} tasks</p>
              {filter === 'pending' && (
                <button onClick={() => setShowModal(true)}
                  className="mt-3 px-4 py-2 rounded-lg bg-[var(--crimson)] text-white text-[12px] font-semibold">
                  Add one
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-50 overflow-y-auto">
              {filtered.map(t => {
                const isOverdue = t.status === 'pending' && new Date(t.due_date) < new Date();
                return (
                  <div key={t.id} className={`flex items-start gap-3 px-5 py-4 hover:bg-slate-50 transition-colors ${isOverdue ? 'border-l-2 border-l-red-400' : ''}`}>
                    <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${t.status === 'done' ? 'bg-emerald-400' : isOverdue ? 'bg-red-400' : 'bg-amber-400'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Link href={`/rm/customers/${t.customer_id}`}
                          className="text-[13px] font-semibold text-[var(--crimson)] hover:underline">
                          {custName(t.customer_id)}
                        </Link>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${TYPE_COLORS[t.type] || 'bg-slate-50 text-slate-500'}`}>
                          {TYPE_LABELS[t.type] || t.type}
                        </span>
                        {isOverdue && (
                          <span className="flex items-center gap-1 text-[10px] font-semibold text-crimson">
                            <AlertTriangle className="w-3 h-3" /> Overdue
                          </span>
                        )}
                      </div>
                      <p className="text-[12px] text-slate-600 leading-snug">{t.note}</p>
                      <p className={`text-[10px] mt-1.5 font-medium ${isOverdue ? 'text-crimson' : 'text-slate-400'}`}>
                        {new Date(t.due_date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                        {' · '}{new Date(t.due_date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    {t.status === 'pending' && (
                      <div className="flex gap-1.5 shrink-0 ml-2">
                        <button onClick={() => markDone(t.id)}
                          className="px-2.5 py-1 rounded-lg bg-sage-soft text-sage-brand text-[11px] font-semibold hover:bg-sage-soft transition-colors">
                          Done
                        </button>
                        <button onClick={() => snooze(t.id)}
                          className="px-2.5 py-1 rounded-lg bg-slate-50 text-slate-500 text-[11px] font-semibold hover:bg-slate-100 transition-colors flex items-center gap-1">
                          <Clock className="w-3 h-3" /> +3d
                        </button>
                      </div>
                    )}
                    {t.status === 'done' && (
                      <span className="text-[10px] font-semibold text-sage-brand bg-sage-soft px-2 py-0.5 rounded shrink-0">Done</span>
                    )}
                    {t.status === 'snoozed' && (
                      <span className="text-[10px] font-semibold text-copper-dark bg-copper-soft px-2 py-0.5 rounded shrink-0">Snoozed</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right sidebar — 1/3 width */}
        <div className="flex flex-col gap-4">
          {/* Upcoming this week */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <h3 className="text-[13px] font-bold text-slate-800 mb-3 flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-[var(--crimson)]" /> Due This Week
            </h3>
            {loading ? (
              <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
            ) : upcoming.length === 0 ? (
              <p className="text-[12px] text-slate-400 py-4 text-center">Nothing due in the next 7 days</p>
            ) : (
              <div className="space-y-2">
                {upcoming.slice(0, 5).map(t => {
                  const d = new Date(t.due_date);
                  const isToday = d.toDateString() === new Date().toDateString();
                  return (
                    <div key={t.id} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-50">
                      <div className={`text-center shrink-0 w-8 ${isToday ? 'text-[var(--crimson)]' : 'text-slate-400'}`}>
                        <p className="text-[9px] font-semibold uppercase">{d.toLocaleDateString('en-IN', { weekday: 'short' })}</p>
                        <p className="text-[15px] font-black leading-none">{d.getDate()}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-slate-700 truncate">{custName(t.customer_id)}</p>
                        <p className="text-[10px] text-slate-400 truncate">{t.note}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Type distribution */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <h3 className="text-[13px] font-bold text-slate-800 mb-3">By Task Type</h3>
            {loading ? (
              <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8 rounded-lg" />)}</div>
            ) : typeDist.length === 0 ? (
              <p className="text-[12px] text-slate-400 text-center py-4">No tasks yet</p>
            ) : typeDist.map(({ type, count }) => (
              <div key={type} className="flex items-center gap-2 mb-2">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded w-24 text-center ${TYPE_COLORS[type] || 'bg-slate-50 text-slate-500'}`}>
                  {TYPE_LABELS[type] || type}
                </span>
                <div className="flex-1 bg-slate-100 rounded-full h-2">
                  <div className="h-2 rounded-full bg-[var(--crimson)]" style={{ width: `${(count / tasks.length) * 100}%` }} />
                </div>
                <span className="text-[11px] font-bold text-slate-600 w-4 text-right">{count}</span>
              </div>
            ))}
          </div>

          {/* Snoozed tasks */}
          {snoozed.length > 0 && (
            <div className="bg-copper-soft border border-amber-100 rounded-xl p-4">
              <h3 className="text-[13px] font-bold text-copper-dark mb-2 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Snoozed ({snoozed.length})
              </h3>
              {snoozed.map(t => (
                <div key={t.id} className="text-[11px] text-copper-dark py-1 border-b border-amber-100 last:border-0">
                  {custName(t.customer_id)} · {new Date(t.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </div>
              ))}
            </div>
          )}

          {/* Quick tip */}
          <div className="bg-[var(--crimson)]/5 rounded-xl p-4">
            <p className="text-[11px] font-semibold text-[var(--crimson)] mb-1">Pro Tip</p>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Use <span className="font-semibold">+3d</span> to snooze tasks when a customer asks you to call back later. Snoozed tasks re-appear automatically on the due date.
            </p>
          </div>
        </div>
      </div>

      {showModal && <AddTaskModal customers={customers} onClose={() => setShowModal(false)} onSaved={load} />}
    </div>
  );
}
