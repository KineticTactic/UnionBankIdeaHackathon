'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, BookOpen, DollarSign, TrendingUp, Users, Target, Shield, Building2, ChevronDown, ArrowUpRight, BarChart3, Globe } from 'lucide-react';

const TOC = [
  { id: 'executive-summary',       label: 'Executive Summary' },
  { id: 'the-problem',             label: 'The Problem' },
  { id: 'the-product',             label: 'The Product — Architecture & Modules' },
  { id: 'market-landscape',         label: 'Market Landscape' },
  { id: 'market-sizing',           label: 'Market Sizing — TAM / SAM / SOM' },
  { id: 'competitive-analysis',    label: 'Competitive Analysis' },
  { id: 'business-model-pricing',  label: 'Business Model & Pricing' },
  { id: 'financial-model-cost',    label: 'Financial Model — Cost to Deploy' },
  { id: 'financial-model-value',   label: 'Financial Model — Value Created (Union Bank)' },
  { id: 'go-to-market',            label: 'Go-to-Market Strategy' },
];

const NAV_SECTIONS = [
  'executive-summary', 'the-problem', 'the-product', 'market-landscape', 'market-sizing',
  'competitive-analysis', 'business-model-pricing', 'financial-model-cost', 'financial-model-value', 'go-to-market',
];

export default function PitchPage() {
  const [activeId, setActiveId] = useState('executive-summary');

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

      <div className="max-w-5xl mx-auto px-6 py-16">

        {/* ── HEADER ──────────────────────────────────────────────────── */}
        <div className="mb-16 animate-fade-up">
          <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-md text-crimson text-[10px] font-bold uppercase tracking-widest bg-crimson-soft border border-crimson">
            <BookOpen className="w-3 h-3" />
            Business & Financial Pitch
          </div>
          <h1 className="text-[32px] lg:text-[44px] font-heading font-bold text-charcoal mb-3 leading-[1.05]" style={{ letterSpacing: '-0.03em' }}>
            Predictive Customer Outreach Platform
          </h1>
          <p className="text-[16px] font-heading font-semibold text-copper mb-2">Comprehensive Business & Financial Pitch Document</p>
          <p className="text-[13px] text-gray-500">
            Team MoneyLords · IIT Guwahati · Union Bank of India iDEA 2.0 Hackathon (PS-3) · July 2026
          </p>
        </div>

        {/* ── SECTION 1: EXECUTIVE SUMMARY ─────────────────────────────── */}
        <section id="executive-summary" className="mb-20 animate-fade-up delay-100">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-md bg-gradient-brand flex items-center justify-center">
              <span className="text-white text-[11px] font-black">01</span>
            </div>
            <h2 className="text-[22px] font-heading font-bold text-charcoal">Executive Summary</h2>
          </div>

          <p className="text-[14px] text-gray-600 leading-relaxed mb-8">
            PCOP (Predictive Customer Outreach Platform) is a causal, AI-driven customer retention and cross-sell
            intelligence layer purpose-built for Indian retail banks. It sits on top of a bank's existing Core Banking
            System (Finacle, FLEXCUBE, BaNCS) and CRM (CRMNEXT, Finacle CRM) — reading transactional signals,
            predicting churn 60–90 days in advance, recommending the next-best-action, generating personalised outreach
            content, and proving causal impact through a holdout-group methodology.
          </p>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
            {[
              { label: 'Global TAM (2024)',  value: '$4.5–5B' },
              { label: 'Global TAM (2030)',  value: '$12–15B' },
              { label: 'India SAM (2025)',   value: '$35–50M' },
              { label: 'India SAM (2030)',   value: '$130–200M' },
              { label: 'SOM Year 3 ARR',     value: '~$4.7M' },
              { label: 'SOM Year 5 ARR',     value: '~$14.5M' },
            ].map((k) => (
              <div key={k.label} className="p-4 rounded-md border border-soft bg-white text-center">
                <p className="text-[20px] font-black text-charcoal font-heading tabular-nums">{k.value}</p>
                <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mt-1">{k.label}</p>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-3 gap-3 mb-6">
            <div className="p-4 rounded-md border border-crimson/30 bg-crimson/[0.04]">
              <p className="text-[13px] font-bold text-crimson font-heading">Annual Value Created</p>
              <p className="text-[24px] font-black text-crimson font-heading tabular-nums">₹128.2 Cr</p>
              <p className="text-[10px] text-gray-500 mt-0.5">For a mid-sized PSU bank at full deployment</p>
            </div>
            <div className="p-4 rounded-md border border-copper/30 bg-copper/[0.04]">
              <p className="text-[13px] font-bold text-copper font-heading">PCOP Annual Cost</p>
              <p className="text-[24px] font-black text-copper font-heading tabular-nums">₹6–10.2 Cr</p>
              <p className="text-[10px] text-gray-500 mt-0.5">Including licence, infra, and outreach APIs</p>
            </div>
            <div className="p-4 rounded-md border border-soft bg-white">
              <p className="text-[13px] font-bold text-charcoal font-heading">ROI at Full Deployment</p>
              <p className="text-[24px] font-black text-charcoal font-heading tabular-nums">11.6x</p>
              <p className="text-[10px] text-gray-500 mt-0.5">Validated via VERDICT causal holdout methodology</p>
            </div>
          </div>

          <div className="p-5 rounded-md border-l-4 border-crimson bg-white border border-soft">
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <strong className="text-charcoal">The one-line thesis:</strong> Indian banks already spend ₹23–54 Cr/year
              on CRM software that is purely descriptive — it records what happened. PCOP adds the one layer none of
              them have: causal, proactive intelligence that predicts what is about to happen and acts on it, with
              statistically defensible proof that it worked.
            </p>
          </div>
        </section>

        {/* ── SECTION 2: THE PROBLEM ─────────────────────────────────────── */}
        <section id="the-problem" className="mb-20 animate-fade-up delay-200">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-md bg-gradient-brand flex items-center justify-center">
              <span className="text-white text-[11px] font-black">02</span>
            </div>
            <h2 className="text-[22px] font-heading font-bold text-charcoal">The Problem</h2>
          </div>

          <div className="grid lg:grid-cols-2 gap-4 mb-8">
            <div className="p-5 rounded-md border border-soft bg-white">
              <h3 className="text-[14px] font-bold text-charcoal font-heading mb-2">Churn is expensive and invisible until it is too late</h3>
              <p className="text-[12px] text-gray-500 leading-relaxed">
                World Bank Global Findex data (2025) shows roughly <strong className="text-charcoal">16% account inactivity</strong> in Indian
                banking, well above the 4% average for low- and middle-income countries elsewhere. Existing systems
                (CBS, CRM, call centre tools) are all reactive: they record a customer's departure after the fact.
                None of the dominant Indian banking software layers — Finacle, FLEXCUBE, BaNCS, CRMNEXT, MoEngage,
                Genesys — performs individual-level early-warning detection or proves causal retention impact.
              </p>
            </div>
            <div className="p-5 rounded-md border border-soft bg-white">
              <h3 className="text-[14px] font-bold text-charcoal font-heading mb-2">Cross-sell is left to chance</h3>
              <p className="text-[12px] text-gray-500 leading-relaxed">
                The average PSU bank customer holds only <strong className="text-charcoal">1.8 products</strong>; a well-engaged customer holds 3.5+.
                Banks have the transaction data to know which customer needs a credit card, personal loan, or insurance
                policy next — but no system connects life-event signals (marriage, salary jump, home purchase) or
                peer-behaviour patterns to a personalised, timed offer.
              </p>
            </div>
          </div>

          <h3 className="text-[14px] font-bold text-charcoal font-heading mb-3">Existing CRM stack is fragmented and purely descriptive</h3>
          <div className="overflow-x-auto rounded-md border border-soft">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-cream border-b border-soft">
                  <th className="text-left px-4 py-3 font-bold text-charcoal">CRM Layer</th>
                  <th className="text-left px-4 py-3 font-bold text-charcoal">Dominant Vendor</th>
                  <th className="text-left px-4 py-3 font-bold text-charcoal">Annual Cost (Mid-PSU)</th>
                  <th className="text-left px-4 py-3 font-bold text-charcoal">What It Does NOT Do</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-soft">
                {[
                  { layer: 'Core Banking (CBS)',      vendor: 'Infosys Finacle, Oracle FLEXCUBE, TCS BaNCS', cost: '₹16–33 Cr/yr AMC', missing: 'No proactive outreach, no churn prediction' },
                  { layer: 'CRM / RM Tool',           vendor: 'CRMNEXT, Finacle CRM',                         cost: '₹3–10 Cr/yr',     missing: 'Records interactions, does not predict who will leave' },
                  { layer: 'Campaign / Outreach',     vendor: 'MoEngage, Netcore, Capillary',                 cost: '₹1–3 Cr/yr',      missing: 'Batch campaigns only — no individual-level signal detection' },
                  { layer: 'Analytics / BI',          vendor: 'SAS, Power BI, Tableau',                      cost: '₹1–3 Cr/yr',      missing: 'Descriptive — tells you what happened, not what to do' },
                  { layer: 'Call Centre',             vendor: 'Genesys, Avaya',                              cost: '₹2–5 Cr/yr',      missing: 'Reactive — customer must call in' },
                ].map((r) => (
                  <tr key={r.layer} className="bg-white hover:bg-cream transition-colors">
                    <td className="px-4 py-3 font-bold text-charcoal">{r.layer}</td>
                    <td className="px-4 py-3 text-gray-500">{r.vendor}</td>
                    <td className="px-4 py-3 text-gray-500 tabular-nums">{r.cost}</td>
                    <td className="px-4 py-3 text-crimson text-[10px]">{r.missing}</td>
                  </tr>
                ))}
                <tr className="bg-crimson/[0.04] border-t-2 border-crimson">
                  <td className="px-4 py-3 font-bold text-charcoal">Total CRM ecosystem spend</td>
                  <td className="px-4 py-3 text-gray-500">—</td>
                  <td className="px-4 py-3 font-bold text-crimson tabular-nums">₹23–54 Cr/yr</td>
                  <td className="px-4 py-3 text-crimson text-[10px] font-bold">Zero causal retention intelligence, zero early-warning system, zero automated personalised outreach</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* ── SECTION 3: THE PRODUCT ─────────────────────────────────────── */}
        <section id="the-product" className="mb-20 animate-fade-up delay-300">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-md bg-gradient-brand flex items-center justify-center">
              <span className="text-white text-[11px] font-black">03</span>
            </div>
            <h2 className="text-[22px] font-heading font-bold text-charcoal">The Product — Architecture & Modules</h2>
          </div>

          <div className="overflow-x-auto rounded-md border border-soft mb-6">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-cream border-b border-soft">
                  <th className="text-left px-4 py-3 font-bold text-charcoal w-[100px]">Layer</th>
                  <th className="text-left px-4 py-3 font-bold text-charcoal w-[140px]">Module</th>
                  <th className="text-left px-4 py-3 font-bold text-charcoal">Function</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-soft">
                {[
                  { layer: '1 — Source',    module: 'Finacle CBS Connector',     fn: 'Daily delta pull via REST APIs: salary credits, transaction frequency drops, complaint counts, inactivity streaks' },
                  { layer: '2 — Detection', module: 'ARGUS',                      fn: 'Early-warning signal detection (CUSUM/BOCPD change-point), flags risk 60–90 days before churn' },
                  { layer: '3 — Prediction',module: 'CHRONOS',                    fn: 'ML ensemble churn score + survival timing (TARE AUC 0.846, HABITAT AUC 0.88)' },
                  { layer: '4 — Decisioning',module: 'COMPASS',                   fn: 'Agentic, tool-calling (LangGraph) next-best-action engine — decides offer, channel, and timing' },
                  { layer: '5 — Outreach',  module: 'HERALD',                     fn: 'LLM-generated, compliance-gated personalised outreach content (Azure OpenAI, Central India)' },
                  { layer: '6 — Proof',    module: 'VERDICT',                    fn: 'Causal uplift measurement via doubly-robust learner with holdout/control group' },
                ].map((r) => (
                  <tr key={r.module} className="bg-white hover:bg-cream transition-colors">
                    <td className="px-4 py-3 text-[10px] font-bold text-copper uppercase tracking-wider">{r.layer}</td>
                    <td className="px-4 py-3 font-bold text-charcoal">{r.module}</td>
                    <td className="px-4 py-3 text-gray-500">{r.fn}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid lg:grid-cols-3 gap-4 mb-8">
            <div className="p-5 rounded-md border border-soft bg-white">
              <h3 className="text-[13px] font-bold text-charcoal font-heading mb-2 flex items-center gap-2">
                <Shield className="w-4 h-4 text-copper" />
                Integration Philosophy
              </h3>
              <p className="text-[12px] text-gray-500 leading-relaxed">
                PCOP does not replace any existing system. It sits between data sources and the RM-facing CRM.
                "Reads from CBS, pushes to CRM, proves via VERDICT." This makes it politically viable even in
                cautious PSU bank IT environments — it looks like an add-on, not a migration.
              </p>
            </div>
            <div className="p-5 rounded-md border border-soft bg-white">
              <h3 className="text-[13px] font-bold text-charcoal font-heading mb-2 flex items-center gap-2">
                <Users className="w-4 h-4 text-copper" />
                Human-in-the-Loop
              </h3>
              <p className="text-[12px] text-gray-500 leading-relaxed">
                Every recommendation requires RM approval before an action is taken — a mandatory design choice
                aligned with RBI's AI governance guidance, and a genuine differentiator versus competitors who
                treat this as optional.
              </p>
            </div>
            <div className="p-5 rounded-md border border-soft bg-white">
              <h3 className="text-[13px] font-bold text-charcoal font-heading mb-2 flex items-center gap-2">
                <Target className="w-4 h-4 text-copper" />
                Compliance by Design
              </h3>
              <p className="text-[12px] text-gray-500 leading-relaxed">
                DPDPA, TRAI, and RBI outsourcing/data-localization norms are mapped directly into the product.
                All LLM inference runs on Azure OpenAI in Central India (Pune) — no customer data leaves India,
                satisfying the first question every Indian bank's legal team asks.
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
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-md bg-gradient-brand flex items-center justify-center">
              <span className="text-white text-[11px] font-black">04</span>
            </div>
            <h2 className="text-[22px] font-heading font-bold text-charcoal">Market Landscape</h2>
          </div>

          <div className="mb-8">
            <h3 className="text-[14px] font-bold text-charcoal font-heading mb-3">Integration Architecture</h3>
            <div className="p-6 rounded-md border border-soft bg-white font-mono text-[11px] leading-loose">
              <span className="text-copper font-bold">Finacle CBS</span> &nbsp;→&nbsp;
              <span className="text-crimson font-bold">ARGUS</span> &nbsp;→&nbsp;
              <span className="text-charcoal font-bold">CHRONOS</span> &nbsp;→&nbsp;
              <span className="text-copper font-bold">COMPASS</span> &nbsp;→&nbsp;
              <span className="text-crimson font-bold">HERALD</span> &nbsp;→&nbsp;
              <span className="text-charcoal font-bold">RM Dashboard</span><br />
              <span className="text-gray-400 text-[10px]">(source &nbsp; detect &nbsp; predict &nbsp; decide &nbsp; outreach &nbsp; RM approves)</span>
              <br /><br />
              <span className="text-gray-400 ml-8">↓</span><br />
              <span className="text-gray-400 ml-8">VERDICT → Bank BI/Analytics</span><br />
              <span className="text-gray-400 ml-10 text-[10px]">(causal proof, exposed via API)</span>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-4 mb-6">
            {[
              { point: 'Integration Point A', desc: 'Finacle CBS → ARGUS. Daily delta pull, no real-time CBS access required in pilot phase.' },
              { point: 'Integration Point B', desc: 'COMPASS → CRMNEXT. Recommendation appears as an approvable RM task.' },
              { point: 'Integration Point C', desc: 'VERDICT → Bank Analytics. Causal uplift exposed as an API into existing BI tools.' },
            ].map((i) => (
              <div key={i.point} className="p-4 rounded-md border border-soft bg-white">
                <p className="text-[10px] font-bold text-copper uppercase tracking-wider mb-1">{i.point}</p>
                <p className="text-[12px] text-gray-500">{i.desc}</p>
              </div>
            ))}
          </div>

          <div className="p-5 rounded-md border-l-4 border-copper bg-white border border-soft">
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <strong className="text-charcoal">Why banks will adopt this without a "rip and replace" conversation:</strong> A bank's IT team
              sees PCOP as a new module layered on top of infrastructure they already run and trust — not a system
              migration. This dramatically shortens procurement friction versus a competing product that asks a bank
              to replace its CRM outright.
            </p>
          </div>
        </section>

        {/* ── SECTION 5: MARKET SIZING ───────────────────────────────────── */}
        <section id="market-sizing" className="mb-20 animate-fade-up delay-500">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-md bg-gradient-brand flex items-center justify-center">
              <span className="text-white text-[11px] font-black">05</span>
            </div>
            <h2 className="text-[22px] font-heading font-bold text-charcoal">Market Sizing — TAM / SAM / SOM</h2>
          </div>

          <div className="grid lg:grid-cols-3 gap-4 mb-8">
            <div className="p-5 rounded-md border border-soft bg-white">
              <div className="flex items-center gap-2 mb-3">
                <Globe className="w-4 h-4 text-crimson" />
                <h3 className="text-[14px] font-bold text-charcoal font-heading">TAM — Total Addressable Market</h3>
              </div>
              <p className="text-[11px] text-gray-500 leading-relaxed mb-3">
                <strong className="text-charcoal">Top-down:</strong> IDC (Aug 2024) shows banking committed ~$31.3B in AI
                investment in 2024; software captured &gt;48% (~$15B). A conservative 15% allocation to customer
                retention/cross-sell analytics → ~$4.7B. Cross-checked against IMARC ($5.2B), Straits Research
                ($3.63B), GrowthMarket Reports ($8.9B) averaging ~$5.9B.
              </p>
              <p className="text-[11px] text-gray-500 leading-relaxed mb-3">
                <strong className="text-charcoal">Bottom-up:</strong> ~5,000–7,000 banking institutions globally hold &gt;$1B
                in assets. A blended enterprise ACV of $500K median × 5,000 institutions → $2.5B; at the high end,
                7,000 × $700K → $4.9B.
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-[22px] font-black text-crimson font-heading">$4.5–5B</span>
                <span className="text-[10px] text-gray-500">TAM (2024)</span>
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-[18px] font-black text-charcoal font-heading">$12–15B</span>
                <span className="text-[10px] text-gray-500">TAM (2030)</span>
              </div>
            </div>
            <div className="p-5 rounded-md border border-soft bg-white">
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-4 h-4 text-copper" />
                <h3 className="text-[14px] font-bold text-charcoal font-heading">SAM — Serviceable Addressable Market (India)</h3>
              </div>
              <p className="text-[11px] text-gray-500 leading-relaxed mb-3">
                <strong className="text-charcoal">Top-down:</strong> India AI & Automation in Banking: $2.05B (2025) → $16.05B
                by 2033 at 30.2% CAGR (Grand View Research). 15–20% allocation to customer analytics → $307–410M in 2025.
              </p>
              <p className="text-[11px] text-gray-500 leading-relaxed mb-3">
                <strong className="text-charcoal">Bottom-up:</strong> 45 target institutions (33 PSBs + PVBs + 12 SFBs).
                Weighted average ACV ~$380,000 → theoretical max $17.1M in capturable license revenue.
              </p>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                <strong className="text-charcoal">Revised framing:</strong> Total AI spend ~$350M (2025). Capturable SaaS
                platform license revenue: <strong className="text-charcoal">$35–50M (2025) → $130–200M (2030)</strong>.
              </p>
            </div>
            <div className="p-5 rounded-md border border-soft bg-white">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-crimson" />
                <h3 className="text-[14px] font-bold text-charcoal font-heading">SOM — Serviceable Obtainable Market</h3>
              </div>
              <p className="text-[11px] text-gray-500 leading-relaxed mb-3">
                <strong className="text-charcoal">Assumptions:</strong> 9–18 month sales cycle, 25% win rate, 6-person
                founding team running 10–15 opportunities. Net Revenue Retention 110–115% from Year 2. Annual churn 5%.
              </p>
              <div className="space-y-1.5 mb-3">
                {[
                  { year: 'Year 1', arr: '$360K', note: '3 pilots' },
                  { year: 'Year 2', arr: '$1.76M', note: '8 banks' },
                  { year: 'Year 3', arr: '~$4.7M', note: '15–16 banks' },
                  { year: 'Year 4', arr: '~$8.5M', note: '25 banks' },
                  { year: 'Year 5', arr: '~$14.5M', note: '35–40 + SE Asia' },
                ].map((y) => (
                  <div key={y.year} className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-charcoal">{y.year}</span>
                    <span className="text-[12px] font-black text-crimson font-heading tabular-nums">{y.arr}</span>
                    <span className="text-[9px] text-gray-400">{y.note}</span>
                  </div>
                ))}
              </div>
              <div className="p-3 rounded-md bg-copper-soft border border-copper/30 text-[10px] text-gray-600 leading-relaxed">
                <strong>Why $120K pilot pricing is right:</strong> Gainsight's mid-market deployments start at $50K–$150K/year.
                PCOP is more complex (ML + GNN + outreach automation vs. a health-score dashboard), justifying a higher
                floor while staying in the comparable range.
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-md border border-soft mb-4">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-cream border-b border-soft">
                  <th className="text-left px-4 py-3 font-bold text-charcoal">Metric</th>
                  <th className="text-right px-4 py-3 font-bold text-charcoal">Conservative</th>
                  <th className="text-right px-4 py-3 font-bold text-charcoal">Central</th>
                  <th className="text-right px-4 py-3 font-bold text-charcoal">Optimistic</th>
                  <th className="text-left px-4 py-3 font-bold text-charcoal">Primary Evidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-soft">
                {[
                  { m: 'Global TAM (2024)',      c: '$2.5B',   mid: '$4.5B',  o: '$5.5B',  e: 'IDC $31.3B × 15%; bottom-up 5,000 banks × $500K' },
                  { m: 'Global TAM (2030)',      c: '$8B',     mid: '$12B',   o: '$17B',   e: '17–20% CAGR applied' },
                  { m: 'India SAM (2025)',       c: '$250M',   mid: '$350M',  o: '$450M',  e: 'GVR India AI-in-banking $2.05B × 15–20%' },
                  { m: 'India SAM licenses (2025)',c: '$17M',  mid: '$35M',   o: '$55M',   e: '45 target banks × $380K ACV' },
                  { m: 'India SAM licenses (2030)',c: '$80M',  mid: '$130M',  o: '$200M',  e: '30% CAGR (GVR)' },
                  { m: 'SOM Year 3 ARR',         c: '$3M',    mid: '$4.7M',  o: '$7M',    e: '12–20 banks; $220–380K ACV; 25% win rate' },
                  { m: 'SOM Year 5 ARR',         c: '$8M',    mid: '$14.5M', o: '$22M',   e: '30–45 banks incl. SE Asia; NRR 110–115%' },
                ].map((r) => (
                  <tr key={r.m} className="bg-white hover:bg-cream transition-colors">
                    <td className="px-4 py-3 font-bold text-charcoal">{r.m}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-500">{r.c}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-bold text-charcoal">{r.mid}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-500">{r.o}</td>
                    <td className="px-4 py-3 text-gray-500 text-[10px]">{r.e}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-4 rounded-md bg-crimson-soft border border-crimson/30 text-[11px] text-gray-600 leading-relaxed">
            <strong className="text-charcoal">Methodological caveat:</strong> the $350M and $35M figures measure different things
            (total AI spend vs. capturable license revenue). Both matter — $350M signals the scale of the problem being
            solved; $35M is the realistic near-term revenue ceiling absent geographic expansion. The 33 first-wave Indian
            bank targets represent a theoretical ceiling of ~$12.5M ARR at 100% penetration — exceeding $15M ARR requires
            either upsell (NEXUS/ARGUS add-ons, realistic cap $800K–$1.5M per large bank) or Southeast Asia expansion.
          </div>
        </section>

        {/* ── SECTION 6: COMPETITIVE ANALYSIS ─────────────────────────────── */}
        <section id="competitive-analysis" className="mb-20 animate-fade-up delay-600">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-md bg-gradient-brand flex items-center justify-center">
              <span className="text-white text-[11px] font-black">06</span>
            </div>
            <h2 className="text-[22px] font-heading font-bold text-charcoal">Competitive Analysis</h2>
          </div>

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
                  { cap: 'Early-warning signal detection (60–90 days)', pcop: 'ARGUS (CUSUM/BOCPD)', sf: 'Not native', pega: 'Not native', crm: 'Not native', kumo: 'Limited' },
                  { cap: 'Causal uplift proof (doubly-robust)',         pcop: 'Built in',           sf: 'Not native', pega: 'Not native', crm: 'Not native', kumo: 'Not native' },
                  { cap: 'Agentic next-best-action',                    pcop: 'COMPASS',             sf: 'Einstein',   pega: 'Pega CDH',   crm: 'Basic AI',   kumo: 'Not native' },
                  { cap: 'LLM-generated outreach content',              pcop: 'HERALD',              sf: 'Einstein GPT',pega: 'Limited',   crm: 'Not native', kumo: 'Not native' },
                  { cap: 'DPDPA / TRAI / RBI compliance',               pcop: 'Built in, mapped',   sf: 'Configurable',pega: 'Configurable',crm: 'Partial',  kumo: 'Not native' },
                  { cap: 'India-only data residency',                   pcop: 'Azure Central India',sf: 'Requires config',pega: 'Requires config',crm: 'On-prem option',kumo: 'Not native' },
                  { cap: 'Graph-based peer cross-sell',                 pcop: 'GraphSAGE-trained',  sf: 'Not native', pega: 'Not native', crm: 'Not native', kumo: 'Core feature' },
                  { cap: 'Human-in-loop (RBI AI governance)',           pcop: 'Mandatory',          sf: 'Optional',   pega: 'Optional',   crm: 'Optional',   kumo: 'Not native' },
                  { cap: 'India-first pricing',                         pcop: 'Built for India',    sf: 'Global/generic',pega: 'Global/generic',crm: 'India-first',kumo: 'Global' },
                ].map((r) => {
                  const badge = (v: string, isPcop: boolean) => {
                    if (isPcop) return <span className="text-crimson font-bold">{v}</span>;
                    if (v === 'Not native') return <span className="text-gray-400">{v}</span>;
                    if (v === 'Built in' || v === 'Built in, mapped' || v === 'Built for India' || v === 'Mandatory' || v === 'Azure Central India' || v === 'COMPASS' || v === 'ARGUS (CUSUM/BOCPD)' || v === 'HERALD' || v === 'GraphSAGE-trained') return <span className="text-crimson font-bold">{v}</span>;
                    if (v === 'Optional' || v === 'Configurable' || v === 'Limited' || v === 'Basic AI' || v === 'Partial' || v === 'Einstein' || v === 'Pega CDH' || v === 'Einstein GPT' || v === 'Core feature' || v === 'On-prem option' || v === 'Requires config' || v === 'India-first' || v === 'Global/generic' || v === 'Global') return <span className="text-gray-500">{v}</span>;
                    return <span className="text-gray-500">{v}</span>;
                  };
                  return (
                    <tr key={r.cap} className="bg-white hover:bg-cream transition-colors">
                      <td className="px-3 py-2.5 font-bold text-charcoal">{r.cap}</td>
                      <td className="px-3 py-2.5 text-center">{badge(r.pcop, true)}</td>
                      <td className="px-3 py-2.5 text-center">{badge(r.sf, false)}</td>
                      <td className="px-3 py-2.5 text-center">{badge(r.pega, false)}</td>
                      <td className="px-3 py-2.5 text-center">{badge(r.crm, false)}</td>
                      <td className="px-3 py-2.5 text-center">{badge(r.kumo, false)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="p-5 rounded-md border border-crimson/30 bg-crimson/[0.04]">
              <h3 className="text-[13px] font-bold text-crimson font-heading mb-2">Positioning</h3>
              <p className="text-[12px] text-gray-600 leading-relaxed">
                Plotting "proactive + causal" against "India-first + compliance-native," every global incumbent
                clusters in one corner. PCOP occupies the empty quadrant. This is verified by reading each competitor's
                product sheet and documenting the absence of causal proof and India-specific compliance mapping.
              </p>
            </div>
            <div className="p-5 rounded-md border border-soft bg-white">
              <h3 className="text-[13px] font-bold text-charcoal font-heading mb-2">Market Context</h3>
              <p className="text-[12px] text-gray-500 leading-relaxed">
                The global banking CRM market is <strong className="text-charcoal">$18.1B (2025)</strong>, growing at
                17.4% CAGR through 2029 — the fastest-growing enterprise software segment globally, driven by AI
                integration and digital banking. India's addressable Phase 1 opportunity within this is $50–150M,
                serviceable with 3–5 anchor banks in Years 1–2.
              </p>
            </div>
          </div>
        </section>

        {/* ── SECTION 7: BUSINESS MODEL & PRICING ────────────────────────── */}
        <section id="business-model-pricing" className="mb-20 animate-fade-up delay-700">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-md bg-gradient-brand flex items-center justify-center">
              <span className="text-white text-[11px] font-black">07</span>
            </div>
            <h2 className="text-[22px] font-heading font-bold text-charcoal">Business Model & Pricing</h2>
          </div>

          <h3 className="text-[14px] font-bold text-charcoal font-heading mb-3">Pricing Tiers (by RM headcount / bank size)</h3>
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
                {[
                  { tier: 'Small SFB / mid PSB', rms: '50–100',   inr: '₹1–2 Cr',   usd: '$120K–$240K' },
                  { tier: 'Mid PVB / large PSB', rms: '100–300',  inr: '₹2–5 Cr',   usd: '$240K–$600K' },
                  { tier: 'Large PVB (HDFC/ICICI/Axis-tier)', rms: '300–1,000', inr: '₹5–15 Cr',  usd: '$600K–$1.8M' },
                ].map((p) => (
                  <tr key={p.tier} className="bg-white hover:bg-cream transition-colors">
                    <td className="px-4 py-3 font-bold text-charcoal">{p.tier}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-500">{p.rms}</td>
                    <td className="px-4 py-3 text-right font-bold text-charcoal tabular-nums">{p.inr}</td>
                    <td className="px-4 py-3 text-right text-gray-500 tabular-nums">{p.usd}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid lg:grid-cols-3 gap-4 mb-6">
            <div className="p-5 rounded-md border border-soft bg-white">
              <h3 className="text-[13px] font-bold text-charcoal font-heading mb-2">Revenue Structure</h3>
              <ul className="text-[11px] text-gray-500 space-y-2">
                <li><strong className="text-charcoal">Licence fee</strong> — core retention module (ARGUS/CHRONOS/COMPASS/HERALD/VERDICT), primary ACV driver</li>
                <li><strong className="text-charcoal">Setup/integration fee</strong> — one-time, ₹1.6–2.6 Cr for a mid-PSU deployment</li>
                <li><strong className="text-charcoal">Module upsell</strong> — NEXUS (cross-sell), ARGUS extensions from Year 2, driving 110–115% NRR</li>
                <li><strong className="text-charcoal">90-day paid pilots</strong> at ~$120K / ₹1 Cr — standard practice to bypass full capex approval cycles</li>
              </ul>
            </div>
            <div className="p-5 rounded-md border border-soft bg-white">
              <h3 className="text-[13px] font-bold text-charcoal font-heading mb-2">Unit Economics (Steady State)</h3>
              <div className="space-y-3">
                {[
                  { label: 'Licence Revenue',        value: '₹6 Cr/yr',   cls: 'text-charcoal' },
                  { label: 'Cost to Deliver',        value: '₹1.65 Cr/yr',cls: 'text-crimson' },
                  { label: 'Gross Margin',           value: '72%',        cls: 'text-crimson font-black text-[20px]' },
                  { label: 'Year 1 Margin (w/ setup)',value: '37%',      cls: 'text-gray-500' },
                ].map((i) => (
                  <div key={i.label} className="flex items-center justify-between">
                    <span className="text-[11px] text-gray-500">{i.label}</span>
                    <span className={`text-[14px] font-black font-heading tabular-nums ${i.cls}`}>{i.value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-5 rounded-md bg-copper-soft border border-copper/30">
              <h3 className="text-[13px] font-bold text-copper font-heading mb-2">Why This Pricing Works</h3>
              <p className="text-[11px] text-gray-600 leading-relaxed">
                Salesforce FSC costs a 100-RM bank ~$390K/year for base CRM alone, before AI add-ons. PCOP prices at
                a discount to Salesforce's per-seat rate while substantially replacing a layer of that spend. The
                90-day paid pilot model (not free POC) generates early revenue signal and cash from day one.
              </p>
            </div>
          </div>
        </section>

        {/* ── SECTION 8: COST TO DEPLOY ──────────────────────────────────── */}
        <section id="financial-model-cost" className="mb-20 animate-fade-up delay-800">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-md bg-gradient-brand flex items-center justify-center">
              <span className="text-white text-[11px] font-black">08</span>
            </div>
            <h2 className="text-[22px] font-heading font-bold text-charcoal">Financial Model — Cost to Deploy</h2>
          </div>

          <div className="p-4 rounded-md bg-copper-soft border border-copper/30 text-[12px] text-gray-600 leading-relaxed mb-6">
            <strong className="text-charcoal">Deployment stack:</strong> Azure Kubernetes Service (AKS) running all 8 PCOP
            microservices, primary region Central India (Pune), DR in South India (Chennai). Chosen over AWS primarily
            because most PSU banks already hold Microsoft Enterprise Agreements — dramatically simplifying procurement.
          </div>

          <h3 className="text-[14px] font-bold text-charcoal font-heading mb-3">Annual Cloud Infrastructure (Azure, mid-PSU bank)</h3>
          <div className="overflow-x-auto rounded-md border border-soft mb-6">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-cream border-b border-soft">
                  <th className="text-left px-4 py-3 font-bold text-charcoal">Azure Service</th>
                  <th className="text-left px-4 py-3 font-bold text-charcoal">Function</th>
                  <th className="text-right px-4 py-3 font-bold text-charcoal">Monthly ₹</th>
                  <th className="text-right px-4 py-3 font-bold text-charcoal">Annual ₹</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-soft">
                {[
                  { s: 'AKS (Kubernetes)',         f: 'Runs all 8 microservices',          m: '₹1.6L',  a: '₹19.2L' },
                  { s: 'Azure DB for PostgreSQL',  f: 'Audit logs, scores, consents',      m: '₹1.4L',  a: '₹16.8L' },
                  { s: 'Azure Cache for Redis',    f: 'Event bus, job queue, sessions',    m: '₹0.5L',  a: '₹6L' },
                  { s: 'Azure Event Hubs',         f: 'Kafka-compatible event backbone',   m: '₹0.8L',  a: '₹9.6L' },
                  { s: 'Azure Blob Storage',       f: 'Audit logs, model artifacts',       m: '₹0.2L',  a: '₹2.4L' },
                  { s: 'Application Gateway + WAF',f: 'Load balancer, DDoS protection',   m: '₹0.6L',  a: '₹7.2L' },
                  { s: 'CDN + Static Web Apps',    f: 'Frontend hosting',                  m: '₹0.1L',  a: '₹1.2L' },
                  { s: 'Monitor + Log Analytics',  f: 'Logs, metrics, alerts',             m: '₹0.3L',  a: '₹3.6L' },
                  { s: 'Key Vault',                f: 'Secrets/credential management',     m: '₹0.05L', a: '₹0.6L' },
                  { s: 'Azure AD B2C',             f: 'RM/Admin authentication',           m: '₹0.1L',  a: '₹1.2L' },
                  { s: 'DR site (South India)',    f: 'Cold standby',                      m: '₹1.5L',  a: '₹18L' },
                  { s: 'Bandwidth / egress',       f: '~2TB/mo outbound',                 m: '₹0.4L',  a: '₹4.8L' },
                ].map((r) => (
                  <tr key={r.s} className="bg-white hover:bg-cream transition-colors">
                    <td className="px-4 py-2.5 font-bold text-charcoal">{r.s}</td>
                    <td className="px-4 py-2.5 text-gray-500">{r.f}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-500">{r.m}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-bold text-charcoal">{r.a}</td>
                  </tr>
                ))}
                <tr className="bg-copper-soft border-t-2 border-copper">
                  <td className="px-4 py-3 font-bold text-charcoal">Total infra</td>
                  <td className="px-4 py-3 text-gray-500"></td>
                  <td className="px-4 py-3 text-right font-bold text-crimson tabular-nums">₹7.55L/mo</td>
                  <td className="px-4 py-3 text-right font-bold text-crimson tabular-nums">₹90.6L/yr</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="text-[11px] text-gray-500 mb-8">
            With 1-year Reserved Instance commitments (typical 40% discount on compute): effective annual infra cost ≈
            <strong className="text-charcoal"> ₹65–70L/year</strong> (~₹6.5–7 Cr over 5 years).
          </p>

          <div className="grid lg:grid-cols-3 gap-4 mb-6">
            <div className="p-5 rounded-md border border-soft bg-white">
              <h3 className="text-[13px] font-bold text-charcoal font-heading mb-3">One-Time Setup Costs</h3>
              <div className="space-y-2">
                {[
                  { i: 'Finacle API integration',     c: '₹80L–1.2 Cr' },
                  { i: 'ARGUS signal mapping',         c: '₹15–25L' },
                  { i: 'CHRONOS retraining',           c: '₹10–20L' },
                  { i: 'COMPASS/HERALD prompt tuning', c: '₹5–10L' },
                  { i: 'AKS cluster setup + CI/CD',   c: '₹10–15L' },
                  { i: 'Security audit + pen testing', c: '₹15–25L' },
                  { i: 'RBI / compliance docs',        c: '₹10–20L' },
                  { i: 'UAT',                          c: '₹10–15L' },
                  { i: 'Training (RM + admin)',        c: '₹5–10L' },
                ].map((x) => (
                  <div key={x.i} className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-500">{x.i}</span>
                    <span className="text-[11px] font-bold text-charcoal tabular-nums">{x.c}</span>
                  </div>
                ))}
                <div className="pt-2 mt-2 border-t border-soft flex items-center justify-between">
                  <span className="text-[11px] font-bold text-charcoal">Total setup</span>
                  <span className="text-[14px] font-black text-crimson font-heading">₹1.6–2.6 Cr</span>
                </div>
              </div>
            </div>
            <div className="p-5 rounded-md border border-soft bg-white">
              <h3 className="text-[13px] font-bold text-charcoal font-heading mb-3">Annual External API Costs</h3>
              <div className="space-y-2">
                {[
                  { i: 'Azure OpenAI (LLM)',   c: '₹12–24L', n: '~500 gen/day' },
                  { i: 'Twilio SMS',            c: '₹21L',    n: '50K SMS/mo' },
                  { i: 'Resend Email',          c: '₹3.6L',   n: '2L emails/mo' },
                ].map((x) => (
                  <div key={x.i} className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-gray-500">{x.i}</span>
                      <span className="text-[8px] text-gray-400 ml-1">({x.n})</span>
                    </div>
                    <span className="text-[11px] font-bold text-charcoal tabular-nums">{x.c}</span>
                  </div>
                ))}
                <div className="pt-2 mt-2 border-t border-soft flex items-center justify-between">
                  <span className="text-[11px] font-bold text-charcoal">Total APIs</span>
                  <span className="text-[14px] font-black text-crimson font-heading">₹34–63L/yr</span>
                </div>
              </div>
            </div>
            <div className="p-5 rounded-md border border-soft bg-white">
              <h3 className="text-[13px] font-bold text-charcoal font-heading mb-3">Ongoing People Cost (Annual)</h3>
              <div className="space-y-2">
                {[
                  { i: 'Site Reliability / DevOps',          c: '₹18–25L' },
                  { i: 'ML Engineer (retraining, ORACLE)',   c: '₹20–30L' },
                  { i: 'Customer Success / bank rel.',       c: '₹12–18L' },
                ].map((x) => (
                  <div key={x.i} className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-500">{x.i}</span>
                    <span className="text-[11px] font-bold text-charcoal tabular-nums">{x.c}</span>
                  </div>
                ))}
                <div className="pt-2 mt-2 border-t border-soft flex items-center justify-between">
                  <span className="text-[11px] font-bold text-charcoal">Total people</span>
                  <span className="text-[14px] font-black text-crimson font-heading">₹50–73L/yr</span>
                </div>
              </div>
            </div>
          </div>

          <h3 className="text-[14px] font-bold text-charcoal font-heading mb-3">5-Year Total Cost of Ownership (per mid-PSU bank)</h3>
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
                {[
                  { c: 'Azure infra (with reservations)',       y1: '₹70L',   y2: '₹65L',   t: '₹3.3 Cr' },
                  { c: 'Setup / integration',                   y1: '₹2 Cr',  y2: '₹0',     t: '₹2 Cr' },
                  { c: 'External APIs',                         y1: '₹50L',   y2: '₹45L',   t: '₹2.3 Cr' },
                  { c: 'People (3 FTE)',                        y1: '₹60L',   y2: '₹55L',   t: '₹2.8 Cr' },
                ].map((r) => (
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
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-md bg-gradient-brand flex items-center justify-center">
              <span className="text-white text-[11px] font-black">09</span>
            </div>
            <h2 className="text-[22px] font-heading font-bold text-charcoal">Financial Model — Value Created (Union Bank Case Study)</h2>
          </div>

          <div className="p-4 rounded-md bg-copper-soft border border-copper/30 text-[12px] text-gray-600 leading-relaxed mb-6">
            <strong className="text-charcoal">Real inputs used:</strong> Union Bank of India FY2025 actuals — net profit
            ₹19,430 Cr, total deposits ₹13.1 lakh Cr, 8,600+ branches, 74,600+ employees. Active retail customer base
            estimated at 2.5 crore based on account activity data.
          </div>

          <div className="grid lg:grid-cols-3 gap-4 mb-6">
            <div className="p-5 rounded-md border border-soft bg-white">
              <h3 className="text-[13px] font-bold text-charcoal font-heading mb-2">Churn Baseline</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-gray-500">Active retail customers</span>
                  <span className="text-[15px] font-black text-charcoal font-heading tabular-nums">2.5 Cr</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-gray-500">Annual churn rate (conservative)</span>
                  <span className="text-[15px] font-black text-charcoal font-heading tabular-nums">10%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-gray-500">Customers lost per year without PCOP</span>
                  <span className="text-[15px] font-black text-crimson font-heading tabular-nums">25 lakh</span>
                </div>
              </div>
              <p className="text-[9px] text-gray-400 mt-3">
                World Bank Global Findex 2025 shows 16% account inactivity in Indian banking — 10% is deliberately conservative.
              </p>
            </div>

            <div className="p-5 rounded-md border border-soft bg-white">
              <h3 className="text-[13px] font-bold text-charcoal font-heading mb-2">Churn Savings</h3>
              <div className="overflow-x-auto text-[10px] mb-3">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-soft">
                      <th className="text-left py-1.5 font-bold text-charcoal">Tier</th>
                      <th className="text-right py-1.5 font-bold text-charcoal">Saved</th>
                      <th className="text-right py-1.5 font-bold text-charcoal">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { t: 'HNW (>₹10L)',  s: '1,680', r: '₹23.5 Cr' },
                      { t: 'Premium (₹1L–10L)', s: '9,450', r: '₹52.9 Cr' },
                      { t: 'Mass (<₹1L)',   s: '42,000', r: '₹76.9 Cr' },
                    ].map((x) => (
                      <tr key={x.t} className="border-b border-soft/50">
                        <td className="py-1.5 text-gray-500">{x.t}</td>
                        <td className="py-1.5 text-right text-gray-500 tabular-nums">{x.s}</td>
                        <td className="py-1.5 text-right font-bold text-charcoal tabular-nums">{x.r}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-soft">
                <span className="text-[10px] font-bold text-charcoal">Total (Year 1)</span>
                <span className="text-[16px] font-black text-crimson font-heading">₹49.4 Cr</span>
              </div>
            </div>

            <div className="p-5 rounded-md border border-soft bg-white">
              <h3 className="text-[13px] font-bold text-charcoal font-heading mb-2">Cross-Sell Revenue</h3>
              <div className="overflow-x-auto text-[10px] mb-3">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-soft">
                      <th className="text-left py-1.5 font-bold text-charcoal">Product</th>
                      <th className="text-right py-1.5 font-bold text-charcoal">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { p: 'Credit Card',      r: '₹9.6 Cr' },
                      { p: 'Personal Loan',    r: '₹24.0 Cr' },
                      { p: 'Life Insurance',   r: '₹11.5 Cr' },
                      { p: 'Mutual Fund SIP',  r: '₹7.2 Cr' },
                      { p: 'FD Upgrade',       r: '₹9.0 Cr' },
                      { p: 'Home Loan',        r: '₹17.5 Cr' },
                    ].map((x) => (
                      <tr key={x.p} className="border-b border-soft/50">
                        <td className="py-1 text-gray-500">{x.p}</td>
                        <td className="py-1 text-right font-bold text-charcoal tabular-nums">{x.r}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-soft">
                <span className="text-[10px] font-bold text-charcoal">Total cross-sell</span>
                <span className="text-[16px] font-black text-crimson font-heading">₹78.8 Cr</span>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-4 mb-6">
            <div className="p-5 rounded-md border border-crimson/30 bg-crimson/[0.04]">
              <h3 className="text-[13px] font-bold text-crimson font-heading mb-3">Combined Annual P&L Impact</h3>
              <div className="space-y-2">
                {[
                  { l: 'Churn savings (Year 1 revenue)',  v: '₹49.4 Cr' },
                  { l: 'Cross-sell revenue',               v: '₹78.8 Cr' },
                  { l: 'Total value created',              v: '₹128.2 Cr', b: true },
                  { l: 'PCOP total cost',                  v: '₹10.2 Cr' },
                  { l: 'Net profit to bank',               v: '₹118 Cr', b: true },
                ].map((x) => (
                  <div key={x.l} className="flex items-center justify-between">
                    <span className="text-[12px] text-gray-600">{x.l}</span>
                    <span className={`text-[16px] font-black font-heading tabular-nums ${x.b ? 'text-crimson' : 'text-charcoal'}`}>{x.v}</span>
                  </div>
                ))}
                <div className="pt-2 mt-2 border-t border-crimson/30 flex items-center justify-between">
                  <span className="text-[14px] font-bold text-charcoal font-heading">ROI</span>
                  <span className="text-[28px] font-black text-crimson font-heading tabular-nums">11.6x</span>
                </div>
                <p className="text-[9px] text-gray-400">PCOP licence as % of value generated: 4.7%</p>
              </div>
            </div>
            <div className="p-5 rounded-md border border-soft bg-white">
              <h3 className="text-[13px] font-bold text-charcoal font-heading mb-3">Phased Ramp (Years 1–3)</h3>
              <div className="overflow-x-auto text-[10px]">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-soft">
                      <th className="text-left py-1.5 font-bold text-charcoal">Year</th>
                      <th className="text-right py-1.5 font-bold text-charcoal">Net Profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { y: 'Year 1 (40% — pilot)',   v: '₹41 Cr' },
                      { y: 'Year 2 (75% — scaled)',  v: '₹88.5 Cr' },
                      { y: 'Year 3 (100% — full)',   v: '₹121.2 Cr' },
                    ].map((x) => (
                      <tr key={x.y} className="border-b border-soft/50">
                        <td className="py-1.5 text-gray-500">{x.y}</td>
                        <td className="py-1.5 text-right font-bold text-charcoal tabular-nums">{x.v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between pt-2 mt-2 border-t border-soft">
                <span className="text-[11px] font-bold text-charcoal">3-year cumulative</span>
                <span className="text-[16px] font-black text-crimson font-heading">₹250.7 Cr</span>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-md bg-crimson-soft border border-crimson/30 text-[11px] text-gray-600 leading-relaxed">
            <strong className="text-charcoal">Methodological note:</strong> the 6% uplift is the VERDICT causal figure —
            customers who stayed <em>because of</em> PCOP's intervention, isolated from customers who would have stayed
            anyway via a holdout/control group. This is conservative versus industry benchmarks of 8–12% uplift, and it
            is the number that survives a bank's model-risk committee review. The ₹49.4 Cr figure (Year 1 revenue only)
            is the defensible pitch number; the 5-year LTV version at ₹153 Cr is technically valid but harder to defend
            in a first pitch. The cross-sell uplift of 2% is conservative — industry data shows 3–8% conversion uplift
            for AI-assisted personalised cross-sell, but PSU bank customers are more conservative and PSU RMs less
            aggressive sellers.
          </div>
        </section>

        {/* ── SECTION 10: GO-TO-MARKET ──────────────────────────────────── */}
        <section id="go-to-market" className="mb-20 animate-fade-up delay-1000">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-md bg-gradient-brand flex items-center justify-center">
              <span className="text-white text-[11px] font-black">10</span>
            </div>
            <h2 className="text-[22px] font-heading font-bold text-charcoal">Go-to-Market Strategy & Customer Segmentation</h2>
          </div>

          <div className="grid lg:grid-cols-3 gap-4 mb-8">
            {[
              {
                tier: 'Tier 1 — Private Banks',
                accent: 'copper',
                banks: 'AU SFB, Bandhan, Federal, South Indian Bank, Karnataka Bank, City Union Bank, DCB Bank, RBL Bank',
                why: 'Private banks lead AI adoption (AI mentions in annual reports grew 6x between 2015–2023 vs. 3x for PSU banks). They decide in 6–12 months, feel churn pressure acutely, and have right-sized customer bases (20–80 lakh active retail).',
                deal: '₹3–5 Cr/yr · 6–10 month cycle · 3–4 month integration',
              },
              {
                tier: 'Tier 2 — Mid-Sized PSU Banks',
                accent: 'crimson',
                banks: 'Bank of Maharashtra, Punjab & Sind Bank, UCO Bank, Indian Overseas Bank, Central Bank of India',
                why: 'The Union Bank iDEA relationship converts into a design-partner pilot inside the RBI sandbox. Winning one PSU unlocks the rest — Indian PSU banks watch each other closely.',
                deal: '₹5–8 Cr/yr · 12–18 month cycle · 4–6 month integration',
              },
              {
                tier: 'Tier 3 — Small Finance Banks',
                accent: 'copper',
                banks: 'Ujjivan SFB, Jana SFB, ESAF SFB, Suryoday SFB',
                why: 'SFBs raise AI spend fastest as they scale toward universal-bank status. Their biggest pain point — retaining microfinance customers graduating into full banking products — is exactly what PCOP solves.',
                deal: '₹2–4 Cr/yr · 8–12 month cycle',
              },
            ].map((t) => (
              <div key={t.tier} className={`p-5 rounded-md border bg-white ${
                t.accent === 'crimson' ? 'border-crimson/30' : 'border-copper/30'
              }`}>
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

          <h3 className="text-[14px] font-bold text-charcoal font-heading mb-3">What to Avoid at the Start</h3>
          <div className="grid lg:grid-cols-3 gap-3 mb-8">
            {[
              { bank: 'SBI, PNB, Bank of Baroda, Canara',  why: 'Too large — will build in-house or demand enterprise customisation beyond current capacity' },
              { bank: 'HDFC, ICICI, Axis',                  why: 'Already have mature in-house AI teams; will build or acquire rather than buy' },
              { bank: 'Urban Co-operative Banks',           why: 'Economics do not work — a bank with 5,000–20,000 customers earns less than PCOP licence fee' },
              { bank: 'NBFCs',                              why: 'Not banks — no Finacle/CBS integration path, different regulatory framework' },
              { bank: 'Payment banks (Airtel, Jio, India Post)', why: 'No lending products — no LTV to protect, nothing for COMPASS cross-sell' },
            ].map((x) => (
              <div key={x.bank} className="p-4 rounded-md border border-soft bg-white">
                <p className="text-[11px] font-bold text-charcoal mb-1">{x.bank}</p>
                <p className="text-[10px] text-gray-500">{x.why}</p>
              </div>
            ))}
          </div>

          <h3 className="text-[14px] font-bold text-charcoal font-heading mb-3">Sequencing Strategy</h3>
          <div className="space-y-3 mb-6">
            {[
              { step: 'Now — Year 1',  action: 'Convert Union Bank iDEA relationship into a paid pilot inside the RBI sandbox with Bank of Maharashtra or a mid-sized PSU bank. One proven uplift number on real data is the entire critical path.' },
              { step: 'Year 1–2',      action: 'Use that result to approach AU Small Finance Bank or Federal Bank — faster private-sector procurement, and the published pilot result is the door-opener.' },
              { step: 'Year 2–3',      action: 'With two live references (one PSU, one private), approach Ujjivan and Jana SFB through the Finacle/FLEXCUBE system integrators already embedded inside them.' },
            ].map((s) => (
              <div key={s.step} className="flex items-start gap-4 p-4 rounded-md border border-soft bg-white">
                <div className="w-8 h-8 rounded-md bg-gradient-brand flex items-center justify-center shrink-0">
                  <span className="text-white text-[10px] font-black">{s.step.split('—')[1]?.trim()?.charAt(0) || s.step.charAt(0)}</span>
                </div>
                <div>
                  <p className="text-[12px] font-bold text-charcoal font-heading">{s.step}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">{s.action}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="p-5 rounded-md border-l-4 border-crimson bg-white border border-soft">
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <strong className="text-charcoal">The single most important selection criterion:</strong> pick the first
              bank based on who will give real CBS data to retrain on — not who pays the most. Real transaction data
              is what turns PCOP from a demo (currently trained on Kaggle + synthetic data) into a product.
            </p>
          </div>
        </section>

        {/* ── FOOTER ──────────────────────────────────────────────────────── */}
        <footer className="pt-12 pb-6 border-t border-soft text-center">
          <p className="text-[11px] text-gray-500">
            Prepared by Team MoneyLords, IIT Guwahati · Union Bank iDEA 2.0 Hackathon, PS-3 · July 2026
          </p>
        </footer>

      </div>
    </div>
  );
}
