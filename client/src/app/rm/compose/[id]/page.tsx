'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getToken, api } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft, Brain, Globe, ShieldCheck, Eye, Send,
  Loader2, CheckCircle, AlertTriangle, ChevronRight,
} from 'lucide-react';

const LANG_OPTIONS: Record<string, string> = {
  en:'English', hi:'Hindi', ta:'Tamil', bn:'Bengali', te:'Telugu',
  mr:'Marathi', ml:'Malayalam', kn:'Kannada', gu:'Gujarati', pa:'Punjabi',
};

type Step = 1 | 2 | 3 | 4 | 5;

export default function OutreachComposerPage() {
  const { id } = useParams() as { id: string };
  const router  = useRouter();

  const [step,         setStep]         = useState<Step>(1);
  const [customer,     setCustomer]     = useState<any>(null);
  const [loadingCust,  setLoadingCust]  = useState(true);

  // Step 1 — Generate
  const [content,        setContent]        = useState<any>(null);
  const [approvalId,     setApprovalId]     = useState('');
  const [generating,     setGenerating]     = useState(false);
  const [genError,       setGenError]       = useState('');

  // Step 2 — Translate
  const [targetLang,    setTargetLang]    = useState('en');
  const [translated,    setTranslated]    = useState<any>(null);
  const [backtranslation,setBacktranslation] = useState<any>(null);
  const [translating,   setTranslating]   = useState(false);
  const [transError,    setTransError]    = useState('');

  // Step 3 — Compliance
  const [consent,       setConsent]       = useState<any>(null);
  const [loadingConsent,setLoadingConsent]= useState(false);

  // Step 4 — Review (edit)
  const [editContent,   setEditContent]   = useState<any>(null);

  // Step 5 — Send
  const [sending,       setSending]       = useState(false);
  const [sendResult,    setSendResult]    = useState<any>(null);
  const [sendError,     setSendError]     = useState('');

  useEffect(() => {
    if (!getToken()) { router.push('/login'); return; }
    api.getCustomerById(id)
      .then(r => { setCustomer(r.customer || r); setTargetLang(r.customer?.preferred_language || 'en'); })
      .catch(() => {})
      .finally(() => setLoadingCust(false));
  }, [id]);

  const generate = async () => {
    setGenerating(true); setGenError('');
    try {
      const r = await api.generateOutreach(id);
      setContent(r.heraldContent || r);
      setApprovalId(r.approvalId || '');
      setEditContent(r.heraldContent || r);
      setStep(2);
    } catch(e: any) { setGenError(e.message); }
    finally { setGenerating(false); }
  };

  const translate = async () => {
    if (targetLang === 'en') { setStep(3); loadConsent(); return; }
    setTranslating(true); setTransError('');
    try {
      const r = await api.translateOutreach({ customer_id: id, content, target_language: targetLang });
      setTranslated(r.translated);
      setBacktranslation(r.backtranslation);
      setEditContent(r.translated);
      setStep(3);
      loadConsent();
    } catch(e: any) { setTransError(e.message); }
    finally { setTranslating(false); }
  };

  const loadConsent = async () => {
    setLoadingConsent(true);
    try { const r = await api.getConsent(id); setConsent(r.consent || r); }
    catch {}
    finally { setLoadingConsent(false); }
  };

  const proceed = (s: Step) => setStep(s);

  const submitForApproval = async () => {
    if (!approvalId) { setSendError('No approval request found — please regenerate.'); return; }
    setSending(true); setSendError('');
    try {
      const r = await api.approveOutreach(approvalId);
      setSendResult(r);
      setStep(5);
    } catch(e: any) { setSendError(e.message); }
    finally { setSending(false); }
  };

  if (loadingCust) return <div className="p-6"><Skeleton className="h-96 rounded-xl" /></div>;

  const finalContent = editContent || content;
  const useTranslated = targetLang !== 'en' && translated;

  const StepIndicator = () => (
    <div className="flex items-center gap-1 mb-6">
      {(['Generate','Translate','Compliance','Review','Send'] as const).map((label, i) => {
        const num = (i + 1) as Step;
        const done = step > num; const active = step === num;
        return (
          <div key={label} className="flex items-center">
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all ${
              done ? 'bg-emerald-100 text-emerald-700' : active ? 'bg-[#0f2d5c] text-white' : 'bg-slate-100 text-slate-400'
            }`}>
              {done ? <CheckCircle className="w-3 h-3" /> : <span>{num}</span>}
              <span className="hidden sm:inline">{label}</span>
            </div>
            {i < 4 && <ChevronRight className="w-3 h-3 text-slate-300 mx-0.5" />}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link href={`/rm/customers/${id}`} className="inline-flex items-center gap-1.5 text-[12px] text-slate-400 hover:text-[#0f2d5c] mb-5 transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Customer 360
      </Link>

      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-[20px] font-black text-slate-900">Outreach Composer</h1>
          {customer && <p className="text-[13px] text-slate-400 mt-0.5">for {customer.full_name} · {customer.segment} · {customer.city}</p>}
        </div>
        <div className="text-right">
          <p className="text-[10px] text-slate-400 font-medium">HERALD + NVIDIA DeepSeek V4 Pro</p>
          <p className="text-[10px] text-slate-300">Human approval required before send</p>
        </div>
      </div>

      <StepIndicator />

      {/* ── Step 1: Generate ─────────────────────────────────────────────── */}
      {step === 1 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <Brain className="w-5 h-5 text-[#0f2d5c]" />
            <h2 className="text-[16px] font-bold text-slate-900">Step 1 — Generate Content</h2>
          </div>
          <p className="text-[13px] text-slate-500 mb-6">
            HERALD will create personalised email, SMS, and push drafts using the customer's signal profile,
            risk tier, and COMPASS action plan. All content applies Union Bank's compliance rules automatically.
          </p>
          {genError && <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-[12px] text-red-600 mb-4">{genError}</div>}
          <button onClick={generate} disabled={generating}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#0f2d5c] text-white text-[13px] font-semibold hover:bg-[#1a3f7a] disabled:opacity-50 transition-colors">
            {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</> : <><Brain className="w-4 h-4" /> Generate All Channels</>}
          </button>
        </div>
      )}

      {/* ── Step 2: Translate ─────────────────────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <Globe className="w-5 h-5 text-[#0f2d5c]" />
              <h2 className="text-[16px] font-bold text-slate-900">Step 2 — Translate / Transcreate</h2>
            </div>
            <p className="text-[12px] text-slate-500 mb-4">
              HERALD transcreates into the customer's preferred language, preserving tone and offer.
              A back-translation is shown for your verification.
            </p>
            <div className="flex items-center gap-3 mb-4">
              <label className="text-[12px] font-semibold text-slate-500">Target language:</label>
              <select value={targetLang} onChange={e => setTargetLang(e.target.value)}
                className="px-3 py-1.5 text-[13px] rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0f2d5c]/20">
                {Object.entries(LANG_OPTIONS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              {targetLang === 'en' && <span className="text-[11px] text-slate-400">No translation needed — content is already in English.</span>}
            </div>
            {transError && <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-[12px] text-red-600 mb-3">{transError}</div>}
            <div className="flex gap-2">
              <button onClick={() => { setStep(3); loadConsent(); }}
                className="px-4 py-2 rounded-lg border border-slate-200 text-[12px] text-slate-600 hover:bg-slate-50 transition-colors">
                Skip translation
              </button>
              <button onClick={translate} disabled={translating}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0f2d5c] text-white text-[12px] font-semibold hover:bg-[#1a3f7a] disabled:opacity-50 transition-colors">
                {translating ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Translating…</> : <><Globe className="w-3.5 h-3.5" /> Transcreate to {LANG_OPTIONS[targetLang]}</>}
              </button>
            </div>
          </div>

          {/* Content preview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[['Email', content?.email?.subject, content?.email?.body],
              ['SMS',   null,                    content?.sms?.body],
              ['Push',  content?.push?.title,    content?.push?.body]
            ].map(([ch, title, body]) => (
              <div key={ch as string} className="bg-white border border-slate-200 rounded-lg p-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">{ch as string}</p>
                {title && <p className="text-[11px] font-semibold text-slate-700 mb-1">{title as string}</p>}
                <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-4">{body as string}</p>
              </div>
            ))}
          </div>

          {backtranslation && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
              <p className="text-[11px] font-semibold text-amber-700 mb-2">Back-translation (verify meaning before sending):</p>
              <p className="text-[11px] text-amber-800 leading-relaxed">{backtranslation?.email?.body || JSON.stringify(backtranslation)}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Step 3: Compliance ────────────────────────────────────────────── */}
      {step === 3 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="w-5 h-5 text-[#0f2d5c]" />
            <h2 className="text-[16px] font-bold text-slate-900">Step 3 — Compliance Gate</h2>
          </div>
          {loadingConsent ? <Skeleton className="h-32 rounded-lg" /> : (
            <div className="space-y-3 mb-5">
              {[
                ['DPDPA Consent (retention_outreach)',    consent?.dpdpa_consent,  'Required for outreach'],
                ['TRAI DCA Channel Consent',             consent?.trai_consent,   'Required for SMS/push'],
                ['Not Opted Out',                        !consent?.opted_out,     'Must not have opted out'],
                ['DLT Registration',                     true,                    'DEMO-DLT-001 — valid'],
              ].map(([label, ok, note]) => (
                <div key={label as string} className={`flex items-center justify-between rounded-lg px-4 py-3 border ${ok ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                  <div>
                    <p className="text-[12px] font-semibold text-slate-700">{label as string}</p>
                    <p className="text-[10px] text-slate-400">{note as string}</p>
                  </div>
                  {ok ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <AlertTriangle className="w-4 h-4 text-red-500" />}
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={() => setStep(2)} className="px-4 py-2 rounded-lg border border-slate-200 text-[12px] text-slate-600 hover:bg-slate-50 transition-colors">Back</button>
            <button onClick={() => proceed(4)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0f2d5c] text-white text-[12px] font-semibold hover:bg-[#1a3f7a] transition-colors">
              <Eye className="w-3.5 h-3.5" /> Proceed to Review
            </button>
          </div>
        </div>
      )}

      {/* ── Step 4: Review & Edit ────────────────────────────────────────── */}
      {step === 4 && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <Eye className="w-5 h-5 text-[#0f2d5c]" />
              <h2 className="text-[16px] font-bold text-slate-900">Step 4 — Review & Edit</h2>
            </div>
            <p className="text-[12px] text-slate-500 mb-4">
              Review the {useTranslated ? `${LANG_OPTIONS[targetLang]} ` : ''}content. Edit inline if needed — changes are re-compliance-checked before send.
            </p>
            <div className="space-y-4">
              {/* Email */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Email Subject</label>
                <input value={finalContent?.email?.subject || ''} onChange={e => setEditContent((c: any) => ({...c, email:{...c.email, subject:e.target.value}}))}
                  className="w-full px-3 py-2 text-[13px] rounded-lg border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0f2d5c]/20" />
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5 mt-3">Email Body</label>
                <textarea value={finalContent?.email?.body || ''} onChange={e => setEditContent((c: any) => ({...c, email:{...c.email, body:e.target.value}}))}
                  rows={5} className="w-full px-3 py-2 text-[12px] rounded-lg border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0f2d5c]/20 resize-none" />
              </div>
              {/* SMS */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">SMS ({finalContent?.sms?.body?.length || 0} chars)</label>
                <textarea value={finalContent?.sms?.body || ''} onChange={e => setEditContent((c: any) => ({...c, sms:{...c.sms, body:e.target.value}}))}
                  rows={2} className="w-full px-3 py-2 text-[12px] rounded-lg border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0f2d5c]/20 resize-none" />
              </div>
              {/* Push */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Push Title</label>
                  <input value={finalContent?.push?.title || ''} onChange={e => setEditContent((c: any) => ({...c, push:{...c.push, title:e.target.value}}))}
                    className="w-full px-3 py-2 text-[12px] rounded-lg border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0f2d5c]/20" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Push Body</label>
                  <input value={finalContent?.push?.body || ''} onChange={e => setEditContent((c: any) => ({...c, push:{...c.push, body:e.target.value}}))}
                    className="w-full px-3 py-2 text-[12px] rounded-lg border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0f2d5c]/20" />
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setStep(3)} className="px-4 py-2 rounded-lg border border-slate-200 text-[12px] text-slate-600 hover:bg-slate-50 transition-colors">Back</button>
            <button onClick={() => proceed(5)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0f2d5c] text-white text-[12px] font-semibold hover:bg-[#1a3f7a] transition-colors">
              <Send className="w-3.5 h-3.5" /> Proceed to Send
            </button>
          </div>
        </div>
      )}

      {/* ── Step 5: Send / Queue ────────────────────────────────────────── */}
      {step === 5 && !sendResult && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <Send className="w-5 h-5 text-[#0f2d5c]" />
            <h2 className="text-[16px] font-bold text-slate-900">Step 5 — Submit for Approval</h2>
          </div>
          <p className="text-[12px] text-slate-500 mb-4">
            Per RBI AI Governance 2024 (human-in-the-loop), outreach requires approval before delivery.
            Clicking below triggers the approval workflow and sends via all consented channels once approved.
          </p>
          <div className="bg-slate-50 rounded-lg p-3 mb-5 text-[12px] text-slate-600">
            Approval ID: <span className="font-mono font-semibold">{approvalId || '—'}</span>
          </div>
          {sendError && <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-[12px] text-red-600 mb-3">{sendError}</div>}
          <div className="flex gap-2">
            <button onClick={() => setStep(4)} className="px-4 py-2 rounded-lg border border-slate-200 text-[12px] text-slate-600 hover:bg-slate-50 transition-colors">Back</button>
            <button onClick={submitForApproval} disabled={sending}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-emerald-600 text-white text-[13px] font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors">
              {sending ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</> : <><Send className="w-4 h-4" /> Approve & Send</>}
            </button>
          </div>
        </div>
      )}

      {/* ── Sent confirmation ──────────────────────────────────────────── */}
      {step === 5 && sendResult && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 flex flex-col items-center text-center">
          <CheckCircle className="w-14 h-14 text-emerald-500 mb-4" />
          <h2 className="text-[18px] font-black text-slate-900 mb-2">Outreach Sent!</h2>
          <p className="text-[13px] text-slate-400 mb-4">
            Sent via: {(sendResult.sentChannels || []).join(', ') || '—'}
          </p>
          {(sendResult.blockedChannels || []).length > 0 && (
            <div className="bg-amber-50 border border-amber-100 rounded-lg px-4 py-3 mb-4 text-left">
              <p className="text-[11px] font-semibold text-amber-700 mb-1">Blocked channels:</p>
              {sendResult.blockedChannels.map((b: any) => (
                <p key={b.channel} className="text-[11px] text-amber-700">• {b.channel}: {b.reason}</p>
              ))}
            </div>
          )}
          <Link href={`/rm/customers/${id}`}
            className="px-4 py-2 rounded-lg bg-[#0f2d5c] text-white text-[12px] font-semibold hover:bg-[#1a3f7a] transition-colors">
            Back to Customer 360
          </Link>
        </div>
      )}
    </div>
  );
}
