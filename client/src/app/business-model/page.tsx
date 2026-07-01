'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Briefcase,
  IndianRupee,
  TrendingUp,
  Globe,
  Target,
  Building2,
  Shield,
  Users,
  DollarSign,
  Server,
  Zap,
  Code2,
  BarChart3,
  Layers,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
  BookOpen,
  Database,
  Cloud,
  ChevronRight,
} from 'lucide-react';

const TOC = [
  { id: 'the-problem',            label: 'The Problem' },
  { id: 'the-product',            label: 'The Product' },
  { id: 'market-landscape',       label: 'Market Landscape' },
  { id: 'market-sizing',          label: 'Market Sizing' },
  { id: 'competitive-analysis',   label: 'Competitive Analysis' },
  { id: 'business-model-pricing', label: 'Business Model & Pricing' },
  { id: 'financial-model-cost',   label: 'Cost to Deploy' },
  { id: 'financial-model-value',  label: 'Value Created' },
  { id: 'go-to-market',           label: 'Go-to-Market' },
];

const NAV_SECTIONS = TOC.map(s => s.id);

const EXEC_KPIS = [
  { label: 'Global TAM (2024)',         value: '$4.5–5B' },
  { label: 'Global TAM (2030)',         value: '$12–15B' },
  { label: 'India SAM (2025)',          value: '$35–50M' },
  { label: 'India SAM (2030)',          value: '$130–200M' },
  { label: 'SOM Year 3 ARR',            value: '~$4.7M' },
  { label: 'SOM Year 5 ARR',            value: '~$14.5M' },
  { label: 'Annual value to mid-PSU',   value: '₹128.2 Cr', highlight: true },
  { label: 'PCOP annual cost',          value: '₹6–10.2 Cr', highlight: true },
  { label: 'ROI at full deployment',    value: '11.6x', highlight: true },
  { label: 'Immediate funding ask',     value: '₹2–3 Cr seed', highlight: true },
];

const CRM_LAYERS = [
  { layer: 'Core Banking (CBS)',    vendor: 'Finacle · FLEXCUBE · BaNCS',     cost: '₹16–33 Cr/yr', missing: 'No proactive outreach, no churn prediction' },
  { layer: 'CRM / RM Tool',         vendor: 'CRMNEXT · Finacle CRM',           cost: '₹3–10 Cr/yr',  missing: 'Records interactions, does not predict who will leave' },
  { layer: 'Campaign / Outreach',   vendor: 'MoEngage · Netcore · Capillary',  cost: '₹1–3 Cr/yr',   missing: 'Batch campaigns only — no individual signal detection' },
  { layer: 'Analytics / BI',        vendor: 'SAS · Power BI · Tableau',         cost: '₹1–3 Cr/yr',   missing: 'Descriptive — tells you what happened, not what to do' },
  { layer: 'Call Centre',           vendor: 'Genesys · Avaya',                  cost: '₹2–5 Cr/yr',   missing: 'Reactive — customer must call in' },
];

const PRODUCT_LAYERS = [
  { layer: '1 — Source',     module: 'Finacle CBS Connector',  fn: 'Daily delta pull: salary credits, transaction frequency drops, complaint counts, inactivity streaks' },
  { layer: '2 — Detection',  module: 'ARGUS',                   fn: 'CUSUM/BOCPD change-point detection. Flags risk 60–90 days before churn' },
  { layer: '3 — Prediction', module: 'CHRONOS',                 fn: 'ML ensemble churn score + survival timing. TARE AUC 0.846, HABITAT AUC 0.88' },
  { layer: '4 — Decision',   module: 'COMPASS',                 fn: 'Agentic, tool-calling (LangGraph) next-best-action engine — offer, channel, timing' },
  { layer: '5 — Outreach',   module: 'HERALD',                  fn: 'LLM-generated, compliance-gated personalised content (Azure OpenAI, Central India)' },
  { layer: '6 — Proof',      module: 'VERDICT',                 fn: 'Causal uplift measurement — doubly-robust learner with holdout/control group' },
  { layer: 'Cross-Sell',     module: 'GraphSAGE',               fn: 'Graph neural network for peer-signal-based cross-sell recommendations' },
  { layer: 'Dest',           module: 'CRMNEXT / Bank BI',       fn: 'Recommendations pushed as approvable RM tasks; VERDICT exposed via API into Power BI/SAS' },
];

const INTEGRATION_POINTS = [
  { tag: 'A', src: 'Finacle CBS', dst: 'ARGUS',  desc: 'Daily delta pull. No real-time CBS access required in pilot phase.' },
  { tag: 'B', src: 'COMPASS',     dst: 'CRMNEXT', desc: 'Recommendation appears as an approvable RM task in the existing CRM.' },
  { tag: 'C', src: 'VERDICT',     dst: 'Bank Analytics', desc: 'Causal uplift exposed as an API into the bank\'s existing BI tools (Power BI / SAS).' },
];

const SAM_TABLE = [
  { m: 'Global TAM (2024)',                  c: '$2.5B',  mid: '$4.5B',  o: '$5.5B' },
  { m: 'Global TAM (2030)',                  c: '$8B',    mid: '$12B',   o: '$17B' },
  { m: 'India SAM — total AI spend (2025)',  c: '$250M',  mid: '$350M',  o: '$450M' },
  { m: 'India SAM — software licenses 2025',c: '$17M',   mid: '$35M',   o: '$55M' },
  { m: 'India SAM — software licenses 2030',c: '$80M',   mid: '$130M',  o: '$200M' },
  { m: 'SOM Year 3 ARR',                     c: '$3M',    mid: '$4.7M',  o: '$7M' },
  { m: 'SOM Year 5 ARR',                     c: '$8M',    mid: '$14.5M', o: '$22M' },
];

const PRICING = [
  { tier: 'Small SFB / Mid PSB',  rms: '50–100',  inr: '₹1–2 Cr',   usd: '$120K–240K',   accent: 'copper' },
  { tier: 'Mid PVB / Large PSB',  rms: '100–300', inr: '₹2–5 Cr',   usd: '$240K–600K',   accent: 'crimson' },
  { tier: 'Large PVB',            rms: '300–1K',  inr: '₹5–15 Cr',  usd: '$600K–1.8M',   accent: 'copper' },
];

const COST_TCO = [
  { c: 'Azure infra (with reservations)',  y1: '₹70L',  y2: '₹65L',  t: '₹3.3 Cr' },
  { c: 'Setup / integration',              y1: '₹2 Cr', y2: '₹0',    t: '₹2 Cr' },
  { c: 'External APIs (LLM, SMS, Email)',  y1: '₹50L',  y2: '₹45L',  t: '₹2.3 Cr' },
  { c: 'People (3 FTE)',                   y1: '₹60L',  y2: '₹55L',  t: '₹2.8 Cr' },
];

const CHURN_TIERS = [
  { tier: 'HNW (>₹10L)',          cust: '8L',   churn: '80,000',  detected: '28,000', saved: '1,680',  ltv: '₹1,40,000',  revenue: '₹23.5 Cr' },
  { tier: 'Premium (₹1L–10L)',    cust: '45L',  churn: '4,50,000',detected: '1,57,500',saved: '9,450',  ltv: '₹56,000',    revenue: '₹52.9 Cr' },
  { tier: 'Mass (<₹1L)',          cust: '2 Cr', churn: '20L',     detected: '7L',      saved: '42,000', ltv: '₹18,300',    revenue: '₹76.9 Cr' },
];

const CROSS_SELL = [
  { p: 'Credit Card',     pool: '20L',  base: '5%', pcop: '7%',  won: '40,000', arpc: '₹2,400',  rev: '₹9.6 Cr' },
  { p: 'Personal Loan',   pool: '15L',  base: '3%', pcop: '5%',  won: '30,000', arpc: '₹8,000',  rev: '₹24.0 Cr' },
  { p: 'Life Insurance',  pool: '18L',  base: '4%', pcop: '6%',  won: '36,000', arpc: '₹3,200',  rev: '₹11.5 Cr' },
  { p: 'Mutual Fund SIP', pool: '20L',  base: '2%', pcop: '4%',  won: '40,000', arpc: '₹1,800',  rev: '₹7.2 Cr' },
  { p: 'FD Upgrade',      pool: '10L',  base: '6%', pcop: '8%',  won: '20,000', arpc: '₹4,500',  rev: '₹9.0 Cr' },
  { p: 'Home Loan',       pool: '5L',   base: '2%', pcop: '3%',  won: '5,000',  arpc: '₹35,000', rev: '₹17.5 Cr' },
];

const GTM_TIERS = [
  {
    tier: 'Tier 1 — Private Banks',
    accent: 'copper',
    banks: 'AU SFB, Bandhan, Federal, South Indian Bank, Karnataka Bank, City Union Bank, DCB, RBL',
    why: 'Decide in 6–12 months, feel churn pressure acutely, right-sized customer base (20–80L) for CHRONOS.',
    deal: '₹3–5 Cr/yr · 6–10 month cycle',
  },
  {
    tier: 'Tier 2 — Mid-Sized PSU Banks',
    accent: 'crimson',
    banks: 'Bank of Maharashtra, Punjab & Sind, UCO, IOB, Central Bank of India',
    why: 'The Union Bank iDEA relationship converts into a design-partner pilot. Winning one PSU unlocks the rest.',
    deal: '₹5–8 Cr/yr · 12–18 month cycle',
  },
  {
    tier: 'Tier 3 — Small Finance Banks',
    accent: 'copper',
    banks: 'Ujjivan SFB, Jana SFB, ESAF SFB, Suryoday SFB',
    why: 'SFBs raise AI spend fastest. Retaining microfinance customers graduating into full banking is exactly what PCOP solves.',
    deal: '₹2–4 Cr/yr · 8–12 month cycle',
  },
];

const AVOID = [
  { bank: 'SBI, PNB, BoB, Canara',  why: 'Too large — will build in-house or demand enterprise customisation beyond current capacity' },
  { bank: 'HDFC, ICICI, Axis',      why: 'Already have mature in-house AI teams; will build or acquire rather than buy' },
  { bank: 'Urban Co-op Banks',      why: 'Economics do not work — 5K–20K customers earn less than PCOP licence fee' },
  { bank: 'NBFCs',                  why: 'Not banks — no Finacle/CBS integration path, different regulatory framework' },
  { bank: 'Payment banks',          why: 'No lending products — no LTV to protect, nothing for COMPASS cross-sell' },
];

export default function BusinessModelPage() {
  const [activeId, setActiveId] = useState('the-problem');

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0.1 }
    );

    for (const id of NAV_SECTIONS) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const jump = (id: string) => {
        const el = document.getElementById(id);
        if (!el) return;
        const NAV_OFFSET = 56;
        const top = el.getBoundingClientRect().top + window.scrollY - NAV_OFFSET;
        window.scrollTo({ top, behavior: 'smooth' });
      };
      if (e.key === 'c' || e.key === 'C') jump('competitive-analysis');
      else if (e.key === 'g' || e.key === 'G') jump('go-to-market');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="min-h-screen bg-cream text-charcoal">

      {/* ── STICKY NAV ─────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-soft">
        <div className="max-w-7xl mx-auto px-6 h-12 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-[13px] font-bold text-charcoal hover:text-crimson transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
          <div className="hidden lg:flex items-center gap-5 overflow-x-auto scrollbar-none">
            {TOC.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className={`text-[11px] whitespace-nowrap transition-colors ${
                  activeId === s.id
                    ? 'text-crimson font-bold'
                    : 'text-gray-500 hover:text-charcoal'
                }`}
              >
                {s.label}
              </a>
            ))}
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 lg:px-24 py-16">

        {/* ── HEADER ──────────────────────────────────────────────────── */}
        <div className="mb-16 animate-fade-up">
          <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-md text-crimson text-[10px] font-bold uppercase tracking-widest bg-crimson-soft border border-crimson">
            <Briefcase className="w-3 h-3" />
            Business Model · For Hackathon Judges
          </div>
          <h1 className="text-[32px] lg:text-[44px] font-heading font-bold text-charcoal mb-3 leading-[1.05]" style={{ letterSpacing: '-0.03em' }}>
            Predictive Customer Outreach Platform
          </h1>
          <p className="text-[16px] font-heading font-semibold text-copper mb-2">Causal AI for Indian Retail Banking — Business & Financial Pitch</p>
          <p className="text-[13px] text-gray-500">
            Team MoneyLords · IIT Guwahati · Union Bank of India iDEA 2.0 Hackathon (PS-3) · July 2026
          </p>
        </div>

        {/* ── SECTION 1: EXECUTIVE SUMMARY ─────────────────────────────── */}
        <section id="executive-summary" className="mb-20 animate-fade-up delay-100">
          <SectionHeader num="01" title="Executive Summary" />
          <p className="text-[14px] text-gray-600 leading-relaxed mb-8">
            PCOP (Predictive Customer Outreach Platform) is a causal, AI-driven customer retention and cross-sell
            intelligence layer purpose-built for Indian retail banks. It sits on top of a bank's existing Core Banking
            System (Finacle, FLEXCUBE, BaNCS) and CRM (CRMNEXT, Finacle CRM) — reading transactional signals,
            predicting churn 60–90 days in advance, recommending the next-best-action, generating personalised outreach
            content, and proving causal impact through a holdout-group methodology.
          </p>

          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">Key numbers at a glance</p>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 mb-8">
            {EXEC_KPIS.map((k) => (
              <div
                key={k.label}
                className={`p-3 rounded-md border text-center ${
                  k.highlight
                    ? 'border-crimson/30 bg-crimson/[0.04]'
                    : 'border-soft bg-white'
                }`}
              >
                <p className={`text-[15px] font-black font-heading tabular-nums ${
                  k.highlight ? 'text-crimson' : 'text-charcoal'
                }`}>{k.value}</p>
                <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mt-1">{k.label}</p>
              </div>
            ))}
          </div>

          <Callout tone="crimson" border="crimson">
            <strong className="text-charcoal">The one-line thesis:</strong> Indian banks already spend ₹23–54 Cr/year
            on CRM software that is purely descriptive — it records what happened. PCOP adds the one layer none of
            them have: causal, proactive intelligence that predicts what is about to happen and acts on it, with
            statistically defensible proof that it worked.
          </Callout>
        </section>

        {/* ── SECTION 2: THE PROBLEM ─────────────────────────────────────── */}
        <section id="the-problem" className="mb-20 animate-fade-up delay-200">
          <SectionHeader num="02" title="The Problem" />

          <div className="grid lg:grid-cols-2 gap-4 mb-6">
            <div className="p-5 rounded-md border border-soft bg-white">
              <h3 className="text-[14px] font-bold text-charcoal font-heading mb-2">2.1 — Churn is expensive and invisible until it is too late</h3>
              <p className="text-[12px] text-gray-500 leading-relaxed">
                World Bank Global Findex data (2025) shows roughly <strong className="text-charcoal">16% account inactivity</strong> in
                Indian banking, well above the 4% average for low- and middle-income countries elsewhere. Existing systems
                (CBS, CRM, call centre tools) are all reactive: they record a customer's departure after the fact. None
                of the dominant Indian banking software — Finacle, FLEXCUBE, BaNCS, CRMNEXT, MoEngage, Genesys —
                performs individual-level early-warning detection or proves causal retention impact.
              </p>
            </div>
            <div className="p-5 rounded-md border border-soft bg-white">
              <h3 className="text-[14px] font-bold text-charcoal font-heading mb-2">2.2 — Cross-sell is left to chance</h3>
              <p className="text-[12px] text-gray-500 leading-relaxed">
                The average PSU bank customer holds only <strong className="text-charcoal">1.8 products</strong>; a well-engaged
                customer holds 3.5+. Banks have the transaction data to know which customer needs a credit card,
                personal loan, or insurance policy next — but no system connects life-event signals (marriage, salary
                jump, home purchase) or peer-behaviour patterns to a personalised, timed offer.
              </p>
            </div>
          </div>

          <h3 className="text-[14px] font-bold text-charcoal font-heading mb-3">2.3 — Existing CRM stack is fragmented and purely descriptive</h3>
          <div className="overflow-x-auto rounded-md border border-soft">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-cream border-b border-soft">
                  <th className="text-left px-4 py-3 font-bold text-charcoal">CRM Layer</th>
                  <th className="text-left px-4 py-3 font-bold text-charcoal">Dominant Vendor</th>
                  <th className="text-right px-4 py-3 font-bold text-charcoal">Annual Cost (Mid-PSU)</th>
                  <th className="text-left px-4 py-3 font-bold text-charcoal">What It Does NOT Do</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-soft">
                {CRM_LAYERS.map((r) => (
                  <tr key={r.layer} className="bg-white hover:bg-cream transition-colors">
                    <td className="px-4 py-3 font-bold text-charcoal">{r.layer}</td>
                    <td className="px-4 py-3 text-gray-500">{r.vendor}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-500">{r.cost}</td>
                    <td className="px-4 py-3 text-crimson text-[10px]">{r.missing}</td>
                  </tr>
                ))}
                <tr className="bg-crimson/[0.04] border-t-2 border-crimson">
                  <td className="px-4 py-3 font-bold text-charcoal">Total CRM ecosystem spend</td>
                  <td className="px-4 py-3 text-gray-500">—</td>
                  <td className="px-4 py-3 text-right font-bold text-crimson tabular-nums">₹23–54 Cr/yr</td>
                  <td className="px-4 py-3 text-crimson text-[10px] font-bold">Zero causal retention intelligence, zero early-warning system, zero automated personalised outreach</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* ── SECTION 3: THE PRODUCT ─────────────────────────────────────── */}
        <section id="the-product" className="mb-20 animate-fade-up delay-300">
          <SectionHeader num="03" title="The Product — Architecture & Modules" />

          <div className="overflow-x-auto rounded-md border border-soft mb-6">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-cream border-b border-soft">
                  <th className="text-left px-4 py-3 font-bold text-charcoal w-[110px]">Layer</th>
                  <th className="text-left px-4 py-3 font-bold text-charcoal w-[150px]">Module</th>
                  <th className="text-left px-4 py-3 font-bold text-charcoal">Function</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-soft">
                {PRODUCT_LAYERS.map((r) => (
                  <tr key={r.module} className="bg-white hover:bg-cream transition-colors">
                    <td className="px-4 py-3 text-[10px] font-bold text-copper uppercase tracking-wider">{r.layer}</td>
                    <td className="px-4 py-3 font-bold text-charcoal">{r.module}</td>
                    <td className="px-4 py-3 text-gray-500">{r.fn}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid lg:grid-cols-3 gap-4 mb-6">
            <div className="p-5 rounded-md border border-soft bg-white">
              <h3 className="text-[13px] font-bold text-charcoal font-heading mb-2 flex items-center gap-2">
                <Shield className="w-4 h-4 text-copper" />
                Integration Philosophy
              </h3>
              <p className="text-[12px] text-gray-500 leading-relaxed">
                "Reads from CBS, pushes to CRM, proves via VERDICT." PCOP does not replace any existing system. It sits
                between data sources and the RM-facing CRM. Politically viable in cautious PSU bank IT — looks like an
                add-on, not a migration.
              </p>
            </div>
            <div className="p-5 rounded-md border border-soft bg-white">
              <h3 className="text-[13px] font-bold text-charcoal font-heading mb-2 flex items-center gap-2">
                <Users className="w-4 h-4 text-copper" />
                Human-in-the-Loop
              </h3>
              <p className="text-[12px] text-gray-500 leading-relaxed">
                Every recommendation requires RM approval before any action is taken. Aligned with RBI's AI governance
                guidance, and a genuine differentiator versus competitors who treat this as optional.
              </p>
            </div>
            <div className="p-5 rounded-md border border-soft bg-white">
              <h3 className="text-[13px] font-bold text-charcoal font-heading mb-2 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-copper" />
                Compliance by Design
              </h3>
              <p className="text-[12px] text-gray-500 leading-relaxed">
                DPDPA, TRAI, and RBI outsourcing/data-localization norms are mapped directly into the product. All LLM
                inference on Azure OpenAI in Central India (Pune) — no customer data leaves India.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-md bg-copper-soft border border-copper/30 text-[12px] text-gray-600 leading-relaxed">
            <strong className="text-charcoal">Technical stack:</strong> Node.js/Express API gateway, Python/FastAPI microservices,
            Postgres + Redis, Kafka event backbone, Next.js frontend, BullMQ job queue, Twilio (SMS), Resend (email),
            Azure OpenAI (LLM inference, India-resident).
          </div>
        </section>

        {/* ── SECTION 4: MARKET LANDSCAPE ────────────────────────────────── */}
        <section id="market-landscape" className="mb-20 animate-fade-up delay-400">
          <SectionHeader num="04" title="Market Landscape — Where PCOP Sits" />

          <h3 className="text-[14px] font-bold text-charcoal font-heading mb-3">4.1 — Integration Architecture</h3>
          <div className="p-6 rounded-md border border-soft bg-white mb-6">
            <p className="text-[11px] text-center text-gray-600 leading-loose">
              <span className="font-bold text-copper">Finacle CBS</span>
              <span className="text-gray-400 mx-2">→</span>
              <span className="font-bold text-crimson">ARGUS</span>
              <span className="text-gray-400 mx-2">→</span>
              <span className="font-bold text-charcoal">CHRONOS</span>
              <span className="text-gray-400 mx-2">→</span>
              <span className="font-bold text-copper">COMPASS</span>
              <span className="text-gray-400 mx-2">→</span>
              <span className="font-bold text-crimson">HERALD</span>
              <span className="text-gray-400 mx-2">→</span>
              <span className="font-bold text-charcoal">RM Dashboard (CRMNEXT)</span>
            </p>
            <p className="text-[10px] text-center text-gray-400 mt-2">
              (source → detect → predict → decide → outreach → RM approves)
            </p>
            <p className="text-[11px] text-center text-gray-600 mt-4">
              <span className="text-gray-400">↓</span><br />
              <span className="font-bold text-charcoal">VERDICT</span> → Bank BI/Analytics
              <span className="text-gray-400"> &nbsp; (causal proof, exposed via API)</span>
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-4 mb-6">
            {INTEGRATION_POINTS.map((p) => (
              <div key={p.tag} className="p-4 rounded-md border border-soft bg-white">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-6 h-6 rounded-md bg-crimson text-white flex items-center justify-center text-[10px] font-black">{p.tag}</span>
                  <p className="text-[10px] font-bold text-copper uppercase tracking-widest">Integration Point</p>
                </div>
                <p className="text-[12px] font-bold text-charcoal mb-1">{p.src} → {p.dst}</p>
                <p className="text-[11px] text-gray-500">{p.desc}</p>
              </div>
            ))}
          </div>

          <Callout tone="copper" border="copper">
            <strong className="text-charcoal">4.2 — Why banks will adopt this without a "rip and replace" conversation:</strong> A bank's
            IT team sees PCOP as a new module layered on top of infrastructure they already run and trust — not a system
            migration. This dramatically shortens procurement friction versus competing products that ask a bank to
            replace its CRM outright.
          </Callout>
        </section>

        {/* ── SECTION 5: MARKET SIZING ───────────────────────────────────── */}
        <section id="market-sizing" className="mb-20 animate-fade-up delay-500">
          <SectionHeader num="05" title="Market Sizing — TAM / SAM / SOM" />

          <div className="grid lg:grid-cols-3 gap-4 mb-6">
            <div className="p-5 rounded-md border border-soft bg-white">
              <div className="flex items-center gap-2 mb-3">
                <Globe className="w-4 h-4 text-crimson" />
                <h3 className="text-[14px] font-bold text-charcoal font-heading">TAM</h3>
              </div>
              <p className="text-[11px] text-gray-500 leading-relaxed mb-2">
                <strong className="text-charcoal">Top-down:</strong> IDC (Aug 2024) shows banking committed ~$31.3B in AI
                investment in 2024. 15% allocation to customer retention/cross-sell analytics → ~$4.7B. Cross-checked
                against IMARC ($5.2B), Straits ($3.63B), GrowthMarket ($8.9B) averaging ~$5.9B.
              </p>
              <p className="text-[11px] text-gray-500 leading-relaxed mb-2">
                <strong className="text-charcoal">Bottom-up:</strong> 5,000–7,000 banking institutions globally hold assets
                exceeding $1B. Blended ACV $500K × 5,000 → $2.5B; 7,000 × $700K → $4.9B.
              </p>
              <p className="text-[12px] font-black text-crimson font-heading">$4.5–5B (2024) → $12–15B (2030)</p>
            </div>
            <div className="p-5 rounded-md border border-soft bg-white">
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-4 h-4 text-copper" />
                <h3 className="text-[14px] font-bold text-charcoal font-heading">SAM (India)</h3>
              </div>
              <p className="text-[11px] text-gray-500 leading-relaxed mb-2">
                <strong className="text-charcoal">Top-down:</strong> India AI & Automation in Banking $2.05B (2025) → $16.05B
                by 2033 (Grand View Research). 15–20% to customer analytics → $307–410M in 2025.
              </p>
              <p className="text-[11px] text-gray-500 leading-relaxed mb-2">
                <strong className="text-charcoal">Bottom-up:</strong> 45 target institutions (33 PSBs + PVBs + 12 SFBs).
                Weighted ACV ~$380K → $17.1M theoretical max license revenue.
              </p>
              <p className="text-[12px] font-black text-crimson font-heading">$35–50M (2025) → $130–200M (2030)</p>
            </div>
            <div className="p-5 rounded-md border border-soft bg-white">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-crimson" />
                <h3 className="text-[14px] font-bold text-charcoal font-heading">SOM (5-yr)</h3>
              </div>
              <p className="text-[11px] text-gray-500 leading-relaxed mb-2">
                <strong className="text-charcoal">Assumptions:</strong> 9–18 month sales cycle, 25% win rate, 6-person founding
                team running 10–15 opportunities. NRR 110–115% from Year 2. Annual churn 5%.
              </p>
              <div className="space-y-1 mt-3">
                {[
                  { y: 'Y1', arr: '$360K',    note: '3 pilots' },
                  { y: 'Y2', arr: '$1.76M',   note: '8 banks' },
                  { y: 'Y3', arr: '$4.7M',    note: '15–16' },
                  { y: 'Y4', arr: '$8.5M',    note: '25' },
                  { y: 'Y5', arr: '$14.5M',   note: '35–40 + SE Asia' },
                ].map((r) => (
                  <div key={r.y} className="flex items-center justify-between text-[10px]">
                    <span className="font-bold text-charcoal">{r.y}</span>
                    <span className="font-black text-crimson font-heading tabular-nums">{r.arr}</span>
                    <span className="text-gray-400">{r.note}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-md border border-soft">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-cream border-b border-soft">
                  <th className="text-left px-4 py-3 font-bold text-charcoal">Metric</th>
                  <th className="text-right px-4 py-3 font-bold text-charcoal">Conservative</th>
                  <th className="text-right px-4 py-3 font-bold text-crimson">Central</th>
                  <th className="text-right px-4 py-3 font-bold text-charcoal">Optimistic</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-soft">
                {SAM_TABLE.map((r) => (
                  <tr key={r.m} className="bg-white hover:bg-cream transition-colors">
                    <td className="px-4 py-3 font-bold text-charcoal">{r.m}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-500">{r.c}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-bold text-crimson">{r.mid}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-500">{r.o}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── SECTION 6: COMPETITIVE ANALYSIS ─────────────────────────────── */}
        <section id="competitive-analysis" className="mb-20 animate-fade-up delay-600">
          <SectionHeader num="06" title="Competitive Analysis" />

          <div className="overflow-x-auto rounded-md border border-soft mb-6">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="bg-cream border-b border-soft">
                  <th className="text-left px-3 py-3 font-bold text-charcoal">Capability</th>
                  <th className="text-center px-3 py-3 font-bold text-crimson">PCOP</th>
                  <th className="text-center px-3 py-3 font-bold text-charcoal">Salesforce FSC</th>
                  <th className="text-center px-3 py-3 font-bold text-charcoal">Pega CDH</th>
                  <th className="text-center px-3 py-3 font-bold text-charcoal">CRMNEXT</th>
                  <th className="text-center px-3 py-3 font-bold text-charcoal">Kumo.ai</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-soft">
                {[
                  { c: 'Early-warning detection (60–90d)', p: 'ARGUS',          s: 'No',  pe: 'No',  cr: 'No',  k: 'Limited' },
                  { c: 'Causal uplift proof',              p: 'Doubly-robust',  s: 'No',  pe: 'No',  cr: 'No',  k: 'No' },
                  { c: 'Agentic next-best-action',         p: 'COMPASS',        s: 'Einstein', pe: 'Pega',  cr: 'Basic',  k: 'No' },
                  { c: 'LLM-generated outreach',           p: 'HERALD',         s: 'Einstein GPT', pe: 'Limited', cr: 'No', k: 'No' },
                  { c: 'DPDPA / TRAI / RBI compliance',    p: 'Built in',       s: 'Configurable', pe: 'Configurable', cr: 'Partial', k: 'No' },
                  { c: 'India-only data residency',        p: 'Azure Central',  s: 'Config', pe: 'Config', cr: 'On-prem', k: 'No' },
                  { c: 'Graph-based peer cross-sell',      p: 'GraphSAGE',      s: 'No',  pe: 'No',  cr: 'No',  k: 'Core' },
                  { c: 'Human-in-loop (RBI AI governance)',p: 'Mandatory',      s: 'Optional', pe: 'Optional', cr: 'Optional', k: 'No' },
                  { c: 'India-first pricing',              p: 'Built for India',s: 'Global', pe: 'Global', cr: 'India-first', k: 'Global' },
                ].map((r) => (
                  <tr key={r.c} className="bg-white hover:bg-cream transition-colors">
                    <td className="px-3 py-2.5 font-bold text-charcoal">{r.c}</td>
                    <td className="px-3 py-2.5 text-center text-crimson font-bold">{r.p}</td>
                    <td className="px-3 py-2.5 text-center text-gray-500">{r.s}</td>
                    <td className="px-3 py-2.5 text-center text-gray-500">{r.pe}</td>
                    <td className="px-3 py-2.5 text-center text-gray-500">{r.cr}</td>
                    <td className="px-3 py-2.5 text-center text-gray-500">{r.k}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="p-5 rounded-md border border-crimson/30 bg-crimson/[0.04]">
              <h3 className="text-[13px] font-bold text-crimson font-heading mb-2">Positioning Statement</h3>
              <p className="text-[12px] text-gray-600 leading-relaxed">
                Plotting "proactive + causal" against "India-first + compliance-native," every global incumbent clusters
                in one corner. PCOP occupies the empty quadrant — verified by reading each competitor's product sheet and
                documenting the absence of causal proof and India-specific compliance mapping.
              </p>
            </div>
            <div className="p-5 rounded-md border border-soft bg-white">
              <h3 className="text-[13px] font-bold text-charcoal font-heading mb-2">Market Context</h3>
              <p className="text-[12px] text-gray-500 leading-relaxed">
                Global banking CRM market is <strong className="text-charcoal">$18.1B (2025)</strong>, growing at 17.4% CAGR
                through 2029 — the fastest-growing enterprise software segment globally. India's addressable Phase 1
                opportunity within this is $50–150M, serviceable with 3–5 anchor banks in Years 1–2.
              </p>
            </div>
          </div>
        </section>

        {/* ── SECTION 7: BUSINESS MODEL & PRICING ────────────────────────── */}
        <section id="business-model-pricing" className="mb-20 animate-fade-up delay-700">
          <SectionHeader num="07" title="Business Model & Pricing" />

          <h3 className="text-[14px] font-bold text-charcoal font-heading mb-3">7.1 — Pricing Tiers (by RM headcount / bank size)</h3>
          <div className="overflow-x-auto rounded-md border border-soft mb-6">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-cream border-b border-soft">
                  <th className="text-left px-4 py-3 font-bold text-charcoal">Bank Tier</th>
                  <th className="text-right px-4 py-3 font-bold text-charcoal">RM Count</th>
                  <th className="text-right px-4 py-3 font-bold text-charcoal">Annual Price (₹)</th>
                  <th className="text-right px-4 py-3 font-bold text-charcoal">Annual Price (USD)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-soft">
                {PRICING.map((p) => (
                  <tr key={p.tier} className="bg-white hover:bg-cream transition-colors">
                    <td className="px-4 py-3 font-bold text-charcoal">{p.tier}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-500">{p.rms}</td>
                    <td className="px-4 py-3 text-right font-bold text-crimson tabular-nums">{p.inr}</td>
                    <td className="px-4 py-3 text-right text-gray-500 tabular-nums">{p.usd}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="text-[14px] font-bold text-charcoal font-heading mb-3">7.2 — Revenue Structure</h3>
          <div className="grid lg:grid-cols-2 gap-4 mb-6">
            <div className="p-5 rounded-md border border-soft bg-white">
              <ul className="text-[12px] text-gray-600 space-y-3">
                <li>
                  <strong className="text-charcoal">Licence fee</strong> (core retention module — ARGUS/CHRONOS/COMPASS/HERALD/VERDICT) — primary ACV driver
                </li>
                <li>
                  <strong className="text-charcoal">Setup / integration fee</strong> (one-time, ₹1.6–2.6 Cr for mid-PSU): Finacle API integration, signal mapping, model retraining, security audit, RBI compliance docs, UAT, training
                </li>
                <li>
                  <strong className="text-charcoal">Module upsell</strong> from Year 2: NEXUS (cross-sell), ARGUS extensions (fraud/complaint) — drives 110–115% NRR
                </li>
                <li>
                  <strong className="text-charcoal">90-day paid pilots</strong> at ~$120K / ₹1 Cr — standard practice to bypass full capex approval cycles in Indian banking procurement
                </li>
              </ul>
            </div>
            <div className="p-5 rounded-md border border-copper/30 bg-copper/[0.04]">
              <h3 className="text-[13px] font-bold text-copper font-heading mb-3">7.3 — Unit Economics (mid-PSU bank, steady state)</h3>
              <div className="space-y-2">
                <Row label="Licence revenue"            value="₹6 Cr/yr" />
                <Row label="Cost to deliver"            value="₹1.65 Cr/yr" />
                <Row label="Gross margin (steady state)" value="72%" highlight />
                <Row label="Year 1 margin (w/ setup)"   value="37%" muted />
              </div>
            </div>
          </div>
        </section>

        {/* ── SECTION 8: COST TO DEPLOY ──────────────────────────────────── */}
        <section id="financial-model-cost" className="mb-20 animate-fade-up delay-800">
          <SectionHeader num="08" title="Financial Model — Cost to Deploy" />

          <div className="p-4 rounded-md bg-copper-soft border border-copper/30 text-[12px] text-gray-600 leading-relaxed mb-6">
            <strong className="text-charcoal">Deployment stack:</strong> Azure Kubernetes Service (AKS) running all 8 PCOP
            microservices, primary region Central India (Pune), DR in South India (Chennai). Chosen over AWS primarily
            because most PSU banks already hold Microsoft Enterprise Agreements — dramatically simplifying procurement.
          </div>

          <div className="grid lg:grid-cols-3 gap-4 mb-6">
            <KpiCard icon={Server}  label="Annual Azure infra"   value="₹90.6L"  sub="With 1-yr reservations → ₹65–70L/yr" />
            <KpiCard icon={Cloud}   label="One-time setup"       value="₹1.6–2.6 Cr" sub="Finacle integration is largest line item" />
            <KpiCard icon={Zap}     label="External APIs"        value="₹34–63L/yr" sub="LLM (Azure), SMS (Twilio), Email (Resend)" />
          </div>

          <h3 className="text-[14px] font-bold text-charcoal font-heading mb-3">5-Year Total Cost of Ownership (per mid-PSU bank deployment)</h3>
          <div className="overflow-x-auto rounded-md border border-soft">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-cream border-b border-soft">
                  <th className="text-left px-4 py-3 font-bold text-charcoal">Category</th>
                  <th className="text-right px-4 py-3 font-bold text-charcoal">Year 1</th>
                  <th className="text-right px-4 py-3 font-bold text-charcoal">Years 2–5 (each)</th>
                  <th className="text-right px-4 py-3 font-bold text-charcoal">5-Year Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-soft">
                {COST_TCO.map((r) => (
                  <tr key={r.c} className="bg-white hover:bg-cream transition-colors">
                    <td className="px-4 py-3 font-bold text-charcoal">{r.c}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-500">{r.y1}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-500">{r.y2}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-500">{r.t}</td>
                  </tr>
                ))}
                <tr className="bg-cream border-t-2 border-crimson">
                  <td className="px-4 py-3 font-bold text-charcoal">Total cost to deliver</td>
                  <td className="px-4 py-3 text-right font-bold text-crimson tabular-nums">₹3.8 Cr</td>
                  <td className="px-4 py-3 text-right font-bold text-crimson tabular-nums">₹1.65 Cr</td>
                  <td className="px-4 py-3 text-right font-bold text-crimson tabular-nums">₹10.4 Cr</td>
                </tr>
                <tr className="bg-cream">
                  <td className="px-4 py-3 font-bold text-charcoal">Revenue from bank</td>
                  <td className="px-4 py-3 text-right font-bold text-charcoal tabular-nums">₹6 Cr</td>
                  <td className="px-4 py-3 text-right font-bold text-charcoal tabular-nums">₹6 Cr</td>
                  <td className="px-4 py-3 text-right font-bold text-charcoal tabular-nums">₹30 Cr</td>
                </tr>
                <tr className="bg-copper-soft">
                  <td className="px-4 py-3 font-bold text-charcoal">Gross margin</td>
                  <td className="px-4 py-3 text-right font-bold text-copper tabular-nums">₹2.2 Cr (37%)</td>
                  <td className="px-4 py-3 text-right font-bold text-copper tabular-nums">₹4.35 Cr (72%)</td>
                  <td className="px-4 py-3 text-right font-bold text-copper tabular-nums">₹19.6 Cr (65%)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* ── SECTION 9: VALUE CREATED ──────────────────────────────────── */}
        <section id="financial-model-value" className="mb-20 animate-fade-up delay-900">
          <SectionHeader num="09" title="Financial Model — Value Created (Union Bank Case Study)" />

          <div className="p-4 rounded-md bg-copper-soft border border-copper/30 text-[12px] text-gray-600 leading-relaxed mb-6">
            <strong className="text-charcoal">Real inputs:</strong> Union Bank of India FY2025 actuals — net profit
            ₹19,430 Cr, total deposits ₹13.1 lakh Cr, 8,600+ branches, 74,600+ employees. Active retail base estimated
            at 2.5 crore.
          </div>

          <h3 className="text-[14px] font-bold text-charcoal font-heading mb-3">9.1 — Churn Savings</h3>
          <div className="overflow-x-auto rounded-md border border-soft mb-6">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="bg-cream border-b border-soft">
                  <th className="text-left px-3 py-3 font-bold text-charcoal">Tier</th>
                  <th className="text-right px-3 py-3 font-bold text-charcoal">Active</th>
                  <th className="text-right px-3 py-3 font-bold text-charcoal">Annual Churn (10%)</th>
                  <th className="text-right px-3 py-3 font-bold text-charcoal">ARGUS Detects (35%)</th>
                  <th className="text-right px-3 py-3 font-bold text-crimson">VERDICT Uplift (6%)</th>
                  <th className="text-right px-3 py-3 font-bold text-charcoal">LTV / Save</th>
                  <th className="text-right px-3 py-3 font-bold text-charcoal">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-soft">
                {CHURN_TIERS.map((r) => (
                  <tr key={r.tier} className="bg-white hover:bg-cream transition-colors">
                    <td className="px-3 py-2.5 font-bold text-charcoal">{r.tier}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-gray-500">{r.cust}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-gray-500">{r.churn}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-gray-500">{r.detected}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-bold text-crimson">{r.saved}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-gray-500">{r.ltv}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-bold text-charcoal">{r.revenue}</td>
                  </tr>
                ))}
                <tr className="bg-crimson/[0.04] border-t-2 border-crimson">
                  <td className="px-3 py-3 font-bold text-charcoal">TOTAL</td>
                  <td className="px-3 py-3 text-right font-bold text-charcoal tabular-nums">2.5 Cr</td>
                  <td className="px-3 py-3 text-right tabular-nums text-gray-500">25.3L/yr</td>
                  <td className="px-3 py-3 text-right tabular-nums text-gray-500">8.85L</td>
                  <td className="px-3 py-3 text-right font-bold text-crimson tabular-nums">53,130/yr</td>
                  <td className="px-3 py-3 text-right text-gray-400">—</td>
                  <td className="px-3 py-3 text-right font-black text-crimson tabular-nums">₹153.3 Cr LTV / ₹49.4 Cr Yr-1</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 className="text-[14px] font-bold text-charcoal font-heading mb-3">9.2 — Cross-Sell Revenue</h3>
          <div className="overflow-x-auto rounded-md border border-soft mb-6">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="bg-cream border-b border-soft">
                  <th className="text-left px-3 py-3 font-bold text-charcoal">Product</th>
                  <th className="text-right px-3 py-3 font-bold text-charcoal">Addressable</th>
                  <th className="text-right px-3 py-3 font-bold text-charcoal">Baseline</th>
                  <th className="text-right px-3 py-3 font-bold text-crimson">PCOP-Assisted</th>
                  <th className="text-right px-3 py-3 font-bold text-charcoal">New Customers</th>
                  <th className="text-right px-3 py-3 font-bold text-charcoal">ARPC</th>
                  <th className="text-right px-3 py-3 font-bold text-charcoal">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-soft">
                {CROSS_SELL.map((r) => (
                  <tr key={r.p} className="bg-white hover:bg-cream transition-colors">
                    <td className="px-3 py-2.5 font-bold text-charcoal">{r.p}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-gray-500">{r.pool}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-gray-500">{r.base}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-bold text-crimson">{r.pcop}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-gray-500">{r.won}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-gray-500">{r.arpc}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-bold text-charcoal">{r.rev}</td>
                  </tr>
                ))}
                <tr className="bg-crimson/[0.04] border-t-2 border-crimson">
                  <td className="px-3 py-3 font-bold text-charcoal">TOTAL CROSS-SELL</td>
                  <td className="px-3 py-3 text-gray-400">—</td>
                  <td className="px-3 py-3 text-gray-400">—</td>
                  <td className="px-3 py-3 text-gray-400">—</td>
                  <td className="px-3 py-3 text-right font-bold text-charcoal tabular-nums">1,71,000 new products</td>
                  <td className="px-3 py-3 text-gray-400">—</td>
                  <td className="px-3 py-3 text-right font-black text-crimson tabular-nums">₹78.8 Cr</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 className="text-[14px] font-bold text-charcoal font-heading mb-3">9.3 — Combined Annual P&L Impact</h3>
          <div className="grid lg:grid-cols-2 gap-4 mb-6">
            <div className="p-5 rounded-md border border-crimson/30 bg-crimson/[0.04]">
              <div className="space-y-2">
                <Row label="Churn savings (Year 1 revenue)"  value="₹49.4 Cr" />
                <Row label="Cross-sell revenue"               value="₹78.8 Cr" />
                <Row label="Total value created"              value="₹128.2 Cr" highlight />
                <Row label="PCOP total cost"                  value="₹10.2 Cr" />
                <Row label="Net profit to bank"               value="₹118 Cr"   highlight />
                <div className="pt-2 mt-2 border-t border-crimson/30 flex items-center justify-between">
                  <span className="text-[14px] font-bold text-charcoal font-heading">ROI</span>
                  <span className="text-[28px] font-black text-crimson font-heading tabular-nums">11.6x</span>
                </div>
                <p className="text-[9px] text-gray-400">PCOP licence as % of value generated: 4.7%</p>
              </div>
            </div>
            <div className="p-5 rounded-md border border-soft bg-white">
              <h3 className="text-[13px] font-bold text-charcoal font-heading mb-3">9.4 — Phased Ramp (Years 1–3)</h3>
              <div className="space-y-2">
                <Row label="Year 1 (40% — pilot, calibrating)"  value="₹41 Cr net" />
                <Row label="Year 2 (75% — scaled)"              value="₹88.5 Cr net" />
                <Row label="Year 3 (100% — full deployment)"    value="₹121.2 Cr net" />
                <div className="pt-2 mt-2 border-t border-soft flex items-center justify-between">
                  <span className="text-[11px] font-bold text-charcoal">3-year cumulative</span>
                  <span className="text-[16px] font-black text-crimson font-heading">₹250.7 Cr</span>
                </div>
              </div>
            </div>
          </div>

          <Callout tone="crimson" border="crimson">
            <p className="text-[13px] font-bold text-charcoal mb-2">9.5 — Honest caveats (worth stating in the pitch):</p>
            <ol className="list-decimal pl-5 space-y-1 text-[13px] text-gray-600 leading-relaxed">
              <li><strong className="text-charcoal">Churn savings are net of natural retainers</strong> — the 6% VERDICT uplift is causal, not a raw retention number. This is precisely why the holdout methodology is the biggest technical differentiator.</li>
              <li><strong className="text-charcoal">Cross-sell uplift (2%) is conservative</strong> — industry data shows 3–8% conversion uplift for AI-assisted personalised cross-sell; 2% was chosen because PSU bank customers are more conservative and PSU RMs less aggressive sellers.</li>
              <li><strong className="text-charcoal">The churn number uses annual revenue, not LTV</strong> — the LTV version is ₹153 Cr, technically valid but harder to defend in Year 1; ₹49.4 Cr is the defensible number for a first pitch.</li>
            </ol>
          </Callout>
        </section>

        {/* ── SECTION 10: GO-TO-MARKET ──────────────────────────────────── */}
        <section id="go-to-market" className="mb-20 animate-fade-up delay-1000">
          <SectionHeader num="10" title="Go-to-Market Strategy & Customer Segmentation" />

          <div className="grid lg:grid-cols-3 gap-4 mb-8">
            {GTM_TIERS.map((t) => (
              <div
                key={t.tier}
                className={`p-5 rounded-md border bg-white ${
                  t.accent === 'crimson' ? 'border-crimson/30' : 'border-copper/30'
                }`}
              >
                <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-[9px] font-bold uppercase tracking-widest mb-3 ${
                  t.accent === 'crimson' ? 'text-crimson bg-crimson-soft' : 'text-copper bg-copper-soft'
                }`}>
                  <Building2 className="w-3 h-3" />
                  {t.tier}
                </div>
                <p className="text-[11px] font-bold text-charcoal mb-2">{t.banks}</p>
                <p className="text-[11px] text-gray-500 leading-relaxed mb-3">{t.why}</p>
                <div className={`p-3 rounded-md text-[10px] leading-relaxed ${
                  t.accent === 'crimson' ? 'bg-crimson/[0.04] text-crimson' : 'bg-copper-soft text-copper'
                }`}>
                  {t.deal}
                </div>
              </div>
            ))}
          </div>

          <h3 className="text-[14px] font-bold text-charcoal font-heading mb-3">10.4 — What to Avoid at the Start</h3>
          <div className="grid lg:grid-cols-2 gap-3 mb-8">
            {AVOID.map((x) => (
              <div key={x.bank} className="flex items-start gap-3 p-4 rounded-md border border-soft bg-white">
                <AlertCircle className="w-4 h-4 text-crimson shrink-0 mt-0.5" />
                <div>
                  <p className="text-[11px] font-bold text-charcoal mb-0.5">{x.bank}</p>
                  <p className="text-[10px] text-gray-500">{x.why}</p>
                </div>
              </div>
            ))}
          </div>

          <h3 className="text-[14px] font-bold text-charcoal font-heading mb-3">10.5 — Sequencing Strategy</h3>
          <div className="space-y-3 mb-6">
            {[
              { step: 'Now — Year 1',  action: 'Convert Union Bank iDEA relationship into a paid pilot inside the RBI sandbox with Bank of Maharashtra or a mid-sized PSU bank. One proven uplift number on real data is the entire critical path.' },
              { step: 'Year 1–2',      action: 'Use that result to approach AU Small Finance Bank or Federal Bank — faster private-sector procurement, and the published pilot result is the door-opener.' },
              { step: 'Year 2–3',      action: 'With two live references (one PSU, one private), approach Ujjivan and Jana SFB through the Finacle/FLEXCUBE system integrators already embedded inside them.' },
            ].map((s, i) => (
              <div key={s.step} className="flex items-start gap-4 p-4 rounded-md border border-soft bg-white">
                <div className="w-8 h-8 rounded-md bg-gradient-brand flex items-center justify-center shrink-0">
                  <span className="text-white text-[10px] font-black">{i + 1}</span>
                </div>
                <div>
                  <p className="text-[12px] font-bold text-charcoal font-heading mb-0.5">{s.step}</p>
                  <p className="text-[11px] text-gray-500">{s.action}</p>
                </div>
              </div>
            ))}
          </div>

          <Callout tone="crimson" border="crimson">
            <strong className="text-charcoal">The single most important selection criterion:</strong> pick the first bank
            based on who will give real CBS data to retrain on — not who pays the most. Real transaction data is what
            turns PCOP from a demo (currently trained on Kaggle + synthetic data) into a product.
          </Callout>
        </section>

        {/* ── FOOTER ──────────────────────────────────────────────────────── */}
        <footer className="pt-12 pb-6 border-t border-soft text-center">
          <p className="text-[11px] text-gray-500 mb-3">
            Prepared by Team MoneyLords, IIT Guwahati · Union Bank iDEA 2.0 Hackathon, PS-3 · July 2026
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link href="/" className="text-[11px] text-copper hover:text-crimson font-bold inline-flex items-center gap-1">
              <ArrowLeft className="w-3 h-3" />
              Back to home
            </Link>
            <span className="text-gray-300">·</span>
            <Link href="/pitch" className="text-[11px] text-copper hover:text-crimson font-bold inline-flex items-center gap-1">
              Full pitch document
              <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        </footer>

      </div>
    </div>
  );
}

function SectionHeader({ num, title }: { num: string; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      <div className="w-8 h-8 rounded-md bg-gradient-brand flex items-center justify-center">
        <span className="text-white text-[11px] font-black">{num}</span>
      </div>
      <h2 className="text-[22px] font-heading font-bold text-charcoal">{title}</h2>
    </div>
  );
}

function Callout({ children, tone, border }: { children: React.ReactNode; tone: 'crimson' | 'copper'; border: 'crimson' | 'copper' }) {
  return (
    <div className={`p-5 rounded-md border-l-4 bg-white border border-soft ${
      border === 'crimson' ? 'border-l-crimson' : 'border-l-copper'
    }`}>
      <div className={`text-[13px] text-gray-600 leading-relaxed`}>{children}</div>
    </div>
  );
}

function Row({ label, value, highlight, muted }: { label: string; value: string; highlight?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-[12px] ${muted ? 'text-gray-400' : 'text-gray-600'}`}>{label}</span>
      <span className={`text-[15px] font-black font-heading tabular-nums ${
        highlight ? 'text-crimson' : muted ? 'text-gray-400' : 'text-charcoal'
      }`}>{value}</span>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string; sub: string }) {
  return (
    <div className="p-5 rounded-md border border-soft bg-white">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-md bg-copper-soft flex items-center justify-center">
          <Icon className="w-4 h-4 text-copper" />
        </div>
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{label}</p>
      </div>
      <p className="text-[22px] font-black text-crimson font-heading tabular-nums">{value}</p>
      <p className="text-[10px] text-gray-500 mt-1">{sub}</p>
    </div>
  );
}
