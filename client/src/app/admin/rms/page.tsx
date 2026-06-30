'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Search, RefreshCw, Users, AlertTriangle, TrendingUp, Phone } from 'lucide-react';

const TIER_BADGE: Record<string, string> = {
  PRIORITY: 'bg-red-100 text-red-700 border border-red-200',
  ESCALATE: 'bg-orange-100 text-orange-700 border border-orange-200',
  STANDARD: 'bg-amber-100 text-amber-700 border border-amber-200',
  MONITOR:  'bg-blue-100 text-blue-700 border border-blue-200',
  NONE:     'bg-emerald-100 text-emerald-700 border border-emerald-200',
};

export default function RmsPage() {
  const [rms,     setRms]     = useState<any[]>([]);
  const [stats,   setStats]   = useState<any>(null);
  const [search,  setSearch]  = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [r, s] = await Promise.all([api.getAdminRms(), api.getAdminStats()]);
      setRms(r.rms || []);
      setStats(s?.stats || {});
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = rms.filter(r =>
    !search || r.rm_name?.toLowerCase().includes(search.toLowerCase()) || r.username?.toLowerCase().includes(search.toLowerCase())
  );

  const totalBook = rms.reduce((s, r) => s + (r.book_size || 0), 0);
  const totalRisk = rms.reduce((s, r) => s + (r.at_risk_count || 0), 0);
  const totalSaves= rms.reduce((s, r) => s + (r.saves_this_month || 0), 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">RM Management</h1>
          <p className="text-slate-400 text-sm mt-0.5">Relationship manager roster and performance overview</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-700 text-xs shadow-sm transition-all">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total RMs',    value: rms.length,  icon: Users,         accent: 'border-l-[#0f2d5c]' },
          { label: 'Total Book',   value: totalBook,   icon: Users,         accent: 'border-l-sky-500' },
          { label: 'Total At-Risk',value: totalRisk,   icon: AlertTriangle, accent: 'border-l-red-500' },
          { label: 'Saves (30d)',  value: totalSaves,  icon: TrendingUp,    accent: 'border-l-emerald-500' },
        ].map(c => (
          <div key={c.label} className={`bg-white rounded-xl border border-slate-200 shadow-sm p-5 border-l-4 ${c.accent}`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{c.label}</p>
                <p className="text-2xl font-bold text-slate-900 tabular-nums">{loading ? '—' : c.value}</p>
              </div>
              <c.icon className="w-5 h-5 text-slate-300 mt-1" />
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#0f2d5c]/40 shadow-sm"
          placeholder="Search by RM name or username…"
          value={search} onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* RM cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => <div key={i} className="h-44 bg-white rounded-xl border border-slate-200 animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((rm: any, i: number) => (
            <Link key={rm.username} href={`/admin/rms/${rm.username}`}
              className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:border-[#0f2d5c]/30 hover:shadow-md transition-all group">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-11 h-11 rounded-full bg-[#0f2d5c] flex items-center justify-center text-white text-sm font-bold shrink-0">
                  {rm.rm_name?.split(' ').map((n: string) => n[0]).join('').slice(0,2)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-900 truncate">{rm.rm_name}</p>
                  <p className="text-[11px] text-slate-400">@{rm.username}</p>
                </div>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${rm.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {rm.active ? 'ACTIVE' : 'INACTIVE'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-4">
                {[
                  { label: 'Book',    value: rm.book_size || 0 },
                  { label: 'At-Risk', value: rm.at_risk_count || 0, red: true },
                  { label: 'Saves',   value: rm.saves_this_month || 0, green: true },
                ].map(m => (
                  <div key={m.label} className="bg-slate-50 rounded-lg p-2.5 text-center">
                    <p className={`text-lg font-bold tabular-nums ${m.red ? 'text-red-600' : m.green ? 'text-emerald-600' : 'text-slate-900'}`}>{m.value}</p>
                    <p className="text-[9px] text-slate-400 uppercase tracking-wide">{m.label}</p>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <div className="flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  <span>{rm.calls_this_week || 0} calls this week</span>
                </div>
                <span className={`font-semibold ${(rm.task_completion_rate || 0) >= 80 ? 'text-emerald-600' : (rm.task_completion_rate || 0) >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                  {rm.task_completion_rate || 0}% tasks done
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No RMs found</p>
          <p className="text-slate-400 text-sm mt-1">Try a different search term</p>
        </div>
      )}
    </div>
  );
}
