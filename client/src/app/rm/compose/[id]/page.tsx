'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getToken, api } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft, Brain, Globe, Globe2, ShieldCheck, Eye, Send, Languages,
  Loader2, CheckCircle, AlertTriangle, ChevronRight, AlertCircle, RotateCcw,
  MessageCircle,
} from 'lucide-react';

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
  const [languages,     setLanguages]     = useState<{ code: string; name: string; nativeName: string; region: string }[]>([]);
  const [langReady,      setLangReady]      = useState<boolean>(false);
  const [langError,      setLangError]      = useState<string>('');
  const [targetLang,    setTargetLang]    = useState<string>('');
  // `content` is the live LLM-generated English herald.
  // `translated` (when set) overrides it on the Edit step so the user
  // can flip back to the original English via the "Original" button.
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

  // Step 5 — Resend direct email send
  const [emailSending, setEmailSending]   = useState(false);
  const [emailResult,  setEmailResult]    = useState<any>(null);
  const [emailError,   setEmailError]     = useState('');

  // Step 5 — Twilio direct WhatsApp send
  const [waSending,    setWaSending]      = useState(false);
  const [waResult,     setWaResult]       = useState<any>(null);
  const [waError,      setWaError]        = useState('');

  useEffect(() => {
    if (!getToken()) { router.push('/login'); return; }
    api.getCustomerById(id)
      .then(r => { setCustomer(r.customer || r); })
      .catch(() => {})
      .finally(() => setLoadingCust(false));
  }, [id]);

  // Load the live language dropdown once on mount.
  useEffect(() => {
    api.listLanguages()
      .then((r: any) => {
        if (r?.languages) {
          setLanguages(r.languages);
          setLangReady(true);
        }
      })
      .catch((e: any) => {
        setLangError(e?.message || 'Failed to load translation languages');
      });
  }, []);

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
    if (!targetLang) { setTransError('Pick a target language first.'); return; }
    setTranslating(true); setTransError('');
    try {
      const r = await api.translateHerald(content, targetLang);
      if (r?.herald) {
        setTranslated(r.herald);
        setBacktranslation(r.backtranslation || null);
        setEditContent(r.herald);
      } else {
        setTransError('Translation service returned no content.');
      }
    } catch(e: any) { setTransError(e.message); }
    finally { setTranslating(false); }
  };

  const proceedAfterTranslate = () => {
    if (translated) setEditContent(translated);
    setStep(3); loadConsent();
  };

  const handleResetTranslation = () => {
    setTranslated(null);
    setBacktranslation(null);
    setEditContent(content);
    setTargetLang('');
    setTransError('');
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

  const sendEmailViaResend = async () => {
    setEmailSending(true); setEmailError(''); setEmailResult(null);
    try {
      const finalBody = editContent || content;
      const r = await api.sendOutreachEmail({
        customer_id: id,
        subject:     finalBody?.email?.subject || '',
        body:        finalBody?.email?.body    || '',
        approval_id: approvalId || undefined,
      });
      setEmailResult(r);
    } catch (e: any) {
      setEmailError(e.message);
    } finally {
      setEmailSending(false);
    }
  };

  const sendWhatsappViaTwilio = async () => {
    setWaSending(true); setWaError(''); setWaResult(null);
    try {
      const finalBody = editContent || content;
      const r = await api.sendOutreachWhatsapp({
        customer_id: id,
        body:        finalBody?.sms?.body || finalBody?.push?.body || '',
        approval_id: approvalId || undefined,
      });
      setWaResult(r);
    } catch (e: any) {
      setWaError(e.message);
    } finally {
      setWaSending(false);
    }
  };

  if (loadingCust) return <div className="p-6"><Skeleton className="h-96 rounded-xl" /></div>;

  const finalContent = editContent || content;
  const useTranslated = !!translated;

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
              Pick a target language and click <strong>Translate</strong>. HERALD transcreates into the
              customer's preferred language, preserving tone and offer.  A back-translation is shown
              for your verification.
            </p>

            {/* Language selector (same pattern as the customer page) */}
            <div className="flex items-center gap-2 flex-wrap mb-4">
              <select
                disabled={!langReady}
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
                className="text-[12px] font-medium px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:border-[#0f2d5c] focus:border-[#0f2d5c] outline-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                aria-label="Target language for translation"
                title={
                  !langReady
                    ? (langError || 'Loading language list…')
                    : !content
                        ? 'Generate content first'
                        : 'Translate to a language'
                }
              >
                <option value="">
                  {!langReady
                    ? (langError ? '⚠ translation unavailable' : 'Loading…')
                    : 'Translate to…'}
                </option>
                {['India', 'Global'].map(region => {
                  const langs = languages.filter(l => l.region === region);
                  if (langs.length === 0) return null;
                  return (
                    <optgroup key={region} label={region}>
                      {langs.map(l => (
                        <option key={l.code} value={l.code}>
                          {l.nativeName ? `${l.nativeName} (${l.name})` : l.name}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
              <button
                onClick={translate}
                disabled={!targetLang || translating || !langReady || !content}
                className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg bg-[#0f2d5c] text-white hover:bg-[#1a3f7a] disabled:opacity-50 transition-colors"
                title={
                  !langReady
                    ? (langError || 'Waiting for language list')
                    : !targetLang
                        ? 'Pick a target language'
                        : 'Translate via Google Cloud Translation'
                }
              >
                <Languages className="w-3.5 h-3.5" />
                {translating ? 'Translating…' : 'Translate'}
              </button>
              {translated && (
                <button
                  onClick={handleResetTranslation}
                  className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500 bg-white hover:border-slate-300 transition-colors"
                  title="Show the original English content"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Original
                </button>
              )}
            </div>

            {/* Translation status row */}
            {(translated || transError || langError) && (
              <div className="flex items-center gap-2 flex-wrap text-[11px] mb-4">
                {translated && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
                    <Globe2 className="w-3 h-3" />
                    Translated to {languages.find(l => l.code === targetLang)?.name || targetLang.toUpperCase()}
                  </span>
                )}
                {(transError || langError) && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-red-50 text-red-600 border border-red-200">
                    <AlertCircle className="w-3 h-3" />
                    {transError || langError}
                  </span>
                )}
              </div>
            )}

            {transError && (
              <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-[12px] text-red-600 mb-3">{transError}</div>
            )}

            <div className="flex gap-2">
              <button onClick={() => { setEditContent(content); setStep(3); loadConsent(); }}
                className="px-4 py-2 rounded-lg border border-slate-200 text-[12px] text-slate-600 hover:bg-slate-50 transition-colors">
                Skip translation
              </button>
              {translated && (
                <button onClick={proceedAfterTranslate}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0f2d5c] text-white text-[12px] font-semibold hover:bg-[#1a3f7a] transition-colors">
                  Continue with translation <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Content preview — shows the active (possibly translated) herald */}
          {(() => {
            const active = translated || content;
            if (!active) return null;
            return (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  ['Email', active?.email?.subject, active?.email?.body],
                  ['SMS',   null,                    active?.sms?.body],
                  ['Push',  active?.push?.title,    active?.push?.body],
                ].map(([ch, title, body]) => (
                  <div key={ch as string} className="bg-white border border-slate-200 rounded-lg p-4">
                    <div className="flex items-center gap-1.5 mb-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{ch as string}</p>
                      {translated && (
                        <span className="text-[10px] font-semibold bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded-full">
                          {(languages.find(l => l.code === targetLang)?.nativeName) || targetLang}
                        </span>
                      )}
                    </div>
                    {title && <p className="text-[11px] font-semibold text-slate-700 mb-1">{title as string}</p>}
                    <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-4">{body as string}</p>
                  </div>
                ))}
              </div>
            );
          })()}

          {backtranslation && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
              <p className="text-[11px] font-semibold text-amber-700 mb-2">Back-translation (verify meaning before sending):</p>
              <p className="text-[11px] text-amber-800 leading-relaxed whitespace-pre-line">
                {backtranslation?.email?.body || JSON.stringify(backtranslation)}
              </p>
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
              Review the {useTranslated
                ? `${languages.find(l => l.code === targetLang)?.name || targetLang.toUpperCase()} `
                : ''
              }content. Edit inline if needed — changes are re-compliance-checked before send.
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

          {/* Resend direct email — routes through the same approval gate */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Send className="w-4 h-4 text-emerald-600" />
              <p className="text-[12px] font-bold text-slate-700">Or send email directly via Resend</p>
            </div>
            <p className="text-[11px] text-slate-500 mb-3">
              Dispatches through the Resend API to <span className="font-mono font-semibold">rudrajeetpal64@gmail.com</span>
              (sandbox override).  Uses the approval ID above and the email draft from Step 4.
            </p>
            {emailError && (
              <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-[12px] text-red-600 mb-3">{emailError}</div>
            )}
            {emailResult && (
              <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 text-[12px] text-emerald-800 mb-3 space-y-0.5">
                <p className="font-semibold flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5" /> Resend dispatch successful
                </p>
                <p>Message ID: <span className="font-mono">{emailResult.dispatch?.messageId}</span></p>
                <p>To: <span className="font-mono">{emailResult.dispatchedTo}</span></p>
              </div>
            )}
            <button onClick={sendEmailViaResend} disabled={emailSending || sending || !approvalId}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-[12px] font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors">
              {emailSending ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending via Resend…</> : <><Send className="w-3.5 h-3.5" /> Send Email via Resend</>}
            </button>
          </div>

          {/* Twilio direct WhatsApp — uses push.body from the edit step */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <MessageCircle className="w-4 h-4 text-emerald-600" />
              <p className="text-[12px] font-bold text-slate-700">Or send WhatsApp message directly via Twilio</p>
            </div>
            <p className="text-[11px] text-slate-500 mb-3">
              Dispatches via Twilio to <span className="font-mono font-semibold">whatsapp:+919874618487</span>
              (sandbox override).  Uses the push.body from Step 4 (falls back to sms.body).
            </p>
            {waError && (
              <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-[12px] text-red-600 mb-3">{waError}</div>
            )}
            {waResult && (
              <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 text-[12px] text-emerald-800 mb-3 space-y-0.5">
                <p className="font-semibold flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5" /> Twilio dispatch successful
                </p>
                <p>Message SID: <span className="font-mono">{waResult.dispatch?.messageSid}</span></p>
                <p>To: <span className="font-mono">{waResult.dispatchedTo}</span></p>
              </div>
            )}
            <button onClick={sendWhatsappViaTwilio} disabled={waSending || sending || !approvalId}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-[12px] font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors">
              {waSending ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending via Twilio…</> : <><MessageCircle className="w-3.5 h-3.5" /> Send via WhatsApp</>}
            </button>
          </div>

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
