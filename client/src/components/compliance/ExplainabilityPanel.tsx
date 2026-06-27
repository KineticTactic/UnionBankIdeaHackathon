'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { BarChart2, RefreshCw, Info } from 'lucide-react';

interface ShapValue {
  feature:      string;
  label:        string;
  group:        string;
  direction:    'increases_risk' | 'decreases_risk';
  contribution: number;
  value:        number | null;
  normalised:   number;
  weight:       number;
}

interface Explanation {
  modelName:        string;
  churnProbability: number | null;
  riskTier:         string;
  shapValues:       ShapValue[];
  topDrivers:       ShapValue[];
  narrative:        string;
  legalBasis:       string;
  disclaimer:       string;
}

const GROUP_COLORS: Record<string, string> = {
  financial:   '#dc2626',
  behavioural: '#ea580c',
  digital:     '#7c3aed',
  sentiment:   '#db2777',
  profile:     '#0284c7',
};

export function ExplainabilityPanel({ customerId }: { customerId: string }) {
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const r = await api.getChurnExplanation(customerId);
      setExplanation(r.explanation || null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load explanation');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [customerId]);

  const maxContrib = explanation ? Math.max(...explanation.topDrivers.map(d => Math.abs(d.contribution))) : 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[13px] font-bold text-slate-800 flex items-center gap-1.5">
            <BarChart2 className="w-4 h-4 text-[#0f2d5c]" />
            Score Explainability
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">RBI AI Governance 2024 + GDPR Article 22 — meaningful explanation of automated decisions</p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {loading && (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="h-8 bg-slate-100 rounded animate-pulse" />)}
        </div>
      )}

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-[12px] text-red-600">{error}</div>
      )}

      {explanation && !loading && (
        <>
          {/* Narrative */}
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
            <p className="text-[12px] text-slate-700 leading-relaxed">{explanation.narrative}</p>
          </div>

          {/* Top drivers bar chart */}
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">
              Top Score Drivers — {explanation.modelName}
            </p>
            <div className="space-y-2.5">
              {explanation.topDrivers.map(d => {
                const width   = maxContrib > 0 ? (Math.abs(d.contribution) / maxContrib) * 100 : 0;
                const barColor = GROUP_COLORS[d.group] || '#64748b';
                return (
                  <div key={d.feature} className="space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-700">{d.label}</span>
                      <div className="flex items-center gap-2">
                        {d.value !== null && (
                          <span className="text-[10px] text-slate-400">value: {typeof d.value === 'number' ? d.value.toFixed(d.value < 1 ? 2 : 0) : d.value}</span>
                        )}
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                          d.direction === 'increases_risk'
                            ? 'bg-red-50 text-red-600'
                            : 'bg-green-50 text-green-600'
                        }`}>
                          {d.direction === 'increases_risk' ? '↑ risk' : '↓ risk'}
                        </span>
                        <span className="text-[11px] font-bold tabular-nums" style={{color: barColor}}>
                          {(d.contribution * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${width}%`, backgroundColor: barColor }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-start gap-2 text-[10px] text-slate-400 border border-slate-100 rounded-lg p-2.5">
            <Info className="w-3 h-3 mt-0.5 shrink-0" />
            {explanation.disclaimer}
          </div>
        </>
      )}
    </div>
  );
}
