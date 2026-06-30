'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getToken, api } from '@/lib/api';
import RiskBadge from '@/components/RiskBadge';
import ScoreBar from '@/components/ScoreBar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft, Send, ClipboardList, Phone, Brain,
  Activity, BarChart3, FileText, Shield, X, Loader2,
  CheckCircle, AlertTriangle, TrendingUp, Calendar,
  MapPin, Briefcase, CreditCard, Smartphone, MessageCircle,
  Package, Sparkles, Ban, ShieldCheck,
} from 'lucide-react';

function mdToHtml(md: string): string {
  let html = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  html = html
    .replace(/### (.+)/g, '<h3 class="text-[14px] font-bold text-[#2A161B] mt-3 mb-1">$1</h3>')
    .replace(/## (.+)/g, '<h2 class="text-[15px] font-bold text-[#2A161B] mt-4 mb-1.5">$1</h2>')
    .replace(/# (.+)/g, '<h1 class="text-[17px] font-black text-[#2A161B] mt-4 mb-2">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-[#2A161B]">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="bg-[#F9F9F7] text-[#6B132B] px-1 rounded text-[11px]">$1</code>')
    .replace(/^> (.+)/gm, '<blockquote class="border-l-2 border-[#B46B3E] pl-3 text-[#6B6562] italic my-2">$1</blockquote>');
  const lines = html.split('\n');
  let inList = false;
  const out: string[] = [];
  for (const line of lines) {
    if (/^- (.+)/.test(line)) {
      if (!inList) { out.push('<ul class="list-disc pl-5 space-y-0.5 my-1.5">'); inList = true; }
      out.push(`<li class="text-[12px] text-[#2A161B]">${line.replace(/^- /, '')}</li>`);
    } else {
      if (inList) { out.push('</ul>'); inList = false; }
      if (line.trim() === '') {
        out.push('</p><p class="text-[12px] text-[#2A161B] leading-relaxed">');
      } else if (!line.startsWith('<h') && !line.startsWith('<blockquote') && !line.startsWith('</blockquote') && !line.startsWith('<ul') && !line.startsWith('</ul') && !line.startsWith('<li')) {
        out.push(line + ' ');
      } else {
        out.push(line);
      }
    }
  }
  if (inList) out.push('</ul>');
  return `<p class="text-[12px] text-[#2A161B] leading-relaxed">${out.join('').replace(/<\/p><p class="text-\[12px\] text-\[\#2A161B\] leading-relaxed"><\/p>/g, '</p><p class="text-[12px] text-[#2A161B] leading-relaxed">')}</p>`;
}

interface Snapshot {
  customer: Record<string, any>;
  score: Record<string, any>;
  signals: any[];
  plan: Record<string, any>;
  herald: Record<string, any>;
}

const TABS = [
  { id: 'overview',  label: 'Overview',    icon: BarChart3    },
  { id: 'signals',   label: 'Signals',     icon: Activity     },
  { id: 'plan',      label: 'Action Plan', icon: Brain        },
  { id: 'crosssell', label: 'Cross-Sell',  icon: Package      },
  { id: 'outreach',  label: 'Outreach',    icon: Send         },
  { id: 'calls',     label: 'Calls',       icon: Phone        },
  { id: 'outcomes',  label: 'Outcomes',    icon: ClipboardList},
  { id: 'explain',   label: 'Explain',     icon: FileText     },
  { id: 'rights',    label: 'Data Rights', icon: Shield       },
];

const OUTCOME_OPTIONS = ['converted','retained','neutral','declined','unreachable','churned'];
const CHANNEL_OPTIONS = ['phone','email','sms','branch','whatsapp','app'];
const LANG_OPTIONS    = ['en','hi','ta','bn','te','mr','ml','kn','gu','pa'];
const LANG_LABELS: Record<string,string> = {
  en:'English',hi:'Hindi',ta:'Tamil',bn:'Bengali',te:'Telugu',
  mr:'Marathi',ml:'Malayalam',kn:'Kannada',gu:'Gujarati',pa:'Punjabi',
};

// ── Overview Tab ──────────────────────────────────────────────────────────────
function OverviewTab({ snap }: { snap: Snapshot }) {
  const c = snap.customer;

  const sections = [
    {
      title: 'Identity',
      icon: Briefcase,
      items: [
        { label: 'Customer ID', value: c.customer_id },
        { label: 'Segment',     value: c.segment },
        { label: 'Age',         value: `${c.age} years` },
        { label: 'City',        value: c.city },
        { label: 'Employer',    value: c.employer },
        { label: 'Tenure',      value: `${c.tenure_months} months` },
      ],
    },
    {
      title: 'Financials',
      icon: CreditCard,
      items: [
        { label: 'Balance',        value: `₹${(c.balance||0).toLocaleString('en-IN')}` },
        { label: 'Annual Income',  value: `₹${(c.income||0).toLocaleString('en-IN')}` },
        { label: 'Product Count',  value: String(c.product_count) },
        { label: 'Transactions',   value: `${c.txn_freq_90d} in 90d` },
        { label: 'Digital Ratio',  value: `${((c.digital_ratio||0)*100).toFixed(0)}% of txns` },
        { label: 'Salary Credits', value: `${c.salary_credit_count} in 3mo` },
      ],
    },
    {
      title: 'Engagement',
      icon: Smartphone,
      items: [
        { label: 'App Logins',    value: `${c.app_logins_30d} in 30d` },
        { label: 'NPS',           value: `${c.nps}/10` },
        { label: 'Complaints',    value: String(c.complaint_count) },
        { label: 'Inactivity',    value: `${c.inactivity_days} days` },
      ],
    },
  ];

  return (
    <div className="space-y-5">
      {c.life_event && (
        <div className="bg-teal-soft border border-soft rounded-xl px-4 py-3 flex items-start gap-3">
          <Calendar className="w-4 h-4 text-teal mt-0.5 shrink-0" />
          <div>
            <p className="text-[11px] font-bold text-teal-dark uppercase tracking-wide">Life Event Detected</p>
            <p className="text-[13px] text-teal-dark font-medium mt-0.5">{c.life_event.replace(/_/g,' ')}</p>
            {c.life_event_desc && <p className="text-[12px] text-teal-dark mt-0.5">{c.life_event_desc}</p>}
          </div>
        </div>
      )}

      {sections.map(({ title, icon: Icon, items }) => (
        <div key={title}>
          <div className="flex items-center gap-2 mb-2">
            <Icon className="w-3.5 h-3.5 text-slate-400" />
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{title}</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {items.map(({ label, value }) => (
              <div key={label} className="bg-slate-50 rounded-lg px-3 py-2.5">
                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">{label}</p>
                <p className="text-[13px] font-semibold text-slate-800 mt-0.5 truncate">{value}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Signals Tab ───────────────────────────────────────────────────────────────
function SignalsTab({ snap }: { snap: Snapshot }) {
  const signals: any[] = snap.signals || [];
  if (!signals.length) return (
    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
      <CheckCircle className="w-8 h-8 mb-2 text-sage-brand" />
      <p className="text-[13px] font-medium">No active signals — profile is stable</p>
    </div>
  );
  return (
    <div className="space-y-3">
      <p className="text-[12px] text-slate-400">{signals.length} active ARGUS signal{signals.length !== 1 ? 's' : ''}</p>
      {signals.map((s: any, i: number) => (
        <div key={i} className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[13px] font-semibold text-slate-800 capitalize">{s.signal_type.replace(/_/g,' ')}</span>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${s.confidence > 0.8 ? 'bg-crimson-soft text-crimson' : s.confidence > 0.6 ? 'bg-copper-soft text-copper-dark' : 'bg-copper-soft text-copper-dark'}`}>
              {(s.confidence*100).toFixed(0)}% confidence
            </span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-slate-400 mb-2">
            <span>Method: <span className="text-slate-600 font-medium">{s.method}</span></span>
            {s.days_active && <span>Active: <span className="text-slate-600 font-medium">{s.days_active}d</span></span>}
            {s.cusum_value && <span>CUSUM: <span className="text-slate-600 font-medium">{s.cusum_value?.toFixed(2)}</span></span>}
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5">
            <div className="h-1.5 rounded-full bg-[var(--crimson)]" style={{ width:`${Math.min(s.confidence*100,100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Action Plan Tab ───────────────────────────────────────────────────────────
function PlanTab({ snap }: { snap: Snapshot }) {
  const p = snap.plan;
  if (!p) return <div className="py-16 text-center text-slate-400 text-[13px]">No action plan available</div>;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {[
          ['Offer',    p.offer_display || p.offer_code || '—'],
          ['Channel',  p.channel || '—'],
          ['Urgency',  p.urgency || '—'],
          ['Timing',   p.timing  || '—'],
        ].map(([k,v]) => (
          <div key={k} className="bg-slate-50 rounded-xl px-4 py-3">
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-1">{k}</p>
            <p className="text-[14px] font-bold text-slate-800 capitalize">{String(v).replace(/_/g,' ')}</p>
          </div>
        ))}
      </div>
      {p.rationale && (
        <div className="bg-teal-soft border border-blue-100 rounded-xl px-5 py-4">
          <p className="text-[10px] font-semibold text-teal uppercase tracking-wide mb-1.5">COMPASS Rationale</p>
          <p className="text-[13px] text-blue-900 leading-relaxed">{p.rationale}</p>
        </div>
      )}
      {p.tone_modifiers?.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {p.tone_modifiers.map((t: string) => (
            <span key={t} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 capitalize">{t}</span>
          ))}
        </div>
      )}
      {p.suppressed && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-copper-soft border border-soft">
          <AlertTriangle className="w-4 h-4 text-copper-dark shrink-0" />
          <p className="text-[12px] text-copper-dark font-medium">Outreach suppressed (contact fatigue / consent rules)</p>
        </div>
      )}
    </div>
  );
}

// ── Cross-Sell Tab (NEXUS) ────────────────────────────────────────────────────
const CAT_BADGE: Record<string, string> = {
  card: 'bg-purple-100 text-purple-700', loan: 'bg-red-100 text-red-700',
  deposit: 'bg-emerald-100 text-emerald-700', investment: 'bg-sky-100 text-sky-700',
  insurance: 'bg-amber-100 text-amber-700',
};

function PitchView({ pitch, customerId }: { pitch: any; customerId: string }) {
  const c = pitch?.content;
  if (!c?.email) return null;
  return (
    <div className="mt-2 rounded-lg border border-[var(--crimson)]/20 bg-[var(--crimson)]/[0.02] p-3 space-y-2">
      <p className="text-[9px] font-bold text-[var(--crimson)] uppercase tracking-wide flex items-center gap-1.5">
        <Send className="w-3 h-3" /> HERALD draft for {pitch.label} · {pitch.source === 'llm-live' ? 'NVIDIA DeepSeek' : 'template'}
      </p>
      <div>
        <p className="text-[12px] font-semibold text-slate-800">Subject: {c.email.subject}</p>
        <p className="text-[12px] text-slate-600 leading-relaxed whitespace-pre-wrap mt-1">{c.email.body}</p>
      </div>
      {c.sms?.body && (
        <p className="text-[11px] text-slate-500 border-t border-slate-100 pt-2">
          <span className="font-bold uppercase text-[9px] text-slate-400">SMS · </span>{c.sms.body}
        </p>
      )}
      <Link href={`/rm/compose/${customerId}`}
        className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--crimson)] hover:underline">
        <Send className="w-3 h-3" /> Refine in Composer
      </Link>
    </div>
  );
}

function CrossSellTab({ snap, customerId }: { snap: Snapshot; customerId: string }) {
  const [nexus,   setNexus]   = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [pitches, setPitches] = useState<Record<string, any>>({});
  const [pitchLoading, setPitchLoading] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true); setPitches({});
    api.getNexusForCustomer(customerId).then(setNexus).catch(() => setNexus(null)).finally(() => setLoading(false));
  }, [customerId]);

  const generatePitch = async (product: string) => {
    setPitchLoading(product);
    try { const r = await api.generateNexusPitch(customerId, product); setPitches(p => ({ ...p, [product]: r })); }
    catch { /* */ } finally { setPitchLoading(null); }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
      <Loader2 className="w-5 h-5 animate-spin text-[var(--crimson)]" /> Scoring cross-sell fit…
    </div>
  );
  if (!nexus) return <div className="py-16 text-center text-slate-400 text-[13px]">No cross-sell data available.</div>;

  const top        = nexus.top_offer;
  const recs       = nexus.recommendations || [];
  const suppressed = nexus.suppressed || [];
  const deferral   = nexus.churn_deferral_active;

  return (
    <div className="space-y-4">
      {/* header line */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[13px] font-bold text-slate-900 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-[var(--crimson)]" /> NEXUS Cross-Sell Recommendations
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Model-backed (XGBoost · PKDD'99) · compliance-gated · pitch HERALD content per product
          </p>
        </div>
        {deferral && (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-crimson-soft text-crimson text-[11px] font-bold">
            <AlertTriangle className="w-3.5 h-3.5" /> Churn-deferral active
          </span>
        )}
      </div>

      {deferral && (
        <div className="bg-crimson-soft border border-red-100 rounded-xl px-4 py-3 text-[12px] text-crimson">
          This customer is high churn-risk — NEXUS has suppressed new-credit cross-sell. Retention takes priority;
          only safe products (deposits / insurance) are offered below.
        </div>
      )}

      {!top && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-center text-[13px] text-slate-500">
          No eligible cross-sell for this customer right now.
        </div>
      )}

      {/* eligible recommendations — each with its own HERALD pitch generator */}
      {recs.length > 0 && (
        <div>
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Eligible Products — generate a pitch per product
          </p>
          <div className="space-y-2">
            {recs.map((rec: any, i: number) => {
              const isTop = i === 0;
              const busy  = pitchLoading === rec.product;
              const pitch = pitches[rec.product];
              return (
                <div key={rec.product}
                  className={`rounded-lg border bg-white px-3 py-2.5 ${isTop ? 'border-[var(--crimson)]/30' : 'border-slate-200'}`}>
                  <div className="flex items-center gap-3">
                    <Package className="w-4 h-4 text-slate-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold text-slate-800 truncate">{rec.label}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${CAT_BADGE[rec.category] || 'bg-slate-100 text-slate-500'}`}>{rec.category}</span>
                        {isTop && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-crimson-soft text-crimson font-bold uppercase tracking-wide">Best fit</span>}
                      </div>
                      {rec.reason_codes?.[0] && <p className="text-[11px] text-slate-400 truncate">{rec.reason_codes[0].detail}</p>}
                    </div>
                    <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden shrink-0">
                      <div className="h-full bg-[var(--crimson)] rounded-full" style={{ width: `${Math.round(rec.score * 100)}%` }} />
                    </div>
                    <span className="text-[12px] font-bold text-[var(--crimson)] tabular-nums w-9 text-right shrink-0">{Math.round(rec.score * 100)}%</span>
                    <button onClick={() => generatePitch(rec.product)} disabled={busy}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--crimson)] text-white text-[11px] font-semibold hover:bg-[var(--crimson-dark)] disabled:opacity-50 transition-colors shrink-0">
                      {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3" />}
                      {busy ? 'Drafting…' : pitch ? 'Regenerate' : 'Generate'}
                    </button>
                  </div>
                  {pitch && <PitchView pitch={pitch} customerId={customerId} />}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* suppressed (compliance) */}
      {suppressed.length > 0 && (
        <div>
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <Ban className="w-3.5 h-3.5 text-red-500" /> Suppressed by Compliance ({suppressed.length})
          </p>
          <div className="space-y-1.5">
            {suppressed.map((rec: any) => (
              <div key={rec.product} className="flex items-center justify-between gap-3 rounded-lg bg-red-50/50 border border-red-100 px-3 py-2">
                <span className="text-[12px] font-medium text-slate-600 truncate">{rec.label}</span>
                <span className="text-[11px] text-red-600 italic text-right shrink-0 max-w-[60%] truncate" title={rec.filtered_reason}>{rec.filtered_reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[10px] text-slate-400 leading-relaxed pt-1">
        Recommendations are advisory and audit-logged. NEXUS defers to the churn model — new-credit offers are
        withheld from high-risk customers so retention messaging wins first.
      </p>
    </div>
  );
}

// ── Outreach Tab ──────────────────────────────────────────────────────────────
function OutreachTab({ snap, customerId }: { snap: Snapshot; customerId: string }) {
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState<any>(snap.herald);
  const [error,   setError]   = useState('');

  const generate = async () => {
    setLoading(true); setError('');
    try { const r = await api.generateOutreach(customerId); setContent(r.heraldContent || r); }
    catch(e:any) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-slate-400">HERALD-generated content (NVIDIA DeepSeek V4 Pro)</p>
        <div className="flex gap-2">
          <button onClick={generate} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--crimson)] text-white text-[12px] font-semibold hover:bg-[var(--crimson-dark)] disabled:opacity-50 transition-colors">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
            {loading ? 'Generating…' : 'Generate'}
          </button>
          {content && (
            <Link href={`/rm/compose/${customerId}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--crimson)] text-[var(--crimson)] text-[12px] font-semibold hover:bg-[var(--crimson)]/5 transition-colors">
              <Send className="w-3.5 h-3.5" /> Open Composer
            </Link>
          )}
        </div>
      </div>
      {error && <div className="bg-crimson-soft border border-red-100 rounded-xl px-4 py-3 text-[12px] text-crimson">{error}</div>}
      {content?.email ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 lg:col-span-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">EMAIL</p>
            <p className="text-[12px] font-semibold text-slate-800 mb-2">Subject: {content.email.subject}</p>
            <p className="text-[12px] text-slate-600 leading-relaxed whitespace-pre-wrap">{content.email.body}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">
              SMS <span className="text-slate-300 font-normal">({content.sms?.char_count || 0} chars)</span>
            </p>
            <p className="text-[12px] text-slate-600">{content.sms?.body}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">PUSH NOTIFICATION</p>
            <p className="text-[12px] font-semibold text-slate-800 mb-1">{content.push?.title}</p>
            <p className="text-[12px] text-slate-600">{content.push?.body}</p>
          </div>
        </div>
      ) : !loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <Send className="w-8 h-8 mb-2" />
          <p className="text-[13px]">Click Generate to create personalised outreach</p>
        </div>
      ) : null}

      <SendEmailPanel
        customerId={customerId}
        customerEmail={snap.customer?.email || ''}
        customerName={snap.customer?.full_name || ''}
        defaultSubject={content?.email?.subject || ''}
        defaultBody={content?.email?.body || ''}
      />

      <SendWhatsappPanel
        customerId={customerId}
        customerPhone={snap.customer?.phone || ''}
        customerName={snap.customer?.full_name || ''}
        defaultBody={content?.sms?.body || content?.push?.body || ''}
      />
    </div>
  );
}

// ── Send Email Panel (Resend) ─────────────────────────────────────────────────
function SendEmailPanel({
  customerId, customerEmail, customerName, defaultSubject, defaultBody,
}: {
  customerId: string;
  customerEmail: string;
  customerName: string;
  defaultSubject: string;
  defaultBody: string;
}) {
  const [subject,   setSubject]   = useState(defaultSubject);
  const [body,      setBody]      = useState(defaultBody);
  const [sending,   setSending]   = useState(false);
  const [sendError, setSendError] = useState('');
  const [result,    setResult]    = useState<any>(null);

  useEffect(() => {
    setSubject(defaultSubject);
    setBody(defaultBody);
  }, [defaultSubject, defaultBody]);

  const canSend = subject.trim().length > 0 && body.trim().length > 0 && !sending;

  const send = async () => {
    setSending(true); setSendError(''); setResult(null);
    try {
      const r = await api.sendOutreachEmail({
        customer_id: customerId,
        subject:     subject,
        body:        body,
      });
      setResult(r);
    } catch (e: any) {
      setSendError(e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Send Email · Resend</p>
          <p className="text-[12px] text-slate-600 mt-0.5">
            Direct send via Resend API.  Routed through the human-approval gate and audit log.
          </p>
        </div>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sage-soft text-sage-brand uppercase tracking-wide">
          EMAIL · Resend
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Customer email (display)</label>
          <input value={customerEmail} readOnly
            className="w-full px-3 py-2 text-[12px] rounded-lg border border-slate-200 bg-slate-50 text-slate-500" />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Recipient (Resend sandbox)</label>
          <input value="rudrajeetpal64@gmail.com" readOnly
            className="w-full px-3 py-2 text-[12px] rounded-lg border border-slate-200 bg-slate-50 text-slate-500 font-mono" />
        </div>
      </div>

      <div>
        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Subject</label>
        <input value={subject} onChange={e => setSubject(e.target.value)} placeholder={defaultSubject ? '' : 'Click Generate above to populate the subject…'}
          className="w-full px-3 py-2 text-[13px] rounded-lg border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-[var(--crimson)]/20" />
      </div>
      <div>
        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Body</label>
        <textarea value={body} onChange={e => setBody(e.target.value)} placeholder={defaultBody ? '' : 'Click Generate above to populate the body…'}
          rows={6} className="w-full px-3 py-2 text-[12px] rounded-lg border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-[var(--crimson)]/20 resize-none" />
      </div>

      {sendError && (
        <div className="bg-crimson-soft border border-red-100 rounded-lg px-3 py-2 text-[12px] text-crimson">{sendError}</div>
      )}

      {result && (
        <div className="bg-sage-soft border border-emerald-100 rounded-lg px-3 py-2.5 text-[12px] text-emerald-800 space-y-1">
          <p className="font-semibold flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5" /> Email dispatched
          </p>
          <p>Message ID: <span className="font-mono">{result.dispatch?.messageId}</span></p>
          <p>To: <span className="font-mono">{result.dispatchedTo}</span>{result.sandboxOverride && <span className="ml-2 text-[10px] uppercase tracking-wide text-copper-dark font-semibold">(sandbox override)</span>}</p>
          <p>Approval ID: <span className="font-mono">{result.approvalId}</span></p>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[10px] text-slate-400">
          Sending to <span className="font-mono font-semibold">rudrajeetpal64@gmail.com</span> for the Resend sandbox demo.
        </p>
        <button onClick={send} disabled={!canSend}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sage-brand text-white text-[12px] font-semibold hover:bg-sage-brand disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          {sending ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending…</> : <><Send className="w-3.5 h-3.5" /> Send via Resend</>}
        </button>
      </div>
    </div>
  );
}

// ── Send WhatsApp Panel (Twilio) ──────────────────────────────────────────────
function SendWhatsappPanel({
  customerId, customerPhone, customerName, defaultBody,
}: {
  customerId: string;
  customerPhone: string;
  customerName: string;
  defaultBody: string;
}) {
  const [body,    setBody]    = useState(defaultBody);
  const [sending, setSending] = useState(false);
  const [err,     setErr]     = useState('');
  const [result,  setResult]  = useState<any>(null);

  useEffect(() => { setBody(defaultBody); }, [defaultBody]);

  const canSend = body.trim().length > 0 && !sending;

  const send = async () => {
    setSending(true); setErr(''); setResult(null);
    try {
      const r = await api.sendOutreachWhatsapp({ customer_id: customerId, body });
      setResult(r);
    } catch (e: any) {
      setErr(e.message);
    } finally { setSending(false); }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-sage-brand" />
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Send WhatsApp · Twilio</p>
            <p className="text-[12px] text-slate-600 mt-0.5">
              Direct send via the Twilio WhatsApp API.  Routed through the human-approval gate and audit log.
            </p>
          </div>
        </div>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sage-soft text-sage-brand uppercase tracking-wide">
          WHATSAPP · Twilio
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Customer phone (display)</label>
          <input value={customerPhone} readOnly
            className="w-full px-3 py-2 text-[12px] rounded-lg border border-slate-200 bg-slate-50 text-slate-500 font-mono" />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Recipient (Twilio sandbox)</label>
          <input value="whatsapp:+919874618487" readOnly
            className="w-full px-3 py-2 text-[12px] rounded-lg border border-slate-200 bg-slate-50 text-slate-500 font-mono" />
        </div>
      </div>

      <div>
        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Message</label>
        <textarea value={body} onChange={e => setBody(e.target.value)} placeholder={defaultBody ? '' : 'Click Generate above to populate the message…'}
          rows={4} className="w-full px-3 py-2 text-[12px] rounded-lg border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-[var(--crimson)]/20 resize-none" />
        <p className="text-[10px] text-slate-400 mt-1">{body.length} chars</p>
      </div>

      {err && (
        <div className="bg-crimson-soft border border-red-100 rounded-lg px-3 py-2 text-[12px] text-crimson">{err}</div>
      )}

      {result && (
        <div className="bg-sage-soft border border-emerald-100 rounded-lg px-3 py-2.5 text-[12px] text-emerald-800 space-y-1">
          <p className="font-semibold flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5" /> WhatsApp dispatched
          </p>
          <p>Message SID: <span className="font-mono">{result.dispatch?.messageSid}</span></p>
          <p>To: <span className="font-mono">{result.dispatchedTo}</span>{result.sandboxOverride && <span className="ml-2 text-[10px] uppercase tracking-wide text-copper-dark font-semibold">(sandbox override)</span>}</p>
          <p>Approval ID: <span className="font-mono">{result.approvalId}</span></p>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[10px] text-slate-400">
          Sending to <span className="font-mono font-semibold">whatsapp:+919874618487</span> for the Twilio sandbox demo.
        </p>
        <button onClick={send} disabled={!canSend}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sage-brand text-white text-[12px] font-semibold hover:bg-sage-brand disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          {sending ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending…</> : <><MessageCircle className="w-3.5 h-3.5" /> Send via WhatsApp</>}
        </button>
      </div>
    </div>
  );
}

// ── Call Modal ────────────────────────────────────────────────────────────────
function CallModal({ customerId, customerName, onClose, onCommit }: {
  customerId: string; customerName: string; onClose: () => void; onCommit: () => void;
}) {
  const [step,       setStep]       = useState<'script'|'transcript'|'review'|'done'>('script');
  const [script,     setScript]     = useState<any>(null);
  const [transcript, setTranscript] = useState('');
  const [analysis,   setAnalysis]   = useState<any>(null);
  const [callId,     setCallId]     = useState('');
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');

  useEffect(() => {
    setLoading(true);
    api.getCallScript(customerId).then(r => setScript(r.script)).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);

  const startCall = async () => {
    setLoading(true); setError('');
    try { const r = await api.startCall(customerId); setCallId(r.callId); setStep('transcript'); }
    catch(e:any) { setError(e.message); } finally { setLoading(false); }
  };

  const analyze = async () => {
    if (!transcript.trim()) { setError('Paste the call transcript first.'); return; }
    setLoading(true); setError('');
    try { const r = await api.analyzeCall(customerId, transcript); setAnalysis(r.analysis); setStep('review'); }
    catch(e:any) { setError(e.message); } finally { setLoading(false); }
  };

  const commit = async () => {
    setLoading(true); setError('');
    try {
      await api.commitCall({ customer_id: customerId, callId, analysis, transcript, consent_to_record: true });
      setStep('done');
      setTimeout(() => { onCommit(); onClose(); }, 1800);
    } catch(e:any) { setError(e.message); } finally { setLoading(false); }
  };

  const STEPS = ['Pre-call','Record','Review'];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={e => e.target===e.currentTarget&&onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-[var(--crimson)]" />
            <h2 className="text-[15px] font-bold text-slate-900">Call Capture — {customerName}</h2>
          </div>
          <button onClick={onClose}><X className="w-4 h-4 text-slate-400" /></button>
        </div>
        <div className="px-6 py-3 border-b border-slate-100 flex items-center gap-1">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-1">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${['script','transcript','review','done'].indexOf(step) >= i ? 'bg-[var(--crimson)] text-white' : 'bg-slate-100 text-slate-400'}`}>{i+1}</div>
              <span className="text-[10px] text-slate-400 hidden sm:inline">{s}</span>
              {i < STEPS.length-1 && <div className="w-6 h-px bg-slate-200 mx-1" />}
            </div>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {error && <div className="bg-crimson-soft border border-red-100 rounded-lg px-3 py-2 text-[12px] text-crimson">{error}</div>}
          {step === 'script' && (
            <div className="space-y-3">
              <div className="bg-teal-soft border border-blue-100 rounded-lg p-3 text-[12px] text-teal-dark">
                HERALD pre-call brief — review before dialling.
              </div>
              {loading && <div className="flex items-center gap-2 text-slate-400 text-[13px]"><Loader2 className="w-4 h-4 animate-spin" /> Loading script…</div>}
              {script && (
                <div className="space-y-3">
                  {script.suggested_opening && (
                    <div className="bg-white border border-slate-200 rounded-lg p-3">
                      <p className="text-[10px] text-[var(--crimson)] font-bold uppercase tracking-wide mb-1">Opening Line</p>
                      <p className="text-[13px] text-slate-700 italic">"{script.suggested_opening}"</p>
                    </div>
                  )}
                  {script.talking_points?.length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Talking Points</p>
                      <ul className="space-y-1.5">
                        {script.talking_points.map((p: string, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-[12px] text-slate-700">
                            <span className="w-4 h-4 rounded-full bg-[var(--crimson)] text-white flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">{i+1}</span>
                            {p}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {script.likely_objections?.length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Objections → Rebuttals</p>
                      {script.likely_objections.map((obj: string, i: number) => (
                        <div key={i} className="bg-copper-soft border border-orange-100 rounded-lg p-3 mb-2">
                          <p className="text-[11px] text-copper-dark font-medium">⚠ {obj}</p>
                          {script.rebuttals?.[i] && <p className="text-[11px] text-slate-600 mt-1">→ {script.rebuttals[i]}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                  {script.compliance_note && (
                    <div className="bg-copper-soft border border-amber-100 rounded-lg p-3">
                      <p className="text-[11px] text-copper-dark font-semibold">⚑ {script.compliance_note}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {step === 'transcript' && (
            <div className="space-y-3">
              <div className="bg-copper-soft border border-amber-100 rounded-lg p-3 text-[12px] text-copper-dark">
                Call started (ID: {callId}). Paste the transcript after the call.
              </div>
              <textarea value={transcript} onChange={e => setTranscript(e.target.value)}
                placeholder={`Paste call transcript…\n\nExample:\nRM: Hello, Aditya here from Union Bank…\nCustomer: Yes, I was expecting your call…`}
                className="w-full h-48 px-3 py-2.5 text-[12px] rounded-lg border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-[var(--crimson)]/20 resize-none" />
              <p className="text-[10px] text-slate-400">{transcript.length} characters</p>
            </div>
          )}
          {step === 'review' && analysis && (
            <div className="space-y-3">
              <div className="bg-sage-soft border border-emerald-100 rounded-lg p-3 text-[12px] text-sage-brand">
                AI analysis complete — review before committing.
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['Outcome',   analysis.outcome],
                  ['Sentiment', `${analysis.sentiment} (${analysis.sentiment_score?.toFixed(2)})`],
                  ['Language',  LANG_LABELS[analysis.detected_language] || analysis.detected_language],
                  ['Follow-up', analysis.follow_up_required ? (analysis.follow_up_date || 'Yes') : 'No'],
                  ['Offer',     analysis.offer_presented || '—'],
                  ['Accepted',  analysis.offer_accepted != null ? String(analysis.offer_accepted) : '—'],
                ].map(([k,v]) => (
                  <div key={k} className="bg-slate-50 rounded-lg px-3 py-2">
                    <p className="text-[10px] text-slate-400 font-medium">{k}</p>
                    <p className="text-[12px] font-semibold text-slate-800 capitalize">{String(v).replace(/_/g,' ')}</p>
                  </div>
                ))}
              </div>
              {analysis.summary && (
                <div className="bg-white border border-slate-200 rounded-lg p-3">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Summary</p>
                  <p className="text-[12px] text-slate-700">{analysis.summary}</p>
                </div>
              )}
              {analysis.compliance_flags?.length > 0 && (
                <div className="bg-crimson-soft border border-red-100 rounded-lg p-3">
                  <p className="text-[11px] font-semibold text-crimson mb-1">⚑ Compliance Flags</p>
                  {analysis.compliance_flags.map((f: string, i: number) => <p key={i} className="text-[11px] text-crimson">• {f}</p>)}
                </div>
              )}
            </div>
          )}
          {step === 'done' && (
            <div className="flex flex-col items-center justify-center py-12">
              <CheckCircle className="w-12 h-12 text-sage-brand mb-3" />
              <p className="text-[15px] font-bold text-slate-900">Call committed!</p>
              <p className="text-[12px] text-slate-400 mt-1">Outcome recorded · Tasks updated</p>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 text-[12px] text-slate-600 hover:bg-slate-50">Close</button>
          <div className="flex gap-2">
            {step === 'script' && (
              <button onClick={startCall} disabled={loading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--crimson)] text-white text-[12px] font-semibold hover:bg-[var(--crimson-dark)] disabled:opacity-50">
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Phone className="w-3.5 h-3.5" />} Start Call
              </button>
            )}
            {step === 'transcript' && (
              <button onClick={analyze} disabled={loading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--crimson)] text-white text-[12px] font-semibold hover:bg-[var(--crimson-dark)] disabled:opacity-50">
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />} Analyse
              </button>
            )}
            {step === 'review' && (
              <button onClick={commit} disabled={loading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sage-brand text-white text-[12px] font-semibold hover:bg-sage-brand disabled:opacity-50">
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />} Confirm & Commit
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Log Outcome Modal ─────────────────────────────────────────────────────────
function OutcomeModal({ customerId, customerName, onClose, onSaved }: {
  customerId: string; customerName: string; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({
    action_taken:'call', contacted:true, outcome:'neutral', offer_presented:'',
    offer_accepted:'', channel:'phone', language_used:'en', rm_notes:'', follow_up_date:'',
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const save = async () => {
    setLoading(true); setError('');
    try {
      await api.logRmOutcome({
        customer_id: customerId, ...form,
        offer_accepted: form.offer_accepted === 'true' ? true : form.offer_accepted === 'false' ? false : null,
      });
      onSaved(); onClose();
    } catch(e:any) { setError(e.message); } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={e => e.target===e.currentTarget&&onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-[var(--crimson)]" />
            <h2 className="text-[14px] font-bold text-slate-900">Log Outcome — {customerName}</h2>
          </div>
          <button onClick={onClose}><X className="w-4 h-4 text-slate-400" /></button>
        </div>
        <div className="px-5 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
          {error && <div className="bg-crimson-soft border border-red-100 rounded-lg px-3 py-2 text-[12px] text-crimson">{error}</div>}
          {([
            ['action_taken','Action Taken','select',['call','email_reply','sms','branch_visit','no_contact']],
            ['outcome','Outcome','select',OUTCOME_OPTIONS],
            ['channel','Channel','select',CHANNEL_OPTIONS],
            ['language_used','Language Used','select',LANG_OPTIONS],
            ['offer_presented','Offer Presented (optional)','text',[]],
            ['offer_accepted','Offer Accepted','select',['','true','false']],
            ['follow_up_date','Follow-up Date (optional)','date',[]],
          ] as [string,string,string,string[]][]).map(([k,label,type,opts]) => (
            <div key={k}>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{label}</label>
              {type === 'select' ? (
                <select value={(form as any)[k]} onChange={e => setForm(f => ({...f,[k]:e.target.value}))}
                  className="w-full px-3 py-2 text-[13px] rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[var(--crimson)]/20">
                  {opts.map(o => <option key={o} value={o}>{o===''?'—':LANG_LABELS[o]||o.replace(/_/g,' ')}</option>)}
                </select>
              ) : (
                <input type={type} value={(form as any)[k]} onChange={e => setForm(f => ({...f,[k]:e.target.value}))}
                  className="w-full px-3 py-2 text-[13px] rounded-lg border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-[var(--crimson)]/20" />
              )}
            </div>
          ))}
          <div>
            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Notes</label>
            <textarea value={form.rm_notes} onChange={e => setForm(f => ({...f,rm_notes:e.target.value}))} rows={3}
              className="w-full px-3 py-2 text-[13px] rounded-lg border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-[var(--crimson)]/20 resize-none" />
          </div>
          <label className="flex items-center gap-2 text-[12px] text-slate-600 cursor-pointer">
            <input type="checkbox" checked={form.contacted} onChange={e => setForm(f => ({...f,contacted:e.target.checked}))} className="rounded" />
            Customer was contacted
          </label>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 text-[12px] text-slate-600 hover:bg-slate-50">Cancel</button>
          <button onClick={save} disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--crimson)] text-white text-[12px] font-semibold hover:bg-[var(--crimson-dark)] disabled:opacity-50">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />} Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Calls Tab ─────────────────────────────────────────────────────────────────
function CallsTab({ customerId }: { customerId: string }) {
  const [calls,   setCalls]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.getRmCalls({ customer_id: customerId }).then(r => setCalls(r.calls || [])).catch(()=>{}).finally(() => setLoading(false));
  }, [customerId]);
  if (loading) return <div className="space-y-2">{Array.from({length:2}).map((_,i) => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>;
  if (!calls.length) return <div className="py-16 text-center text-slate-400 text-[13px]">No calls logged for this customer yet.</div>;
  return (
    <div className="space-y-3">
      {calls.map(c => (
        <div key={c.id} className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[13px] font-semibold text-slate-800 capitalize">{c.outcome?.replace(/_/g,' ')}</span>
            <div className="flex items-center gap-2">
              {c.duration_sec && <span className="text-[10px] text-slate-400">{Math.floor(c.duration_sec/60)}m {c.duration_sec%60}s</span>}
              <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${c.sentiment==='positive'?'bg-sage-soft text-sage-brand':c.sentiment==='negative'?'bg-crimson-soft text-crimson':'bg-slate-50 text-slate-500'}`}>{c.sentiment}</span>
            </div>
          </div>
          {c.summary && <p className="text-[12px] text-slate-500 mb-1.5 leading-snug">{c.summary}</p>}
          <p className="text-[10px] text-slate-300">{new Date(c.started_at).toLocaleDateString('en-IN', {day:'numeric',month:'short',year:'numeric'})}</p>
        </div>
      ))}
    </div>
  );
}

// ── Outcomes Tab ──────────────────────────────────────────────────────────────
function OutcomesTab({ customerId }: { customerId: string }) {
  const [outcomes, setOutcomes] = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  useEffect(() => {
    api.getRmOutcomes(customerId).then(r => setOutcomes(r.outcomes||[])).catch(()=>{}).finally(() => setLoading(false));
  }, [customerId]);
  if (loading) return <div className="space-y-2">{Array.from({length:2}).map((_,i) => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>;
  if (!outcomes.length) return <div className="py-16 text-center text-slate-400 text-[13px]">No outcomes logged yet.</div>;
  return (
    <div className="space-y-2">
      {outcomes.map(o => (
        <div key={o.id} className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full shrink-0 ${o.outcome==='converted'||o.outcome==='retained'?'bg-emerald-400':o.outcome==='declined'||o.outcome==='churned'?'bg-red-400':'bg-slate-300'}`} />
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-slate-800 capitalize">{o.outcome?.replace(/_/g,' ')} · {o.action_taken?.replace(/_/g,' ')}</p>
            <p className="text-[10px] text-slate-400">{new Date(o.created_at).toLocaleDateString('en-IN')}</p>
          </div>
          {o.offer_presented && <span className="text-[10px] text-slate-500 bg-slate-50 px-2 py-0.5 rounded">{o.offer_presented}</span>}
        </div>
      ))}
    </div>
  );
}

// ── Explain Tab ───────────────────────────────────────────────────────────────
function ExplainTab({ customerId }: { customerId: string }) {
  const [expl,    setExpl]    = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api.getChurnExplanation(customerId).then(r => setExpl(r)).catch(()=>{}).finally(() => setLoading(false)); }, [customerId]);
  if (loading) return <Skeleton className="h-48 rounded-lg" />;
  if (!expl) return <div className="py-16 text-center text-slate-400 text-[13px]">Explanation unavailable.</div>;
  const features = expl.explanation?.features || expl.features || [];
  return (
    <div className="space-y-4">
      <div className="bg-teal-soft border border-blue-100 rounded-xl px-4 py-3 text-[11px] text-teal-dark">
        RBI AI Governance 2024 — SHAP-style feature attribution for model explainability.
      </div>
      <div className="space-y-2.5">
        {features.slice(0,10).map((f: any, i: number) => (
          <div key={i} className="flex items-center gap-3">
            <span className="w-36 text-[11px] text-slate-500 truncate">{(f.feature||f.name||'').replace(/_/g,' ')}</span>
            <div className="flex-1 bg-slate-100 rounded-full h-2">
              <div className={`h-2 rounded-full ${f.impact>0?'bg-red-400':'bg-emerald-400'}`}
                style={{width:`${Math.min(Math.abs(f.importance||f.shap_value||0)*200,100)}%`}} />
            </div>
            <span className={`text-[10px] font-semibold w-14 text-right ${f.impact>0?'text-crimson':'text-sage-brand'}`}>
              {((f.importance||f.shap_value||0)*100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Data Rights Tab ───────────────────────────────────────────────────────────
function RightsTab({ customerId }: { customerId: string }) {
  const [consent, setConsent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api.getConsent(customerId).then(r => setConsent(r.consent||r)).catch(()=>{}).finally(() => setLoading(false)); }, [customerId]);
  if (loading) return <Skeleton className="h-48 rounded-lg" />;
  return (
    <div className="space-y-3">
      {[
        ['DPDPA Consent', consent?.dpdpa_consent ? 'Granted' : 'Not Granted', !!consent?.dpdpa_consent],
        ['TRAI Consent',  consent?.trai_consent  ? 'Granted' : 'Not Granted', !!consent?.trai_consent],
        ['Opted Out',     consent?.opted_out      ? 'Yes'     : 'No',          !consent?.opted_out],
      ].map(([k,v,ok]) => (
        <div key={k as string} className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
          <span className="text-[12px] text-slate-600 font-medium">{k as string}</span>
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${ok?'bg-sage-soft text-sage-brand':'bg-crimson-soft text-crimson'}`}>{v as string}</span>
        </div>
      ))}
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function Sidebar({ snap, onCall, onOutcome }: {
  snap: Snapshot; onCall: () => void; onOutcome: () => void;
}) {
  const c = snap.customer;
  const s = snap.score;
  const signals: any[] = snap.signals || [];
  const p = snap.plan;

  const models = [
    { name: 'TARE',      score: s?.tare_score },
    { name: 'HABITAT',   score: s?.habitat_score },
    { name: 'GraphSAGE', score: s?.graph_score },
    { name: 'GENESIS',   score: s?.genesis_score },
  ];

  const TIER_COLOR: Record<string, string> = {
    PRIORITY: 'text-crimson', ESCALATE: 'text-copper-dark',
    STANDARD: 'text-copper-dark', MONITOR: 'text-teal-dark', NONE: 'text-sage-brand',
  };
  const tier = s?.risk_tier || c.risk_tier;

  return (
    <div className="flex flex-col gap-4 w-72 shrink-0">

      {/* Risk Score Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-3">Risk Score</p>
        <div className="flex items-end gap-3 mb-3">
          <p className={`text-[40px] font-black leading-none tabular-nums ${TIER_COLOR[tier] || 'text-slate-800'}`}>
            {((s?.final_score || c.churn_score || 0) * 100).toFixed(0)}%
          </p>
          <div className="pb-1">
            <RiskBadge tier={tier} size="sm" />
            {s?.ci_lower != null && (
              <p className="text-[9px] text-slate-400 mt-1">
                CI: {(s.ci_lower*100).toFixed(0)}–{(s.ci_upper*100).toFixed(0)}%
              </p>
            )}
          </div>
        </div>
        <ScoreBar score={s?.final_score || c.churn_score || 0} tier={tier} height={6} />

        <div className="mt-4 space-y-2">
          {models.map(m => (
            <div key={m.name} className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 w-16">{m.name}</span>
              <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                <div className="h-1.5 rounded-full bg-[var(--crimson)]/60" style={{ width: `${(m.score||0)*100}%` }} />
              </div>
              <span className="text-[10px] font-semibold text-slate-600 w-10 text-right">{((m.score||0)*100).toFixed(1)}%</span>
            </div>
          ))}
        </div>
        {s?.final_score && (
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[10px] text-slate-400">FusionX (final)</span>
            <span className="text-[13px] font-black text-slate-900">{(s.final_score*100).toFixed(1)}%</span>
          </div>
        )}
      </div>

      {/* Survival probabilities */}
      {s?.p7 != null && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-3">Churn Probability</p>
          {[['7 days', s.p7], ['30 days', s.p30], ['90 days', s.p90]].map(([label, val]) => (
            <div key={label as string} className="flex items-center justify-between mb-2 last:mb-0">
              <span className="text-[11px] text-slate-500">Within {label as string}</span>
              <span className={`text-[13px] font-black tabular-nums ${(val as number) > 0.5 ? 'text-crimson' : (val as number) > 0.25 ? 'text-copper' : 'text-sage-brand'}`}>
                {((val as number) * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Active signals */}
      {signals.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-3">
            Active Signals <span className="ml-1 bg-crimson-soft text-crimson text-[9px] font-bold px-1.5 py-0.5 rounded-full">{signals.length}</span>
          </p>
          <div className="space-y-2">
            {signals.slice(0, 4).map((s: any, i: number) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                <span className="text-[11px] text-slate-600 capitalize truncate flex-1">{s.signal_type.replace(/_/g,' ')}</span>
                <span className="text-[10px] font-semibold text-slate-500">{(s.confidence*100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action plan summary */}
      {p?.offer_display && (
        <div className="bg-[var(--crimson)]/5 rounded-xl border border-[var(--crimson)]/10 p-4">
          <p className="text-[10px] font-semibold text-[var(--crimson)] uppercase tracking-wide mb-2">Recommended Action</p>
          <p className="text-[13px] font-bold text-slate-800">{p.offer_display}</p>
          <p className="text-[11px] text-slate-500 mt-0.5 capitalize">{p.channel} · {p.urgency}</p>
          {p.rationale && <p className="text-[10px] text-slate-400 mt-2 leading-snug line-clamp-3">{p.rationale}</p>}
        </div>
      )}

      {/* Quick actions */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-2">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Quick Actions</p>
        <button onClick={onCall}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-[12px] font-semibold text-slate-700 hover:bg-slate-50 hover:border-[var(--crimson)]/30 transition-colors">
          <Phone className="w-3.5 h-3.5 text-[var(--crimson)]" /> Start Call
        </button>
        <button onClick={onOutcome}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-[12px] font-semibold text-slate-700 hover:bg-slate-50 hover:border-[var(--crimson)]/30 transition-colors">
          <ClipboardList className="w-3.5 h-3.5 text-[var(--crimson)]" /> Log Outcome
        </button>
        <Link href={`/rm/compose/${snap.customer.customer_id}`}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-[12px] font-semibold text-slate-700 hover:bg-slate-50 hover:border-[var(--crimson)]/30 transition-colors">
          <Send className="w-3.5 h-3.5 text-[var(--crimson)]" /> Compose Outreach
        </Link>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function RmCustomer360Page() {
  const { id }  = useParams() as { id: string };
  const router  = useRouter();
  const [snap,        setSnap]        = useState<Snapshot | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [activeTab,   setActiveTab]   = useState('overview');
  const [showCall,    setShowCall]    = useState(false);
  const [showOutcome, setShowOutcome] = useState(false);
  const [analysis,    setAnalysis]    = useState<string>('');
  const [analysisLoading, setAnalysisLoading] = useState(false);

  const load = () => {
    if (!getToken()) { router.push('/login'); return; }
    setLoading(true);
    api.getCustomerById(id).then(r => setSnap(r)).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  const runAnalysis = async () => {
    setAnalysisLoading(true);
    try { const r = await api.analyzeCustomer(id); setAnalysis(r.analysis || r.message || ''); }
    catch(e:any) { setAnalysis(e.message); }
    finally { setAnalysisLoading(false); }
  };

  const c = snap?.customer;
  const s = snap?.score;
  const tier = s?.risk_tier || c?.risk_tier;

  return (
    <div className="p-6 flex flex-col gap-5 min-h-full">
      {/* Back */}
      <Link href="/rm/book" className="inline-flex items-center gap-1.5 text-[12px] text-slate-400 hover:text-[var(--crimson)] transition-colors w-fit">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to My Book
      </Link>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_288px] gap-5">
          <div className="space-y-4">
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-12 rounded-xl" />
            <Skeleton className="h-96 rounded-xl" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
          </div>
        </div>
      ) : !snap ? (
        <div className="flex items-center gap-3 text-slate-500 py-20 justify-center">Customer not found.</div>
      ) : (
        <div className="flex gap-5 items-start">

          {/* ── Left: header + tabs ─────────────────────────────────────── */}
          <div className="flex-1 min-w-0 flex flex-col gap-4">

            {/* Header card */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-full bg-[var(--crimson)]/10 flex items-center justify-center text-[15px] font-black text-[var(--crimson)] shrink-0">
                  {c!.full_name.split(' ').map((n: string) => n[0]).join('').slice(0,2)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <h1 className="text-[20px] font-black text-slate-900 leading-tight">{c!.full_name}</h1>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-[11px] text-slate-400">{c!.customer_id}</span>
                        <span className="text-slate-200">·</span>
                        <span className="text-[11px] text-slate-400">{c!.segment}</span>
                        <span className="text-slate-200">·</span>
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                          <MapPin className="w-3 h-3" />{c!.city}
                        </span>
                        <span className="text-slate-200">·</span>
                        <span className="text-[11px] text-slate-400">{c!.tenure_months}mo tenure</span>
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 mt-4 flex-wrap">
                    <button onClick={runAnalysis} disabled={analysisLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--crimson)] text-white text-[12px] font-semibold hover:bg-[var(--crimson-dark)] disabled:opacity-50 transition-colors">
                      {analysisLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
                      {analysisLoading ? 'Analysing…' : analysis ? 'Regenerate' : 'Run AI Analysis'}
                    </button>
                    <Link href={`/rm/compose/${id}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--crimson)] text-[var(--crimson)] text-[12px] font-semibold hover:bg-[var(--crimson)]/5 transition-colors">
                      <Send className="w-3.5 h-3.5" /> Compose Outreach
                    </Link>
                    <button onClick={() => setShowCall(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-[12px] font-semibold hover:bg-slate-50 transition-colors">
                      <Phone className="w-3.5 h-3.5" /> Start Call
                    </button>
                    <button onClick={() => setShowOutcome(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-[12px] font-semibold hover:bg-slate-50 transition-colors">
                      <ClipboardList className="w-3.5 h-3.5" /> Log Outcome
                    </button>
                  </div>

                  {/* AI Analysis inline result */}
                  {analysis && (
                    <div className="mt-4 bg-[#F9F9F7] rounded-md border border-soft px-4 py-3">
                      <div className="flex items-center gap-2 mb-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-[#6B132B]" />
                        <p className="text-[10px] font-bold text-[#6B132B] uppercase tracking-wide">AI Risk Analysis</p>
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-[#6B132B] text-white uppercase tracking-wide">NVIDIA DeepSeek V4 Pro</span>
                      </div>
                      <div className="text-[12px] text-[#2A161B] leading-relaxed prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: mdToHtml(analysis) }} />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Tab bar + content */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="flex overflow-x-auto border-b border-slate-100 px-1">
                {TABS.map(t => {
                  const Icon = t.icon;
                  return (
                    <button key={t.id} onClick={() => setActiveTab(t.id)}
                      className={`flex items-center gap-1.5 px-3 py-3.5 text-[12px] font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
                        activeTab === t.id ? 'border-[var(--crimson)] text-[var(--crimson)]' : 'border-transparent text-slate-400 hover:text-slate-600'
                      }`}>
                      <Icon className="w-3.5 h-3.5" />
                      {t.label}
                    </button>
                  );
                })}
              </div>
              <div className="p-5">
                {activeTab === 'overview'  && <OverviewTab snap={snap} />}
                {activeTab === 'signals'   && <SignalsTab snap={snap} />}
                {activeTab === 'plan'      && <PlanTab snap={snap} />}
                {activeTab === 'crosssell' && <CrossSellTab snap={snap} customerId={id} />}
                {activeTab === 'outreach'  && <OutreachTab snap={snap} customerId={id} />}
                {activeTab === 'calls'     && <CallsTab customerId={id} />}
                {activeTab === 'outcomes'  && <OutcomesTab customerId={id} />}
                {activeTab === 'explain'   && <ExplainTab customerId={id} />}
                {activeTab === 'rights'    && <RightsTab customerId={id} />}
              </div>
            </div>
          </div>

          {/* ── Right sidebar ──────────────────────────────────────────── */}
          <Sidebar snap={snap} onCall={() => setShowCall(true)} onOutcome={() => setShowOutcome(true)} />
        </div>
      )}

      {showCall && snap && (
        <CallModal customerId={id} customerName={snap.customer.full_name}
          onClose={() => setShowCall(false)}
          onCommit={() => { setActiveTab('calls'); load(); }} />
      )}
      {showOutcome && snap && (
        <OutcomeModal customerId={id} customerName={snap.customer.full_name}
          onClose={() => setShowOutcome(false)}
          onSaved={() => { setActiveTab('outcomes'); load(); }} />
      )}
    </div>
  );
}
