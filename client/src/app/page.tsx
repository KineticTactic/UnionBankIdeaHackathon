'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight, Shield, Activity, Plug, CheckCircle2, AlertCircle, Code2, ChevronDown,
  IndianRupee, TrendingUp, BarChart3, Building2, ArrowUpRight, Target, Globe, DollarSign,
  Server, Zap, Quote, BellOff, Megaphone, Scale, Brain, RefreshCw,
} from 'lucide-react';

// ─── Static data ─────────────────────────────────────────────────────────────

const LAYERS = [
  { id: 'L1', name: 'INGEST',  color: 'var(--crimson)',      desc: 'Kafka · T24/Finacle · CRM · Mobile App' },
  { id: 'L2', name: 'ARGUS',   color: 'var(--crimson-dark)', desc: 'Shiryaev-Roberts · CUSUM · SPRT · 9 streams' },
  { id: 'L3', name: 'CHRONOS', color: 'var(--copper)',       desc: 'GENESIS · HABITAT · TARE · GraphSAGE · FusionXV2' },
  { id: 'L4', name: 'COMPASS', color: 'var(--copper-dark)',  desc: 'LangGraph · Life-event inference · Next-best-action' },
  { id: 'L5', name: 'HERALD',  color: 'var(--charcoal)',     desc: 'NVIDIA DeepSeek V4 Pro · Email · SMS · Push' },
  { id: 'L6', name: 'VERDICT', color: 'var(--gray-600)',     desc: 'Doubly-robust ATE · Qini curve · Hillstrom' },
  { id: 'L7', name: 'ORACLE',  color: 'var(--copper-soft)',  desc: 'Thompson Sampling · Weekly retrain · Prompt optimisation' },
];

const REAL = [
  { real: true,  text: 'All 7 AI/ML layers fully designed, documented and implemented' },
  { real: true,  text: 'ARGUS algorithms (SR, CUSUM, SPRT) - real statistical implementations' },
  { real: true,  text: 'CHRONOS 5-model ensemble with conformal prediction intervals' },
  { real: true,  text: 'HERALD content generation via live NVIDIA DeepSeek V4 Pro API' },
  { real: true,  text: 'VERDICT doubly-robust ATE estimator and Qini uplift curves' },
  { real: true,  text: 'REST API - any banking portal can integrate with one endpoint' },
  { real: false, text: '50 customers are synthetic - scores pre-computed for demo' },
  { real: false, text: 'No live bank feed - Kafka events simulated every 8 seconds' },
];

const SIGNALS = [
  { type: 'Balance Decline',     method: 'CUSUM', conf: 91, desc: 'Sustained balance drop over 6 weeks - CUSUM detects the downward regime shift before it reaches zero.' },
  { type: 'Salary Credit Miss',  method: 'SPRT',  conf: 88, desc: 'No salary credit for 2 consecutive months - Wald sequential test fires after the second absence.' },
  { type: 'App Login Drop',      method: 'SR',    conf: 84, desc: '18 → 2 logins/month - Shiryaev-Roberts detects the engagement regime change instantly.' },
  { type: 'Complaint Spike',     method: 'SPRT',  conf: 97, desc: '3 complaints in 30d vs. 0.2/month baseline - Poisson SPRT fires after the first abnormal count.' },
  { type: 'Competitor Transfer', method: 'CUSUM', conf: 79, desc: 'Recurring ₹50K outward IMPS to HDFC - CUSUM detects the new periodic outflow pattern.' },
  { type: 'Dormancy',            method: 'SR',    conf: 95, desc: '45+ days zero transactions - SR detects step-change from active-customer prior in one pass.' },
];

const CREDS = [
  { user: 'analyst', pass: 'analyst123', role: 'Risk Analyst',     access: 'Signals · scores · analytics (read-only)' },
  { user: 'rm_user', pass: 'rm123',      role: 'Relationship Mgr', access: 'Outreach queue · customer notes' },
  { user: 'admin',   pass: 'admin123',   role: 'Administrator',    access: 'Full platform access' },
];

const METHOD: Record<string, string> = {
  SR:    'bg-crimson-soft text-crimson',
  CUSUM: 'bg-copper-soft text-copper-dark',
  SPRT:  'bg-copper-pale text-copper-dark',
};

const PRICING = [
  { tier: 'Small SFB / Mid PSU', rms: '50–100',  price: '₹1–2 Cr',  usd: '$120K–240K',  accent: 'copper' },
  { tier: 'Mid PVB / Large PSU', rms: '100–300', price: '₹2–5 Cr',  usd: '$240K–600K',  accent: 'crimson' },
  { tier: 'Large PVB',           rms: '300–1K',  price: '₹5–15 Cr', usd: '$600K–1.8M',  accent: 'copper' },
];

const ROI_ROW = [
  { label: 'Churn savings (Yr 1 revenue)',   value: '₹49.4 Cr' },
  { label: 'Cross-sell revenue',             value: '₹78.8 Cr' },
  { label: 'Total value created per year',   value: '₹128.2 Cr', bold: true },
  { label: 'PCOP annual cost to bank',       value: '₹6–10.2 Cr' },
  { label: 'Net profit to bank',             value: '₹118 Cr',   bold: true },
  { label: 'ROI',                            value: '11.6x',     accent: true },
];

const GTM_TIERS = [
  { tier: 'Tier 1 - Private Banks',     banks: 'AU SFB · Bandhan · Federal · South Indian · Karnataka · DCB · RBL',          why: 'Decide in 6–12 months, feel churn pressure acutely, right-sized customer base for CHRONOS without a multi-year integration.', accent: 'copper',  cls: 'border-copper/30 bg-copper/[0.04]' },
  { tier: 'Tier 2 - Mid-Sized PSU',     banks: 'Bank of Maharashtra · Punjab & Sind · UCO · Indian Overseas · Central Bank', why: 'The Union Bank iDEA relationship converts into a design-partner pilot. Winning one PSU unlocks the rest - they watch each other closely.', accent: 'crimson', cls: 'border-crimson/30 bg-crimson/[0.04]' },
  { tier: 'Tier 3 - Small Finance Banks', banks: 'Ujjivan SFB · Jana SFB · ESAF SFB · Suryoday SFB',                        why: 'Raising AI spend fastest as they scale toward universal-bank status. Their biggest pain point is precisely what PCOP solves.', accent: 'copper',  cls: 'border-copper/30 bg-copper/[0.04]' },
];

const SCALE_PILLARS = [
  { icon: Code2,     title: 'Stateless Orchestration', body: 'Zero in-memory state. JWTs with 8-hour TTL, no session tables. pm2 -i 8 behind nginx - no cache invalidation, no sticky sessions.' },
  { icon: Shield,    title: 'Async by Default',         body: 'BullMQ on Redis with sync fallback. API returns 202 with jobId; worker runs at concurrency 5. Redis down? Falls back to sync - degrade, not fail.' },
  { icon: BarChart3, title: 'Postgres at Every Tier',   body: 'Sharding-ready: customer_id leads every table. At 1M customers, add Citus - same queries, zero app changes.' },
  { icon: Activity,  title: 'Kafka Event Spine',        body: 'Signals, approvals, consent changes all flow through Kafka keyed by customer_id. Ordered processing, audit replay. New consumer = 2 lines.' },
  { icon: Plug,      title: 'Abstracted LLM Layer',     body: 'callNvidia() with Claude fallback, 30s timeout, p-limit concurrency, circuit breaker. Token usage tracked per customer.' },
  { icon: Globe,     title: 'Translation at Scale',     body: 'Provider-agnostic wrapper around Google Cloud Translation. Used for Composer transcreate with back-translation. 70% under free tier.' },
];

const LAYER_HEROES = [
  { code: 'ARGUS',   layer: 'L2', accent: 'crimson', Icon: Activity,   desc: 'Statistical detection layer. Picks up subtle behavioural changes using SR, CUSUM and SPRT across 9 independent streams - raising early signals before any explicit event fires.' },
  { code: 'CHRONOS', layer: 'L3', accent: 'copper',  Icon: Brain,      desc: 'ML ensemble. Reads ARGUS signals and converts them into confidence scores using GENESIS, HABITAT, TARE, GraphSAGE and FusionX V2.' },
  { code: 'NEXUS',   layer: 'L4', accent: 'copper',  Icon: TrendingUp, desc: 'Cross-sell engine. Recommends the next right product based on peer behaviour and life events. Gets sharper every time a customer call or message is fed back.' },
  { code: 'ORACLE',  layer: 'L7', accent: 'crimson', Icon: RefreshCw,  desc: 'Continuous learning. Watches every outcome, learns what worked, and retrains all models weekly - so the whole system keeps getting smarter.' },
];

// ─── Navbar ───────────────────────────────────────────────────────────────────

function Navbar() {
  return (
    <nav className="fixed top-0 inset-x-0 z-50 bg-white/95 backdrop-blur-md border-b border-soft">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="#top" className="flex items-center gap-2.5">
          <Image src="/pcop_logo.png" alt="PCOP" width={32} height={18} className="h-[18px] w-auto" priority />
          <span className="text-[14px] font-bold font-heading text-charcoal">PCOP</span>
          <span className="text-gray-500 text-[10px] font-semibold px-2 py-0.5 rounded-md border border-soft uppercase tracking-wider ml-1">Demo</span>
        </Link>
        <div className="flex items-center gap-6">
          <Link href="/business-model" className="text-[13px] text-charcoal/70 hover:text-charcoal transition-colors hidden md:block">Business Model</Link>
          <Link href="/login" className="flex items-center gap-1.5 text-[13px] font-semibold px-4 py-2 rounded-md text-white bg-gradient-brand hover:opacity-90 transition-all">
            Enter Platform <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </nav>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      const map: Record<string, string> = {
        '1': 'top', '2': 'market', '3': 'problem',
        '4': 'pipeline', '5': 'scalability', '6': 'business', '7': 'login',
      };
      if (map[e.key]) {
        const el = document.getElementById(map[e.key]);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      if (e.key === 'a' || e.key === 'A') window.location.href = '/admin/argus';
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="w-full min-h-screen bg-cream text-charcoal">
      <Navbar />

      {/* ── 1 · HERO / HOOK ──────────────────────────────────────────────── */}
      <section id="top" className="relative min-h-screen flex flex-col items-center justify-center text-center overflow-hidden bg-white pt-14">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-mesh-gradient animate-pulse-soft" />
        <div className="absolute top-[15%] left-[10%] w-[600px] h-[600px] opacity-80 pointer-events-none animate-mesh-a"
             style={{ background: 'radial-gradient(circle, rgba(180,107,62,0.7) 0%, transparent 65%)' }} />
        <div className="absolute bottom-[10%] right-[8%] w-[650px] h-[650px] opacity-70 pointer-events-none animate-mesh-b"
             style={{ background: 'radial-gradient(circle, rgba(107,19,43,0.6) 0%, transparent 65%)' }} />
        <div className="absolute inset-0 bg-dot-grid" />
        <div className="absolute top-[20%] left-0 right-0 h-px overflow-hidden">
          <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-copper to-transparent opacity-60 animate-line" />
        </div>
        <div className="absolute top-[55%] left-0 right-0 h-px overflow-hidden">
          <div className="h-full w-1/2 bg-gradient-to-r from-transparent via-crimson to-transparent opacity-50 animate-line" style={{ animationDelay: '2s' }} />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-6">
          <div className="inline-flex items-center gap-2 mb-8 px-4 py-2 rounded-md text-crimson text-[11px] font-semibold uppercase tracking-widest bg-crimson-soft border border-crimson">
            <span className="w-1.5 h-1.5 rounded-full bg-gradient-brand animate-live-pulse" />
            Union Bank · IDEA 2.0 Hackathon 2026
          </div>

          <h1 className="font-heading font-bold leading-[0.95] mb-6 animate-fade-up delay-100"
              style={{ fontSize: 'clamp(2.5rem, 7vw, 5.5rem)', letterSpacing: '-0.04em' }}>
            <span className="text-charcoal">Predict.</span>{' '}
            <span className="text-gradient">Personalise.</span>{' '}
            <span className="text-charcoal">Retain.</span>
          </h1>

          <p className="text-gray-500 text-[16px] leading-relaxed mb-10 max-w-2xl mx-auto animate-fade-up delay-200">
            A fully agentic 7-layer AI/ML platform that identifies retail banking customers
            at risk of attrition <strong className="text-charcoal">weeks before any explicit signal</strong> - and
            automatically orchestrates hyper-personalised outreach.
          </p>

          <div className="flex items-center justify-center gap-4 flex-wrap animate-fade-up delay-300">
            <Link href="/login"
              className="group inline-flex items-center gap-2 text-[15px] font-bold px-8 py-4 rounded-md text-white bg-gradient-brand hover:opacity-90 transition-all">
              Try the Demo <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <a href="#market" className="inline-flex items-center gap-2 text-[14px] font-semibold px-6 py-4 rounded-md text-charcoal hover:text-crimson transition-colors border border-soft hover:border-crimson">
              See the Business Case
            </a>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-4 gap-3 mt-16 max-w-2xl mx-auto animate-fade-up delay-400">
            {[
              { v: '7',     l: 'ML Layers' },
              { v: '0.93',  l: 'AUC Score' },
              { v: '9',     l: 'Signal Streams' },
              { v: '< 4h',  l: 'Detection Lag' },
            ].map(s => (
              <div key={s.l} className="relative text-center p-4 rounded-md bg-white border border-soft overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-copper/40 to-transparent" />
                <p className="text-charcoal text-[22px] font-black leading-none font-heading tabular-nums">{s.v}</p>
                <p className="text-gray-400 text-[10px] uppercase tracking-wider mt-1.5">{s.l}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-gray-400 animate-bounce">
          <span className="text-[10px] uppercase tracking-widest">Scroll</span>
          <ChevronDown className="w-4 h-4" />
        </div>
      </section>

      {/* ── 2 · MARKET OPPORTUNITY ───────────────────────────────────────── */}
      <section id="market" className="relative py-32 px-6 bg-cream overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full opacity-[0.05] pointer-events-none"
             style={{ background: 'radial-gradient(circle, var(--copper) 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full opacity-[0.04] pointer-events-none"
             style={{ background: 'radial-gradient(circle, var(--crimson) 0%, transparent 70%)' }} />

        <div className="relative max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-md text-copper text-[10px] font-bold uppercase tracking-widest bg-copper-soft border border-copper animate-fade-up">
              <Target className="w-3 h-3" />
              The Business
            </div>
            <h2 className="text-[40px] lg:text-[52px] font-heading font-bold text-charcoal mb-4 leading-[1.05] animate-fade-up delay-100"
                style={{ letterSpacing: '-0.03em' }}>
              India's banking retention crisis<br />
              <span className="text-gradient">is a billion-dollar problem.</span>
            </h2>
            <p className="text-gray-500 text-[16px] max-w-2xl mx-auto animate-fade-up delay-200">
              We're not asking any bank to buy into the whole market on day one - we charge per transaction analysed,
              so a bank pilots on one branch, sees the proof, and scales up from there.
            </p>
          </div>

          {/* Big stat cards */}
          <div className="grid lg:grid-cols-3 gap-4 mb-12">
            {/* 16% inactive card with bar chart */}
            <div className="lg:col-span-1 p-7 rounded-md border border-soft bg-white hover-lift animate-fade-up delay-200">
              <p className="text-[9px] font-black uppercase tracking-[0.15em] text-copper mb-4">World Bank Findex 2025</p>
              <p className="text-[64px] font-black font-heading text-gradient leading-none tabular-nums" style={{ letterSpacing: '-0.05em' }}>16%</p>
              <p className="text-[14px] font-bold text-charcoal mt-2 mb-5">of Indian bank accounts sit inactive</p>

              {/* Bar comparison */}
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-[10px] font-bold mb-1">
                    <span className="text-charcoal">India</span>
                    <span className="text-crimson">16%</span>
                  </div>
                  <div className="h-2 bg-cream rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-brand transition-all duration-1000" style={{ width: '80%' }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[10px] font-bold mb-1">
                    <span className="text-charcoal">Dev. Economies Avg</span>
                    <span className="text-gray-400">4%</span>
                  </div>
                  <div className="h-2 bg-cream rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-gray-300 transition-all duration-1000" style={{ width: '20%' }} />
                  </div>
                </div>
              </div>
              <p className="mt-3 text-[11px] text-crimson font-bold">4× the developing-economy average</p>
            </div>

            {/* Market growth card */}
            <div className="lg:col-span-1 p-7 rounded-md border border-soft bg-white hover-lift animate-fade-up delay-300">
              <p className="text-[9px] font-black uppercase tracking-[0.15em] text-copper mb-4">Grand View Research</p>
              <div className="flex items-end gap-3 mb-2">
                <div>
                  <p className="text-[11px] text-gray-400 font-bold mb-1">2025</p>
                  <p className="text-[38px] font-black font-heading text-charcoal leading-none tabular-nums">$2B</p>
                </div>
                <div className="flex-1 pb-2">
                  <div className="flex items-center gap-1">
                    <div className="flex-1 h-0.5 bg-gradient-brand" />
                    <ArrowRight className="w-4 h-4 text-crimson shrink-0" />
                  </div>
                  <p className="text-[9px] text-center text-gray-400 mt-1 font-bold uppercase tracking-wider">8× growth</p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-400 font-bold mb-1">2033</p>
                  <p className="text-[38px] font-black font-heading text-gradient leading-none tabular-nums">$16B</p>
                </div>
              </div>
              <p className="text-[14px] font-bold text-charcoal mt-4 mb-2">India AI banking retention spend</p>
              {/* Growth bar */}
              <div className="mt-4 relative h-3 bg-cream rounded-full overflow-hidden">
                <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-brand" style={{ width: '12.5%' }} />
                <div className="absolute inset-y-0 right-0 rounded-full bg-crimson/20" style={{ width: '87.5%' }} />
              </div>
              <div className="flex justify-between text-[9px] text-gray-400 mt-1 font-bold">
                <span>Today (12.5%)</span><span>2033 target</span>
              </div>
            </div>

            {/* Pilot-to-scale card */}
            <div className="lg:col-span-1 p-7 rounded-md border border-soft bg-white hover-lift animate-fade-up delay-400">
              <p className="text-[9px] font-black uppercase tracking-[0.15em] text-copper mb-4">Business Model</p>
              <p className="text-[16px] font-black font-heading text-charcoal mb-5">Per-transaction pricing - pilot on one branch, prove value, scale up.</p>

              <div className="space-y-3">
                {[
                  { step: '01', label: 'Pilot',   desc: 'One branch, 3-month proof-of-value' },
                  { step: '02', label: 'Prove',   desc: 'VERDICT measures causal uplift' },
                  { step: '03', label: 'Scale',   desc: 'Roll to full portfolio - no rebuild' },
                ].map(s => (
                  <div key={s.step} className="flex items-center gap-3 p-3 rounded-md bg-cream border border-soft">
                    <span className="text-[10px] font-black text-crimson w-6 shrink-0">{s.step}</span>
                    <div>
                      <p className="text-[12px] font-bold text-charcoal">{s.label}</p>
                      <p className="text-[10px] text-gray-500">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Market sizing strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-fade-up delay-500">
            {[
              { label: 'India SAM (2025)',   value: '$35M',   sub: 'SaaS license revenue',       icon: Target },
              { label: 'India SAM (2030)',   value: '$200M',  sub: 'Capturable platform spend',   icon: TrendingUp },
              { label: 'Year 3 ARR Target',  value: '$4.7M',  sub: '8–12 banks live',            icon: BarChart3 },
              { label: 'Year 5 ARR Target',  value: '$14.5M', sub: '35–40 banks, SE Asia entry', icon: Globe },
            ].map(m => {
              const Icon = m.icon;
              return (
                <div key={m.label} className="group p-5 rounded-md border border-soft hover:border-copper bg-white transition-all duration-300 hover-lift">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-md bg-white border border-soft flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Icon className="w-4 h-4 text-copper" />
                    </div>
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{m.label}</span>
                  </div>
                  <p className="text-[26px] font-black text-charcoal font-heading tabular-nums tracking-tight">{m.value}</p>
                  <p className="text-[10px] text-gray-500 mt-1">{m.sub}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── 3 · THE PROBLEM ──────────────────────────────────────────────── */}
      <section id="problem" className="relative py-32 px-6 bg-white overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full opacity-[0.04] pointer-events-none"
             style={{ background: 'radial-gradient(circle, var(--crimson) 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full opacity-[0.04] pointer-events-none"
             style={{ background: 'radial-gradient(circle, var(--copper) 0%, transparent 70%)' }} />

        <div className="relative max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-md text-crimson text-[10px] font-bold uppercase tracking-widest bg-crimson-soft border border-crimson animate-fade-up">
              <AlertCircle className="w-3 h-3" />
              Why Every Existing System Gets This Wrong
            </div>
            <h2 className="text-[40px] lg:text-[50px] font-heading font-bold text-charcoal mb-5 leading-[1.05] animate-fade-up delay-100"
                style={{ letterSpacing: '-0.03em' }}>
              A signal is a reaction.<br />
              <span className="text-gradient">Not a reason.</span>
            </h2>
            <p className="text-gray-500 text-[16px] max-w-2xl mx-auto animate-fade-up delay-200">
              Every CRM already sees missed salary credits, fewer logins, a complaint spike.
              But these are <em>symptoms</em> - the customer had already decided to leave weeks earlier.
            </p>
          </div>

          {/* CRM vs PCOP comparison */}
          <div className="grid lg:grid-cols-2 gap-4 mb-14 animate-fade-up delay-300">
            {/* What CRMs see */}
            <div className="p-6 rounded-md border border-soft bg-cream">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center">
                  <AlertCircle className="w-4 h-4 text-gray-400" />
                </div>
                <div>
                  <p className="text-[13px] font-bold text-gray-500 font-heading">What every CRM sees</p>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider">Lagging indicators - reactions</p>
                </div>
              </div>
              <div className="space-y-2">
                {['Missed salary credit', 'Fewer app logins', 'Balance near zero', 'Account closure request'].map(s => (
                  <div key={s} className="flex items-center gap-3 p-3 rounded-md bg-white border border-soft">
                    <div className="w-5 h-5 rounded-full border-2 border-gray-300 flex items-center justify-center shrink-0">
                      <span className="w-2 h-2 rounded-full bg-gray-300" />
                    </div>
                    <span className="text-[13px] text-gray-500">{s}</span>
                    <span className="ml-auto text-[9px] font-bold text-gray-300 uppercase tracking-wider">symptom</span>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-[12px] text-gray-400 leading-relaxed italic">
                By the time these fire, the customer has already decided to leave.
              </p>
            </div>

            {/* What PCOP reads */}
            <div className="p-6 rounded-md border border-crimson/30 bg-crimson/[0.03]">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-md bg-gradient-brand flex items-center justify-center">
                  <Activity className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-[13px] font-bold text-charcoal font-heading">What PCOP reads alongside</p>
                  <p className="text-[10px] text-crimson uppercase tracking-wider font-bold">Causal context - reasons</p>
                </div>
              </div>
              <div className="space-y-2">
                {[
                  'Declined card 6 weeks ago',
                  'Unresolved complaint thread',
                  'Outage they were still annoyed about',
                  'Competitor transfer pattern emerging',
                ].map(s => (
                  <div key={s} className="flex items-center gap-3 p-3 rounded-md bg-white border border-crimson/20">
                    <div className="w-5 h-5 rounded-full bg-gradient-brand flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-[13px] text-charcoal font-semibold">{s}</span>
                    <span className="ml-auto text-[9px] font-bold text-crimson uppercase tracking-wider">causal</span>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-[12px] text-charcoal leading-relaxed font-semibold">
                We read incident reports and call logs alongside behaviour - so the real reason shows up, not just the symptom.
              </p>
            </div>
          </div>

          {/* Root cause cards */}
          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest text-center mb-6 animate-fade-up delay-400">Three Structural Gaps in Existing Solutions</p>
          <div className="grid lg:grid-cols-3 gap-4">
            {[
              { icon: BellOff,  title: 'Signals arrive too late',        body: 'Account closure requests and balance-zero events are lagging indicators. By then the decision is made.', accent: 'crimson' },
              { icon: Megaphone, title: 'Outreach is generic',           body: 'Blanket campaign mailers ignore individual context - salary drops, life events, competitor activity - generating noise instead of retention.', accent: 'copper' },
              { icon: Scale,    title: 'No causal measurement',          body: "Banks can't distinguish customers retained by outreach from those who would have stayed anyway - wasting budget on the wrong cohort.", accent: 'crimson' },
            ].map((c, i) => {
              const Icon = c.icon;
              return (
                <div key={c.title}
                  className={`group p-6 rounded-md border bg-white border-soft transition-all duration-300 hover-lift animate-fade-up ${c.accent === 'crimson' ? 'hover:border-crimson' : 'hover:border-copper'}`}
                  style={{ animationDelay: `${0.5 + i * 0.1}s` }}>
                  <div className={`w-10 h-10 rounded-md flex items-center justify-center mb-4 ${c.accent === 'crimson' ? 'bg-crimson-soft' : 'bg-copper-soft'}`}>
                    <Icon className={`w-5 h-5 ${c.accent === 'crimson' ? 'text-crimson' : 'text-copper'}`} />
                  </div>
                  <p className="text-[15px] font-bold text-charcoal font-heading mb-2">{c.title}</p>
                  <p className="text-[12px] text-gray-500 leading-relaxed">{c.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── 4 · PCOP PIPELINE ────────────────────────────────────────────── */}
      <section id="pipeline" className="relative py-32 px-6 bg-cream overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] opacity-20 pointer-events-none animate-mesh-a"
             style={{ background: 'radial-gradient(circle, rgba(180,107,62,0.2) 0%, transparent 60%)' }} />

        <div className="relative max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-md text-copper text-[10px] font-bold uppercase tracking-widest bg-copper-soft border border-copper animate-fade-up">
              <Activity className="w-3 h-3" />
              The Solution
            </div>
            <h2 className="text-[40px] lg:text-[50px] font-heading font-bold text-charcoal mb-5 leading-[1.05] animate-fade-up delay-100"
                style={{ letterSpacing: '-0.03em' }}>
              PCOP - a 7-layer<br />
              <span className="text-gradient">ML orchestration pipeline</span>
            </h2>
            <p className="text-gray-500 text-[16px] max-w-3xl mx-auto animate-fade-up delay-200">
              Watches a bank's everyday customer activity, spots early warning signs <strong className="text-charcoal">weeks before they do</strong>, and automatically
              reaches out in a personal, relevant way - proving with real evidence that each outreach actually worked.
              Plugs directly into the CRM software banks already use today.
            </p>
          </div>

          {/* 7-layer architecture */}
          <div className="max-w-3xl mx-auto mb-16">
            <div className="space-y-2">
              {LAYERS.map((layer, i) => (
                <div key={layer.id} className="flex rounded-md overflow-hidden border border-soft bg-white group hover-lift transition-all duration-200">
                  <div className="w-[96px] shrink-0 flex flex-col items-center justify-center py-4 text-white"
                       style={{ backgroundColor: layer.color, color: layer.color === 'var(--copper-soft)' ? 'var(--charcoal)' : '#FFFFFF' }}>
                    <span className="text-[9px] font-bold opacity-70 uppercase tracking-widest">{layer.id}</span>
                    <span className="text-[13px] font-black tracking-tight mt-0.5 font-heading">{layer.name}</span>
                  </div>
                  <div className="flex-1 px-5 py-3 flex items-center">
                    <p className="text-[12px] text-gray-500">{layer.desc}</p>
                  </div>
                  <div className="flex items-center pr-4">
                    <span className="w-6 h-6 rounded-md text-[10px] font-black text-white flex items-center justify-center bg-gradient-brand">{i + 1}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-center gap-6 text-[11px] text-gray-400">
              <span className="flex items-center gap-1.5"><span className="w-2 h-px bg-gradient-brand inline-block" />Data flows top-to-bottom</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-px bg-copper inline-block" />Learning flows bottom-to-top</span>
            </div>
          </div>

          {/* Layer hero callouts */}
          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest text-center mb-8 animate-fade-up">Key Intelligence Layers</p>
          <div className="grid lg:grid-cols-4 gap-4 mb-16">
            {LAYER_HEROES.map((l, i) => {
              const Icon = l.Icon;
              return (
                <div key={l.code}
                  className={`group p-5 rounded-md border transition-all duration-300 hover-lift animate-fade-up ${
                    l.accent === 'crimson'
                      ? 'border-crimson/30 bg-crimson/[0.03] hover:border-crimson/60'
                      : 'border-copper/30 bg-copper/[0.03] hover:border-copper/60'
                  }`}
                  style={{ animationDelay: `${0.2 + i * 0.08}s` }}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-9 h-9 rounded-md flex items-center justify-center group-hover:scale-110 transition-transform ${
                      l.accent === 'crimson' ? 'bg-crimson-soft' : 'bg-copper-soft'
                    }`}>
                      <Icon className={`w-4.5 h-4.5 ${l.accent === 'crimson' ? 'text-crimson' : 'text-copper'}`} />
                    </div>
                    <div>
                      <p className={`text-[16px] font-black font-heading tracking-tight ${l.accent === 'crimson' ? 'text-crimson' : 'text-copper'}`}>{l.code}</p>
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">{l.layer}</span>
                    </div>
                  </div>
                  <p className="text-[12px] text-gray-600 leading-relaxed">{l.desc}</p>
                </div>
              );
            })}
          </div>

          {/* ARGUS signals in production */}
          <div className="mb-6">
            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest text-center mb-3">ARGUS - Signals in Production</p>
            <p className="text-center text-[13px] text-gray-400 mb-8">9 behavioural streams per customer, 3 statistical methods. These would fire on real transaction data.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {SIGNALS.map((s, i) => (
                <div key={s.type}
                  className="group relative p-5 rounded-md border border-soft hover:border-crimson bg-white transition-all duration-300 hover-lift overflow-hidden animate-fade-up"
                  style={{ animationDelay: `${0.3 + i * 0.07}s` }}>
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-crimson via-copper to-crimson opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="flex items-start justify-between mb-3">
                    <span className={`text-[9px] font-black px-2 py-1 rounded-md uppercase tracking-wider ${METHOD[s.method]}`}>{s.method}</span>
                    <div className="flex items-baseline gap-0.5">
                      <span className="text-[26px] font-black text-charcoal leading-none font-heading tabular-nums">{s.conf}</span>
                      <span className="text-[11px] font-bold text-crimson">%</span>
                    </div>
                  </div>
                  <p className="text-[14px] font-bold text-charcoal mb-1.5 font-heading">{s.type}</p>
                  <p className="text-[11px] text-gray-500 leading-relaxed">{s.desc}</p>
                  <div className="mt-3 pt-3 border-t border-soft">
                    <div className="flex-1 h-1 bg-cream rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-brand" style={{ width: `${s.conf}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { name: 'SR',    full: 'Shiryaev-Roberts',       desc: 'gradual regime shifts' },
                { name: 'CUSUM', full: 'Cumulative Sum',          desc: 'step changes' },
                { name: 'SPRT',  full: 'Sequential Probability',  desc: 'rate changes' },
              ].map(m => (
                <div key={m.name} className="p-3 rounded-md bg-white border border-soft text-center hover-lift">
                  <span className="text-[10px] font-bold text-crimson uppercase tracking-widest">{m.name}</span>
                  <p className="text-[12px] font-bold text-charcoal mt-0.5 font-heading">{m.full}</p>
                  <p className="text-[10px] text-gray-500">{m.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── DEMO BRIDGE ──────────────────────────────────────────────────── */}
      <section className="relative py-20 px-6 text-white overflow-hidden bg-gradient-brand">
        <div className="absolute inset-0 opacity-20"
             style={{ background: 'radial-gradient(ellipse 800px 400px at 20% 30%, rgba(255,255,255,0.4) 0%, transparent 60%)' }} />
        <div className="absolute inset-0 bg-dot-grid opacity-30" />

        <div className="relative max-w-5xl mx-auto">
          {/* Transparency - what's real */}
          <div className="mb-10">
            <p className="text-[10px] font-bold uppercase tracking-widest text-copper mb-3">Transparency Notice</p>
            <h3 className="text-[26px] font-heading font-bold text-white mb-2" style={{ letterSpacing: '-0.02em' }}>Demonstration Environment</h3>
            <p className="text-[14px] text-white/70 max-w-2xl">
              A <strong className="text-white">functional prototype</strong> showing exactly how PCOP looks in a real Union Bank deployment.
              The UI, dashboards, signals, scores, and AI-generated content are representative of real system output.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
            {REAL.map((r, i) => (
              <div key={i}
                className={`flex items-start gap-2.5 p-3.5 rounded-md border ${r.real ? 'bg-white/10 border-white/20' : 'bg-black/20 border-white/10'}`}>
                <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${r.real ? 'bg-copper/20' : 'bg-white/10'}`}>
                  {r.real ? <CheckCircle2 className="w-3 h-3 text-copper" /> : <AlertCircle className="w-3 h-3 text-white/30" />}
                </div>
                <p className={`text-[11px] leading-snug ${r.real ? 'text-white' : 'text-white/40'}`}>{r.text}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link href="/login"
              className="group inline-flex items-center gap-2 text-[15px] font-bold px-8 py-4 rounded-md text-charcoal bg-white hover:bg-copper-pale transition-all">
              Enter the Platform
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <p className="text-white/60 text-[13px]">
              Log in as <code className="bg-white/10 px-2 py-0.5 rounded font-mono">rm_user</code> or <code className="bg-white/10 px-2 py-0.5 rounded font-mono">admin</code> for the full demo
            </p>
          </div>
        </div>
      </section>

      {/* ── 5 · SCALABILITY ──────────────────────────────────────────────── */}
      <section id="scalability" className="relative py-24 px-6 bg-white overflow-hidden">
        <div className="absolute top-0 left-0 w-[500px] h-[500px] rounded-full opacity-[0.04] pointer-events-none"
             style={{ background: 'radial-gradient(circle, var(--crimson) 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full opacity-[0.04] pointer-events-none"
             style={{ background: 'radial-gradient(circle, var(--copper) 0%, transparent 70%)' }} />

        <div className="relative max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-md text-copper text-[10px] font-bold uppercase tracking-widest bg-copper-soft border border-copper animate-fade-up">
              <Server className="w-3 h-3" />
              Scalability
            </div>
            <h2 className="text-[44px] font-heading font-bold text-charcoal mb-4 leading-[1.05] animate-fade-up delay-100"
                style={{ letterSpacing: '-0.03em' }}>
              Seven independent microservices,<br />
              <span className="text-gradient">each one scales on its own.</span>
            </h2>
            <p className="text-gray-500 text-[16px] max-w-2xl mx-auto animate-fade-up delay-200">
              Growing from 50 customers to 50 million means <strong className="text-charcoal">adding capacity, not rebuilding anything.</strong> The same pattern Netflix uses for independent scaling and failure domains.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-4 mb-8">
            {SCALE_PILLARS.map((p, i) => {
              const Icon = p.icon;
              return (
                <div key={p.title}
                  className="group relative p-6 rounded-md border border-soft bg-cream transition-all duration-300 hover-lift overflow-hidden animate-fade-up"
                  style={{ animationDelay: `${0.3 + i * 0.08}s` }}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-md bg-gradient-brand flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <p className="text-[14px] font-bold text-charcoal font-heading">{p.title}</p>
                  </div>
                  <p className="text-[12px] text-gray-500 leading-relaxed">{p.body}</p>
                </div>
              );
            })}
          </div>

          {/* Port map */}
          <div className="p-5 rounded-md border border-soft bg-cream animate-fade-up delay-500">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-md bg-copper-soft flex items-center justify-center">
                <Zap className="w-4 h-4 text-copper" />
              </div>
              <p className="text-[13px] font-bold text-charcoal font-heading">Layer Architecture - Port Map</p>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              {[
                { port: '3001', name: 'Bank API',    color: 'bg-copper-soft text-copper' },
                { port: '8000', name: 'Orchestrator', color: 'bg-crimson-soft text-crimson' },
                { port: '8001', name: 'CHRONOS',      color: 'bg-copper-soft text-copper' },
                { port: '8002', name: 'ARGUS',        color: 'bg-crimson-soft text-crimson' },
                { port: '8004', name: 'COMPASS',      color: 'bg-copper-soft text-copper' },
                { port: '8005', name: 'HERALD',       color: 'bg-cream text-charcoal border border-soft' },
                { port: '8006', name: 'VERDICT',      color: 'bg-cream text-charcoal border border-soft' },
                { port: '8007', name: 'ORACLE',       color: 'bg-cream text-charcoal border border-soft' },
              ].map(svc => (
                <div key={svc.port} className="flex items-center gap-2.5 p-2.5 rounded-md bg-white border border-soft">
                  <code className={`text-[10px] font-black px-2 py-1 rounded shrink-0 tracking-wider ${svc.color}`}>{svc.port}</code>
                  <span className="text-[12px] font-bold text-charcoal">{svc.name}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-gray-500">Each service owns its own data, dependencies, and port. Independent deploys, independent scaling, independent failure domains.</p>
          </div>

          {/* Compliance strip */}
          <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-3 animate-fade-up delay-600">
            {[
              { label: 'DPDPA 2023',        sub: 'Full compliance mapped' },
              { label: 'TRAI Regs',         sub: 'Consent + 155-char SMS' },
              { label: 'RBI Outsourcing',   sub: 'India-only data residency' },
              { label: 'Model Risk',        sub: 'Holdout-gated deployment' },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-3 p-4 rounded-md border border-soft bg-cream">
                <div className="w-2 h-2 rounded-full bg-gradient-brand shrink-0" />
                <div>
                  <p className="text-[12px] font-bold text-charcoal">{s.label}</p>
                  <p className="text-[10px] text-gray-500">{s.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 6 · BUSINESS MODEL ───────────────────────────────────────────── */}
      <section id="business" className="relative py-24 px-6 bg-cream overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full opacity-[0.04] pointer-events-none"
             style={{ background: 'radial-gradient(circle, var(--copper) 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full opacity-[0.04] pointer-events-none"
             style={{ background: 'radial-gradient(circle, var(--crimson) 0%, transparent 70%)' }} />

        <div className="relative max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-md text-copper text-[10px] font-bold uppercase tracking-widest bg-copper-soft border border-copper animate-fade-up">
              <IndianRupee className="w-3 h-3" />
              Business Model
            </div>
            <h2 className="text-[44px] font-heading font-bold text-charcoal mb-4 leading-[1.05] animate-fade-up delay-100"
                style={{ letterSpacing: '-0.03em' }}>
              Proven economics for<br />
              <span className="text-gradient">Indian retail banking</span>
            </h2>
            <p className="text-gray-500 text-[16px] max-w-xl mx-auto animate-fade-up delay-200">
              Priced for India. Built for compliance. Proven by causal measurement.
            </p>
          </div>

          {/* Pricing + ROI */}
          <div className="grid lg:grid-cols-5 gap-4 mb-14">
            <div className="lg:col-span-3 rounded-md border border-soft bg-white overflow-hidden animate-fade-up delay-200">
              <div className="px-6 py-4 border-b border-soft flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-gradient-brand flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-[13px] font-bold text-charcoal font-heading">Pricing Tiers</p>
                  <p className="text-[10px] text-gray-500">Annual license by RM headcount</p>
                </div>
              </div>
              <div className="divide-y divide-soft">
                {PRICING.map(p => (
                  <div key={p.tier} className="grid grid-cols-3 gap-4 px-6 py-3.5 items-center hover:bg-cream transition-colors">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-5 h-5 rounded-sm flex items-center justify-center shrink-0 ${p.accent === 'crimson' ? 'bg-crimson-soft' : 'bg-copper-soft'}`}>
                        <Building2 className={`w-3 h-3 ${p.accent === 'crimson' ? 'text-crimson' : 'text-copper'}`} />
                      </div>
                      <span className="text-[13px] font-bold text-charcoal font-heading">{p.tier}</span>
                    </div>
                    <div className="text-center">
                      <span className="text-[10px] text-gray-400 uppercase tracking-wider">RMs</span>
                      <p className="text-[13px] font-bold text-charcoal tabular-nums">{p.rms}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-gray-400 uppercase tracking-wider">{p.usd}</span>
                      <p className="text-[15px] font-black text-charcoal font-heading tabular-nums">{p.price}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-6 py-3 bg-cream border-t border-soft flex items-center gap-2">
                <ArrowUpRight className="w-3 h-3 text-copper" />
                <span className="text-[10px] text-gray-500">72% gross margin at steady state</span>
              </div>
            </div>

            <div className="lg:col-span-2 rounded-md border border-soft bg-white overflow-hidden animate-fade-up delay-300">
              <div className="px-6 py-4 border-b border-soft flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-gradient-brand flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-[13px] font-bold text-charcoal font-heading">Union Bank Case Study</p>
                  <p className="text-[10px] text-gray-500">2.5 Cr active retail customers</p>
                </div>
              </div>
              <div className="divide-y divide-soft px-6">
                {ROI_ROW.map(r => (
                  <div key={r.label} className="flex items-center justify-between py-2.5">
                    <span className={`text-[11px] ${r.bold ? 'font-bold text-charcoal' : 'text-gray-500'}`}>{r.label}</span>
                    <span className={`text-[14px] font-black tabular-nums font-heading ${r.accent ? 'text-crimson' : r.bold ? 'text-charcoal' : 'text-charcoal'}`}>{r.value}</span>
                  </div>
                ))}
              </div>
              <div className="px-6 py-3 bg-cream border-t border-soft flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-gradient-brand animate-live-pulse" />
                <span className="text-[10px] text-gray-500">Causal uplift validated via VERDICT holdout methodology</span>
              </div>
            </div>
          </div>

          {/* GTM */}
          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest text-center mb-6 animate-fade-up">Go-to-Market Sequencing</p>
          <div className="grid lg:grid-cols-3 gap-4">
            {GTM_TIERS.map((g, i) => (
              <div key={g.tier}
                className={`rounded-md border p-6 transition-all duration-300 hover-lift animate-fade-up ${g.cls}`}
                style={{ animationDelay: `${0.5 + i * 0.1}s` }}>
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${g.accent === 'crimson' ? 'bg-crimson-soft' : 'bg-copper-soft'}`}>
                    <span className={`text-[10px] font-black ${g.accent === 'crimson' ? 'text-crimson' : 'text-copper'}`}>{i + 1}</span>
                  </div>
                  <p className={`text-[13px] font-bold font-heading ${g.accent === 'crimson' ? 'text-crimson' : 'text-copper'}`}>{g.tier}</p>
                </div>
                <p className="text-[11px] font-bold text-charcoal mb-2">{g.banks}</p>
                <p className="text-[11px] text-gray-500 leading-relaxed">{g.why}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 flex justify-center animate-fade-up delay-700">
            <Link href="/business-model"
              className="group inline-flex items-center gap-1.5 text-[12px] font-bold px-6 py-3 rounded-md text-white bg-gradient-brand hover:opacity-90 transition-all">
              Full Business & Financial Pitch
              <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── 7 · LOGIN + CLOSING ──────────────────────────────────────────── */}
      <section id="login" className="relative py-32 px-6 bg-white overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full opacity-[0.05] pointer-events-none"
             style={{ background: 'radial-gradient(circle, var(--crimson) 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full opacity-[0.05] pointer-events-none"
             style={{ background: 'radial-gradient(circle, var(--copper) 0%, transparent 70%)' }} />

        <div className="relative max-w-6xl mx-auto">
          {/* Closing hook */}
          <div className="max-w-3xl mx-auto mb-20 animate-fade-up">
            <div className="relative p-8 rounded-md border-l-4 border-copper bg-cream border border-soft text-center">
              <Quote className="w-6 h-6 text-copper mx-auto mb-4" />
              <p className="text-[20px] md:text-[24px] font-heading font-bold text-charcoal leading-snug mb-4" style={{ letterSpacing: '-0.02em' }}>
                "That customer we mentioned at the start - the one your CRM won't notice for ninety days?
                With PCOP, their RM <span className="text-gradient">already has a call scheduled.</span>"
              </p>
              <p className="text-[14px] text-gray-500 leading-relaxed max-w-xl mx-auto">
                That's the difference between finding out a customer left, and making sure they never had a reason to.
              </p>
            </div>
          </div>

          {/* Credentials */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-md text-crimson text-[10px] font-bold uppercase tracking-widest bg-crimson-soft border border-crimson animate-fade-up">
              <span className="w-1.5 h-1.5 rounded-full bg-gradient-brand animate-live-pulse" />
              No sign-up required
            </div>
            <h2 className="text-[36px] font-heading font-bold text-charcoal mb-3 leading-[1.05] animate-fade-up delay-100"
                style={{ letterSpacing: '-0.03em' }}>
              Log in and <span className="text-gradient">start exploring</span>
            </h2>
            <p className="text-gray-500 text-[15px] max-w-lg mx-auto animate-fade-up delay-200">
              Three role levels to explore different parts of the platform.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-4 mb-12">
            {CREDS.map((c, i) => (
              <div key={c.user}
                className="group relative rounded-md border border-soft p-6 hover:border-crimson bg-white transition-all duration-300 hover-lift overflow-hidden animate-fade-up cursor-pointer"
                style={{ animationDelay: `${0.3 + i * 0.1}s` }}>
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-crimson via-copper to-crimson opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-md bg-gradient-brand flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <span className="text-white text-[12px] font-black tracking-tight">
                      {c.role.split(' ').map(w => w[0]).join('').slice(0, 2)}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-bold text-crimson uppercase tracking-widest">Role</p>
                    <p className="text-[10px] font-mono text-gray-400">#{String(i + 1).padStart(2, '0')}</p>
                  </div>
                </div>
                <p className="text-[16px] font-bold text-charcoal mb-1 font-heading">{c.role}</p>
                <p className="text-[12px] text-gray-500 mb-5 leading-relaxed">{c.access}</p>
                <div className="space-y-2 pt-4 border-t border-soft">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider">Username</span>
                    <code className="text-[12px] font-mono font-bold text-charcoal bg-cream px-2.5 py-1 rounded border border-soft">{c.user}</code>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider">Password</span>
                    <code className="text-[12px] font-mono font-bold text-charcoal bg-cream px-2.5 py-1 rounded border border-soft">{c.pass}</code>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center animate-fade-up delay-700">
            <Link href="/login"
              className="group inline-flex items-center gap-3 text-[16px] font-bold px-12 py-5 rounded-md text-white bg-gradient-brand hover:opacity-90 transition-all hover-lift">
              Enter the Platform
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <p className="mt-5 text-[13px] text-gray-500">
              Log in as <strong className="text-charcoal">admin</strong> to access everything including the review queue
            </p>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <footer className="relative py-10 px-6 border-t border-soft bg-charcoal text-white overflow-hidden">
        <div className="absolute inset-0 opacity-30"
             style={{ background: 'radial-gradient(ellipse 600px 200px at 50% 0%, rgba(180,107,62,0.3) 0%, transparent 70%)' }} />
        <div className="relative max-w-6xl mx-auto flex items-center justify-between flex-wrap gap-6">
          <div className="flex items-center gap-3">
            <Image src="/pcop_logo.png" alt="PCOP" width={28} height={16} className="h-4 w-auto brightness-0 invert" />
            <div>
              <p className="text-[13px] font-bold text-white font-heading">PCOP</p>
              <p className="text-[10px] text-white/50 uppercase tracking-wider">Union Bank · IDEA 2.0 · 2026</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="px-3 py-1.5 rounded-md bg-crimson/10 border border-crimson/30">
              <span className="text-[10px] font-bold text-copper uppercase tracking-widest">Team MoneyLords</span>
              <span className="text-[10px] text-white/40 uppercase tracking-wider ml-2">IIT Guwahati</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-copper/10 border border-copper/30">
              <span className="w-1.5 h-1.5 rounded-full bg-copper animate-live-pulse" />
              <span className="text-[10px] font-bold text-copper uppercase tracking-widest">Demo Environment</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
