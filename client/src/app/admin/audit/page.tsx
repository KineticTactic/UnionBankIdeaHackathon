'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { FileText, Download, Sparkles, RefreshCw, Clock, CheckCircle2 } from 'lucide-react';

const REPORT_TYPES = [
  { value: 'churn_intervention', label: 'Churn Intervention Report', desc: 'Save rate, at-risk distribution, intervention outcomes' },
  { value: 'compliance_audit',   label: 'Compliance Audit',          desc: 'Consent coverage, opt-outs, DPDPA/TRAI status' },
  { value: 'rm_performance',     label: 'RM Performance Report',     desc: 'Activity, saves, task completion per RM' },
  { value: 'model_accuracy',     label: 'Model Accuracy Report',     desc: 'AUC, precision/recall per ML model layer' },
];

function fmtDate(dt?: string) {
  if (!dt) return '—';
  try { return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(dt)); }
  catch { return dt; }
}

export default function AuditReportsPage() {
  const [history, setHistory]  = useState<any[]>([]);
  const [loading, setLoading]  = useState(true);
  const [generating, setGen]   = useState(false);
  const [generated, setGenerated] = useState<any>(null);
  const [form, setForm] = useState({
    report_type: 'churn_intervention',
    date_from: '2026-06-01',
    date_to: '2026-06-30',
    include_llm_summary: true,
  });

  const loadHistory = async () => {
    setLoading(true);
    try { const r = await api.getReportHistory(); setHistory(r.reports || []); } catch {}
    setLoading(false);
  };

  useEffect(() => { loadHistory(); }, []);

  const handleGenerate = async () => {
    setGen(true);
    setGenerated(null);
    try {
      const r = await api.generateReport(form);
      setGenerated(r.report);
      loadHistory();
    } catch {}
    setGen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Audit Reports</h1>
          <p className="text-white/40 text-sm mt-0.5">Generate and download compliance & performance reports</p>
        </div>
        <button onClick={loadHistory} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/6 hover:bg-white/10 text-white/60 hover:text-white text-xs transition-all">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Report builder */}
        <div className="lg:col-span-2 rounded-xl border border-white/10 bg-white/4 p-5 space-y-4 h-fit">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40">Generate Report</p>

          <div>
            <label className="text-[11px] text-white/40 font-semibold uppercase tracking-widest block mb-1.5">Report Type</label>
            <select
              value={form.report_type}
              onChange={e => setForm(f => ({ ...f, report_type: e.target.value }))}
              className="w-full rounded-xl bg-white/6 border border-white/10 text-sm text-white p-3 focus:outline-none focus:border-white/30"
            >
              {REPORT_TYPES.map(rt => (
                <option key={rt.value} value={rt.value}>{rt.label}</option>
              ))}
            </select>
            <p className="text-[11px] text-white/30 mt-1.5">
              {REPORT_TYPES.find(r => r.value === form.report_type)?.desc}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-white/40 font-semibold uppercase tracking-widest block mb-1.5">Date From</label>
              <input
                type="date"
                value={form.date_from}
                onChange={e => setForm(f => ({ ...f, date_from: e.target.value }))}
                className="w-full rounded-xl bg-white/6 border border-white/10 text-sm text-white p-3 focus:outline-none focus:border-white/30"
              />
            </div>
            <div>
              <label className="text-[11px] text-white/40 font-semibold uppercase tracking-widest block mb-1.5">Date To</label>
              <input
                type="date"
                value={form.date_to}
                onChange={e => setForm(f => ({ ...f, date_to: e.target.value }))}
                className="w-full rounded-xl bg-white/6 border border-white/10 text-sm text-white p-3 focus:outline-none focus:border-white/30"
              />
            </div>
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.include_llm_summary}
              onChange={e => setForm(f => ({ ...f, include_llm_summary: e.target.checked }))}
              className="w-4 h-4 rounded accent-amber-500"
            />
            <span className="text-sm text-white/70">Include HERALD AI summary</span>
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          </label>

          <button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full py-3 rounded-xl bg-[#0f2d5c] border border-white/20 text-white font-semibold text-sm hover:bg-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {generating ? <><RefreshCw className="w-4 h-4 animate-spin" />Generating…</> : <><FileText className="w-4 h-4" />Generate Report</>}
          </button>
        </div>

        {/* Right: generated result + history */}
        <div className="lg:col-span-3 space-y-4">
          {/* Generated report */}
          {generated && (
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <p className="text-sm font-bold text-white">Report Generated</p>
                </div>
                <span className="text-[10px] text-white/30">{generated.id}</span>
              </div>
              <p className="text-[11px] text-white/40">{fmtDate(generated.generated_at)}</p>

              {generated.llm_summary && (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/8 p-3">
                  <p className="text-[10px] text-amber-400 font-semibold uppercase tracking-widest mb-1 flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3" />HERALD AI Summary
                  </p>
                  <p className="text-sm text-white/70 leading-relaxed">{generated.llm_summary}</p>
                </div>
              )}

              <div className="rounded-lg bg-white/5 border border-white/8 p-3">
                <p className="text-[10px] text-white/30 font-semibold uppercase tracking-widest mb-2">Data</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                  {Object.entries(generated.data || {}).map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between py-0.5">
                      <span className="text-[11px] text-white/40 capitalize">{k.replace(/_/g,' ')}</span>
                      <span className="text-[11px] text-white font-mono">{String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* History */}
          <div className="rounded-xl border border-white/8 bg-white/4 overflow-hidden">
            <div className="px-5 py-3 border-b border-white/8">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40">Report History</p>
            </div>
            {loading && <p className="px-5 py-8 text-white/30 text-sm animate-pulse">Loading…</p>}
            {!loading && history.length === 0 && <p className="px-5 py-8 text-white/30 text-sm">No reports generated yet.</p>}
            {history.map((r: any) => (
              <div key={r.id} className="flex items-center gap-4 px-5 py-3.5 border-b border-white/5 last:border-0 hover:bg-white/4 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-white/6 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 text-white/50" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {REPORT_TYPES.find(rt => rt.value === r.report_type)?.label || r.report_type}
                  </p>
                  <p className="text-[11px] text-white/35">
                    {r.date_from} → {r.date_to} · by {r.generated_by}
                    {r.llm_summary && <span className="ml-2 text-amber-400/60">+ AI</span>}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 text-[11px] text-white/25">
                  <Clock className="w-3 h-3" />{fmtDate(r.generated_at)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
