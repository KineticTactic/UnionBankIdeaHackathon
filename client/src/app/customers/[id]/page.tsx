'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getToken, api } from '@/lib/api';
import { CustomerSnapshot, Signal, Transaction, RiskTier, HeraldContent } from '@/types';
import RiskBadge, { tierColor, tierBgColor } from '@/components/RiskBadge';
import ScoreBar from '@/components/ScoreBar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BarChart, Bar, AreaChart, Area, ResponsiveContainer, XAxis, YAxis,
  Tooltip, CartesianGrid,
} from 'recharts';
import {
  ArrowLeft, Building2, MapPin, Clock, User, TrendingUp,
  AlertCircle, CheckCircle, Mail, MessageSquare, Bell, Phone, ChevronRight, Zap,
  Languages, Globe2, RotateCcw,
} from 'lucide-react';
import { ExplainabilityPanel } from '@/components/compliance/ExplainabilityPanel';
import { DataRightsPanel } from '@/components/compliance/DataRightsPanel';
import { ConsentStatusBadge } from '@/components/compliance/ConsentStatusBadge';
import { RMCopilotPanel } from '@/components/copilot/RMCopilotPanel';

const TABS = ['Overview','Risk Score','Signals','Transactions','Action Plan','Cross-Sell','Outreach','Survival','Explain','Data Rights'] as const;
type Tab = typeof TABS[number];

const NEXUS_CAT_BADGE: Record<string, string> = {
  card: 'bg-purple-100 text-purple-700', loan: 'bg-red-100 text-red-700',
  deposit: 'bg-emerald-100 text-emerald-700', investment: 'bg-sky-100 text-sky-700',
  insurance: 'bg-amber-100 text-amber-700',
};

const METHOD_COLORS: Record<string, string> = {
  SR:    'bg-teal-soft text-teal-dark',
  CUSUM: 'bg-copper-soft text-copper-dark',
  SPRT:  'bg-teal-soft text-teal-dark',
};

function StatBox({ label, value, sub, color }: { label:string; value:string|number; sub?:string; color?:string }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-xl font-black text-slate-900" style={color ? {color} : {}}>{value}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function CustomerDetailPage({ params }: { params: Promise<{id:string}> }) {
  const { id }     = use(params);
  const router     = useRouter();
  const [snap,    setSnap]    = useState<CustomerSnapshot | null>(null);
  const [txns,    setTxns]    = useState<Transaction[]>([]);
  const [tab,     setTab]     = useState<Tab>('Overview');
  const [loading, setLoading] = useState(true);
  const [analysis,      setAnalysis]      = useState('');
  const [analyzing,     setAnalyzing]     = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const [herald,        setHerald]        = useState<HeraldContent | null>(null);
  const [generating,    setGenerating]    = useState(false);
  const [heraldError,   setHeraldError]   = useState('');
  const [nexus,         setNexus]         = useState<any>(null);

  // NEXUS cross-sell recommendations for this customer
  useEffect(() => {
    api.getNexusForCustomer(id).then(setNexus).catch(() => setNexus(null));
  }, [id]);

  // ── Translation state (GCP) ─────────────────────────────────────────────
  // `translation` is the post-translation herald; if set, the UI
  // renders it instead of `herald` so the user can flip back to the
  // English source via the "Show original" button.
  const [languages,     setLanguages]     = useState<{ code: string; name: string; nativeName: string; region: string }[]>([]);
  const [langReady,      setLangReady]      = useState<boolean>(false);
  const [langError,      setLangError]      = useState<string>('');
  const [targetLang,     setTargetLang]     = useState<string>('');
  const [translation,    setTranslation]    = useState<HeraldContent | null>(null);
  const [translating,    setTranslating]    = useState(false);
  const [translationErr, setTranslationErr] = useState('');
  // Load the language dropdown once on mount.  If GCP isn't
  // configured we surface a single error message in the UI.
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
  // Core: generate (or re-generate) the live LLM content.  Returns
  // the herald on success or null on failure.  Used by both the
  // "Generate with AI" button and the smart "Translate" button.
  const generateHerald = async (): Promise<any | null> => {
    setGenerating(true);
    setHeraldError('');
    try {
      const r = await api.generateOutreach(id);
      // Server returns the live LLM content in `heraldContent`
      // (camelCase).  The polling path also returns
      // {status, ...poll.result} with the same field.
      const h = r.heraldContent || r.herald || null;
      setHerald(h);
      return h;
    } catch (e: unknown) {
      setHeraldError(e instanceof Error ? e.message : 'NVIDIA DeepSeek V4 Pro did not respond. Check the API key or network connection.');
      return null;
    } finally {
      setGenerating(false);
    }
  };

  // Translate: if no live content yet, generate first, then translate.
  // This makes the language dropdown the single primary action.
  const handleTranslate = async (target: string) => {
    setTranslating(true);
    setTranslationErr('');
    try {
      let source = herald;
      if (!source) {
        // No live content yet — generate it first.
        const generated = await generateHerald();
        if (!generated) {
          setTranslationErr('Could not generate content for translation. ' +
                             'Check the NVIDIA API key and try again.');
          return;
        }
        source = generated;
      }
      const r = await api.translateHerald(source, target);
      if (r?.herald) {
        setTranslation(r.herald);
        setTargetLang(target);
      }
    } catch (e) {
      setTranslationErr(e instanceof Error ? e.message : 'Translation failed');
    } finally {
      setTranslating(false);
    }
  };
  const handleResetTranslation = () => {
    setTranslation(null);
    setTargetLang('');
    setTranslationErr('');
  };

  useEffect(() => {
    if (!getToken()) { router.push('/login'); return; }
    const load = () => Promise.all([
      api.getCustomerById(id),
      api.getCustomerTransactions(id),
    ]).then(([snapRes, txnRes]) => {
      setSnap(snapRes as CustomerSnapshot);
      setTxns(txnRes.transactions || []);
    }).catch(() => {}).finally(() => setLoading(false));
    load();
    // Poll every 5s so live ARGUS evaluations and Kafka events appear
    // without a manual refresh — the demo runs end-to-end from the
    // TUI: user fires `argus evaluate CUST-XXX` and the Signals tab
    // lights up within ~5 seconds.
    const interval = setInterval(load, 5_000);
    return () => clearInterval(interval);
  }, [id, router]);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setAnalysisError('');
    setAnalysis('');
    try {
      const r = await api.analyzeCustomer(id);
      setAnalysis(r.analysis || '');
    } catch (e: unknown) {
      setAnalysisError(e instanceof Error ? e.message : 'NVIDIA DeepSeek V4 Pro did not respond. Check the API key or network connection.');
    } finally { setAnalyzing(false); }
  };

  const handleGenerate = () => generateHerald();

  // The displayed herald.  `herald` is the freshly LLM-generated
  // content; `translation` (if set) overrides it so the user can flip
  // back to the original via the "Original" button.  There is NO
  // fallback to a static snapshot — for the demo, content only appears
  // once the user clicks Generate with AI (or Translate, which also
  // generates if needed).
  const activeHerald = translation ?? herald;

  if (loading) return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-28 rounded-xl" />
      <Skeleton className="h-12 rounded-lg" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );

  if (!snap) return (
    <div className="p-6 flex items-center gap-3 text-slate-500">
      <AlertCircle className="w-5 h-5" />
      Customer not found.
    </div>
  );

  const { customer: c, score, signals, plan, survival } = snap;

  return (
    <div className="p-6 space-y-4">
      {/* Breadcrumb */}
      <Link href="/customers" className="flex items-center gap-1.5 text-[12px] text-slate-400 hover:text-[var(--crimson)] transition-colors w-fit">
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Customers
      </Link>

      {/* Header card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full flex items-center justify-center text-[18px] font-black text-white"
              style={{ backgroundColor: tierColor(c.risk_tier) }}>
              {c.full_name.split(' ').map(n=>n[0]).join('').slice(0,2)}
            </div>
            <div>
              <h1 className="text-[20px] font-black text-slate-900">{c.full_name}</h1>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className="text-[12px] text-slate-400">{c.customer_id}</span>
                <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                  <Building2 className="w-3 h-3" /> {c.employer}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                  <MapPin className="w-3 h-3" /> {c.city}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                  <Clock className="w-3 h-3" /> {c.tenure_months} months
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                  <User className="w-3 h-3" /> {c.relationship_manager}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-[10px] text-slate-400 mb-1">Ensemble Score</p>
              <p className="text-3xl font-black tabular-nums" style={{color: tierColor(c.risk_tier)}}>
                {(c.churn_score*100).toFixed(0)}%
              </p>
            </div>
            <div className="flex flex-col gap-1.5 items-end">
              <RiskBadge tier={c.risk_tier} size="md" />
              <div className="relative">
                <ConsentStatusBadge customerId={c.customer_id} />
              </div>
              {c.life_event && (
                <span className="inline-flex items-center gap-1 text-[10px] bg-teal-soft text-teal-dark px-2 py-0.5 rounded-full border border-soft">
                  {c.life_event.replace(/_/g,' ')}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-[12px] font-semibold transition-colors ${
              tab === t
                ? 'bg-[var(--crimson)] text-white'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50 border-r border-slate-200 last:border-0'
            }`}>
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 min-h-[300px]">

        {/* ── Overview ─────────────────────────────────────────────────────── */}
        {tab === 'Overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-3">
              <StatBox label="Balance"      value={`₹${(c.balance/1000).toFixed(0)}K`} sub={c.segment} />
              <StatBox label="Income (ann)" value={`₹${(c.income/100000).toFixed(1)}L`} />
              <StatBox label="Inactivity"   value={`${c.inactivity_days}d`}  color={c.inactivity_days>45?'var(--crimson)':undefined} />
              <StatBox label="NPS Score"    value={c.nps}  color={c.nps < 3 ? 'var(--crimson)' : c.nps > 7 ? 'var(--sage-brand)' : undefined} />
              <StatBox label="Products"     value={c.product_count} />
              <StatBox label="Txn Freq 90d" value={c.txn_freq_90d} sub="transactions" />
              <StatBox label="App Logins"   value={c.app_logins_30d} sub="last 30d" />
              <StatBox label="Complaints"   value={c.complaint_count} color={c.complaint_count>2?'var(--crimson)':undefined} />
              <StatBox label="Digital"      value={`${(c.digital_ratio*100).toFixed(0)}%`} sub="of txns" />
              <StatBox label="Salary Credits" value={c.salary_credit_count} sub="last 3mo" />
            </div>

            {c.life_event && (
              <div className="p-4 rounded-lg bg-teal-soft border border-soft">
                <p className="text-[12px] font-semibold text-teal-dark mb-1">Life Event Detected: {c.life_event.replace(/_/g,' ')}</p>
                <p className="text-[12px] text-teal-dark">{c.life_event_desc}</p>
              </div>
            )}

            {/* AI Analysis */}
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <p className="text-[13px] font-semibold text-slate-700">AI Risk Analysis</p>
                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-teal-soft text-teal-dark uppercase tracking-wide">NVIDIA DeepSeek V4 Pro</span>
                </div>
                <button onClick={handleAnalyze} disabled={analyzing}
                  className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg bg-[var(--crimson)] text-white hover:bg-[var(--crimson-dark)] disabled:opacity-50 transition-colors">
                  <TrendingUp className="w-3.5 h-3.5" />
                  {analyzing ? 'Analysing…' : analysis ? 'Regenerate' : 'Generate Analysis'}
                </button>
              </div>
              <div className="p-4">
                {analyzing ? (
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2 mb-3 text-[12px] text-slate-400">
                      <div className="w-4 h-4 border-2 border-[var(--crimson)] border-t-transparent rounded-full animate-spin shrink-0" />
                      NVIDIA DeepSeek V4 Pro is analysing {c.full_name}'s risk profile…
                    </div>
                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-slate-200 rounded-full animate-pulse" style={{width:'85%'}} /></div>
                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-slate-200 rounded-full animate-pulse" style={{width:'65%'}} /></div>
                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-slate-200 rounded-full animate-pulse" style={{width:'75%'}} /></div>
                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-slate-200 rounded-full animate-pulse" style={{width:'50%'}} /></div>
                  </div>
                ) : analysisError ? (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-crimson-soft border border-soft">
                    <AlertCircle className="w-4 h-4 text-crimson shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[12px] font-semibold text-crimson mb-0.5">Analysis failed</p>
                      <p className="text-[12px] text-crimson">{analysisError}</p>
                    </div>
                  </div>
                ) : analysis ? (
                  <p className="text-[13px] text-slate-600 leading-relaxed whitespace-pre-line">{analysis}</p>
                ) : (
                  <p className="text-[12px] text-slate-400 italic">Click "Generate Analysis" to get a live AI-powered risk assessment via NVIDIA DeepSeek V4 Pro.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Risk Score ───────────────────────────────────────────────────── */}
        {tab === 'Risk Score' && score && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatBox label="Final Score"   value={`${(score.final_score*100).toFixed(1)}%`} color={tierColor(score.risk_tier)} />
              <StatBox label="CI Lower"      value={`${(score.ci_lower*100).toFixed(1)}%`}   sub="90% conformal" />
              <StatBox label="CI Upper"      value={`${(score.ci_upper*100).toFixed(1)}%`}   sub="90% conformal" />
              <StatBox label="Disagreement"  value={`±${(score.ensemble_disagreement*100).toFixed(1)}%`} sub="model spread" />
            </div>

            <div className="space-y-3">
              <p className="text-[13px] font-semibold text-slate-700">Individual Model Scores</p>
              {[
                { name: 'GENESIS',   desc: 'LR cold-start',             score: score.genesis_score,  weight: 15 },
                { name: 'HABITAT',   desc: 'XGBoost tabular',           score: score.habitat_score,  weight: 30 },
                { name: 'TARE',      desc: 'Temporal Transformer',      score: score.tare_score,     weight: 35 },
                { name: 'GraphSAGE', desc: 'Knowledge graph GNN',       score: score.graph_score,    weight: 20 },
              ].map(m => (
                <div key={m.name} className="flex items-center gap-4">
                  <div className="w-24 shrink-0">
                    <p className="text-[12px] font-semibold text-slate-700">{m.name}</p>
                    <p className="text-[10px] text-slate-400">{m.desc}</p>
                  </div>
                  <div className="flex-1">
                    <ScoreBar score={m.score} height={8} showLabel />
                  </div>
                  <div className="text-[10px] text-slate-400 w-16 text-right">w={m.weight}%</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'P(churn < 7d)',  val: score.p7  },
                { label: 'P(churn < 30d)', val: score.p30 },
                { label: 'P(churn < 90d)', val: score.p90 },
              ].map(({ label, val }) => (
                <div key={label} className="bg-slate-50 rounded-lg border border-slate-200 p-4 text-center">
                  <p className="text-[10px] text-slate-400 mb-1">{label}</p>
                  <p className="text-2xl font-black tabular-nums" style={{color: val>0.5?'var(--crimson)':val>0.25?'var(--copper)':'var(--sage-brand)'}}>
                    {(val*100).toFixed(0)}%
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Signals ──────────────────────────────────────────────────────── */}
        {tab === 'Signals' && (
          <div className="space-y-3">
            <p className="text-[13px] font-semibold text-slate-700 mb-4">
              {signals.length} active ARGUS signal{signals.length!==1?'s':''} detected
            </p>
            {signals.length === 0 && (
              <div className="flex items-center gap-2 text-[13px] text-slate-400">
                <CheckCircle className="w-4 h-4 text-sage-brand" />
                No active signals — customer profile is stable.
              </div>
            )}
            {signals.map((sig: Signal, i: number) => (
              <div key={i} className="flex items-start gap-4 p-4 rounded-lg border border-slate-200">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-[13px] font-semibold text-slate-800 capitalize">{sig.signal_type.replace(/_/g,' ')}</p>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${METHOD_COLORS[sig.method] || 'bg-slate-100 text-slate-600'}`}>
                      {sig.method}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">Active for {sig.days_active} day{sig.days_active!==1?'s':''}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[11px] text-slate-400">Confidence</p>
                  <p className="text-[16px] font-black text-slate-800">{(sig.confidence*100).toFixed(0)}%</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[11px] text-slate-400">CUSUM</p>
                  <p className="text-[16px] font-black text-copper-dark">{sig.cusum_value?.toFixed(1)}</p>
                  <p className="text-[9px] text-slate-400">h={sig.alarm_threshold}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Transactions ─────────────────────────────────────────────────── */}
        {tab === 'Transactions' && (
          <div className="space-y-4">
            <p className="text-[13px] font-semibold text-slate-700">{txns.length} transactions · last 60 days</p>
            {txns.length > 0 && (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={txns.slice(-30).map(t=>({date:t.date.slice(5),amount:t.amount,type:t.type}))}
                  margin={{top:0,right:0,left:-20,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--secondary)" />
                  <XAxis dataKey="date" tick={{fontSize:9,fill:'var(--gray-400)'}} axisLine={false} tickLine={false} interval={4} />
                  <YAxis tick={{fontSize:9,fill:'var(--gray-400)'}} axisLine={false} tickLine={false} tickFormatter={v=>`₹${(v/1000).toFixed(0)}K`} />
                  <Tooltip formatter={(v)=>[`₹${Number(v).toLocaleString('en-IN')}`,'Amount']} contentStyle={{fontSize:11,borderRadius:8,border:'1px solid var(--border-color)'}} />
                  <Bar dataKey="amount" fill="var(--crimson)" radius={[3,3,0,0]} maxBarSize={16} />
                </BarChart>
              </ResponsiveContainer>
            )}
            <div className="overflow-y-auto max-h-72">
              <table className="w-full text-[12px]">
                <thead className="sticky top-0 bg-slate-50">
                  <tr className="border-b border-slate-200 text-[10px] text-slate-400 uppercase tracking-wider">
                    <th className="text-left py-2 px-3">Date</th>
                    <th className="text-left py-2 px-3">Type</th>
                    <th className="text-left py-2 px-3">Channel</th>
                    <th className="text-left py-2 px-3">Category</th>
                    <th className="text-right py-2 px-3">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {[...txns].reverse().map((t, i) => (
                    <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-2 px-3 text-slate-500">{t.date}</td>
                      <td className="py-2 px-3">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${t.type==='CREDIT'?'bg-sage-soft text-sage-brand':'bg-slate-100 text-slate-600'}`}>{t.type}</span>
                      </td>
                      <td className="py-2 px-3 text-slate-500">{t.channel}</td>
                      <td className="py-2 px-3 text-slate-500">{t.category}</td>
                      <td className="py-2 px-3 text-right font-semibold tabular-nums text-slate-800">₹{t.amount.toLocaleString('en-IN', {maximumFractionDigits:0})}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Action Plan ──────────────────────────────────────────────────── */}
        {tab === 'Action Plan' && plan && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatBox label="Action"    value={plan.action.replace(/_/g,' ')}   color="var(--crimson)" />
              <StatBox label="Urgency"   value={plan.urgency}                     color={plan.urgency==='IMMEDIATE'?'var(--crimson)':undefined} />
              <StatBox label="Offer"     value={plan.offer_display || plan.offer_code.replace(/_/g,' ')} />
              <StatBox label="Channel"   value={plan.channel} />
            </div>

            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Rationale</p>
              <p className="text-[13px] text-slate-700 leading-relaxed">{plan.rationale}</p>
            </div>

            {plan.life_event && (
              <div className="p-4 rounded-lg bg-teal-soft border border-soft">
                <p className="text-[11px] font-semibold text-teal-dark uppercase tracking-wider mb-1">Life Event Detected</p>
                <p className="text-[13px] text-teal-dark">{plan.life_event.replace(/_/g,' ')}</p>
              </div>
            )}

            {plan.tone_modifiers?.length > 0 && (
              <div className="flex gap-2">
                {plan.tone_modifiers.map(t => (
                  <span key={t} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-soft text-teal-dark border border-soft capitalize">{t}</span>
                ))}
              </div>
            )}

            {plan.suppressed && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-copper-soft border border-soft">
                <AlertCircle className="w-4 h-4 text-copper-dark" />
                <p className="text-[12px] text-copper-dark font-medium">Outreach suppressed (contact fatigue / consent rules)</p>
              </div>
            )}
          </div>
        )}

        {/* ── Cross-Sell ───────────────────────────────────────────────────── */}
        {tab === 'Cross-Sell' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-[13px] font-semibold text-slate-700">NEXUS Cross-Sell Recommendations</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Model-backed (XGBoost · PKDD'99) · compliance-gated · {nexus?.model_version || '—'}</p>
              </div>
              {nexus?.churn_deferral_active && (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-crimson-soft text-crimson text-[11px] font-bold">
                  <AlertCircle className="w-3.5 h-3.5" /> Churn-deferral active
                </span>
              )}
            </div>

            {!nexus && <div className="flex items-center gap-2 text-slate-400 text-[13px] py-8 justify-center"><span className="animate-spin text-crimson">⟳</span> Loading…</div>}

            {nexus?.churn_deferral_active && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-crimson-soft border border-red-100">
                <AlertCircle className="w-4 h-4 text-crimson shrink-0 mt-0.5" />
                <p className="text-[12px] text-crimson">High churn-risk — new-credit cross-sell suppressed. Retention takes priority; only safe products (deposits / insurance) shown.</p>
              </div>
            )}

            {nexus?.top_offer && (
              <div className="rounded-xl bg-[var(--crimson)] text-white p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Best Cross-Sell Fit</p>
                    <p className="text-[20px] font-black mt-0.5 truncate">{nexus.top_offer.label}</p>
                    <p className="text-[12px] text-white/60 italic mt-1">{nexus.top_offer.reason_codes?.[0]?.detail}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[30px] font-black leading-none tabular-nums">{Math.round(nexus.top_offer.score * 100)}<span className="text-[14px] text-white/50">%</span></p>
                    <p className="text-[10px] text-white/40">fit score</p>
                  </div>
                </div>
                <p className="text-[10px] font-mono text-white/40 mt-3 pt-3 border-t border-white/10">{nexus.top_offer.source_model}</p>
              </div>
            )}

            {nexus?.recommendations?.length > 0 && (
              <div>
                <p className="text-[13px] font-semibold text-slate-700 mb-3">Eligible Products</p>
                <div className="space-y-2">
                  {nexus.recommendations.map((rec: any) => (
                    <div key={rec.product} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-semibold text-slate-800 truncate">{rec.label}</span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${NEXUS_CAT_BADGE[rec.category] || 'bg-slate-100 text-slate-500'}`}>{rec.category}</span>
                        </div>
                        {rec.reason_codes?.[0] && <p className="text-[11px] text-slate-400 truncate">{rec.reason_codes[0].detail}</p>}
                      </div>
                      <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden shrink-0">
                        <div className="h-full bg-[var(--crimson)] rounded-full" style={{ width: `${Math.round(rec.score * 100)}%` }} />
                      </div>
                      <span className="text-[12px] font-bold text-[var(--crimson)] tabular-nums w-9 text-right shrink-0">{Math.round(rec.score * 100)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {nexus?.suppressed?.length > 0 && (
              <div>
                <p className="text-[13px] font-semibold text-slate-700 mb-3">Suppressed by Compliance ({nexus.suppressed.length})</p>
                <div className="space-y-1.5">
                  {nexus.suppressed.map((rec: any) => (
                    <div key={rec.product} className="flex items-center justify-between gap-3 rounded-lg bg-crimson-soft border border-red-100 px-3 py-2">
                      <span className="text-[12px] font-medium text-slate-600 truncate">{rec.label}</span>
                      <span className="text-[11px] text-crimson italic text-right shrink-0 max-w-[55%] truncate">{rec.filtered_reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {nexus && !nexus.top_offer && !nexus.recommendations?.length && (
              <div className="text-center py-10 text-slate-400 text-[13px]">No eligible cross-sell products for this customer right now.</div>
            )}
          </div>
        )}

        {/* ── Outreach ─────────────────────────────────────────────────────── */}
        {tab === 'Outreach' && (
          <div className="space-y-4">
            {/* Header + generate button + language selector */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-[13px] font-semibold text-slate-700">HERALD Content</p>
                <p className="text-[11px] text-slate-400">
                  {herald ? 'Live — generated via NVIDIA DeepSeek V4 Pro' : 'No content yet — click Generate with AI or pick a language and Translate'}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Language selector (GCP translate) */}
                <div className="flex items-center gap-1.5">
                  <select
                    disabled={!langReady}
                    value={targetLang}
                    onChange={(e) => setTargetLang(e.target.value)}
                    className="text-[12px] font-medium px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:border-[var(--crimson)] focus:border-[var(--crimson)] outline-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    aria-label="Target language for translation"
                    title={
                      !langReady
                        ? (langError || 'Loading language list…')
                        : !herald
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
                    onClick={() => targetLang && handleTranslate(targetLang)}
                    disabled={!targetLang || translating || generating || !langReady}
                    className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg border border-[var(--crimson)] text-[var(--crimson)] bg-white hover:bg-[var(--crimson)]/5 disabled:opacity-50 transition-colors"
                    title={
                      !langReady
                        ? (langError || 'Waiting for language list')
                        : !targetLang
                            ? 'Pick a target language'
                            : 'Generate + translate via NVIDIA DeepSeek V4 Pro & Google Cloud Translation'
                    }
                  >
                    <Languages className="w-3.5 h-3.5" />
                    {translating || generating
                      ? (generating ? 'Generating…' : 'Translating…')
                      : (herald ? 'Translate' : 'Generate & Translate')}
                  </button>
                  {translation && (
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
                {/* Generate / regenerate */}
                <button onClick={handleGenerate} disabled={generating}
                  className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg bg-[var(--crimson)] text-white hover:bg-[var(--crimson-dark)] disabled:opacity-50 transition-colors">
                  <Zap className="w-3.5 h-3.5" />
                  {generating ? 'Generating…' : herald ? 'Regenerate' : 'Generate with AI'}
                </button>
              </div>
            </div>

            {/* Translation status row */}
            {(translation || translationErr || langError) && (
              <div className="flex items-center gap-2 flex-wrap text-[11px]">
                {translation && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-teal-soft text-teal-dark border border-soft">
                    <Globe2 className="w-3 h-3" />
                    Translated to {languages.find(l => l.code === targetLang)?.name || targetLang.toUpperCase()}
                  </span>
                )}
                {(translationErr || langError) && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-crimson-soft text-crimson border border-soft">
                    <AlertCircle className="w-3 h-3" />
                    {translationErr || langError}
                  </span>
                )}
              </div>
            )}

            {generating ? (
              <div className="space-y-3 py-2">
                <div className="flex items-center gap-2 text-[12px] text-slate-400 mb-1">
                  <div className="w-4 h-4 border-2 border-[var(--crimson)] border-t-transparent rounded-full animate-spin shrink-0" />
                  NVIDIA DeepSeek V4 Pro is writing personalised email, SMS and push content…
                </div>
                {['Email body', 'SMS message', 'Push notification'].map(label => (
                  <div key={label} className="border border-slate-100 rounded-lg p-3 space-y-2">
                    <div className="h-2.5 w-20 bg-slate-100 rounded animate-pulse" />
                    <div className="h-2 bg-slate-100 rounded animate-pulse" />
                    <div className="h-2 bg-slate-100 rounded animate-pulse w-4/5" />
                    <div className="h-2 bg-slate-100 rounded animate-pulse w-3/5" />
                  </div>
                ))}
              </div>
            ) : heraldError ? (
              <div className="flex items-start gap-3 p-4 rounded-lg bg-crimson-soft border border-soft">
                <AlertCircle className="w-4 h-4 text-crimson shrink-0 mt-0.5" />
                <div>
                  <p className="text-[12px] font-semibold text-crimson mb-0.5">Content generation failed</p>
                  <p className="text-[12px] text-crimson">{heraldError}</p>
                  <p className="text-[11px] text-crimson mt-1">Check that the NVIDIA API key is set in server/.env and the endpoint is reachable.</p>
                </div>
              </div>
            ) : !activeHerald ? (
              <p className="text-[13px] text-slate-400 italic py-8 text-center">Pick a language above and click <strong>Translate</strong> to generate + translate live content via NVIDIA DeepSeek V4 Pro &amp; Google Cloud Translation — or click <strong>Generate with AI</strong> for English-only.</p>
            ) : (
              <>
                {activeHerald.email && (
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                      <Mail className="w-4 h-4 text-slate-400" />
                      <span className="text-[12px] font-semibold text-slate-700">Email</span>
                      {translation && (
                        <span className="text-[10px] font-semibold bg-teal-soft text-teal-dark px-1.5 py-0.5 rounded-full">
                          {(languages.find(l => l.code === targetLang)?.nativeName) || targetLang}
                        </span>
                      )}
                      <span className="ml-auto text-[10px] text-sage-brand font-semibold bg-sage-soft px-1.5 py-0.5 rounded-full">
                        {activeHerald.email.compliance_status}
                      </span>
                      <span className="text-[10px] text-slate-400">{activeHerald.email.word_count} words</span>
                    </div>
                    <div className="p-4">
                      <p className="text-[11px] font-semibold text-slate-400 mb-1">Subject</p>
                      <p className="text-[13px] font-medium text-slate-800 mb-3">{activeHerald.email.subject}</p>
                      <p className="text-[12px] text-slate-600 leading-relaxed whitespace-pre-line">{activeHerald.email.body}</p>
                    </div>
                  </div>
                )}
                {activeHerald.sms && (
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                      <MessageSquare className="w-4 h-4 text-slate-400" />
                      <span className="text-[12px] font-semibold text-slate-700">SMS</span>
                      {translation && (
                        <span className="text-[10px] font-semibold bg-teal-soft text-teal-dark px-1.5 py-0.5 rounded-full">
                          {(languages.find(l => l.code === targetLang)?.nativeName) || targetLang}
                        </span>
                      )}
                      <span className="ml-auto text-[10px] text-sage-brand font-semibold bg-sage-soft px-1.5 py-0.5 rounded-full">
                        {activeHerald.sms.compliance_status}
                      </span>
                      <span className="text-[10px] text-slate-400">{activeHerald.sms.char_count} chars</span>
                    </div>
                    <div className="p-4">
                      <p className="text-[13px] text-slate-700 bg-slate-50 rounded-lg p-3 border border-slate-200">{activeHerald.sms.body}</p>
                    </div>
                  </div>
                )}
                {activeHerald.push && (
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                      <Bell className="w-4 h-4 text-slate-400" />
                      <span className="text-[12px] font-semibold text-slate-700">Push Notification</span>
                      {translation && (
                        <span className="text-[10px] font-semibold bg-teal-soft text-teal-dark px-1.5 py-0.5 rounded-full">
                          {(languages.find(l => l.code === targetLang)?.nativeName) || targetLang}
                        </span>
                      )}
                    </div>
                    <div className="p-4 flex gap-4 items-start">
                      <div className="w-10 h-10 rounded-xl bg-[var(--crimson)] flex items-center justify-center text-white text-[10px] font-black shrink-0">UB</div>
                      <div>
                        <p className="text-[13px] font-semibold text-slate-800 mb-0.5">{activeHerald.push.title}</p>
                        <p className="text-[12px] text-slate-600">{activeHerald.push.body}</p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Explainability ───────────────────────────────────────────────── */}
        {tab === 'Explain' && (
          <ExplainabilityPanel customerId={c.customer_id} />
        )}

        {/* ── Data Rights ──────────────────────────────────────────────────── */}
        {tab === 'Data Rights' && (
          <DataRightsPanel customerId={c.customer_id} />
        )}

        {/* ── Survival ─────────────────────────────────────────────────────── */}
        {tab === 'Survival' && survival && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              {[
                { label:'P(churn < 7d)',  val: survival.p7,  color: survival.p7>0.4?'var(--crimson)':'var(--sage-brand)' },
                { label:'P(churn < 30d)', val: survival.p30, color: survival.p30>0.4?'var(--crimson)':survival.p30>0.25?'var(--copper)':'var(--sage-brand)' },
                { label:'P(churn < 90d)', val: survival.p90, color: survival.p90>0.5?'var(--crimson)':survival.p90>0.3?'var(--copper)':'var(--sage-brand)' },
              ].map(({label,val,color}) => (
                <div key={label} className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-center">
                  <p className="text-[10px] text-slate-400 mb-1">{label}</p>
                  <p className="text-2xl font-black tabular-nums" style={{color}}>{(val*100).toFixed(0)}%</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">probability</p>
                </div>
              ))}
            </div>
            <div>
              <p className="text-[13px] font-semibold text-slate-700 mb-3">DeepHit Survival Curve — P(not churned) over time</p>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart
                  data={survival.time_points.map((t:number, i:number) => ({t, s: survival.survival[i]*100}))}
                  margin={{top:4,right:8,left:-20,bottom:0}}>
                  <defs>
                    <linearGradient id="survGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="var(--crimson)" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="var(--crimson)" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--secondary)" />
                  <XAxis dataKey="t" tick={{fontSize:10,fill:'var(--gray-400)'}} tickFormatter={v=>`${v}d`} axisLine={false} tickLine={false} />
                  <YAxis tick={{fontSize:10,fill:'var(--gray-400)'}} tickFormatter={v=>`${Number(v).toFixed(0)}%`} axisLine={false} tickLine={false} domain={[0,100]} />
                  <Tooltip formatter={(v) => [`${Number(v).toFixed(1)}%`, 'Survival']} contentStyle={{fontSize:11,borderRadius:8,border:'1px solid var(--border-color)'}} labelFormatter={v=>`Day ${v}`} />
                  <Area type="monotone" dataKey="s" stroke="var(--crimson)" strokeWidth={2.5} fill="url(#survGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Item 5: RM Copilot — on-demand, slide-in chat panel [LLM:1 per turn] */}
      <RMCopilotPanel
        customerId={c.customer_id}
        customerName={c.full_name}
      />
    </div>
  );
}
