'use client';

import { useEffect, useState } from 'react';
import { Scale, Play, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';

interface BiasAuditStatus {
  status:          'PASS' | 'FAIL' | 'NOT_RUN' | 'UNKNOWN';
  overall_pass?:   boolean;
  audited_at?:     string | null;
  records_audited?:number;
  attributes?:     Record<string, { status: string }>;
  message?:        string;
}

const CHRONOS_URL = process.env.NEXT_PUBLIC_CHRONOS_URL || 'http://localhost:8001';

async function fetchBiasStatus(): Promise<BiasAuditStatus> {
  const r = await fetch(`${CHRONOS_URL}/bias-audit/status`);
  if (!r.ok) throw new Error('Failed to fetch bias audit status');
  return r.json();
}

async function triggerBiasAudit(): Promise<void> {
  const r = await fetch(`${CHRONOS_URL}/bias-audit/run`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  if (!r.ok) throw new Error('Failed to trigger bias audit');
}

export function BiasAuditCard() {
  const [status,  setStatus]  = useState<BiasAuditStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [toast,   setToast]   = useState('');

  const load = async () => {
    try {
      const s = await fetchBiasStatus();
      setStatus(s);
    } catch { /* CHRONOS may not be running in demo */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleRun = async () => {
    setRunning(true);
    try {
      await triggerBiasAudit();
      setToast('Bias audit started. Results will appear in ~10 seconds.');
      setTimeout(() => { load(); setToast(''); }, 10_000);
    } catch (e: unknown) {
      setToast(e instanceof Error ? e.message : 'Failed to trigger audit');
      setTimeout(() => setToast(''), 5_000);
    } finally { setRunning(false); }
  };

  const s = status?.status;
  const statusStyle = {
    PASS:    { bg: 'bg-sage-soft', border: 'border-soft', text: 'text-sage-brand', icon: <CheckCircle2 className="w-4 h-4" /> },
    FAIL:    { bg: 'bg-crimson-soft',     border: 'border-soft',     text: 'text-crimson',     icon: <AlertTriangle className="w-4 h-4" /> },
    NOT_RUN: { bg: 'bg-slate-50',   border: 'border-slate-200',   text: 'text-slate-500',   icon: <Clock className="w-4 h-4" /> },
    UNKNOWN: { bg: 'bg-slate-50',   border: 'border-slate-200',   text: 'text-slate-500',   icon: <Clock className="w-4 h-4" /> },
  }[s || 'NOT_RUN'] || { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-500', icon: <Clock className="w-4 h-4" /> };

  return (
    <div className={`rounded-xl border ${statusStyle.border} ${statusStyle.bg} p-5 space-y-3`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scale className={`w-4 h-4 ${statusStyle.text}`} />
          <p className="text-[13px] font-bold text-slate-800">Bias Audit</p>
          <span className="text-[10px] text-slate-400">RBI AI Governance 2024 §9 — EEOC 4/5ths rule</span>
        </div>
        <button
          onClick={handleRun}
          disabled={running || loading}
          className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg bg-[var(--crimson)] text-white hover:bg-[var(--crimson-dark)] disabled:opacity-50 transition-colors">
          <Play className="w-3.5 h-3.5" />
          {running ? 'Running…' : 'Run Audit'}
        </button>
      </div>

      {loading ? (
        <div className="h-6 bg-white/50 rounded animate-pulse" />
      ) : !status || s === 'NOT_RUN' ? (
        <p className="text-[12px] text-slate-500">No bias audit has been run. Click "Run Audit" to trigger a disparate impact check across gender, region, and age groups.</p>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <span className={`flex items-center gap-1.5 text-[12px] font-bold ${statusStyle.text}`}>
              {statusStyle.icon}
              {s}
            </span>
            {status.audited_at && (
              <span className="text-[11px] text-slate-400">
                · last run {new Date(status.audited_at).toLocaleDateString()} · {status.records_audited} records
              </span>
            )}
          </div>

          {status.attributes && (
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(status.attributes).map(([attr, v]) => (
                <div key={attr} className={`text-center text-[10px] font-semibold px-2 py-1.5 rounded-lg border ${
                  v.status === 'PASS'
                    ? 'bg-sage-soft border-soft text-sage-brand'
                    : v.status === 'FAIL'
                    ? 'bg-crimson-soft border-soft text-crimson'
                    : 'bg-slate-50 border-slate-200 text-slate-400'
                }`}>
                  {attr.replace(/_/g, ' ')}
                  <div className="font-bold">{v.status}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {toast && (
        <p className="text-[11px] text-slate-600 bg-white/60 rounded-lg px-3 py-2 border border-slate-200">{toast}</p>
      )}
    </div>
  );
}
