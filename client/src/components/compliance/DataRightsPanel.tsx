'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { Download, Trash2, ToggleLeft, ToggleRight, ShieldCheck } from 'lucide-react';

type Toast = { message: string; type: 'ok' | 'error' };

export function DataRightsPanel({ customerId }: { customerId: string }) {
  const [toast,     setToast]     = useState<Toast | null>(null);
  const [loading,   setLoading]   = useState<string | null>(null);
  const [consentState, setConsentState] = useState<Record<string, boolean>>({});

  function showToast(message: string, type: 'ok' | 'error' = 'ok') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  const handleExport = async () => {
    setLoading('export');
    try {
      const r = await api.exportCustomerData(customerId);
      const blob = new Blob([JSON.stringify(r.data, null, 2)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      a.download = `pcop-data-export-${customerId}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Data export downloaded (DPDPA 2023 §12)');
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Export failed', 'error');
    } finally { setLoading(null); }
  };

  const handleErasure = async () => {
    if (!window.confirm(`Request data erasure for ${customerId}? Consent will be revoked immediately. Audit logs will still be retained per DPDPA Rule 4.`)) return;
    setLoading('erase');
    try {
      const r = await api.requestErasure(customerId, 'customer_request');
      showToast(`Erasure request accepted (ID: ${r.erasureId}). DPDPA 2023 §14.`);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Erasure request failed', 'error');
    } finally { setLoading(null); }
  };

  const handleToggleDpdpa = async (grant: boolean) => {
    setLoading('dpdpa');
    try {
      if (grant) await api.grantDpdpaConsent(customerId);
      else       await api.revokeDpdpaConsent(customerId);
      setConsentState(s => ({ ...s, dpdpa: grant }));
      showToast(`DPDPA consent ${grant ? 'granted' : 'revoked'} (DPDPA 2023 §7)`);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Consent update failed', 'error');
    } finally { setLoading(null); }
  };

  const handleToggleTrai = async (grant: boolean) => {
    setLoading('trai');
    try {
      if (grant) await api.grantTraiConsent(customerId, ['SMS','EMAIL','PUSH']);
      else       await api.revokeTraiConsent(customerId);
      setConsentState(s => ({ ...s, trai: grant }));
      showToast(`TRAI DCA consent ${grant ? 'granted' : 'revoked'} (TRAI TCCCPR 2025)`);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Consent update failed', 'error');
    } finally { setLoading(null); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <ShieldCheck className="w-4 h-4 text-[#0f2d5c]" />
        <p className="text-[13px] font-bold text-slate-800">Data Subject Rights</p>
        <span className="text-[10px] text-slate-400">DPDPA 2023 · GDPR · TRAI TCCCPR 2025</span>
      </div>

      {toast && (
        <div className={`px-4 py-2.5 rounded-lg text-[12px] font-medium border ${
          toast.type === 'ok'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
            : 'bg-red-50 border-red-200 text-red-600'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Consent toggles */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Consent Management</p>
        <ConsentToggle
          label="DPDPA 2023 Processing Consent"
          description="Permits personal data processing for retention outreach (§7)"
          grantedState={consentState.dpdpa}
          loading={loading === 'dpdpa'}
          onGrant={() => handleToggleDpdpa(true)}
          onRevoke={() => handleToggleDpdpa(false)}
        />
        <ConsentToggle
          label="TRAI DCA Commercial Consent"
          description="Permits SMS/Email/Push promotional communications (TCCCPR 2025)"
          grantedState={consentState.trai}
          loading={loading === 'trai'}
          onGrant={() => handleToggleTrai(true)}
          onRevoke={() => handleToggleTrai(false)}
        />
      </div>

      {/* Rights actions */}
      <div className="grid grid-cols-1 gap-2">
        <RightsButton
          icon={<Download className="w-3.5 h-3.5" />}
          label="Export My Data"
          description="Download JSON summary of all data held (DPDPA 2023 §12)"
          color="blue"
          loading={loading === 'export'}
          onClick={handleExport}
        />
        <RightsButton
          icon={<Trash2 className="w-3.5 h-3.5" />}
          label="Request Erasure"
          description="Anonymise personal data — audit logs retained 7 years (DPDPA 2023 §14)"
          color="red"
          loading={loading === 'erase'}
          onClick={handleErasure}
        />
      </div>
    </div>
  );
}

function ConsentToggle({ label, description, grantedState, loading, onGrant, onRevoke }: {
  label: string;
  description: string;
  grantedState: boolean | undefined;
  loading: boolean;
  onGrant:  () => void;
  onRevoke: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-[12px] font-semibold text-slate-700">{label}</p>
        <p className="text-[11px] text-slate-400">{description}</p>
      </div>
      <div className="flex gap-1.5 shrink-0">
        <button
          onClick={onGrant}
          disabled={loading || grantedState === true}
          className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 disabled:opacity-40 transition-colors">
          Grant
        </button>
        <button
          onClick={onRevoke}
          disabled={loading || grantedState === false}
          className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 disabled:opacity-40 transition-colors">
          Revoke
        </button>
      </div>
    </div>
  );
}

function RightsButton({ icon, label, description, color, loading, onClick }: {
  icon: React.ReactNode;
  label: string;
  description: string;
  color: 'blue' | 'red';
  loading: boolean;
  onClick: () => void;
}) {
  const styles = {
    blue: 'border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100',
    red:  'border-red-200 text-red-600 bg-red-50 hover:bg-red-100',
  }[color];
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`flex items-center gap-3 p-3 rounded-xl border text-left w-full transition-colors disabled:opacity-50 ${styles}`}>
      <span className="shrink-0">{icon}</span>
      <div>
        <p className="text-[12px] font-semibold">{loading ? 'Processing…' : label}</p>
        <p className="text-[10px] opacity-70">{description}</p>
      </div>
    </button>
  );
}
