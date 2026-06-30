'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getToken, api } from '@/lib/api';
import { UpliftStats } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts';
import { BiasAuditCard } from '@/components/compliance/BiasAuditCard';

export default function AnalyticsPage() {
  const router  = useRouter();
  const [uplift,  setUplift]  = useState<UpliftStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) { router.push('/login'); return; }
    api.getUpliftStats()
      .then((uRes) => { setUplift(uRes.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  return (
    <div className="p-6 space-y-8 bg-[#F9F9F7] min-h-screen">
      <div>
        <h1 className="text-[22px] font-black text-[#2A161B] font-heading">VERDICT — Causal Uplift Measurement</h1>
        <p className="text-[13px] text-[#6B6562] mt-0.5">Doubly-robust ATE estimation · Qini curves · bias audit</p>
      </div>

      {/* Bias Audit — RBI AI Governance 2024 §9 */}
      <BiasAuditCard />

      {loading ? (
        <div className="space-y-4">{Array.from({length:4}).map((_,i)=><Skeleton key={i} className="h-48 rounded-md"/>)}</div>
      ) : (
        <>
          {/* ── VERDICT ──────────────────────────────────────────────────── */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-5 rounded bg-[#6B132B]" />
              <h2 className="text-[16px] font-black text-[#2A161B] font-heading">L6 · VERDICT — Causal Uplift Measurement</h2>
            </div>

            {uplift && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                  {[
                    { label: 'DR-ATE', value: `+${(uplift.ate_doubly_robust*100).toFixed(2)} pp`, sub: 'doubly-robust estimate', color: '#6B132B' },
                    { label: '90% CI', value: `[${(uplift.ate_ci_lower*100).toFixed(2)}, ${(uplift.ate_ci_upper*100).toFixed(2)}]`, sub: 'bootstrap CI', color: '#B46B3E' },
                    { label: 'Qini Coeff', value: uplift.qini_coefficient.toFixed(4), sub: 'uplift concentration', color: '#6B132B' },
                    { label: 'Treated', value: `${(uplift.treated_visit_rate*100).toFixed(1)}%`, sub: `${uplift.n_treated} customers`, color: '#B46B3E' },
                    { label: 'Control', value: `${(uplift.control_visit_rate*100).toFixed(1)}%`, sub: `${uplift.n_control} customers`, color: '#6B6562' },
                  ].map(({label,value,sub,color}) => (
                    <div key={label} className="bg-white rounded-md border border-soft p-4">
                      <p className="text-[10px] font-semibold text-[#6B6562] uppercase tracking-wider mb-1 font-heading">{label}</p>
                      <p className="text-lg font-black tabular-nums" style={{color}}>{value}</p>
                      <p className="text-[10px] text-[#6B6562] mt-0.5">{sub}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="bg-white rounded-md border border-soft p-5">
                    <h3 className="text-[13px] font-bold text-[#2A161B] mb-1 font-heading">Qini Uplift Curve</h3>
                    <p className="text-[11px] text-[#6B6562] mb-4">Cumulative uplift vs random targeting · higher = better model discrimination</p>
                    <ResponsiveContainer width="100%" height={200}>
                      <AreaChart data={uplift.qini_curve} margin={{top:4,right:4,left:-20,bottom:0}}>
                        <defs>
                          <linearGradient id="qiniGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%"   stopColor="#6B132B" stopOpacity={0.15}/>
                            <stop offset="100%" stopColor="#6B132B" stopOpacity={0.01}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E0DF" />
                        <XAxis dataKey="pct" tickFormatter={v=>`${(v*100).toFixed(0)}%`} tick={{fontSize:10,fill:'#8B8481'}} axisLine={false} tickLine={false} />
                        <YAxis tick={{fontSize:10,fill:'#8B8481'}} axisLine={false} tickLine={false} />
                        <Tooltip formatter={(v)=>[Number(v).toFixed(4),'Uplift']} contentStyle={{fontSize:11,borderRadius:6,border:'1px solid #E5E0DF'}} labelFormatter={v=>`Top ${(Number(v)*100).toFixed(0)}%`} />
                        <Area type="monotone" dataKey="uplift" stroke="#6B132B" strokeWidth={2.5} fill="url(#qiniGrad)" dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="bg-white rounded-md border border-soft p-5">
                    <h3 className="text-[13px] font-bold text-[#2A161B] mb-1 font-heading">Treated vs Control</h3>
                    <p className="text-[11px] text-[#6B6562] mb-4">Visit rate comparison · doubly-robust ATE isolates treatment effect from selection bias</p>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={[
                        {group:'Control',  rate: uplift.control_visit_rate*100,  n: uplift.n_control},
                        {group:'Treated',  rate: uplift.treated_visit_rate*100,  n: uplift.n_treated},
                      ]} margin={{top:4,right:4,left:-10,bottom:0}}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E0DF" />
                        <XAxis dataKey="group" tick={{fontSize:11,fill:'#6B6562'}} axisLine={false} tickLine={false} />
                        <YAxis tickFormatter={v=>`${Number(v).toFixed(0)}%`} tick={{fontSize:10,fill:'#8B8481'}} axisLine={false} tickLine={false} />
                        <Tooltip formatter={(v)=>[`${Number(v).toFixed(1)}%`,'Visit Rate']} contentStyle={{fontSize:11,borderRadius:6}} />
                        <Bar dataKey="rate" fill="#6B6562" radius={[4,4,0,0]} maxBarSize={60} />
                      </BarChart>
                    </ResponsiveContainer>
                    <p className="mt-3 text-[12px] text-[#2A161B] text-center">
                      Uplift = <strong className="text-[#6B132B]">+{((uplift.treated_visit_rate-uplift.control_visit_rate)*100).toFixed(1)} pp</strong> visit rate lift from email campaign
                    </p>
                  </div>
                </div>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
