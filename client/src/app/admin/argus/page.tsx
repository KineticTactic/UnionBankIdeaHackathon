'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import {
  Activity, Zap, Target, AlertTriangle, TrendingUp,
  Radio, Shield, BarChart2, RefreshCw,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts';

const METHOD_COLOR: Record<string, string> = {
  'Beta-CUSUM':  '#0891b2',
  'CUSUM':       'var(--crimson)',
  'Adaptive SR': 'var(--teal-dark)',
  'CFSI':        'var(--crimson)',
  'TEMPO':       'var(--sage-brand)',
};

const SENSITIVITY_BADGE: Record<string, string> = {
  High:         'bg-crimson-soft text-crimson',
  Medium:       'bg-copper-soft text-copper-dark',
  Low:          'bg-teal-soft text-teal-dark',
  'Low drift':  'bg-teal-soft text-teal-dark',
  Proportional: 'bg-teal-soft text-teal-dark',
  'High stress':'bg-crimson-soft text-crimson',
  'Sudden spikes':'bg-copper-soft text-copper-dark',
  Baseline:     'bg-sage-soft text-sage-brand',
};

export default function ArgusPage() {
  const [data,    setData]    = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.getArgusModelStats()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const agents:  any[] = data?.agents  || [];
  const methods: any[] = data?.methods || [];
  const summary: any   = data?.summary || {};

  const chartData = [...agents].sort((a, b) => b.fires - a.fires);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-black text-slate-900">ARGUS Signal Intelligence</h1>
          <p className="text-[13px] text-slate-400 mt-0.5">
            9 signal agents · 5 detection methods · Layer 2 statistical anomaly detection
          </p>
        </div>
        <button onClick={load}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-700 text-xs shadow-sm transition-all">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-36 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Radio,        label: 'Signal Agents',        value: '9',                              color: 'var(--crimson)' },
              { icon: Zap,          label: 'Fires Last 30d',       value: summary.total_signal_fires_30d,   color: '#0891b2' },
              { icon: Target,       label: 'Alarm Rate',           value: `${(+summary.alarm_rate * 100).toFixed(1)}%`, color: summary.alarm_rate > 0.3 ? 'var(--crimson)' : 'var(--sage-brand)' },
              { icon: BarChart2,    label: 'Avg Signals/Customer', value: summary.avg_signals_per_customer, color: 'var(--teal-dark)' },
            ].map(({ icon: Icon, label, value, color }) => (
              <div key={label} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${color}18` }}>
                  <Icon className="w-4 h-4" style={{ color }} />
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
                  <p className="text-xl font-black text-slate-900">{value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Signal Agents grid */}
          <div>
            <h2 className="text-[14px] font-bold text-slate-800 mb-3">Signal Agents</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {agents.map((a: any) => (
                <div key={a.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black text-white shrink-0"
                        style={{ backgroundColor: a.color }}>
                        {a.abbr}
                      </div>
                      <div>
                        <p className="text-[13px] font-bold text-slate-900 leading-tight">{a.name}</p>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                          style={{ backgroundColor: `${METHOD_COLOR[a.method]}18`, color: METHOD_COLOR[a.method] }}>
                          {a.method}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[18px] font-black tabular-nums" style={{ color: a.color }}>{a.fires}</p>
                      <p className="text-[9px] text-slate-400">fires/30d</p>
                    </div>
                  </div>

                  <div className="mb-3">
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="text-slate-400">Accuracy</span>
                      <span className="font-bold text-slate-800">{(a.accuracy * 100).toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${a.accuracy * 100}%`, backgroundColor: a.color }} />
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500 leading-relaxed mb-3">{a.desc}</p>

                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${SENSITIVITY_BADGE[a.sensitivity] || 'bg-slate-100 text-slate-600'}`}>
                      {a.sensitivity} sensitivity
                    </span>
                    {a.suppressed > 0 && (
                      <span className="text-[10px] text-slate-400">{a.suppressed} suppressed</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Fires by agent */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h2 className="text-[14px] font-bold text-slate-800 mb-1">Signal Fires by Agent (30d)</h2>
              <p className="text-[11px] text-slate-400 mb-4">Number of anomaly detections per signal agent</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--secondary)" />
                  <XAxis dataKey="abbr" tick={{ fontSize: 10, fill: 'var(--gray-400)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--gray-400)' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(v) => [v, 'Fires']}
                    labelFormatter={(l) => chartData.find(d => d.abbr === l)?.name || l}
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid var(--border-color)' }}
                  />
                  <Bar dataKey="fires" radius={[4, 4, 0, 0]} maxBarSize={36}>
                    {chartData.map((d: any) => <Cell key={d.id} fill={d.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Accuracy by agent */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h2 className="text-[14px] font-bold text-slate-800 mb-1">Agent Accuracy</h2>
              <p className="text-[11px] text-slate-400 mb-4">Signal precision validated against outcome labels</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={[...agents].sort((a, b) => b.accuracy - a.accuracy)}
                  margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--secondary)" />
                  <XAxis dataKey="abbr" tick={{ fontSize: 10, fill: 'var(--gray-400)' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0.7, 1]} tickFormatter={v => `${(Number(v) * 100).toFixed(0)}%`} tick={{ fontSize: 10, fill: 'var(--gray-400)' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(v) => [`${(Number(v) * 100).toFixed(1)}%`, 'Accuracy']}
                    labelFormatter={(l) => agents.find((d: any) => d.abbr === l)?.name || l}
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid var(--border-color)' }}
                  />
                  <Bar dataKey="accuracy" radius={[4, 4, 0, 0]} maxBarSize={36}>
                    {[...agents].sort((a, b) => b.accuracy - a.accuracy).map((d: any) => (
                      <Cell key={d.id} fill={d.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Detection Methods */}
          <div>
            <h2 className="text-[14px] font-bold text-slate-800 mb-3">Detection Methods</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {methods.map((m: any) => (
                <div key={m.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-[15px] font-black text-slate-900">{m.name}</p>
                      <p className="text-[10px] text-slate-400">{m.full}</p>
                    </div>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${m.color}18` }}>
                      <Activity className="w-4 h-4" style={{ color: m.color }} />
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed mb-3">{m.desc}</p>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-slate-400">Parameters</span>
                      <code className="text-slate-700 font-mono">{m.params}</code>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-slate-400">Agents using</span>
                      <span className="font-bold text-slate-700">{m.agents}</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-slate-400">Best for</span>
                      <span className={`font-semibold px-1.5 py-0.5 rounded-full text-[9px] ${SENSITIVITY_BADGE[m.sensitivity] || 'bg-slate-100 text-slate-600'}`}>
                        {m.sensitivity}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tier distribution */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h2 className="text-[14px] font-bold text-slate-800 mb-1">Current Risk Tier Distribution</h2>
            <p className="text-[11px] text-slate-400 mb-4">
              Portfolio snapshot · {summary.total_customers} customers
            </p>
            <div className="flex gap-1 h-8 rounded-lg overflow-hidden">
              {[
                { tier: 'PRIORITY', color: 'var(--crimson)' },
                { tier: 'ESCALATE', color: 'var(--copper)' },
                { tier: 'STANDARD', color: 'var(--copper)' },
                { tier: 'MONITOR',  color: 'var(--teal)' },
                { tier: 'NONE',     color: 'var(--sage-brand)' },
              ].map(({ tier, color }) => {
                const count = summary.tier_distribution?.[tier] || 0;
                const pct   = summary.total_customers ? (count / summary.total_customers) * 100 : 0;
                return pct > 0 ? (
                  <div key={tier} style={{ width: `${pct}%`, backgroundColor: color }}
                    className="flex items-center justify-center text-white text-[9px] font-bold" title={`${tier}: ${count}`}>
                    {pct > 8 ? count : ''}
                  </div>
                ) : null;
              })}
            </div>
            <div className="flex gap-4 mt-3 flex-wrap">
              {[
                { tier: 'PRIORITY', color: 'var(--crimson)' },
                { tier: 'ESCALATE', color: 'var(--copper)' },
                { tier: 'STANDARD', color: 'var(--copper)' },
                { tier: 'MONITOR',  color: 'var(--teal)' },
                { tier: 'NONE',     color: 'var(--sage-brand)' },
              ].map(({ tier, color }) => (
                <div key={tier} className="flex items-center gap-1.5 text-[11px]">
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-slate-600">{tier}</span>
                  <span className="font-bold text-slate-800">{summary.tier_distribution?.[tier] || 0}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
