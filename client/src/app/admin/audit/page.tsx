'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { RefreshCw, FileText, CheckCircle2, Cpu, Users, TrendingUp, AlertTriangle, ChevronDown, ChevronUp, Download } from 'lucide-react';

const REPORT_TYPES = [
  { id: 'churn_intervention', label: 'Churn Intervention',  icon: TrendingUp,    desc: 'At-risk customers, interventions, save rate' },
  { id: 'compliance_audit',   label: 'Compliance Audit',    icon: AlertTriangle,  desc: 'Call compliance, consent coverage, flags' },
  { id: 'rm_activity',        label: 'RM Activity',         icon: Users,          desc: 'Per-RM calls, outcomes, task completion' },
  { id: 'bias_review',        label: 'Bias Review',         icon: Cpu,            desc: 'Tier distribution by customer segment' },
];

function fmtDate(d?: string) {
  if (!d) return '—';
  try { return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(d)); }
  catch { return d; }
}

function exportReportPdf(report: any) {
  const d = report.data;
  const ci = d.churn_intervention;
  const ca = d.compliance_audit;
  const rm: any[] = d.rm_activity || [];
  const label = REPORT_TYPES.find(t => t.id === report.report_type)?.label || report.report_type;

  const kpiRow = (items: { label: string; value: any }[]) =>
    `<div style="display:grid;grid-template-columns:repeat(${items.length},1fr);gap:12px;margin-bottom:20px">
      ${items.map(m => `<div style="border:1px solid var(--border-color);border-radius:8px;padding:12px;border-left:4px solid var(--crimson)">
        <div style="font-size:10px;color:var(--gray-400);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">${m.label}</div>
        <div style="font-size:22px;font-weight:700;color:var(--gray-700)">${m.value ?? '—'}</div>
      </div>`).join('')}
    </div>`;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>PCOP Report — ${label}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;color:var(--gray-700);padding:40px;background:#fff}
    h1{font-size:22px;font-weight:700;color:var(--crimson);margin-bottom:4px}
    h2{font-size:13px;font-weight:700;color:var(--gray-600);text-transform:uppercase;letter-spacing:.06em;margin:24px 0 10px}
    .meta{font-size:11px;color:var(--gray-400);margin-bottom:24px}
    table{width:100%;border-collapse:collapse;font-size:12px}
    th{background:var(--background);padding:8px 12px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:var(--gray-500);border-bottom:1px solid var(--border-color)}
    td{padding:8px 12px;border-bottom:1px solid var(--secondary)}
    .llm{background:#faf5ff;border:1px solid #e9d5ff;border-radius:8px;padding:16px;margin-top:4px}
    .llm-title{font-size:10px;font-weight:700;color:#7e22ce;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px}
    .llm-body{font-size:12px;color:#374151;line-height:1.7;white-space:pre-wrap}
    .hash-box{background:var(--background);border:1px solid var(--border-color);border-radius:8px;padding:12px;margin-top:4px}
    .hash-row{display:flex;gap:16px;font-size:11px;margin-bottom:4px}
    .hash-key{color:var(--gray-500);width:80px;flex-shrink:0}
    .hash-val{font-family:monospace;color:var(--gray-400)}
    .footer{margin-top:32px;padding-top:16px;border-top:1px solid var(--border-color);font-size:10px;color:var(--gray-400);display:flex;justify-content:space-between}
    @media print{body{padding:20px}}
  </style></head><body>
  <h1>PCOP Audit Report — ${label}</h1>
  <div class="meta">${report.id} &nbsp;·&nbsp; Generated ${fmtDate(report.generated_at)} by ${report.generated_by}${d.period?.from && d.period.from !== 'all' ? ` &nbsp;·&nbsp; Period: ${d.period.from} → ${d.period.to || 'now'}` : ''}</div>

  ${ci ? `<h2>Churn Intervention</h2>${kpiRow([
    {label:'Total Customers', value:ci.total_customers},
    {label:'At-Risk',         value:ci.at_risk},
    {label:'Interventions',   value:ci.interventions},
    {label:'Saves',           value:ci.saves},
    {label:'Save Rate',       value:ci.save_rate},
  ])}` : ''}

  ${ca ? `<h2>Compliance Audit</h2>${kpiRow([
    {label:'Customers',         value:ca.total_customers},
    {label:'Calls Recorded',    value:ca.calls_recorded},
    {label:'Compliance Flags',  value:ca.compliance_flags},
    {label:'Consent Coverage',  value:ca.consent_coverage},
    {label:'Tasks Completed',   value:ca.tasks_completed},
  ])}` : ''}

  ${rm.length ? `<h2>RM Activity</h2>
  <table><thead><tr><th>Relationship Manager</th><th>Username</th><th>Calls</th><th>Outcomes</th><th>Tasks</th></tr></thead><tbody>
  ${rm.map(r => `<tr><td>${r.rm_name}</td><td>@${r.username}</td><td>${r.calls}</td><td>${r.outcomes}</td><td>${r.tasks}</td></tr>`).join('')}
  </tbody></table>` : ''}

  ${report.llm_summary ? `<h2>LLM Executive Summary</h2><div class="llm"><div class="llm-title">AI Narrative — Llama 3.3 70B</div><div class="llm-body">${report.llm_summary}</div></div>` : ''}

  ${report.source_hashes ? `<h2>Audit Trail</h2><div class="hash-box">${Object.entries(report.source_hashes).map(([k,v]) => `<div class="hash-row"><span class="hash-key">${k}</span><span class="hash-val">${v}</span></div>`).join('')}</div>` : ''}

  <div class="footer">
    <span>PCOP Banking Intelligence Platform — Confidential</span>
    <span>Exported ${new Date().toLocaleString('en-IN')}</span>
  </div>
  <script>window.onload=()=>{window.print();}</script>
  </body></html>`;

  const win = window.open('', '_blank', 'width=900,height=700');
  if (win) { win.document.write(html); win.document.close(); }
}

function ReportViewer({ report }: { report: any }) {
  const d = report?.data;
  if (!d) return null;
  const ci = d.churn_intervention;
  const ca = d.compliance_audit;
  const rm: any[] = d.rm_activity || [];

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--crimson)]/10 flex items-center justify-center shrink-0">
          <FileText className="w-5 h-5 text-[var(--crimson)]" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-slate-900 text-base">
            {REPORT_TYPES.find(t => t.id === report.report_type)?.label || report.report_type}
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {report.id} · Generated {fmtDate(report.generated_at)} by {report.generated_by}
          </p>
          {d.period?.from && d.period.from !== 'all' && (
            <p className="text-[11px] text-slate-400">
              Period: {d.period.from} → {d.period.to || 'now'}
            </p>
          )}
        </div>
        <button onClick={() => exportReportPdf(report)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-[var(--crimson)] hover:border-[var(--crimson)]/30 text-xs font-semibold shadow-sm transition-all shrink-0">
          <Download className="w-3.5 h-3.5" /> Export PDF
        </button>
      </div>

      {/* churn intervention stats */}
      {ci && (
        <div>
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2">Churn Intervention</p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: 'Total Customers', value: ci.total_customers,  accent: 'border-l-[var(--crimson)]' },
              { label: 'At-Risk',         value: ci.at_risk,          accent: 'border-l-red-500' },
              { label: 'Interventions',   value: ci.interventions,    accent: 'border-l-amber-500' },
              { label: 'Saves',           value: ci.saves,            accent: 'border-l-emerald-500' },
              { label: 'Save Rate',       value: ci.save_rate,        accent: 'border-l-purple-500' },
            ].map(m => (
              <div key={m.label} className={`bg-white rounded-xl border border-slate-200 shadow-sm p-4 border-l-4 ${m.accent}`}>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">{m.label}</p>
                <p className="text-xl font-bold text-slate-900 tabular-nums">{m.value ?? '—'}</p>
              </div>
            ))}
          </div>
          {/* save rate bar */}
          {ci.interventions > 0 && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                <span>Save rate</span><span className="font-bold">{ci.save_rate}</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-sage-brand rounded-full"
                  style={{ width: `${parseFloat(ci.save_rate) || 0}%` }} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* compliance audit stats */}
      {ca && (
        <div>
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2">Compliance Audit</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { label: 'Calls Recorded',    value: ca.calls_recorded,   accent: 'border-l-[var(--crimson)]' },
              { label: 'Compliance Flags',  value: ca.compliance_flags,  accent: ca.compliance_flags > 0 ? 'border-l-red-500' : 'border-l-emerald-500' },
              { label: 'Consent Coverage',  value: `${ca.consent_coverage}/${ca.total_customers}`, accent: 'border-l-sky-500' },
              { label: 'Tasks Completed',   value: ca.tasks_completed,   accent: 'border-l-emerald-500' },
              { label: 'Tasks Outstanding', value: ca.tasks_outstanding, accent: ca.tasks_outstanding > 0 ? 'border-l-amber-500' : 'border-l-emerald-500' },
            ].map(m => (
              <div key={m.label} className={`bg-white rounded-xl border border-slate-200 shadow-sm p-4 border-l-4 ${m.accent}`}>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">{m.label}</p>
                <p className="text-xl font-bold text-slate-900 tabular-nums">{m.value ?? '—'}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* RM Activity table */}
      {rm.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2">RM Activity Breakdown</p>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left py-3 px-4 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">RM Name</th>
                  <th className="text-center py-3 px-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Calls</th>
                  <th className="text-center py-3 px-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Outcomes</th>
                  <th className="text-center py-3 px-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Tasks</th>
                  <th className="text-right py-3 px-4 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Efficiency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rm.map((r: any) => {
                  const eff = r.calls > 0 ? Math.round((r.outcomes / r.calls) * 100) : 0;
                  return (
                    <tr key={r.username} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4">
                        <p className="font-semibold text-slate-800">{r.rm_name}</p>
                        <p className="text-[10px] text-slate-400">@{r.username}</p>
                      </td>
                      <td className="py-3 px-3 text-center font-semibold text-slate-700">{r.calls}</td>
                      <td className="py-3 px-3 text-center font-semibold text-slate-700">{r.outcomes}</td>
                      <td className="py-3 px-3 text-center font-semibold text-slate-700">{r.tasks}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-[var(--crimson)] rounded-full" style={{ width: `${eff}%` }} />
                          </div>
                          <span className="text-[11px] font-bold text-slate-700 tabular-nums w-8 text-right">{eff}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* LLM narrative */}
      {report.llm_summary && (
        <div className="bg-teal-soft border border-soft rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Cpu className="w-4 h-4 text-teal-dark" />
            <p className="text-[11px] font-bold text-teal-dark uppercase tracking-widest">LLM Executive Summary</p>
          </div>
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{report.llm_summary}</p>
        </div>
      )}

      {/* source hashes */}
      {report.source_hashes && (
        <details className="bg-slate-50 rounded-xl border border-slate-100 p-4">
          <summary className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest cursor-pointer">
            Audit Trail (source hashes)
          </summary>
          <div className="mt-3 space-y-1">
            {Object.entries(report.source_hashes).map(([k, v]) => (
              <div key={k} className="flex gap-3 text-[11px]">
                <span className="text-slate-500 w-24 shrink-0">{k}</span>
                <span className="font-mono text-slate-400">{String(v)}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

/* ── main page ───────────────────────────────────── */
export default function AuditPage() {
  const [history,    setHistory]    = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [generating, setGenerating] = useState(false);
  const [activeReport, setActiveReport] = useState<any | null>(null);
  const [expandedRow, setExpandedRow]   = useState<string | null>(null);
  const [form, setForm] = useState({
    report_type: 'churn_intervention',
    date_from: '',
    date_to: '',
    include_llm_summary: false,
  });
  const [genError, setGenError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.getReportHistory();
      setHistory(r.reports || []);
    } catch (e: any) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const generate = async () => {
    setGenerating(true);
    setGenError('');
    try {
      const r = await api.generateReport(form as any);
      setActiveReport(r.report);
      await load();
    } catch (e: any) {
      setGenError(e.message || 'Generation failed');
    }
    setGenerating(false);
  };

  const openHistory = (rep: any) => {
    setActiveReport(rep);
    setExpandedRow(rep.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="p-6 space-y-6">
      {/* page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Audit Reports</h1>
          <p className="text-slate-400 text-sm mt-0.5">Generate compliance and performance reports — all data is templated, never LLM-computed</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-700 text-xs shadow-sm transition-all">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* two-column layout */}
      <div className="grid grid-cols-1 xl:grid-cols-[340px_1fr] gap-6 items-start">

        {/* ── left: generate form ── */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-[var(--crimson)]/20 shadow-sm p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-800">Generate New Report</h2>

            {/* report type cards */}
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Report Type</p>
              {REPORT_TYPES.map(t => {
                const Icon = t.icon;
                const sel  = form.report_type === t.id;
                return (
                  <button key={t.id} onClick={() => setForm(f => ({ ...f, report_type: t.id }))}
                    className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                      sel ? 'border-[var(--crimson)] bg-[var(--crimson)]/5' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}>
                    <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${sel ? 'text-[var(--crimson)]' : 'text-slate-400'}`} />
                    <div>
                      <p className={`text-sm font-semibold leading-tight ${sel ? 'text-[var(--crimson)]' : 'text-slate-700'}`}>{t.label}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{t.desc}</p>
                    </div>
                    {sel && <CheckCircle2 className="w-4 h-4 text-[var(--crimson)] ml-auto shrink-0 mt-0.5" />}
                  </button>
                );
              })}
            </div>

            {/* date range */}
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2">Date Range (optional)</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 mb-1 block">From</label>
                  <input type="date" value={form.date_from}
                    onChange={e => setForm(f => ({ ...f, date_from: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 text-xs text-slate-800 p-2.5 focus:outline-none focus:border-[var(--crimson)]/40" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 mb-1 block">To</label>
                  <input type="date" value={form.date_to}
                    onChange={e => setForm(f => ({ ...f, date_to: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 text-xs text-slate-800 p-2.5 focus:outline-none focus:border-[var(--crimson)]/40" />
                </div>
              </div>
            </div>

            {/* LLM toggle */}
            <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all">
              <input type="checkbox" checked={form.include_llm_summary}
                onChange={e => setForm(f => ({ ...f, include_llm_summary: e.target.checked }))}
                className="mt-0.5 rounded accent-[var(--crimson)]" />
              <div>
                <p className="text-sm font-semibold text-slate-700">Include LLM Executive Summary</p>
                <p className="text-[11px] text-slate-400 mt-0.5">HERALD narrates pre-computed facts — no raw PII, no hallucinated numbers</p>
              </div>
            </label>

            {genError && (
              <p className="text-sm text-crimson bg-crimson-soft border border-soft rounded-xl p-3">{genError}</p>
            )}

            <button onClick={generate} disabled={generating}
              className="w-full py-3 rounded-xl bg-[var(--crimson)] text-white text-sm font-bold hover:bg-[var(--crimson)]/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
              {generating
                ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{form.include_llm_summary ? 'AI writing summary… (~30s)' : 'Generating…'}</>
                : <><FileText className="w-4 h-4" />Generate Report</>}
            </button>
          </div>

          {/* history list */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">Report History</h3>
              <span className="text-[11px] text-slate-400">{history.length} reports</span>
            </div>
            {loading ? (
              <div className="p-4 space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 bg-slate-50 rounded-lg animate-pulse" />)}</div>
            ) : history.length === 0 ? (
              <div className="p-8 text-center">
                <FileText className="w-6 h-6 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-400 text-sm">No reports yet</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50 max-h-[480px] overflow-y-auto">
                {history.map((r: any) => {
                  const isActive = activeReport?.id === r.id;
                  const label = REPORT_TYPES.find(t => t.id === r.report_type)?.label || r.report_type;
                  return (
                    <button key={r.id}
                      onClick={() => openHistory(r)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                        isActive ? 'bg-[var(--crimson)]/5 border-l-2 border-l-[var(--crimson)]' : 'hover:bg-slate-50 border-l-2 border-l-transparent'
                      }`}>
                      <FileText className={`w-4 h-4 shrink-0 ${isActive ? 'text-[var(--crimson)]' : 'text-slate-300'}`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold truncate ${isActive ? 'text-[var(--crimson)]' : 'text-slate-700'}`}>{label}</p>
                        <p className="text-[10px] text-slate-400 truncate">{fmtDate(r.generated_at)}</p>
                      </div>
                      {r.llm_summary && (
                        <span className="text-[9px] font-bold bg-teal-soft text-teal-dark px-1.5 py-0.5 rounded shrink-0">LLM</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── right: report viewer ── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          {activeReport ? (
            <ReportViewer report={activeReport} />
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
                <FileText className="w-7 h-7 text-slate-300" />
              </div>
              <p className="text-slate-600 font-semibold text-base">No report selected</p>
              <p className="text-slate-400 text-sm mt-1 max-w-xs leading-relaxed">
                Generate a new report using the form on the left, or click any entry in Report History to view its data.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
