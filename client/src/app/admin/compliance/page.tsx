'use client';

import { useEffect, useState, useMemo } from 'react';
import { api } from '@/lib/api';
import {
  RefreshCw, Shield, CheckCircle2, AlertTriangle, Users, XCircle,
  Search, ChevronDown, Mail, MessageSquare, Bell, Trash2, FileDown, X, History,
  PenLine,
} from 'lucide-react';

/* ── constants ─────────────────────────────────────────────────────────────── */
const TIER_BADGE: Record<string, string> = {
  PRIORITY: 'bg-red-100 text-red-700 border-red-200',
  ESCALATE: 'bg-orange-100 text-orange-700 border-orange-200',
  STANDARD: 'bg-amber-100 text-amber-700 border-amber-200',
  MONITOR:  'bg-blue-100 text-blue-700 border-blue-200',
  NONE:     'bg-emerald-100 text-emerald-700 border-emerald-200',
};
const SEG_BADGE: Record<string, string> = {
  HNW:    'bg-purple-100 text-purple-700',
  MASS:   'bg-slate-100 text-slate-600',
  SME:    'bg-sky-100 text-sky-700',
  NRI:    'bg-teal-100 text-teal-700',
};
const CHANNELS = ['EMAIL', 'SMS', 'PUSH'] as const;
type Channel = typeof CHANNELS[number];
const CH_ICON: Record<Channel, any> = { EMAIL: Mail, SMS: MessageSquare, PUSH: Bell };

function fmtDate(d?: string) {
  if (!d) return '—';
  try { return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(d)); }
  catch { return d; }
}

/* ── consent action modal ──────────────────────────────────────────────────── */
const CORRECTABLE_FIELDS = ['full_name', 'city', 'email', 'phone', 'segment', 'age'];

function downloadPdf(record: any, exportData: any) {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>Data Package — ${record.full_name}</title>
<style>
  body{font-family:Arial,sans-serif;padding:32px;color:#1e293b;font-size:12px}
  h1{font-size:20px;font-weight:800;margin:0 0 4px}
  h2{font-size:13px;font-weight:700;margin:20px 0 6px;border-bottom:1px solid #e2e8f0;padding-bottom:4px}
  .meta{color:#64748b;font-size:11px;margin-bottom:24px}
  .badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;background:#e0f2fe;color:#0369a1}
  table{width:100%;border-collapse:collapse;margin-bottom:8px}
  td,th{padding:6px 8px;text-align:left;font-size:11px}
  th{background:#f8fafc;font-weight:700;color:#475569}
  tr:nth-child(even) td{background:#f8fafc}
  .green{color:#16a34a;font-weight:700} .red{color:#dc2626;font-weight:700}
  .footer{margin-top:32px;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:12px}
  @media print{body{padding:16px}}
</style></head><body>
<h1>Data Package — ${record.full_name}</h1>
<p class="meta">DPDPA 2023 §12 · Right to Access · Generated: ${new Date().toLocaleString('en-IN')} · By: Admin</p>

<h2>Customer Profile</h2>
<table><tr><th>Field</th><th>Value</th></tr>
  <tr><td>Customer ID</td><td>${record.customer_id}</td></tr>
  <tr><td>Name</td><td>${record.full_name}</td></tr>
  <tr><td>City</td><td>${record.city || '—'}</td></tr>
  <tr><td>Segment</td><td>${record.segment || '—'}</td></tr>
  <tr><td>Risk Tier</td><td>${record.risk_tier || '—'}</td></tr>
  <tr><td>Relationship Manager</td><td>${record.relationship_manager || '—'}</td></tr>
</table>

<h2>Consent Status</h2>
<table><tr><th>Consent Type</th><th>Status</th><th>Last Updated</th></tr>
  <tr><td>DPDPA 2023</td><td class="${record.dpdpa_consent !== false ? 'green' : 'red'}">${record.dpdpa_consent !== false ? 'GRANTED' : 'REVOKED'}</td><td>${record.last_updated || '—'}</td></tr>
  <tr><td>TRAI TCCCPR 2025</td><td class="${record.trai_consent !== false ? 'green' : 'red'}">${record.trai_consent !== false ? 'GRANTED' : 'REVOKED'}</td><td>${record.last_updated || '—'}</td></tr>
  <tr><td>Channel Opt-Outs</td><td colspan="2">${(record.opt_out_channels || []).join(', ') || 'None'}</td></tr>
</table>

<h2>Data Categories Held</h2>
<p>Profile · Behavioural Signals · Churn Score · Outreach History · Consent Log</p>

<h2>Retention Policy</h2>
<p>Audit logs: 7 years (DPDPA Rule 4) · Signals &amp; Scores: 2 years · Approvals: 1 year</p>

${exportData?.data?.auditLog?.length ? `
<h2>Recent Audit Events (last 20)</h2>
<table><tr><th>Event</th><th>Actor</th><th>Timestamp</th></tr>
${exportData.data.auditLog.slice(0,20).map((e: any) => `<tr><td>${e.eventType}</td><td>${e.actor}</td><td>${e.timestamp?.slice(0,19).replace('T',' ')}</td></tr>`).join('')}
</table>` : ''}

<div class="footer">
  Union Bank · PCOP · DPDPA 2023 Compliant · This document was generated automatically. For queries contact dpo@unionbank.in
</div>
</body></html>`;
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 400);
}

function ConsentModal({ record, onClose, onSaved }: { record: any; onClose: () => void; onSaved: () => void }) {
  const [dpdpa,    setDpdpa]    = useState<boolean>(record.dpdpa_consent !== false);
  const [trai,     setTrai]     = useState<boolean>(record.trai_consent !== false);
  const [optOuts,  setOptOuts]  = useState<string[]>(record.opt_out_channels || []);
  const [erasure,  setErasure]  = useState(false);
  const [reason,   setReason]   = useState('');
  const [saving,   setSaving]   = useState(false);
  const [msg,      setMsg]      = useState('');
  const [history,  setHistory]  = useState<any[]>([]);
  const [loadingH, setLoadingH] = useState(false);
  const [showHist, setShowHist] = useState(false);
  const [exporting, setExporting] = useState(false);
  // §13 correction state
  const [showCorrect,  setShowCorrect]  = useState(false);
  const [correctField, setCorrectField] = useState('city');
  const [correctValue, setCorrectValue] = useState('');
  const [correctReason,setCorrectReason]= useState('');

  const loadHistory = async () => {
    if (showHist) { setShowHist(false); return; }
    setLoadingH(true);
    try {
      const r = await api.getConsent(record.customer_id);
      setHistory(r.history || []);
    } catch {}
    setLoadingH(false);
    setShowHist(true);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const data = await api.exportCustomerData(record.customer_id);
      downloadPdf(record, data);
    } catch { setMsg('Export failed'); }
    setExporting(false);
  };

  const handleCorrect = async () => {
    if (!correctValue.trim() || !correctReason.trim()) return;
    try {
      await api.correctCustomerData(record.customer_id, correctField, correctValue, correctReason);
      setMsg('Correction request logged (DPDPA §13)');
      setShowCorrect(false); setCorrectValue(''); setCorrectReason('');
    } catch (e: any) { setMsg('Error: ' + e.message); }
  };

  const toggleOptOut = (ch: string) =>
    setOptOuts(prev => prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch]);

  const save = async () => {
    setSaving(true); setMsg('');
    try {
      const cid = record.customer_id;
      if (dpdpa !== record.dpdpa_consent)
        await (dpdpa ? api.grantDpdpaConsent(cid) : api.revokeDpdpaConsent(cid));
      if (trai !== record.trai_consent)
        await (trai ? api.grantTraiConsent(cid, ['SMS','EMAIL','PUSH']) : api.revokeTraiConsent(cid));
      // channel opt-outs: reconcile diff
      for (const ch of CHANNELS) {
        const wasOut = (record.opt_out_channels || []).includes(ch);
        const isOut  = optOuts.includes(ch);
        if (wasOut && !isOut) await api.removeOptOut(cid, ch);
        if (!wasOut && isOut) await api.addOptOut(cid, ch);
      }
      // erasure request
      if (erasure && reason.trim()) {
        await api.requestErasure(cid, reason);
      }
      setMsg('Saved successfully');
      setTimeout(() => { onSaved(); onClose(); }, 900);
    } catch (e: any) {
      setMsg('Error: ' + e.message);
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg" onClick={e => e.stopPropagation()}>
        {/* header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900 text-base">{record.full_name}</h3>
            <p className="text-[11px] text-slate-400">{record.customer_id} · {record.city} · RM: {record.relationship_manager || '—'}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto" style={{ maxHeight: '70vh' }}>
          {/* DPDPA */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-800">DPDPA 2023 Consent</p>
                <p className="text-[11px] text-slate-400">Digital Personal Data Protection Act — processing permission</p>
              </div>
              <button onClick={() => setDpdpa(p => !p)}
                className={`relative w-11 h-6 rounded-full transition-colors ${dpdpa ? 'bg-emerald-500' : 'bg-red-400'}`}>
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${dpdpa ? 'left-6' : 'left-1'}`} />
              </button>
            </div>
            {!dpdpa && (
              <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                ⚠ Revoking DPDPA will cancel all pending outreach approvals and block further AI-driven contact.
              </p>
            )}
          </div>

          {/* TRAI */}
          <div className="bg-slate-50 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-800">TRAI Consent</p>
                <p className="text-[11px] text-slate-400">Telecom Regulatory Authority — commercial communication</p>
              </div>
              <button onClick={() => setTrai(p => !p)}
                className={`relative w-11 h-6 rounded-full transition-colors ${trai ? 'bg-emerald-500' : 'bg-red-400'}`}>
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${trai ? 'left-6' : 'left-1'}`} />
              </button>
            </div>
          </div>

          {/* Channel opt-outs */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-3">
            <div>
              <p className="text-sm font-semibold text-slate-800">Channel Opt-Outs</p>
              <p className="text-[11px] text-slate-400">Customer has opted out of specific communication channels</p>
            </div>
            <div className="flex gap-3">
              {CHANNELS.map(ch => {
                const Icon = CH_ICON[ch];
                const isOut = optOuts.includes(ch);
                return (
                  <button key={ch} onClick={() => toggleOptOut(ch)}
                    className={`flex-1 flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                      isOut ? 'border-red-400 bg-red-50' : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}>
                    <Icon className={`w-4 h-4 ${isOut ? 'text-red-500' : 'text-slate-400'}`} />
                    <span className={`text-[10px] font-bold ${isOut ? 'text-red-600' : 'text-slate-500'}`}>{ch}</span>
                    <span className={`text-[9px] font-semibold ${isOut ? 'text-red-500' : 'text-emerald-600'}`}>
                      {isOut ? 'OPTED OUT' : 'ACTIVE'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* §12 — Data Export */}
          <div className="bg-slate-50 rounded-xl p-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                <FileDown className="w-4 h-4 text-slate-400" /> Data Package Export
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">DPDPA 2023 §12 — Right to Access. Opens print dialog for PDF download.</p>
            </div>
            <button onClick={handleExport} disabled={exporting}
              className="shrink-0 px-3 py-1.5 rounded-lg bg-[#0f2d5c] text-white text-xs font-bold hover:bg-[#0f2d5c]/90 disabled:opacity-50 transition-all">
              {exporting ? 'Loading…' : 'Export PDF'}
            </button>
          </div>

          {/* §13 — Right to Correction */}
          <div className={`rounded-xl p-4 border-2 transition-all ${showCorrect ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-slate-50'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <PenLine className={`w-4 h-4 ${showCorrect ? 'text-blue-500' : 'text-slate-400'}`} />
                <p className={`text-sm font-semibold ${showCorrect ? 'text-blue-700' : 'text-slate-800'}`}>Request Data Correction</p>
              </div>
              <button onClick={() => setShowCorrect(p => !p)}
                className={`relative w-11 h-6 rounded-full transition-colors ${showCorrect ? 'bg-blue-500' : 'bg-slate-200'}`}>
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${showCorrect ? 'left-6' : 'left-1'}`} />
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mb-2">DPDPA 2023 §13 — right to correction. Logged for DBA review; no immediate data change.</p>
            {showCorrect && (
              <div className="space-y-2 mt-3">
                <div className="flex gap-2">
                  <select value={correctField} onChange={e => setCorrectField(e.target.value)}
                    className="flex-1 rounded-lg border border-blue-200 text-xs text-slate-800 p-2 bg-white focus:outline-none focus:border-blue-400">
                    {CORRECTABLE_FIELDS.map(f => <option key={f} value={f}>{f.replace('_',' ')}</option>)}
                  </select>
                  <input value={correctValue} onChange={e => setCorrectValue(e.target.value)}
                    placeholder="New value…"
                    className="flex-1 rounded-lg border border-blue-200 text-xs text-slate-800 p-2 bg-white focus:outline-none focus:border-blue-400" />
                </div>
                <input value={correctReason} onChange={e => setCorrectReason(e.target.value)}
                  placeholder="Reason for correction (required)…"
                  className="w-full rounded-lg border border-blue-200 text-xs text-slate-800 p-2 bg-white focus:outline-none focus:border-blue-400" />
                <button onClick={handleCorrect} disabled={!correctValue.trim() || !correctReason.trim()}
                  className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 disabled:opacity-50 transition-all">
                  Submit Correction Request
                </button>
              </div>
            )}
          </div>

          {/* Erasure request */}
          <div className={`rounded-xl p-4 border-2 transition-all ${erasure ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Trash2 className={`w-4 h-4 ${erasure ? 'text-red-500' : 'text-slate-400'}`} />
                <p className={`text-sm font-semibold ${erasure ? 'text-red-700' : 'text-slate-800'}`}>Request Data Erasure</p>
              </div>
              <button onClick={() => setErasure(p => !p)}
                className={`relative w-11 h-6 rounded-full transition-colors ${erasure ? 'bg-red-500' : 'bg-slate-200'}`}>
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${erasure ? 'left-6' : 'left-1'}`} />
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mb-2">DPDPA 2023 §14 — customer's right to erasure. Audit logs are retained 7 years (legal obligation).</p>
            {erasure && (
              <textarea value={reason} onChange={e => setReason(e.target.value)}
                placeholder="Reason for erasure request (required)…"
                rows={2} className="w-full rounded-lg border border-red-200 text-xs text-slate-800 p-2.5 resize-none focus:outline-none focus:border-red-400 bg-white" />
            )}
          </div>

          {/* Consent history */}
          <button onClick={loadHistory}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors text-sm text-slate-600 font-medium">
            <span className="flex items-center gap-2"><History className="w-4 h-4 text-slate-400" /> Consent History</span>
            {loadingH ? <span className="w-3.5 h-3.5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" /> : <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showHist ? 'rotate-180' : ''}`} />}
          </button>
          {showHist && (
            <div className="rounded-xl border border-slate-100 divide-y divide-slate-50 max-h-48 overflow-y-auto">
              {history.length === 0 ? (
                <p className="px-4 py-3 text-[12px] text-slate-400 text-center">No consent history recorded</p>
              ) : history.map((h: any, i: number) => (
                <div key={i} className="px-4 py-2.5">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${h.action?.includes('GRANT') || h.action === 'GRANTED' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {h.action || h.event}
                    </span>
                    <span className="text-[10px] text-slate-400">{fmtDate(h.timestamp || h.ts)}</span>
                  </div>
                  <p className="text-[11px] text-slate-500">{h.type || h.purpose || ''} {h.actor ? `· by ${h.actor}` : ''}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* footer */}
        <div className="flex items-center justify-between p-5 border-t border-slate-100 gap-3">
          {msg ? (
            <p className={`text-xs font-semibold ${msg.startsWith('Error') ? 'text-red-600' : 'text-emerald-600'}`}>{msg}</p>
          ) : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-500 hover:text-slate-700">Cancel</button>
            <button onClick={save} disabled={saving || (erasure && !reason.trim())}
              className="px-5 py-2 rounded-xl bg-[#0f2d5c] text-white text-sm font-bold hover:bg-[#0f2d5c]/90 disabled:opacity-50 transition-all">
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── main page ─────────────────────────────────────────────────────────────── */
export default function CompliancePage() {
  const [consent,  setConsent]  = useState<any>(null);
  const [bias,     setBias]     = useState<any>(null);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState<'consent' | 'bias'>('consent');
  const [search,   setSearch]   = useState('');
  const [filter,   setFilter]   = useState<'all' | 'no_dpdpa' | 'no_trai' | 'opted_out'>('all');
  const [selected, setSelected] = useState<any | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [c, b] = await Promise.all([api.getConsentLedger(), api.getBiasAudit()]);
      setConsent(c);
      setBias(b);
    } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const allRecords: any[] = consent?.records || [];

  const records = useMemo(() => {
    let r = allRecords;
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter((x: any) => x.full_name?.toLowerCase().includes(q) || x.customer_id?.toLowerCase().includes(q) || x.city?.toLowerCase().includes(q));
    }
    if (filter === 'no_dpdpa')   r = r.filter((x: any) => x.dpdpa_consent === false);
    if (filter === 'no_trai')    r = r.filter((x: any) => x.trai_consent === false);
    if (filter === 'opted_out')  r = r.filter((x: any) => x.opted_out);
    return r;
  }, [allRecords, search, filter]);

  const matrix: any[]  = bias?.matrix || [];
  const flags: string[] = bias?.disparate_impact_flags || [];
  const optedOut  = allRecords.filter(r => r.opted_out).length;
  const noDpdpa   = allRecords.filter(r => r.dpdpa_consent === false).length;
  const dpdpaOk   = allRecords.filter(r => r.dpdpa_consent !== false).length;

  return (
    <div className="p-6 space-y-6">
      {selected && <ConsentModal record={selected} onClose={() => setSelected(null)} onSaved={load} />}

      {/* header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Compliance Hub</h1>
          <p className="text-slate-400 text-sm mt-0.5">DPDPA 2023 consent ledger · channel opt-outs · bias audit · data rights</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-700 text-xs shadow-sm transition-all">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Customers', value: allRecords.length,        accent: 'border-l-[#0f2d5c]', icon: Users,         color: 'text-slate-900' },
          { label: 'DPDPA Consented', value: dpdpaOk,                  accent: 'border-l-emerald-500', icon: CheckCircle2, color: 'text-emerald-600' },
          { label: 'Channel Opt-Outs',value: optedOut,                  accent: optedOut ? 'border-l-red-500' : 'border-l-emerald-500', icon: XCircle, color: optedOut ? 'text-red-600' : 'text-slate-900' },
          { label: 'Bias Flags',      value: flags.length,              accent: flags.length > 0 ? 'border-l-orange-500' : 'border-l-emerald-500', icon: Shield, color: flags.length ? 'text-orange-600' : 'text-slate-900' },
        ].map(c => (
          <div key={c.label} className={`bg-white rounded-xl border border-slate-200 shadow-sm p-5 border-l-4 ${c.accent}`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{c.label}</p>
                <p className={`text-2xl font-bold tabular-nums ${c.color}`}>{loading ? '—' : c.value}</p>
              </div>
              <c.icon className="w-5 h-5 text-slate-300 mt-1" />
            </div>
          </div>
        ))}
      </div>

      {/* DPDPA RBI notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <Shield className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
        <p className="text-sm text-blue-700">
          <strong>DPDPA 2023 Compliance</strong> — All consent changes are logged with actor identity and timestamp. Revoking DPDPA consent immediately blocks AI-driven outreach. Erasure requests follow §14 — audit logs retained 7 years per Rule 4.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        {[
          { key: 'consent', label: 'Consent Ledger' },
          { key: 'bias',    label: 'Bias Audit' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={`px-4 py-2.5 text-sm font-semibold transition-all border-b-2 -mb-px ${
              tab === t.key ? 'border-[#0f2d5c] text-[#0f2d5c]' : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}>{t.label}</button>
        ))}
      </div>

      {/* ── Consent Ledger ── */}
      {tab === 'consent' && (
        <div className="space-y-4">
          {/* search + filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, ID, or city…"
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:border-[#0f2d5c]/40 bg-white" />
            </div>
            <div className="flex gap-2">
              {[
                { key: 'all',       label: 'All' },
                { key: 'no_dpdpa',  label: 'No DPDPA' },
                { key: 'no_trai',   label: 'No TRAI' },
                { key: 'opted_out', label: 'Opted Out' },
              ].map(f => (
                <button key={f.key} onClick={() => setFilter(f.key as any)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                    filter === f.key ? 'bg-[#0f2d5c] text-white border-[#0f2d5c]' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                  }`}>{f.label}</button>
              ))}
            </div>
          </div>
          <p className="text-[11px] text-slate-400">{records.length} of {allRecords.length} customers · click any row to manage consent</p>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-6 space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-12 bg-slate-50 rounded animate-pulse" />)}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left py-3 px-4 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Customer</th>
                      <th className="text-left py-3 px-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Segment / Tier</th>
                      <th className="text-center py-3 px-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">DPDPA</th>
                      <th className="text-center py-3 px-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">TRAI</th>
                      <th className="text-center py-3 px-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Channels</th>
                      <th className="text-right py-3 px-4 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Last Updated</th>
                      <th className="py-3 px-4 text-[10px] font-semibold text-slate-400 uppercase tracking-wide"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {records.map((r: any) => {
                      const optedChans: string[] = r.opt_out_channels || [];
                      return (
                        <tr key={r.customer_id} className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                          onClick={() => setSelected(r)}>
                          <td className="py-3 px-4">
                            <p className="font-medium text-slate-800">{r.full_name}</p>
                            <p className="text-[10px] text-slate-400">{r.customer_id} · {r.city || '—'}</p>
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex flex-col gap-1">
                              {r.segment && (
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded w-fit ${SEG_BADGE[r.segment] || 'bg-slate-100 text-slate-600'}`}>
                                  {r.segment}
                                </span>
                              )}
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border w-fit ${TIER_BADGE[r.risk_tier] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                {r.risk_tier}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-center">
                            {r.dpdpa_consent !== false
                              ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
                              : <XCircle className="w-4 h-4 text-red-500 mx-auto" />}
                          </td>
                          <td className="py-3 px-3 text-center">
                            {r.trai_consent !== false
                              ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
                              : <XCircle className="w-4 h-4 text-red-500 mx-auto" />}
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1.5 justify-center">
                              {CHANNELS.map(ch => {
                                const Icon = CH_ICON[ch];
                                const out  = optedChans.includes(ch);
                                return (
                                  <span key={ch} title={`${ch}: ${out ? 'Opted out' : 'Active'}`}
                                    className={`w-6 h-6 rounded flex items-center justify-center ${out ? 'bg-red-100' : 'bg-emerald-50'}`}>
                                    <Icon className={`w-3 h-3 ${out ? 'text-red-500' : 'text-emerald-500'}`} />
                                  </span>
                                );
                              })}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right text-[11px] text-slate-400">{fmtDate(r.last_updated)}</td>
                          <td className="py-3 px-4">
                            <button onClick={e => { e.stopPropagation(); setSelected(r); }}
                              className="text-[11px] font-semibold text-[#0f2d5c] hover:underline whitespace-nowrap">
                              Manage →
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {records.length === 0 && (
                  <div className="py-12 text-center">
                    <Search className="w-6 h-6 text-slate-300 mx-auto mb-2" />
                    <p className="text-slate-400 text-sm">No customers match your filters</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Bias Audit ── */}
      {tab === 'bias' && (
        <div className="space-y-4">
          {flags.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-orange-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-orange-800 text-sm">Disparate Impact Detected</p>
                <p className="text-sm text-orange-700">
                  Segments with PRIORITY rate &gt; 2× portfolio avg: <strong>{flags.join(', ')}</strong>.
                  Review for potential algorithmic bias per RBI AI Governance guidelines.
                </p>
              </div>
            </div>
          )}
          {flags.length === 0 && !loading && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <p className="text-sm text-emerald-700">
                <strong>No disparate impact detected.</strong> All segments are within 2× of the portfolio PRIORITY rate. Bias audit passed.
              </p>
            </div>
          )}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100">
              <p className="text-sm font-semibold text-slate-700">Segment × Risk Tier Matrix</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Portfolio PRIORITY rate: {Math.round((bias?.portfolio_priority_rate||0)*100)}% · Flags if segment rate &gt; {Math.round((bias?.portfolio_priority_rate||0)*200)}%</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left py-3 px-4 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Segment</th>
                    <th className="text-center py-3 px-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Customers</th>
                    {['PRIORITY','ESCALATE','STANDARD','MONITOR','NONE'].map(t => (
                      <th key={t} className="text-center py-3 px-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{t}</th>
                    ))}
                    <th className="text-right py-3 px-4 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Priority %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {matrix.map((row: any) => {
                    const isFlagged = flags.includes(row.segment);
                    const rate = Math.round((row.priority_rate || 0) * 100);
                    return (
                      <tr key={row.segment} className={`hover:bg-slate-50 transition-colors ${isFlagged ? 'bg-orange-50/40' : ''}`}>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {isFlagged && <AlertTriangle className="w-3.5 h-3.5 text-orange-500 shrink-0" />}
                            <span className="font-medium text-slate-800">{row.segment}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center font-semibold text-slate-700">{row.count}</td>
                        {['PRIORITY','ESCALATE','STANDARD','MONITOR','NONE'].map(t => (
                          <td key={t} className="py-3 px-2 text-center">
                            <span className={`text-sm ${t === 'PRIORITY' && row.tiers?.[t] > 0 ? 'font-bold text-red-600' : 'text-slate-600'}`}>
                              {row.tiers?.[t] ?? 0}
                            </span>
                          </td>
                        ))}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${isFlagged ? 'bg-orange-500' : 'bg-[#0f2d5c]'}`} style={{ width: `${Math.min(rate, 100)}%` }} />
                            </div>
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded min-w-[40px] text-center ${isFlagged ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600'}`}>
                              {rate}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
