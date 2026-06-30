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
  PRIORITY: 'bg-[#6B132B] text-white',
  ESCALATE: 'bg-[#B46B3E] text-white',
  STANDARD: 'bg-[#F9F9F7] text-[#2A161B] border border-soft',
  MONITOR:  'bg-[#F4D9C0] text-[#2A161B]',
  NONE:     'bg-[#F9F9F7] text-[#6B6562] border border-soft',
};
const SEG_BADGE: Record<string, string> = {
  HNW:    'bg-[#6B132B] text-white',
  MASS:   'bg-[#F9F9F7] text-[#6B6562] border border-soft',
  SME:    'bg-[#B46B3E] text-white',
  NRI:    'bg-[#F4D9C0] text-[#2A161B]',
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
  const css = `body{font-family:Poppins,sans-serif;padding:32px;color:#2A161B;font-size:12px}
h1{font-size:20px;font-weight:800;margin:0 0 4px;color:#2A161B}
h2{font-size:13px;font-weight:700;margin:20px 0 6px;border-bottom:1px solid #E5E0DF;padding-bottom:4px;color:#2A161B}
.meta{color:#6B6562;font-size:11px;margin-bottom:24px}
table{width:100%;border-collapse:collapse;margin-bottom:8px}
td,th{padding:6px 8px;text-align:left;font-size:11px}
th{background:#F9F9F7;font-weight:700;color:#6B6562}
tr:nth-child(even) td{background:#F9F9F7}
.green{color:#6B132B;font-weight:700} .red{color:#B46B3E;font-weight:700}
.footer{margin-top:32px;font-size:10px;color:#8B8481;border-top:1px solid #E5E0DF;padding-top:12px}
@media print{body{padding:16px}}`;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>Data Package — ${record.full_name}</title>
<style>${css}</style></head><body>
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
      for (const ch of CHANNELS) {
        const wasOut = (record.opt_out_channels || []).includes(ch);
        const isOut  = optOuts.includes(ch);
        if (wasOut && !isOut) await api.removeOptOut(cid, ch);
        if (!wasOut && isOut) await api.addOptOut(cid, ch);
      }
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
      <div className="bg-white rounded-md border border-soft w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between p-5 border-b border-soft">
          <div>
            <h3 className="font-bold text-[#2A161B] text-base">{record.full_name}</h3>
            <p className="text-[11px] text-[#6B6562]">{record.customer_id} · {record.city} · RM: {record.relationship_manager || '—'}</p>
          </div>
          <button onClick={onClose} className="text-[#8B8481] hover:text-[#2A161B] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto" style={{ maxHeight: '70vh' }}>
          {/* DPDPA */}
          <div className="bg-[#F9F9F7] rounded-md p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-[#2A161B]">DPDPA 2023 Consent</p>
                <p className="text-[11px] text-[#6B6562]">Digital Personal Data Protection Act — processing permission</p>
              </div>
              <button onClick={() => setDpdpa(p => !p)}
                className={`relative w-11 h-6 rounded-full transition-colors ${dpdpa ? 'bg-[#6B132B]' : 'bg-[#B46B3E]'}`}>
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${dpdpa ? 'left-6' : 'left-1'}`} />
              </button>
            </div>
            {!dpdpa && (
              <p className="text-[11px] text-[#B46B3E] bg-[#F4D9C0] border border-soft rounded-md p-2">
                ⚠ Revoking DPDPA will cancel all pending outreach approvals and block further AI-driven contact.
              </p>
            )}
          </div>

          {/* TRAI */}
          <div className="bg-[#F9F9F7] rounded-md p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-[#2A161B]">TRAI Consent</p>
                <p className="text-[11px] text-[#6B6562]">Telecom Regulatory Authority — commercial communication</p>
              </div>
              <button onClick={() => setTrai(p => !p)}
                className={`relative w-11 h-6 rounded-full transition-colors ${trai ? 'bg-[#6B132B]' : 'bg-[#B46B3E]'}`}>
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${trai ? 'left-6' : 'left-1'}`} />
              </button>
            </div>
          </div>

          {/* Channel opt-outs */}
          <div className="bg-[#F9F9F7] rounded-md p-4 space-y-3">
            <div>
              <p className="text-sm font-semibold text-[#2A161B]">Channel Opt-Outs</p>
              <p className="text-[11px] text-[#6B6562]">Customer has opted out of specific communication channels</p>
            </div>
            <div className="flex gap-3">
              {CHANNELS.map(ch => {
                const Icon = CH_ICON[ch];
                const isOut = optOuts.includes(ch);
                return (
                  <button key={ch} onClick={() => toggleOptOut(ch)}
                    className={`flex-1 flex flex-col items-center gap-1.5 p-3 rounded-md border-2 transition-all ${
                      isOut ? 'border-[#6B132B] bg-[#6B132B]' : 'border-soft bg-white hover:border-[#B46B3E]'
                    }`}>
                    <Icon className={`w-4 h-4 ${isOut ? 'text-white' : 'text-[#6B6562]'}`} />
                    <span className={`text-[10px] font-bold ${isOut ? 'text-white' : 'text-[#6B6562]'}`}>{ch}</span>
                    <span className={`text-[9px] font-semibold ${isOut ? 'text-white' : 'text-[#6B132B]'}`}>
                      {isOut ? 'OPTED OUT' : 'ACTIVE'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* §12 — Data Export */}
          <div className="bg-[#F9F9F7] rounded-md p-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[#2A161B] flex items-center gap-1.5">
                <FileDown className="w-4 h-4 text-[#6B6562]" /> Data Package Export
              </p>
              <p className="text-[11px] text-[#6B6562] mt-0.5">DPDPA 2023 §12 — Right to Access. Opens print dialog for PDF download.</p>
            </div>
            <button onClick={handleExport} disabled={exporting}
              className="shrink-0 px-3 py-1.5 rounded-md bg-[#6B132B] text-white text-xs font-bold hover:bg-[#6B132B]/90 disabled:opacity-50 transition-all">
              {exporting ? 'Loading…' : 'Export PDF'}
            </button>
          </div>

          {/* §13 — Right to Correction */}
          <div className={`rounded-md p-4 border-2 transition-all ${showCorrect ? 'border-[#B46B3E] bg-[#F4D9C0]' : 'border-soft bg-[#F9F9F7]'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <PenLine className={`w-4 h-4 ${showCorrect ? 'text-[#B46B3E]' : 'text-[#6B6562]'}`} />
                <p className={`text-sm font-semibold ${showCorrect ? 'text-[#B46B3E]' : 'text-[#2A161B]'}`}>Request Data Correction</p>
              </div>
              <button onClick={() => setShowCorrect(p => !p)}
                className={`relative w-11 h-6 rounded-full transition-colors ${showCorrect ? 'bg-[#B46B3E]' : 'bg-[#E5E0DF]'}`}>
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${showCorrect ? 'left-6' : 'left-1'}`} />
              </button>
            </div>
            <p className="text-[11px] text-[#6B6562] mb-2">DPDPA 2023 §13 — right to correction. Logged for DBA review; no immediate data change.</p>
            {showCorrect && (
              <div className="space-y-2 mt-3">
                <div className="flex gap-2">
                  <select value={correctField} onChange={e => setCorrectField(e.target.value)}
                    className="flex-1 rounded-md border border-soft text-xs text-[#2A161B] p-2 bg-white focus:outline-none focus:border-[#6B132B]/40">
                    {CORRECTABLE_FIELDS.map(f => <option key={f} value={f}>{f.replace('_',' ')}</option>)}
                  </select>
                  <input value={correctValue} onChange={e => setCorrectValue(e.target.value)}
                    placeholder="New value…"
                    className="flex-1 rounded-md border border-soft text-xs text-[#2A161B] p-2 bg-white focus:outline-none focus:border-[#6B132B]/40" />
                </div>
                <input value={correctReason} onChange={e => setCorrectReason(e.target.value)}
                  placeholder="Reason for correction (required)…"
                  className="w-full rounded-md border border-soft text-xs text-[#2A161B] p-2 bg-white focus:outline-none focus:border-[#6B132B]/40" />
                <button onClick={handleCorrect} disabled={!correctValue.trim() || !correctReason.trim()}
                  className="px-4 py-1.5 rounded-md bg-[#B46B3E] text-white text-xs font-bold hover:bg-[#B46B3E]/90 disabled:opacity-50 transition-all">
                  Submit Correction Request
                </button>
              </div>
            )}
          </div>

          {/* Erasure request */}
          <div className={`rounded-md p-4 border-2 transition-all ${erasure ? 'border-[#6B132B] bg-[#F4D9C0]' : 'border-soft bg-[#F9F9F7]'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Trash2 className={`w-4 h-4 ${erasure ? 'text-[#6B132B]' : 'text-[#6B6562]'}`} />
                <p className={`text-sm font-semibold ${erasure ? 'text-[#6B132B]' : 'text-[#2A161B]'}`}>Request Data Erasure</p>
              </div>
              <button onClick={() => setErasure(p => !p)}
                className={`relative w-11 h-6 rounded-full transition-colors ${erasure ? 'bg-[#6B132B]' : 'bg-[#E5E0DF]'}`}>
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${erasure ? 'left-6' : 'left-1'}`} />
              </button>
            </div>
            <p className="text-[11px] text-[#6B6562] mb-2">DPDPA 2023 §14 — customer's right to erasure. Audit logs are retained 7 years (legal obligation).</p>
            {erasure && (
              <textarea value={reason} onChange={e => setReason(e.target.value)}
                placeholder="Reason for erasure request (required)…"
                rows={2} className="w-full rounded-md border border-soft text-xs text-[#2A161B] p-2.5 resize-none focus:outline-none focus:border-[#6B132B]/40 bg-white" />
            )}
          </div>

          {/* Consent history */}
          <button onClick={loadHistory}
            className="w-full flex items-center justify-between px-4 py-3 rounded-md border border-soft hover:bg-[#F9F9F7] transition-colors text-sm text-[#6B6562] font-medium">
            <span className="flex items-center gap-2"><History className="w-4 h-4 text-[#8B8481]" /> Consent History</span>
            {loadingH ? <span className="w-3.5 h-3.5 border-2 border-[#E5E0DF] border-t-[#6B132B] rounded-full animate-spin" /> : <ChevronDown className={`w-4 h-4 text-[#8B8481] transition-transform ${showHist ? 'rotate-180' : ''}`} />}
          </button>
          {showHist && (
            <div className="rounded-md border border-soft divide-y divide-soft max-h-48 overflow-y-auto">
              {history.length === 0 ? (
                <p className="px-4 py-3 text-[12px] text-[#6B6562] text-center">No consent history recorded</p>
              ) : history.map((h: any, i: number) => (
                <div key={i} className="px-4 py-2.5">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${h.action?.includes('GRANT') || h.action === 'GRANTED' ? 'bg-[#6B132B] text-white' : 'bg-[#6B132B] text-white'}`}>
                      {h.action || h.event}
                    </span>
                    <span className="text-[10px] text-[#6B6562]">{fmtDate(h.timestamp || h.ts)}</span>
                  </div>
                  <p className="text-[11px] text-[#6B6562]">{h.type || h.purpose || ''} {h.actor ? `· by ${h.actor}` : ''}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* footer */}
        <div className="flex items-center justify-between p-5 border-t border-soft gap-3">
          {msg ? (
            <p className={`text-xs font-semibold ${msg.startsWith('Error') ? 'text-[#6B132B]' : 'text-[#B46B3E]'}`}>{msg}</p>
          ) : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-md text-sm text-[#6B6562] hover:text-[#2A161B]">Cancel</button>
            <button onClick={save} disabled={saving || (erasure && !reason.trim())}
              className="px-5 py-2 rounded-md bg-[#6B132B] text-white text-sm font-bold hover:bg-[#6B132B]/90 disabled:opacity-50 transition-all">
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
    <div className="p-6 space-y-6 bg-[#F9F9F7] min-h-screen">
      {selected && <ConsentModal record={selected} onClose={() => setSelected(null)} onSaved={load} />}

      {/* header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-black text-[#2A161B] font-heading">Compliance Hub</h1>
          <p className="text-[13px] text-[#6B6562] mt-0.5">DPDPA 2023 consent ledger · channel opt-outs · bias audit · data rights</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 rounded-md border border-soft bg-white text-[#6B6562] hover:text-[#2A161B] text-xs transition-colors">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Customers', value: allRecords.length,        color: '#6B132B', icon: Users },
          { label: 'DPDPA Consented', value: dpdpaOk,                  color: '#6B132B', icon: CheckCircle2 },
          { label: 'Channel Opt-Outs',value: optedOut,                 color: optedOut ? '#6B132B' : '#B46B3E', icon: XCircle },
          { label: 'Bias Flags',      value: flags.length,             color: flags.length > 0 ? '#6B132B' : '#B46B3E', icon: Shield },
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

      {/* DPDPA RBI notice */}
      <div className="bg-[#F9F9F7] border border-soft rounded-md p-4 flex items-start gap-3">
        <Shield className="w-4 h-4 text-[#6B132B] mt-0.5 shrink-0" />
        <p className="text-sm text-[#2A161B]">
          <strong>DPDPA 2023 Compliance</strong> — All consent changes are logged with actor identity and timestamp. Revoking DPDPA consent immediately blocks AI-driven outreach. Erasure requests follow §14 — audit logs retained 7 years per Rule 4.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-soft">
        {[
          { key: 'consent', label: 'Consent Ledger' },
          { key: 'bias',    label: 'Bias Audit' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={`px-4 py-2.5 text-sm font-semibold transition-all border-b-2 -mb-px ${
              tab === t.key ? 'border-[#6B132B] text-[#6B132B]' : 'border-transparent text-[#6B6562] hover:text-[#2A161B]'
            }`}>{t.label}</button>
        ))}
      </div>

      {/* ── Consent Ledger ── */}
      {tab === 'consent' && (
        <div className="space-y-4">
          {/* search + filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8B8481]" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, ID, or city…"
                className="w-full pl-9 pr-4 py-2.5 rounded-md border border-soft text-sm text-[#2A161B] focus:outline-none focus:border-[#6B132B]/40 bg-white" />
            </div>
            <div className="flex gap-2">
              {[
                { key: 'all',       label: 'All' },
                { key: 'no_dpdpa',  label: 'No DPDPA' },
                { key: 'no_trai',   label: 'No TRAI' },
                { key: 'opted_out', label: 'Opted Out' },
              ].map(f => (
                <button key={f.key} onClick={() => setFilter(f.key as any)}
                  className={`px-3 py-2 rounded-md text-xs font-semibold border transition-all ${
                    filter === f.key ? 'bg-[#6B132B] text-white border-[#6B132B]' : 'bg-white text-[#6B6562] border-soft hover:border-[#B46B3E]'
                  }`}>{f.label}</button>
              ))}
            </div>
          </div>
          <p className="text-[11px] text-[#6B6562]">{records.length} of {allRecords.length} customers · click any row to manage consent</p>

          <div className="bg-white rounded-md border border-soft overflow-hidden">
            {loading ? (
              <div className="p-6 space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-12 bg-[#F9F9F7] rounded animate-pulse" />)}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#F9F9F7] border-b border-soft">
                    <tr>
                      <th className="text-left py-3 px-4 text-[10px] font-bold text-[#6B6562] uppercase tracking-wider">Customer</th>
                      <th className="text-left py-3 px-3 text-[10px] font-bold text-[#6B6562] uppercase tracking-wider">Segment / Tier</th>
                      <th className="text-center py-3 px-3 text-[10px] font-bold text-[#6B6562] uppercase tracking-wider">DPDPA</th>
                      <th className="text-center py-3 px-3 text-[10px] font-bold text-[#6B6562] uppercase tracking-wider">TRAI</th>
                      <th className="text-center py-3 px-3 text-[10px] font-bold text-[#6B6562] uppercase tracking-wider">Channels</th>
                      <th className="text-right py-3 px-4 text-[10px] font-bold text-[#6B6562] uppercase tracking-wider">Last Updated</th>
                      <th className="py-3 px-4 text-[10px] font-bold text-[#6B6562] uppercase tracking-wider"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-soft">
                    {records.map((r: any) => {
                      const optedChans: string[] = r.opt_out_channels || [];
                      return (
                        <tr key={r.customer_id} className="hover:bg-[#F9F9F7]/70 transition-colors cursor-pointer"
                          onClick={() => setSelected(r)}>
                          <td className="py-3 px-4">
                            <p className="font-medium text-[#2A161B]">{r.full_name}</p>
                            <p className="text-[10px] text-[#6B6562]">{r.customer_id} · {r.city || '—'}</p>
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex flex-col gap-1">
                              {r.segment && (
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded w-fit ${SEG_BADGE[r.segment] || 'bg-[#F9F9F7] text-[#6B6562] border border-soft'}`}>
                                  {r.segment}
                                </span>
                              )}
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border w-fit ${TIER_BADGE[r.risk_tier] || 'bg-[#F9F9F7] text-[#6B6562] border border-soft'}`}>
                                {r.risk_tier}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-center">
                            {r.dpdpa_consent !== false
                              ? <CheckCircle2 className="w-4 h-4 text-[#6B132B] mx-auto" />
                              : <XCircle className="w-4 h-4 text-[#B46B3E] mx-auto" />}
                          </td>
                          <td className="py-3 px-3 text-center">
                            {r.trai_consent !== false
                              ? <CheckCircle2 className="w-4 h-4 text-[#6B132B] mx-auto" />
                              : <XCircle className="w-4 h-4 text-[#B46B3E] mx-auto" />}
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1.5 justify-center">
                              {CHANNELS.map(ch => {
                                const Icon = CH_ICON[ch];
                                const out  = optedChans.includes(ch);
                                return (
                                  <span key={ch} title={`${ch}: ${out ? 'Opted out' : 'Active'}`}
                                    className={`w-6 h-6 rounded flex items-center justify-center ${out ? 'bg-[#6B132B]' : 'bg-[#F9F9F7] border border-soft'}`}>
                                    <Icon className={`w-3 h-3 ${out ? 'text-white' : 'text-[#6B6562]'}`} />
                                  </span>
                                );
                              })}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right text-[11px] text-[#6B6562]">{fmtDate(r.last_updated)}</td>
                          <td className="py-3 px-4">
                            <button onClick={e => { e.stopPropagation(); setSelected(r); }}
                              className="text-[11px] font-semibold text-[#6B132B] hover:underline whitespace-nowrap">
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
                    <Search className="w-6 h-6 text-[#8B8481] mx-auto mb-2" />
                    <p className="text-[#6B6562] text-sm">No customers match your filters</p>
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
            <div className="bg-[#F4D9C0] border border-soft rounded-md p-4 flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-[#B46B3E] mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-[#2A161B] text-sm">Disparate Impact Detected</p>
                <p className="text-sm text-[#2A161B]">
                  Segments with PRIORITY rate &gt; 2× portfolio avg: <strong>{flags.join(', ')}</strong>.
                  Review for potential algorithmic bias per RBI AI Governance guidelines.
                </p>
              </div>
            </div>
          )}
          {flags.length === 0 && !loading && (
            <div className="bg-[#F9F9F7] border border-soft rounded-md p-4 flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-[#6B132B] mt-0.5 shrink-0" />
              <p className="text-sm text-[#2A161B]">
                <strong>No disparate impact detected.</strong> All segments are within 2× of the portfolio PRIORITY rate. Bias audit passed.
              </p>
            </div>
          )}
          <div className="bg-white rounded-md border border-soft overflow-hidden">
            <div className="px-5 py-3 border-b border-soft">
              <p className="text-sm font-bold text-[#2A161B]">Segment × Risk Tier Matrix</p>
              <p className="text-[11px] text-[#6B6562] mt-0.5">Portfolio PRIORITY rate: {Math.round((bias?.portfolio_priority_rate||0)*100)}% · Flags if segment rate &gt; {Math.round((bias?.portfolio_priority_rate||0)*200)}%</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#F9F9F7] border-b border-soft">
                  <tr>
                    <th className="text-left py-3 px-4 text-[10px] font-bold text-[#6B6562] uppercase tracking-wider">Segment</th>
                    <th className="text-center py-3 px-3 text-[10px] font-bold text-[#6B6562] uppercase tracking-wider">Customers</th>
                    {['PRIORITY','ESCALATE','STANDARD','MONITOR','NONE'].map(t => (
                      <th key={t} className="text-center py-3 px-2 text-[10px] font-bold text-[#6B6562] uppercase tracking-wider">{t}</th>
                    ))}
                    <th className="text-right py-3 px-4 text-[10px] font-bold text-[#6B6562] uppercase tracking-wider">Priority %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-soft">
                  {matrix.map((row: any) => {
                    const isFlagged = flags.includes(row.segment);
                    const rate = Math.round((row.priority_rate || 0) * 100);
                    return (
                      <tr key={row.segment} className={`hover:bg-[#F9F9F7] transition-colors ${isFlagged ? 'bg-[#F4D9C0]/40' : ''}`}>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {isFlagged && <AlertTriangle className="w-3.5 h-3.5 text-[#B46B3E] shrink-0" />}
                            <span className="font-medium text-[#2A161B]">{row.segment}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center font-semibold text-[#2A161B]">{row.count}</td>
                        {['PRIORITY','ESCALATE','STANDARD','MONITOR','NONE'].map(t => (
                          <td key={t} className="py-3 px-2 text-center">
                            <span className={`text-sm ${t === 'PRIORITY' && row.tiers?.[t] > 0 ? 'font-bold text-[#6B132B]' : 'text-[#6B6562]'}`}>
                              {row.tiers?.[t] ?? 0}
                            </span>
                          </td>
                        ))}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-1.5 bg-[#F9F9F7] rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${isFlagged ? 'bg-[#B46B3E]' : 'bg-[#6B132B]'}`} style={{ width: `${Math.min(rate, 100)}%` }} />
                            </div>
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded min-w-[40px] text-center ${isFlagged ? 'bg-[#F4D9C0] text-[#2A161B]' : 'bg-[#F9F9F7] text-[#6B6562]'}`}>
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
