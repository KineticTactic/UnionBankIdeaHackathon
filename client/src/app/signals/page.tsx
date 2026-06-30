'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getToken, api } from '@/lib/api';
import { RiskTier } from '@/types';
import RiskBadge, { tierColor } from '@/components/RiskBadge';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Activity, AlertTriangle } from 'lucide-react';

const METHOD_COLORS: Record<string, string> = {
  SR:    'bg-[#FAF0E6] text-[#B46B3E]',
  CUSUM: 'bg-[#F5E6E9] text-[#6B132B]',
  SPRT:  'bg-[#F4D9C0] text-[#2A161B]',
};

interface SignalEntry {
  customer_id:  string;
  customer_name?: string;
  risk_tier?:   RiskTier;
  signal_type:  string;
  method:       string;
  confidence:   number;
  cusum_value:  number;
  days_active:  number;
}

interface SignalsData {
  customer_id: string;
  alarm_count: number;
  signals:     SignalEntry[];
}

export default function SignalsPage() {
  const router  = useRouter();
  const [data,  setData]  = useState<SignalsData[]>([]);
  const [custs, setCusts] = useState<Record<string,{full_name:string;risk_tier:RiskTier}>>({});
  const [loading,setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) { router.push('/login'); return; }
    const load = () => Promise.all([api.getV2Signals(), api.getCustomers({ limit: 100 })])
      .then(([sigRes, custRes]) => {
        setData(sigRes.data || []);
        const map: Record<string,{full_name:string;risk_tier:RiskTier}> = {};
        (custRes.customers || []).forEach((c: {customer_id:string;full_name:string;risk_tier:RiskTier}) => {
          map[c.customer_id] = { full_name: c.full_name, risk_tier: c.risk_tier };
        });
        setCusts(map);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    load();
    // Poll every 5s so live ARGUS evaluations and Kafka events appear
    // without a manual refresh — the demo runs end-to-end from the TUI.
    const interval = setInterval(load, 5_000);
    return () => clearInterval(interval);
  }, [router]);

  // Flatten all signals with customer info
  const allSignals: SignalEntry[] = data.flatMap(d =>
    d.signals.map(s => ({
      ...s,
      customer_id:   d.customer_id,
      customer_name: custs[d.customer_id]?.full_name || d.customer_id,
      risk_tier:     custs[d.customer_id]?.risk_tier,
    }))
  ).sort((a, b) => b.cusum_value - a.cusum_value);

  const totalAlarms = allSignals.length;

  // Signal type breakdown
  const typeBreakdown = Object.entries(
    allSignals.reduce((acc, s) => {
      acc[s.signal_type] = (acc[s.signal_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([type, count]) => ({ type: type.replace(/_/g,' '), count }))
   .sort((a,b) => b.count - a.count);

  // Customers with signals
  const customersWithSignals = data.filter(d => d.alarm_count > 0)
    .sort((a,b) => b.alarm_count - a.alarm_count);

  return (
    <div className="p-6 space-y-6 bg-[#F9F9F7] min-h-screen">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-black text-[#2A161B] font-heading">ARGUS Signal Monitor</h1>
          <p className="text-[13px] text-[#6B6562] mt-0.5">Statistical changepoint detection · 9 signal streams</p>
        </div>
        <div className="flex items-center gap-2 bg-white border border-soft rounded-md px-4 py-2">
          <AlertTriangle className="w-4 h-4 text-[#B46B3E]" />
          <span className="text-[18px] font-black text-[#2A161B]">{totalAlarms}</span>
          <span className="text-[12px] text-[#6B6562]">active alarms</span>
        </div>
      </div>

      {loading ? <Skeleton className="h-64 rounded-md" /> : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Signal breakdown chart */}
            <div className="bg-white rounded-md border border-soft p-5">
              <h2 className="text-[14px] font-bold text-[#2A161B] mb-4 font-heading">Alarm Count by Signal Type</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={typeBreakdown} layout="vertical" margin={{top:0,right:10,left:80,bottom:0}}>
                  <XAxis type="number" tick={{fontSize:10,fill:'#8B8481'}} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="type" tick={{fontSize:10,fill:'#6B6562'}} axisLine={false} tickLine={false} width={80} />
                  <Tooltip contentStyle={{fontSize:11,borderRadius:6,border:'1px solid #E5E0DF'}} />
                  <Bar dataKey="count" fill="#6B132B" radius={[0,3,3,0]} maxBarSize={12} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Top customers by alarm count */}
            <div className="bg-white rounded-md border border-soft p-5">
              <h2 className="text-[14px] font-bold text-[#2A161B] mb-4 font-heading">Customers by Alarm Count</h2>
              <div className="space-y-2">
                {customersWithSignals.slice(0, 10).map(d => {
                  const info = custs[d.customer_id];
                  return (
                    <Link key={d.customer_id} href={`/customers/${d.customer_id}`}
                      className="flex items-center gap-3 hover:bg-[#F9F9F7] px-2 py-1.5 rounded-md transition-colors group">
                      <div className="w-7 h-7 rounded-full bg-[#F9F9F7] flex items-center justify-center text-[10px] font-bold text-[#6B6562] shrink-0">
                        {info?.full_name?.split(' ').map(n=>n[0]).join('').slice(0,2) || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold text-[#2A161B] truncate group-hover:text-[#6B132B]">{info?.full_name || d.customer_id}</p>
                        <p className="text-[10px] text-[#6B6562]">{d.customer_id}</p>
                      </div>
                      {info?.risk_tier && <RiskBadge tier={info.risk_tier} size="sm" />}
                      <span className="text-[12px] font-bold text-[#2A161B]">{d.alarm_count}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Method breakdown */}
            <div className="bg-white rounded-md border border-soft p-5">
              <h2 className="text-[14px] font-bold text-[#2A161B] mb-4 font-heading">Detection Method Distribution</h2>
              <div className="space-y-3">
                {['SR','CUSUM','SPRT'].map(method => {
                  const count = allSignals.filter(s => s.method === method).length;
                  const pct   = totalAlarms > 0 ? count/totalAlarms : 0;
                  return (
                    <div key={method}>
                      <div className="flex justify-between mb-1">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${METHOD_COLORS[method]}`}>{method}</span>
                        <span className="text-[11px] font-semibold text-[#2A161B]">{count} ({(pct*100).toFixed(0)}%)</span>
                      </div>
                      <div className="h-2 bg-[#F9F9F7] rounded-full overflow-hidden">
                        <div className="h-full bg-[#6B132B] rounded-full" style={{width:`${pct*100}%`}} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-6 space-y-2">
                <p className="text-[10px] font-semibold text-[#6B6562] uppercase tracking-wider font-heading">Method legend</p>
                <p className="text-[10px] text-[#6B6562]"><strong className="text-[#B46B3E]">SR</strong> — Shiryaev-Roberts: optimal for gradual distant changepoints</p>
                <p className="text-[10px] text-[#6B6562]"><strong className="text-[#6B132B]">CUSUM</strong> — Two-sided CUSUM: fast one-step changes (increase or decrease)</p>
                <p className="text-[10px] text-[#6B6562]"><strong className="text-[#2A161B]">SPRT</strong> — Wald SPRT: sequential binomial/Poisson test (complaints, salary)</p>
              </div>
            </div>
          </div>

          {/* Active alarms table */}
          <div className="bg-white rounded-md border border-soft overflow-hidden">
            <div className="px-5 py-3 border-b border-soft bg-[#F9F9F7]">
              <h2 className="text-[14px] font-bold text-[#2A161B] font-heading">Active Alarm Log</h2>
              <p className="text-[11px] text-[#6B6562]">Sorted by CUSUM value (highest first)</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-soft text-[10px] text-[#6B6562] uppercase tracking-wider font-heading">
                    {['Customer','Risk Tier','Signal Type','Method','Confidence','CUSUM Value','Days Active'].map(h => (
                      <th key={h} className="text-left py-2.5 px-4 font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allSignals.slice(0, 40).map((s, i) => (
                    <tr key={i} className="border-b border-soft hover:bg-[#F9F9F7] transition-colors">
                      <td className="py-2 px-4">
                        <Link href={`/customers/${s.customer_id}`}
                          className="font-semibold text-[#2A161B] hover:text-[#6B132B] transition-colors">
                          {s.customer_name}
                        </Link>
                      </td>
                      <td className="py-2 px-4">
                        {s.risk_tier && <RiskBadge tier={s.risk_tier} />}
                      </td>
                      <td className="py-2 px-4 capitalize text-[#2A161B]">{s.signal_type.replace(/_/g,' ')}</td>
                      <td className="py-2 px-4">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${METHOD_COLORS[s.method] || 'bg-[#F9F9F7] text-[#6B6562]'}`}>
                          {s.method}
                        </span>
                      </td>
                      <td className="py-2 px-4 tabular-nums font-semibold text-[#2A161B]">{(s.confidence*100).toFixed(0)}%</td>
                      <td className="py-2 px-4 tabular-nums font-bold" style={{color: s.cusum_value > 15 ? '#6B132B' : '#B46B3E'}}>
                        {s.cusum_value?.toFixed(1)}
                      </td>
                      <td className="py-2 px-4 text-[#6B6562]">{s.days_active}d</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
