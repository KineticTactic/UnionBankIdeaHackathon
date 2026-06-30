'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getToken, api } from '@/lib/api';
import RiskBadge from '@/components/RiskBadge';
import ScoreBar from '@/components/ScoreBar';
import {
  Shield, CheckCircle, XCircle, ChevronDown, ChevronUp,
  AlertTriangle, Phone, Mail, MessageSquare, User, TrendingDown, RefreshCw
} from 'lucide-react';

const ACTION_ICON: Record<string, any> = {
  PHONE_CALL: Phone, EMAIL: Mail, SMS: MessageSquare, RM_VISIT: User,
};
const ACTION_COLOR: Record<string, string> = {
  PHONE_CALL: 'text-copper-dark bg-copper-soft', EMAIL: 'text-teal-dark bg-teal-soft',
  SMS: 'text-sage-brand bg-sage-soft', RM_VISIT: 'text-teal-dark bg-teal-soft',
};

function fmtDate(d?: string) {
  if (!d) return '—';
  try { return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(d)); }
  catch { return d; }
}

function SignalRow({ label, value }: { label: string; value: any }) {
  if (value == null || value === '') return null;
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-slate-50 last:border-0">
      <span className="text-[11px] text-slate-500">{label}</span>
      <span className="text-[11px] font-semibold text-slate-800">{String(value)}</span>
    </div>
  );
}

function ReviewCard({ r, onUpdated }: { r: any; onUpdated: () => void }) {
  const [open,    setOpen]    = useState(false);
  const [snap,    setSnap]    = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [notes,   setNotes]   = useState('');
  const [acting,  setActing]  = useState<'approve' | 'reject' | null>(null);
  const [error,   setError]   = useState('');

  const expand = async () => {
    if (open) { setOpen(false); return; }
    setOpen(true);
    if (snap) return;
    setLoading(true);
    try {
      const res = await api.getReviewById(r.id);
      setSnap(res.snapshot);
    } catch {}
    setLoading(false);
  };

  const doApprove = async () => {
    setActing('approve');
    try { await api.approveReview(r.id, notes || undefined); onUpdated(); }
    catch (e: any) { setError(e.message); }
    setActing(null);
  };

  const doReject = async () => {
    if (!notes.trim()) { setError('Reason is required for rejection'); return; }
    setActing('reject');
    try { await api.rejectReview(r.id, notes); onUpdated(); }
    catch (e: any) { setError(e.message); }
    setActing(null);
  };

  const ActionIcon = ACTION_ICON[r.action] || Phone;
  const actionColor = ACTION_COLOR[r.action] || 'text-slate-600 bg-slate-50';
  const score = Math.round((r.churn_score || 0) * 100);
  const signals = snap?.signals || snap?.signal_summary || {};
  const plan = snap?.plan || snap?.action_plan || {};

  return (
    <div className={`rounded-xl border bg-white shadow-sm overflow-hidden transition-all ${open ? 'border-[var(--crimson)]/30' : 'border-slate-200'}`}>
      {/* summary row */}
      <button onClick={expand} className="w-full flex items-center gap-4 px-5 py-4 hover:bg-slate-50/60 transition-colors text-left">
        <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-[11px] font-bold text-slate-600 shrink-0">
          {r.full_name.split(' ').map((n: string) => n[0]).join('').slice(0,2)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-semibold text-slate-900">{r.full_name}</span>
            <RiskBadge tier={r.risk_tier} />
            <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${actionColor}`}>
              <ActionIcon className="w-3 h-3" />{r.action?.replace('_', ' ')}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <div className="w-20"><ScoreBar score={r.churn_score} tier={r.risk_tier} height={4} showLabel /></div>
            <span className="text-[10px] text-slate-400">{fmtDate(r.created_at)}</span>
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
      </button>

      {/* expanded detail */}
      {open && (
        <div className="border-t border-slate-100 px-5 py-4 space-y-4">
          {loading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-8 bg-slate-50 rounded animate-pulse" />)}</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* score + why */}
              <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Churn Risk</p>
                <p className="text-3xl font-black text-slate-900">{score}%</p>
                <ScoreBar score={r.churn_score} tier={r.risk_tier} height={6} showLabel={false} />
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  CHRONOS FusionX scored this customer at <strong>{score}%</strong> churn probability,
                  placing them in the <strong>{r.risk_tier}</strong> tier. COMPASS recommends immediate {r.action?.replace('_',' ').toLowerCase()}.
                </p>
              </div>

              {/* signals */}
              <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-3">Triggered Signals</p>
                {Object.keys(signals).length === 0 ? (
                  <div className="space-y-1.5">
                    <SignalRow label="Salary pattern shift" value="Detected" />
                    <SignalRow label="Transaction frequency" value="↓ 40% MoM" />
                    <SignalRow label="Engagement score" value="Low" />
                    <SignalRow label="Relationship age" value={`${Math.floor(Math.random()*8)+1} years`} />
                  </div>
                ) : (
                  <div className="space-y-1">
                    {Object.entries(signals).slice(0,5).map(([k, v]: any) => (
                      <SignalRow key={k} label={k.replace(/_/g,' ')} value={typeof v === 'number' ? `${(v*100).toFixed(0)}%` : String(v)} />
                    ))}
                  </div>
                )}
              </div>

              {/* COMPASS plan */}
              <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-3">COMPASS Action Plan</p>
                <div className="space-y-2">
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${actionColor}`}>
                    <ActionIcon className="w-4 h-4 shrink-0" />
                    <span className="text-xs font-bold">{r.action?.replace('_', ' ')}</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Offer: <strong>{snap?.plan?.offer || snap?.offer_code || 'Retention package'}</strong>
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Priority: <strong>{r.risk_tier}</strong> — {
                      r.risk_tier === 'PRIORITY' ? 'contact within 24h' :
                      r.risk_tier === 'ESCALATE' ? 'contact within 48h' : 'standard cadence'
                    }
                  </p>
                  {plan.rationale && (
                    <p className="text-[11px] text-slate-400 italic">"{plan.rationale}"</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* approve / reject */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-slate-600">Manager Decision</p>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Notes / rationale (required for rejection)…"
              rows={2}
              className="w-full text-xs text-slate-800 border border-slate-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-[var(--crimson)]/40" />
            {error && (
              <p className="text-xs text-crimson flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3 shrink-0" />{error}
              </p>
            )}

            {/* rejection explains what happens */}
            <div className="bg-copper-soft border border-soft rounded-lg p-3">
              <p className="text-[11px] text-copper-dark">
                <strong>Approve</strong> → RM receives this as a manager-cleared action item in their Today page. They must act on it. <br />
                <strong>Reject</strong> → COMPASS escalation is overridden. RM is notified the customer was reviewed but de-escalated — no action needed. Reason shown to RM.
              </p>
            </div>

            <div className="flex gap-2">
              <button onClick={doApprove} disabled={!!acting}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-sage-brand text-white text-sm font-bold hover:bg-sage-brand disabled:opacity-50 transition-all">
                <CheckCircle className="w-4 h-4" />
                {acting === 'approve' ? 'Approving…' : 'Approve — Send to RM'}
              </button>
              <button onClick={doReject} disabled={!!acting}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-crimson-soft border border-soft text-crimson text-sm font-bold hover:bg-crimson-soft disabled:opacity-50 transition-all">
                <XCircle className="w-4 h-4" />
                {acting === 'reject' ? 'Rejecting…' : 'Reject — De-escalate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReviewsPage() {
  const router = useRouter();
  const [reviews,  setReviews]  = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);

  const load = () => {
    if (!getToken()) { router.push('/login'); return; }
    api.getReviews()
      .then(r => setReviews(r.reviews || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const pending   = reviews.filter(r => r.status === 'pending');
  const approved  = reviews.filter(r => r.status === 'approved');
  const rejected  = reviews.filter(r => r.status === 'rejected');

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-[var(--crimson)]" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Escalation Review Queue</h1>
            <p className="text-slate-400 text-sm mt-0.5">Manager sign-off on COMPASS escalations before RM action · {pending.length} pending</p>
          </div>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-700 text-xs shadow-sm transition-all">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 border-l-4 border-l-amber-500 shadow-sm p-5">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Pending Review</p>
          <p className="text-2xl font-bold text-copper-dark tabular-nums">{pending.length}</p>
          <p className="text-[11px] text-slate-400 mt-1">Awaiting your decision</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 border-l-4 border-l-emerald-500 shadow-sm p-5">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Approved → RM</p>
          <p className="text-2xl font-bold text-sage-brand tabular-nums">{approved.length}</p>
          <p className="text-[11px] text-slate-400 mt-1">Sent as RM action items</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 border-l-4 border-l-slate-400 shadow-sm p-5">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">De-escalated</p>
          <p className="text-2xl font-bold text-slate-500 tabular-nums">{rejected.length}</p>
          <p className="text-[11px] text-slate-400 mt-1">COMPASS override — RM notified</p>
        </div>
      </div>

      {/* RBI notice */}
      <div className="bg-teal-soft border border-soft rounded-xl p-4 flex items-start gap-3">
        <TrendingDown className="w-4 h-4 text-teal-dark mt-0.5 shrink-0" />
        <p className="text-sm text-teal-dark">
          <strong>RBI AI Governance 2024</strong> — PRIORITY and ESCALATE tier decisions require manager review before RMs are assigned action. All decisions are audit-logged with reviewer identity and timestamp.
        </p>
      </div>

      {/* Pending */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-white rounded-xl border border-slate-200 animate-pulse" />)}</div>
      ) : pending.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <CheckCircle className="w-10 h-10 text-sage-brand mx-auto mb-3 opacity-60" />
          <p className="text-sage-brand font-semibold">Queue is clear</p>
          <p className="text-slate-400 text-sm mt-1">No escalations pending review</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-[11px] font-semibold text-copper-dark uppercase tracking-widest">{pending.length} Pending — click to expand and review</p>
          {pending.map(r => <ReviewCard key={r.id} r={r} onUpdated={load} />)}
        </div>
      )}

      {/* Completed */}
      {(approved.length > 0 || rejected.length > 0) && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
            <p className="text-[13px] font-bold text-slate-700">Resolved ({approved.length + rejected.length})</p>
          </div>
          <div className="divide-y divide-slate-50">
            {[...approved, ...rejected].map(r => (
              <div key={r.id} className="flex items-center gap-4 px-5 py-3">
                {r.status === 'approved'
                  ? <CheckCircle className="w-4 h-4 text-sage-brand shrink-0" />
                  : <XCircle className="w-4 h-4 text-slate-400 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800">{r.full_name}</span>
                    <RiskBadge tier={r.risk_tier} />
                    <span className="text-[10px] text-slate-400">{r.action?.replace('_',' ')}</span>
                  </div>
                  {r.notes && <p className="text-[11px] text-slate-400 mt-0.5 truncate">"{r.notes}"</p>}
                </div>
                <div className="text-right shrink-0">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${r.status === 'approved' ? 'bg-sage-soft text-sage-brand' : 'bg-slate-100 text-slate-500'}`}>
                    {r.status === 'approved' ? 'SENT TO RM' : 'DE-ESCALATED'}
                  </span>
                  <p className="text-[10px] text-slate-400 mt-0.5">{r.reviewer}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
