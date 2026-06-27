'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { CheckCircle2, XCircle, Clock, RefreshCw, ShieldAlert } from 'lucide-react';

interface Approval {
  approvalId:            string;
  customerId:            string;
  requestedBy:           string;
  requestedAt:           string;
  status:                'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  expiresAt:             string;
  compassRecommendation: { offer?: string; channel?: string; rationale?: string };
  heraldContent:         { email?: { subject?: string }; sms?: { body?: string } };
}

export function ApprovalQueuePanel() {
  const [approvals, setApprovals]     = useState<Approval[]>([]);
  const [loading,   setLoading]       = useState(true);
  const [actionId,  setActionId]      = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api.getPendingApprovals({ status: 'PENDING' });
      setApprovals(r.approvals || []);
    } catch { /* non-fatal */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [load]);

  const handleApprove = async (approvalId: string) => {
    setActionId(approvalId);
    try {
      await api.approveOutreach(approvalId);
      await load();
    } catch { /* shown inline */ }
    finally { setActionId(null); }
  };

  const handleReject = async (approvalId: string) => {
    if (!rejectReason.trim()) return;
    setActionId(approvalId);
    try {
      await api.rejectOutreach(approvalId, rejectReason);
      setRejectTarget(null);
      setRejectReason('');
      await load();
    } catch { /* shown inline */ }
    finally { setActionId(null); }
  };

  const pending = approvals.filter(a => a.status === 'PENDING');

  return (
    <div className="bg-white rounded-xl border border-amber-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 bg-amber-50 border-b border-amber-200">
        <div className="flex items-center gap-2.5">
          <ShieldAlert className="w-4 h-4 text-amber-600" />
          <span className="text-[13px] font-bold text-amber-900">
            Pending RM Approval
            {pending.length > 0 && (
              <span className="ml-2 text-[10px] font-bold bg-amber-500 text-white px-2 py-0.5 rounded-full">
                {pending.length}
              </span>
            )}
          </span>
          <span className="text-[10px] text-amber-600">RBI AI Governance 2024 — human override required</span>
        </div>
        <button onClick={load} className="text-amber-500 hover:text-amber-700 transition-colors">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading ? (
        <div className="p-5 text-[12px] text-slate-400">Loading approval queue…</div>
      ) : pending.length === 0 ? (
        <div className="p-5 flex items-center gap-2 text-[12px] text-slate-400">
          <CheckCircle2 className="w-4 h-4 text-green-500" />
          No pending approvals — queue is clear.
        </div>
      ) : (
        <div className="divide-y divide-amber-100">
          {pending.map(a => {
            const expiresIn = Math.max(0, Math.round((new Date(a.expiresAt).getTime() - Date.now()) / 3_600_000));
            const isActing  = actionId === a.approvalId;
            return (
              <div key={a.approvalId} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[13px] font-bold text-slate-800">{a.customerId}</span>
                    <span className="ml-2 text-[10px] text-slate-400">via {a.compassRecommendation?.channel || '—'}</span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {a.compassRecommendation?.offer?.replace(/_/g, ' ') || 'Personalised offer'} ·
                      requested by {a.requestedBy} · {new Date(a.requestedAt).toLocaleDateString()}
                    </p>
                    {a.heraldContent?.email?.subject && (
                      <p className="text-[11px] text-slate-600 mt-1 italic">
                        &ldquo;{a.heraldContent.email.subject}&rdquo;
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-amber-600 shrink-0">
                    <Clock className="w-3 h-3" />
                    expires in {expiresIn}h
                  </div>
                </div>

                {rejectTarget === a.approvalId ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Rejection reason (required)"
                      value={rejectReason}
                      onChange={e => setRejectReason(e.target.value)}
                      className="flex-1 text-[12px] border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-red-200"
                    />
                    <button
                      onClick={() => handleReject(a.approvalId)}
                      disabled={isActing || !rejectReason.trim()}
                      className="text-[12px] font-semibold px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors">
                      {isActing ? '…' : 'Confirm'}
                    </button>
                    <button onClick={() => setRejectTarget(null)} className="text-[12px] text-slate-400 hover:text-slate-600 px-2">Cancel</button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(a.approvalId)}
                      disabled={isActing}
                      className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {isActing ? 'Approving…' : 'Approve & Send'}
                    </button>
                    <button
                      onClick={() => { setRejectTarget(a.approvalId); setRejectReason(''); }}
                      disabled={isActing}
                      className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors">
                      <XCircle className="w-3.5 h-3.5" />
                      Reject
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
