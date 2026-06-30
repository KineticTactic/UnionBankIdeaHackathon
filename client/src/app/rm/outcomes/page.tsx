'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getToken, api } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import { ClipboardList, Plus, CheckCircle, XCircle, Minus, X, Loader2 } from 'lucide-react';

const OUTCOME_COLORS: Record<string, string> = {
  converted:'bg-emerald-100 text-emerald-700', retained:'bg-green-100 text-green-700',
  neutral:'bg-slate-100 text-slate-500', declined:'bg-orange-100 text-orange-600',
  unreachable:'bg-slate-100 text-slate-400', churned:'bg-red-100 text-red-600',
};

const OUTCOME_ICON: Record<string, React.ReactNode> = {
  converted: <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />,
  retained:  <CheckCircle className="w-3.5 h-3.5 text-green-500" />,
  neutral:   <Minus className="w-3.5 h-3.5 text-slate-400" />,
  declined:  <XCircle className="w-3.5 h-3.5 text-orange-400" />,
  churned:   <XCircle className="w-3.5 h-3.5 text-red-500" />,
};

const LANG_LABELS: Record<string,string> = { en:'English',hi:'Hindi',ta:'Tamil',bn:'Bengali',te:'Telugu',mr:'Marathi',ml:'Malayalam',kn:'Kannada',gu:'Gujarati',pa:'Punjabi' };
const OUTCOME_OPTIONS = ['converted','retained','neutral','declined','unreachable','churned'];
const CHANNEL_OPTIONS = ['phone','email','sms','branch','whatsapp','app'];

function LogModal({ customers, onClose, onSaved }: { customers: any[]; onClose:()=>void; onSaved:()=>void }) {
  const [form, setForm] = useState({ customer_id:'', action_taken:'call', contacted:true, outcome:'neutral', offer_presented:'', offer_accepted:'', channel:'phone', language_used:'en', rm_notes:'', follow_up_date:'' });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const save = async () => {
    if (!form.customer_id) { setError('Select a customer.'); return; }
    setLoading(true); setError('');
    try {
      await api.logRmOutcome({ ...form, offer_accepted: form.offer_accepted === 'true' ? true : form.offer_accepted === 'false' ? false : null });
      onSaved(); onClose();
    } catch(e:any) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2"><ClipboardList className="w-4 h-4 text-[#0f2d5c]" /><h2 className="text-[14px] font-bold text-slate-900">Log Outcome</h2></div>
          <button onClick={onClose}><X className="w-4 h-4 text-slate-400" /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          {error && <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-[12px] text-red-600">{error}</div>}
          <div>
            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Customer</label>
            <select value={form.customer_id} onChange={e=>setForm(f=>({...f,customer_id:e.target.value}))}
              className="w-full px-3 py-2 text-[13px] rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0f2d5c]/20">
              <option value="">Select…</option>
              {customers.map(c => <option key={c.customer_id} value={c.customer_id}>{c.full_name} ({c.customer_id})</option>)}
            </select>
          </div>
          {([
            ['outcome','Outcome','select',OUTCOME_OPTIONS],
            ['action_taken','Action Taken','select',['call','email_reply','sms','branch_visit','no_contact']],
            ['channel','Channel','select',CHANNEL_OPTIONS],
            ['language_used','Language Used','select',Object.keys(LANG_LABELS)],
            ['offer_presented','Offer Presented','text',[]],
            ['offer_accepted','Offer Accepted','select',['','true','false']],
            ['follow_up_date','Follow-up Date','date',[]],
          ] as [string,string,string,string[]][]).map(([k,label,type,opts]) => (
            <div key={k}>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{label}</label>
              {type === 'select' ? (
                <select value={(form as any)[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))}
                  className="w-full px-3 py-2 text-[13px] rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0f2d5c]/20">
                  {opts.map(o => <option key={o} value={o}>{o === '' ? '—' : LANG_LABELS[o] || o.replace(/_/g,' ')}</option>)}
                </select>
              ) : (
                <input type={type} value={(form as any)[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))}
                  className="w-full px-3 py-2 text-[13px] rounded-lg border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0f2d5c]/20" />
              )}
            </div>
          ))}
          <div>
            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Notes</label>
            <textarea value={form.rm_notes} onChange={e=>setForm(f=>({...f,rm_notes:e.target.value}))} rows={3}
              className="w-full px-3 py-2 text-[13px] rounded-lg border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0f2d5c]/20 resize-none" />
          </div>
          <label className="flex items-center gap-2 text-[12px] text-slate-600 cursor-pointer">
            <input type="checkbox" checked={form.contacted} onChange={e=>setForm(f=>({...f,contacted:e.target.checked}))} className="rounded" />
            Customer was contacted
          </label>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 text-[12px] text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
          <button onClick={save} disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0f2d5c] text-white text-[12px] font-semibold hover:bg-[#1a3f7a] disabled:opacity-50 transition-colors">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />} Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default function OutcomesPage() {
  const router  = useRouter();
  const [outcomes,  setOutcomes]  = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);

  const load = () => {
    if (!getToken()) { router.push('/login'); return; }
    setLoading(true);
    Promise.all([api.getRmOutcomes(), api.getRmBook()])
      .then(([o, b]) => { setOutcomes(o.outcomes || []); setCustomers(b.customers || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const custName = (id: string) => customers.find(c=>c.customer_id===id)?.full_name || id;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-[#0f2d5c]" />
          <h1 className="text-[22px] font-black text-slate-900">Outcome Log</h1>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0f2d5c] text-white text-[12px] font-semibold hover:bg-[#1a3f7a] transition-colors">
          <Plus className="w-3.5 h-3.5" /> Log Outcome
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({length:4}).map((_,i)=><Skeleton key={i} className="h-20 rounded-xl"/>)}</div>
      ) : outcomes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <ClipboardList className="w-8 h-8 mb-3" />
          <p className="text-[14px] font-medium">No outcomes logged yet</p>
          <p className="text-[12px]">Record what happened after each customer interaction</p>
        </div>
      ) : (
        <div className="space-y-3">
          {outcomes.map(o => (
            <div key={o.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {OUTCOME_ICON[o.outcome] || <Minus className="w-3.5 h-3.5 text-slate-400" />}
                  <Link href={`/rm/customers/${o.customer_id}`} className="text-[13px] font-semibold text-[#0f2d5c] hover:underline">
                    {custName(o.customer_id)}
                  </Link>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded capitalize ${OUTCOME_COLORS[o.outcome]||'bg-slate-50 text-slate-500'}`}>{o.outcome?.replace(/_/g,' ')}</span>
                </div>
                <span className="text-[10px] text-slate-400">{new Date(o.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</span>
              </div>
              <div className="flex items-center gap-4 text-[11px] text-slate-400">
                <span className="capitalize">{o.action_taken?.replace(/_/g,' ')}</span>
                <span>·</span>
                <span className="capitalize">{o.channel}</span>
                {o.offer_presented && <><span>·</span><span>{o.offer_presented} {o.offer_accepted===true?'✓':o.offer_accepted===false?'✗':''}</span></>}
              </div>
              {o.rm_notes && <p className="text-[11px] text-slate-500 mt-2 leading-relaxed line-clamp-2">{o.rm_notes}</p>}
            </div>
          ))}
        </div>
      )}

      {showModal && <LogModal customers={customers} onClose={() => setShowModal(false)} onSaved={load} />}
    </div>
  );
}
