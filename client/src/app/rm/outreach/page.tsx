'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getToken, api } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import { Send, CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  sent:'bg-emerald-50 text-emerald-600', delivered:'bg-blue-50 text-blue-600',
  opened:'bg-purple-50 text-purple-600', clicked:'bg-indigo-50 text-indigo-600',
  pending:'bg-amber-50 text-amber-600', approved:'bg-emerald-50 text-emerald-600',
  rejected:'bg-red-50 text-red-600',
};

export default function RmOutreachPage() {
  const router = useRouter();
  const [tab,       setTab]       = useState<'sent'|'pending'|'blocked'>('sent');
  const [outreach,  setOutreach]  = useState<any[]>([]);
  const [approvals, setApprovals] = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [acting,    setActing]    = useState<string|null>(null);

  useEffect(() => {
    if (!getToken()) { router.push('/login'); return; }
    setLoading(true);
    Promise.all([ api.getOutreach(), api.getPendingApprovals() ])
      .then(([o, a]) => { setOutreach(o.records || []); setApprovals(a.approvals || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const approve = async (id: string) => {
    setActing(id);
    try { await api.approveOutreach(id); const a = await api.getPendingApprovals(); setApprovals(a.approvals || []); }
    catch {}
    finally { setActing(null); }
  };

  const reject = async (id: string) => {
    setActing(id);
    try { await api.rejectOutreach(id, 'Rejected by RM'); const a = await api.getPendingApprovals(); setApprovals(a.approvals || []); }
    catch {}
    finally { setActing(null); }
  };

  return (
    <div className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <Send className="w-5 h-5 text-[#0f2d5c]" />
        <h1 className="text-[22px] font-black text-slate-900">Outreach Tracker</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-100">
        {(['sent','pending','blocked'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-[13px] font-medium capitalize border-b-2 -mb-px transition-colors ${tab===t ? 'border-[#0f2d5c] text-[#0f2d5c]' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
            {t}
            {t === 'pending' && approvals.filter(a=>a.status==='pending').length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">
                {approvals.filter(a=>a.status==='pending').length}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({length:5}).map((_,i)=><Skeleton key={i} className="h-16 rounded-lg"/>)}</div>
      ) : tab === 'sent' ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            <div className="w-32">Customer</div><div className="w-20">Channel</div>
            <div className="w-20">Status</div><div className="flex-1">Preview</div><div className="w-32">Date</div>
          </div>
          {outreach.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-[13px]">No sent outreach yet.</div>
          ) : outreach.map(o => (
            <div key={o.id} className="flex items-center gap-3 px-4 py-3 border-b border-slate-50 last:border-0">
              <Link href={`/rm/customers/${o.customer_id}`} className="w-32 text-[12px] font-medium text-[#0f2d5c] hover:underline truncate">{o.customer_id}</Link>
              <div className="w-20 text-[11px] text-slate-500 capitalize">{o.channel}</div>
              <div className="w-20">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${STATUS_COLORS[o.status]||'bg-slate-50 text-slate-500'}`}>{o.status}</span>
              </div>
              <div className="flex-1 text-[11px] text-slate-400 truncate">{o.content_preview}</div>
              <div className="w-32 text-[10px] text-slate-400">{new Date(o.dispatched_at).toLocaleDateString('en-IN')}</div>
            </div>
          ))}
        </div>
      ) : tab === 'pending' ? (
        <div className="space-y-3">
          {approvals.filter(a=>a.status==='pending').length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-[13px]">No pending approvals.</div>
          ) : approvals.filter(a=>a.status==='pending').map((a: any) => (
            <div key={a.id} className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-[13px] font-semibold text-slate-800">Approval: {a.id}</p>
                  <p className="text-[11px] text-slate-400">Customer: {a.customerId} · Requested by {a.requestedBy}</p>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-600">Pending</span>
              </div>
              <p className="text-[11px] text-slate-500 mb-3">Offer: {a.compassRecommendation?.offer || '—'} · Channel: {a.compassRecommendation?.channel || '—'}</p>
              <div className="flex gap-2">
                <button onClick={() => approve(a.id)} disabled={acting===a.id}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                  {acting===a.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />} Approve & Send
                </button>
                <button onClick={() => reject(a.id)} disabled={acting===a.id}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-[11px] font-semibold hover:bg-red-50 disabled:opacity-50 transition-colors">
                  <XCircle className="w-3 h-3" /> Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-12 text-center text-slate-400 text-[13px]">
          <XCircle className="w-8 h-8 mx-auto mb-2" />
          No blocked outreach.
        </div>
      )}
    </div>
  );
}
