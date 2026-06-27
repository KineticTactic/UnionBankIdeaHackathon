'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { ShieldCheck, ShieldX, ChevronDown, ChevronUp } from 'lucide-react';

interface ConsentRecord {
  dpdpaConsent?: { granted: boolean; grantedAt?: string };
  traiConsent?:  { granted: boolean; channels?: string[] };
  optOutChannels?: string[];
}

interface ChannelStatus {
  allowed: boolean;
  reason:  string;
}

export function ConsentStatusBadge({ customerId }: { customerId: string }) {
  const [consent,  setConsent]  = useState<ConsentRecord | null>(null);
  const [channels, setChannels] = useState<Record<string, ChannelStatus>>({});
  const [expanded, setExpanded] = useState(false);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    api.getConsent(customerId)
      .then(r => {
        setConsent(r.consent || null);
        setChannels(r.channelStatus || {});
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [customerId]);

  if (loading) return <div className="h-5 w-32 bg-slate-100 rounded animate-pulse" />;
  if (!consent) return null;

  const dpdpaOk = consent.dpdpaConsent?.granted === true;
  const traiOk  = consent.traiConsent?.granted  === true;
  const allOk   = dpdpaOk && traiOk;

  return (
    <div className="inline-block">
      <button
        onClick={() => setExpanded(e => !e)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-colors ${
          allOk
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
            : 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
        }`}>
        {allOk ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldX className="w-3.5 h-3.5" />}
        Consent {allOk ? 'Valid' : 'Issues'}
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {expanded && (
        <div className="absolute z-20 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg p-4 w-72 space-y-3">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Consent Details</p>

          <div className="space-y-1.5">
            <ConsentRow label="DPDPA 2023" ok={dpdpaOk}
              detail={dpdpaOk ? `Granted ${consent.dpdpaConsent?.grantedAt ? new Date(consent.dpdpaConsent.grantedAt).toLocaleDateString() : ''}` : 'Not granted'} />
            <ConsentRow label="TRAI DCA" ok={traiOk}
              detail={traiOk ? `Channels: ${consent.traiConsent?.channels?.join(', ') || '—'}` : 'Not granted'} />
          </div>

          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Channel Status</p>
            <div className="grid grid-cols-3 gap-1">
              {['EMAIL','SMS','PUSH'].map(ch => {
                const status = channels[ch];
                return (
                  <div key={ch} className={`text-center text-[10px] font-semibold px-2 py-1 rounded-lg border ${
                    status?.allowed
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-red-50 text-red-600 border-red-200'
                  }`}>
                    {ch}
                  </div>
                );
              })}
            </div>
          </div>

          {(consent.optOutChannels?.length ?? 0) > 0 && (
            <p className="text-[10px] text-red-600">
              Opted out: {consent.optOutChannels!.join(', ')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ConsentRow({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`w-2 h-2 rounded-full shrink-0 ${ok ? 'bg-emerald-500' : 'bg-red-400'}`} />
      <span className="text-[12px] font-semibold text-slate-700 w-24 shrink-0">{label}</span>
      <span className="text-[11px] text-slate-500">{detail}</span>
    </div>
  );
}
