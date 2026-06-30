'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Search, RefreshCw, Users, AlertTriangle, TrendingUp, Phone } from 'lucide-react';

const TIER_BADGE: Record<string, string> = {
  PRIORITY: 'bg-[#6B132B] text-white',
  ESCALATE: 'bg-[#B46B3E] text-white',
  STANDARD: 'bg-[#F9F9F7] text-[#2A161B] border border-soft',
  MONITOR:  'bg-[#F4D9C0] text-[#2A161B]',
  NONE:     'bg-[#F9F9F7] text-[#6B6562] border border-soft',
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
    <div className="p-6 space-y-6 bg-[#F9F9F7] min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-black text-[#2A161B] font-heading">RM Management</h1>
          <p className="text-[13px] text-[#6B6562] mt-0.5">Relationship manager roster and performance overview</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 rounded-md border border-soft bg-white text-[#6B6562] hover:text-[#2A161B] text-xs transition-colors">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total RMs',    value: rms.length,  icon: Users,         color: '#6B132B' },
          { label: 'Total Book',   value: totalBook,   icon: Users,         color: '#B46B3E' },
          { label: 'Total At-Risk',value: totalRisk,   icon: AlertTriangle, color: '#6B132B' },
          { label: 'Saves (30d)',  value: totalSaves,  icon: TrendingUp,    color: '#B46B3E' },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-md border border-soft p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: `${c.color}18` }}>
              <c.icon className="w-4.5 h-4.5" style={{ color: c.color }} />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-[#6B6562] uppercase tracking-wider">{c.label}</p>
              <p className="text-xl font-black text-[#2A161B] tabular-nums">{loading ? '—' : c.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8B8481]" />
        <input
          className="w-full pl-9 pr-4 py-2.5 rounded-md border border-soft bg-white text-sm text-[#2A161B] placeholder-[#8B8481] focus:outline-none focus:border-[#6B132B]/40"
          placeholder="Search by RM name or username…"
          value={search} onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* RM cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => <div key={i} className="h-44 bg-white rounded-md border border-soft animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((rm: any, i: number) => (
            <Link key={rm.username} href={`/admin/rms/${rm.username}`}
              className="bg-white rounded-md border border-soft p-5 hover:border-[#6B132B]/30 transition-colors group">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-11 h-11 rounded-full bg-[#6B132B] flex items-center justify-center text-white text-sm font-bold shrink-0">
                  {rm.rm_name?.split(' ').map((n: string) => n[0]).join('').slice(0,2)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[#2A161B] truncate">{rm.rm_name}</p>
                  <p className="text-[11px] text-[#6B6562]">@{rm.username}</p>
                </div>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${rm.active ? 'bg-[#6B132B] text-white' : 'bg-[#F9F9F7] text-[#6B6562] border border-soft'}`}>
                  {rm.active ? 'ACTIVE' : 'INACTIVE'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-4">
                {[
                  { label: 'Book',    value: rm.book_size || 0, color: '#2A161B' },
                  { label: 'At-Risk', value: rm.at_risk_count || 0, color: '#6B132B' },
                  { label: 'Saves',   value: rm.saves_this_month || 0, color: '#B46B3E' },
                ].map(m => (
                  <div key={m.label} className="bg-[#F9F9F7] rounded-md p-2.5 text-center">
                    <p className="text-lg font-bold tabular-nums" style={{ color: m.color }}>{m.value}</p>
                    <p className="text-[9px] text-[#6B6562] uppercase tracking-wide">{m.label}</p>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between text-[11px] text-[#6B6562]">
                <div className="flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  <span>{rm.calls_this_week || 0} calls this week</span>
                </div>
                <span className={`font-semibold ${(rm.task_completion_rate || 0) >= 80 ? 'text-[#6B132B]' : (rm.task_completion_rate || 0) >= 50 ? 'text-[#B46B3E]' : 'text-[#2A161B]'}`}>
                  {rm.task_completion_rate || 0}% tasks done
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="bg-white rounded-md border border-soft p-12 text-center">
          <Users className="w-10 h-10 text-[#8B8481] mx-auto mb-3" />
          <p className="text-[#2A161B] font-medium">No RMs found</p>
          <p className="text-[#6B6562] text-sm mt-1">Try a different search term</p>
        </div>
      )}
    </div>
  );
}
