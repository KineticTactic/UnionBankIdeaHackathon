'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Shield, Activity, Plug, CheckCircle2, AlertCircle, Code2, ChevronDown, IndianRupee, TrendingUp, BarChart3, Building2, ArrowUpRight, Target, Globe, DollarSign, Server, Zap, Lock, FileText } from 'lucide-react';

const LAYERS = [
  { id: 'L1', name: 'INGEST',   color: 'var(--crimson)',         desc: 'Kafka · T24/Finacle · CRM · Mobile App' },
  { id: 'L2', name: 'ARGUS',    color: 'var(--crimson-dark)',    desc: 'Shiryaev-Roberts · CUSUM · SPRT · 9 streams' },
  { id: 'L3', name: 'CHRONOS',  color: 'var(--copper)',          desc: 'GENESIS · HABITAT · TARE · GraphSAGE · FusionXV2' },
  { id: 'L4', name: 'COMPASS',  color: 'var(--copper-dark)',     desc: 'LangGraph · Life-event inference · Next-best-action' },
  { id: 'L5', name: 'HERALD',   color: 'var(--charcoal)',        desc: 'NVIDIA DeepSeek V4 Pro · Email · SMS · Push' },
  { id: 'L6', name: 'VERDICT',  color: 'var(--gray-600)',        desc: 'Doubly-robust ATE · Qini curve · Hillstrom' },
  { id: 'L7', name: 'ORACLE',   color: 'var(--copper-soft)',     desc: 'Thompson Sampling · Weekly retrain · Prompt optimisation' },
];

const REAL = [
  { real: true,  text: 'All 7 AI/ML layers fully designed, documented and implemented' },
  { real: true,  text: 'ARGUS algorithms (SR, CUSUM, SPRT) — real statistical implementations' },
  { real: true,  text: 'CHRONOS 5-model ensemble with conformal prediction intervals' },
  { real: true,  text: 'HERALD content generation via live NVIDIA DeepSeek V4 Pro API' },
  { real: true,  text: 'VERDICT doubly-robust ATE estimator and Qini uplift curves' },
  { real: true,  text: 'REST API — any banking portal can integrate with one endpoint' },
  { real: false, text: '50 customers are synthetic — scores pre-computed for demo' },
  { real: false, text: 'No live bank feed — Kafka events simulated every 8 seconds' },
];

const SIGNALS = [
  { type: 'Balance Decline',      method: 'CUSUM', conf: 91, desc: 'Sustained balance drop over 6 weeks — CUSUM detects the downward regime shift before it reaches zero.' },
  { type: 'Salary Credit Miss',   method: 'SPRT',  conf: 88, desc: 'No salary credit for 2 consecutive months — Wald sequential test fires after the second absence.' },
  { type: 'App Login Drop',       method: 'SR',    conf: 84, desc: '18 → 2 logins/month — Shiryaev-Roberts detects the engagement regime change instantly.' },
  { type: 'Complaint Spike',      method: 'SPRT',  conf: 97, desc: '3 complaints in 30d vs. 0.2/month baseline — Poisson SPRT fires after the first abnormal count.' },
  { type: 'Competitor Transfer',  method: 'CUSUM', conf: 79, desc: 'Recurring ₹50K outward IMPS to HDFC — CUSUM detects the new periodic outflow pattern.' },
  { type: 'Dormancy',             method: 'SR',    conf: 95, desc: '45+ days zero transactions — SR detects step-change from active-customer prior in one pass.' },
];

const CREDS = [
  { user: 'analyst', pass: 'analyst123', role: 'Risk Analyst',      access: 'Signals · scores · analytics (read-only)' },
  { user: 'rm_user', pass: 'rm123',     role: 'Relationship Mgr',  access: 'Outreach queue · customer notes' },
  { user: 'admin',   pass: 'admin123',   role: 'Administrator',     access: 'Full platform access' },
];

const METHOD: Record<string, string> = {
  SR:    'bg-crimson-soft text-crimson',
  CUSUM: 'bg-copper-soft text-copper-dark',
  SPRT:  'bg-copper-pale text-copper-dark',
};

const MARKET = [
  { label: 'India SAM (2025)',    value: '$35M',    sub: 'SaaS license revenue',        icon: Target },
  { label: 'India SAM (2030)',    value: '$200M',   sub: 'Capturable platform spend',    icon: TrendingUp },
  { label: 'Year 3 ARR Target',   value: '$4.7M',   sub: '8–12 banks live',             icon: BarChart3 },
  { label: 'Year 5 ARR Target',   value: '$14.5M',  sub: '35–40 banks, SE Asia entry',  icon: Globe },
];

const PRICING = [
  { tier: 'Small SFB / Mid PSU',  rms: '50–100',   price: '₹1–2 Cr',   usd: '$120K–240K',   accent: 'copper' },
  { tier: 'Mid PVB / Large PSU',  rms: '100–300',  price: '₹2–5 Cr',   usd: '$240K–600K',   accent: 'crimson' },
  { tier: 'Large PVB',            rms: '300–1K',   price: '₹5–15 Cr',  usd: '$600K–1.8M',   accent: 'copper' },
];

const ROI_ROW = [
  { label: 'Churn savings (Yr 1 revenue)',     value: '₹49.4 Cr' },
  { label: 'Cross-sell revenue',               value: '₹78.8 Cr' },
  { label: 'Total value created per year',     value: '₹128.2 Cr', bold: true },
  { label: 'PCOP annual cost to bank',         value: '₹6–10.2 Cr' },
  { label: 'Net profit to bank',               value: '₹118 Cr',    bold: true },
  { label: 'ROI',                              value: '11.6x',      accent: true },
];

const GTM_TIERS = [
  {
    tier: 'Tier 1 — Private Banks',
    banks: 'AU SFB, Bandhan, Federal, South Indian Bank, Karnataka Bank, City Union Bank, DCB Bank, RBL Bank',
    why: 'Decide in 6–12 months, feel churn pressure acutely, right-sized customer base (20–80 lakh) for CHRONOS without a multi-year integration.',
    accent: 'copper',
    class: 'border-copper/30 bg-copper/[0.04]',
  },
  {
    tier: 'Tier 2 — Mid-Sized PSU Banks',
    banks: 'Bank of Maharashtra, Punjab & Sind Bank, UCO Bank, Indian Overseas Bank, Central Bank of India',
    why: 'The Union Bank iDEA relationship converts into a design-partner pilot. Winning one PSU unlocks the rest — Indian PSU banks watch each other closely.',
    accent: 'crimson',
    class: 'border-crimson/30 bg-crimson/[0.04]',
  },
  {
    tier: 'Tier 3 — Small Finance Banks',
    banks: 'Ujjivan SFB, Jana SFB, ESAF SFB, Suryoday SFB',
    why: 'Raising AI spend fastest as they scale toward universal-bank status. Their biggest pain point (retaining microfinance customers graduating into full banking) is precisely what PCOP solves.',
    accent: 'copper',
    class: 'border-copper/30 bg-copper/[0.04]',
  },
];

const SCALE_PILLARS = [
  { icon: Code2, title: 'Stateless Orchestration', body: 'Zero in-memory state. JWTs with 8-hour TTL, no session tables. pm2 -i 8 behind nginx — no cache invalidation, no sticky sessions.' },
  { icon: Shield, title: 'Async by Default', body: 'BullMQ on Redis with sync fallback. API returns 202 with jobId; worker runs at concurrency 5. Redis down? Falls back to sync — degrade, not fail.' },
  { icon: BarChart3, title: 'Postgres at Every Tier', body: 'Sharding-ready: customer_id leads every table. Index on (customer_id, timestamp). At 1M customers, add Citus — same queries, zero app changes.' },
  { icon: Activity, title: 'Kafka Event Spine', body: 'Signals, approvals, consent changes all flow through Kafka keyed by customer_id. Ordered processing, audit replay, clean subscription. New consumer = 2 lines.' },
  { icon: Plug, title: 'Abstracted LLM Layer', body: 'callNvidia() with Claude fallback, 30s timeout, p-limit concurrency, circuit breaker. Token usage tracked via /api/llm-usage for cost-per-customer.' },
  { icon: Globe, title: 'Translation at Scale', body: 'Provider-agnostic wrapper around Google Cloud Translation. Used for Composer transcreate with back-translation. 70% under free tier in load test.' },
];


const SECURITY_FEATURES = [
  { icon: Shield, title: 'DPDPA 2023 Compliant', body: 'Every data path mapped against the Act. Consent records with timestamps and purpose tags; withdrawal is immediate. Retention policies configurable per bank.' },
  { icon: CheckCircle2, title: 'PII Masking Before External APIs', body: 'Name, phone, email, account stripped from every prompt before reaching NVIDIA or Azure OpenAI. Masked token replaces identity — LLM sees behaviour, not the person.' },
  { icon: ArrowRight, title: 'Role-Based Access Control', body: 'Three tiers: analyst (read-only), RM (outreach), admin (full). JWT role claims verified on every request. Every mutation logged with actor and timestamp.' },
  { icon: Activity, title: 'Immutable Audit Log', body: 'Every recommendation, generation, handoff, and calculation written to append-only store. Each entry carries eventType, customerId, actor — satisfying DPDPA Section 4(5).' },
  { icon: Target, title: 'TRAI Compliance Gate', body: 'Outreach checks opt-in before dispatch. SMS enforces 155-character limit. Consent revocation propagates within 60 seconds to all dispatch paths.' },
  { icon: Shield, title: 'Data Residency (India Only)', body: 'All customer data in Azure Central India (Pune). LLM inference routes through Azure OpenAI in the same region. No data crosses Indian borders.' },
];

function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > window.innerHeight * 0.85);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
      scrolled
        ? 'bg-white/95 backdrop-blur-md border-b border-soft'
        : 'bg-transparent border-b border-transparent'
    }`}>
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="#top" className="flex items-center gap-2.5">
          <Image
            src="/pcop_logo.png"
            alt="PCOP"
            width={32}
            height={18}
            className="h-[18px] w-auto"
            priority
          />
          <span className={`text-[14px] font-bold font-heading transition-colors ${scrolled ? 'text-charcoal' : 'text-charcoal'}`}>PCOP</span>
          <span className="text-gray-500 text-[10px] font-semibold px-2 py-0.5 rounded-md border border-soft uppercase tracking-wider ml-1">Demo</span>
        </Link>
        <div className="flex items-center gap-6">
          <a href="#how-it-works" className={`text-[13px] transition-colors hidden md:block ${scrolled ? 'text-charcoal/70 hover:text-charcoal' : 'text-charcoal/70 hover:text-charcoal'}`}>How it works</a>
          <a href="#architecture" className={`text-[13px] transition-colors hidden md:block ${scrolled ? 'text-charcoal/70 hover:text-charcoal' : 'text-charcoal/70 hover:text-charcoal'}`}>Architecture</a>
          <a href="#business" className={`text-[13px] transition-colors hidden md:block ${scrolled ? 'text-charcoal/70 hover:text-charcoal' : 'text-charcoal/70 hover:text-charcoal'}`}>Business</a>
          <Link href="/business-model" className={`text-[13px] transition-colors hidden md:block ${scrolled ? 'text-charcoal/70 hover:text-charcoal' : 'text-charcoal/70 hover:text-charcoal'}`}>Business Model</Link>
          <a href="#scalability" className={`text-[13px] transition-colors hidden md:block ${scrolled ? 'text-charcoal/70 hover:text-charcoal' : 'text-charcoal/70 hover:text-charcoal'}`}>Scale</a>
          <a href="#security" className={`text-[13px] transition-colors hidden md:block ${scrolled ? 'text-charcoal/70 hover:text-charcoal' : 'text-charcoal/70 hover:text-charcoal'}`}>Security</a>
          <a href="#api" className={`text-[13px] transition-colors hidden md:block ${scrolled ? 'text-charcoal/70 hover:text-charcoal' : 'text-charcoal/70 hover:text-charcoal'}`}>API</a>
          <Link href="/login"
            className="flex items-center gap-1.5 text-[13px] font-semibold px-4 py-2 rounded-md text-white bg-gradient-brand hover:opacity-90 transition-all">
            Enter Platform <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </nav>
  );
}

export default function LandingPage() {
  return (
    <div className="w-full min-h-screen bg-cream text-charcoal">

      {/* ── NAV ─────────────────────────────────────────────────────────── */}
      <Navbar />

      {/* ── HERO ────────────────────────────────────────────────────────── */}
      <section id="top" className="relative min-h-screen flex flex-col items-center justify-center text-center overflow-hidden bg-white">

        {/* Soft mesh gradient backdrop */}
        <div className="absolute inset-0 bg-mesh-gradient animate-pulse-soft" />

        {/* Animated morphing blobs */}
        <div className="absolute top-[15%] left-[10%] w-[600px] h-[600px] opacity-80 pointer-events-none animate-mesh-a"
             style={{ background: 'radial-gradient(circle, rgba(180,107,62,0.7) 0%, transparent 65%)' }} />
        <div className="absolute bottom-[10%] right-[8%] w-[650px] h-[650px] opacity-70 pointer-events-none animate-mesh-b"
             style={{ background: 'radial-gradient(circle, rgba(107,19,43,0.6) 0%, transparent 65%)' }} />

        {/* Dot grid pattern */}
        <div className="absolute inset-0 bg-dot-grid" />

        {/* Animated horizontal data lines */}
        <div className="absolute top-[20%] left-0 right-0 h-px overflow-hidden">
          <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-copper to-transparent opacity-60 animate-line" />
        </div>
        <div className="absolute top-[55%] left-0 right-0 h-px overflow-hidden">
          <div className="h-full w-1/2 bg-gradient-to-r from-transparent via-crimson to-transparent opacity-50 animate-line" style={{ animationDelay: '2s' }} />
        </div>
        <div className="absolute top-[80%] left-0 right-0 h-px overflow-hidden">
          <div className="h-full w-1/4 bg-gradient-to-r from-transparent via-copper to-transparent opacity-50 animate-line" style={{ animationDelay: '4s' }} />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-6">
          <div className="inline-flex items-center gap-2 mb-8 px-4 py-2 rounded-md text-crimson text-[11px] font-semibold uppercase tracking-widest bg-crimson-soft border border-crimson">
            <span className="w-1.5 h-1.5 rounded-full bg-gradient-brand animate-live-pulse" />
            Union Bank · IDEA 2.0 Hackathon 2026
          </div>

          <h1 className="font-heading font-bold leading-[0.95] mb-6"
              style={{ fontSize: 'clamp(3rem, 8vw, 6.5rem)', letterSpacing: '-0.04em' }}>
            <span className="text-charcoal">Predict.</span><br />
            <span className="text-gradient">Personalise.</span><br />
            <span className="text-charcoal">Retain.</span>
          </h1>

          <p className="text-gray-500 text-[17px] leading-relaxed mb-10 max-w-2xl mx-auto">
            A fully agentic 7-layer AI/ML platform that identifies retail banking customers
            at risk of attrition <strong className="text-charcoal">weeks before any explicit signal</strong> — and
            automatically orchestrates hyper-personalised outreach.
          </p>

          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link href="/login"
              className="group inline-flex items-center gap-2 text-[15px] font-bold px-8 py-4 rounded-md text-white bg-gradient-brand hover:opacity-90 transition-all">
              Try the Demo
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <a href="#architecture"
              className="inline-flex items-center gap-2 text-[14px] font-semibold px-6 py-4 rounded-md text-charcoal hover:text-crimson transition-colors border border-soft hover:border-crimson">
              See Architecture
            </a>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-4 gap-4 mt-20 max-w-2xl mx-auto">
            {[
              { v: '50',    l: 'Customers' },
              { v: '0.93',  l: 'AUC Score' },
              { v: '9',     l: 'Signal Streams' },
              { v: '< 4h',  l: 'Detection Lag' },
            ].map((s, i) => (
              <div key={s.l} className="relative text-center p-4 rounded-md bg-white border border-soft overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-copper/40 to-transparent" />
                <p className="text-charcoal text-[24px] font-black leading-none font-heading tabular-nums">{s.v}</p>
                <p className="text-gray-400 text-[10px] uppercase tracking-wider mt-1.5">{s.l}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-gray-400 animate-bounce">
          <span className="text-[10px] uppercase tracking-widest">Scroll</span>
          <ChevronDown className="w-4 h-4" />
        </div>
      </section>

      {/* ── DEMO DISCLAIMER ─────────────────────────────────────────────── */}
      <section className="relative py-24 px-6 text-white overflow-hidden bg-gradient-brand">
        <div className="absolute inset-0 opacity-20"
             style={{ background: 'radial-gradient(ellipse 800px 400px at 20% 30%, rgba(255,255,255,0.4) 0%, transparent 60%), radial-gradient(ellipse 600px 400px at 80% 70%, rgba(255,255,255,0.3) 0%, transparent 60%)' }} />
        <div className="absolute inset-0 bg-dot-grid opacity-30" />

        <div className="relative max-w-5xl mx-auto">
          <div className="flex items-start gap-5 mb-10">
            <div className="w-14 h-14 rounded-md bg-white/10 border border-white/20 flex items-center justify-center shrink-0 animate-fade-up">
              <Shield className="w-6 h-6 text-copper" />
            </div>
            <div className="animate-fade-up delay-100">
              <p className="text-[11px] font-bold uppercase tracking-widest text-copper mb-2">Transparency Notice</p>
              <h2 className="text-[28px] font-heading font-bold text-white mb-3 leading-tight" style={{ letterSpacing: '-0.02em' }}>
                Demonstration Environment
              </h2>
              <p className="text-[15px] text-white/70 leading-relaxed max-w-3xl">
                This is a <strong className="text-white">functional prototype</strong> built to show exactly how PCOP looks and behaves in a real Union Bank deployment.
                The UI, dashboards, signals, scores, and AI-generated content are all representative of real system output —
                but customer data is synthetic and pre-computed offline.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {REAL.map((r, i) => (
              <div key={i}
                className={`group flex items-start gap-3 p-4 rounded-md border transition-all duration-200 hover-lift animate-fade-up ${
                  r.real
                    ? 'bg-white/10 border-white/20 hover:border-copper/50'
                    : 'bg-black/20 border-white/10 hover:border-copper/30'
                }`}
                style={{ animationDelay: `${0.2 + i * 0.05}s` }}>
                <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${r.real ? 'bg-copper/20' : 'bg-white/10'}`}>
                  {r.real
                    ? <CheckCircle2 className="w-3.5 h-3.5 text-copper" />
                    : <AlertCircle  className="w-3.5 h-3.5 text-white/40" />}
                </div>
                <p className={`text-[12px] leading-snug ${r.real ? 'text-white' : 'text-white/50'}`}>{r.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────────────────────── */}
      <section id="how-it-works" className="relative py-32 px-6 bg-white overflow-hidden">
        <div className="absolute top-0 left-0 w-[400px] h-[400px] rounded-full opacity-[0.04] pointer-events-none"
             style={{ background: 'radial-gradient(circle, var(--crimson) 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full opacity-[0.04] pointer-events-none"
             style={{ background: 'radial-gradient(circle, var(--copper) 0%, transparent 70%)' }} />

        <div className="relative max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-md text-crimson text-[10px] font-bold uppercase tracking-widest bg-crimson-soft border border-crimson animate-fade-up">
              <Activity className="w-3 h-3" />
              ARGUS · Layer 2
            </div>
            <h2 className="text-[44px] font-heading font-bold text-charcoal mb-4 leading-[1.05] animate-fade-up delay-100"
                style={{ letterSpacing: '-0.03em' }}>
              What Signals Look Like<br />
              <span className="text-gradient">in Production</span>
            </h2>
            <p className="text-gray-500 text-[16px] max-w-xl mx-auto animate-fade-up delay-200">
              9 behavioural streams per customer, 3 statistical methods. These would fire on real transaction data.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {SIGNALS.map((s, i) => (
              <div key={s.type}
                className="group relative p-6 rounded-md border border-soft hover:border-crimson bg-white transition-all duration-300 hover-lift overflow-hidden animate-fade-up"
                style={{ animationDelay: `${0.3 + i * 0.08}s` }}>
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-crimson via-copper to-crimson opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-black px-2 py-1 rounded-md uppercase tracking-wider ${METHOD[s.method]}`}>{s.method}</span>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Method</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-[28px] font-black text-charcoal leading-none font-heading tabular-nums">{s.conf}</span>
                    <span className="text-[12px] font-bold text-crimson">%</span>
                  </div>
                </div>
                <p className="text-[15px] font-bold text-charcoal mb-2 font-heading">{s.type}</p>
                <p className="text-[12px] text-gray-500 leading-relaxed">{s.desc}</p>
                <div className="mt-4 pt-3 border-t border-soft">
                  <div className="flex items-center justify-between text-[10px] text-gray-400 uppercase tracking-wider">
                    <span>Confidence</span>
                    <div className="flex items-center gap-2 flex-1 ml-3">
                      <div className="flex-1 h-1 bg-cream rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-brand transition-all duration-700"
                             style={{ width: `${s.conf}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-3 animate-fade-up delay-700">
            {[
              { name: 'SR', full: 'Shiryaev-Roberts', desc: 'gradual regime shifts' },
              { name: 'CUSUM', full: 'Cumulative Sum', desc: 'step changes' },
              { name: 'SPRT', full: 'Sequential Probability', desc: 'rate changes' },
            ].map(m => (
              <div key={m.name} className="p-4 rounded-md bg-cream border border-soft text-center hover-lift">
                <span className="text-[10px] font-bold text-crimson uppercase tracking-widest">{m.name}</span>
                <p className="text-[13px] font-bold text-charcoal mt-1 font-heading">{m.full}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">{m.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ARCHITECTURE ────────────────────────────────────────────────── */}
      <section id="architecture" className="relative py-24 px-6 bg-cream overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] opacity-25 pointer-events-none animate-mesh-a"
             style={{ background: 'radial-gradient(circle, rgba(180,107,62,0.2) 0%, transparent 60%)' }} />

        <div className="relative max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-3">System Design</p>
            <h2 className="text-[32px] font-heading font-bold text-charcoal mb-3" style={{ letterSpacing: '-0.02em' }}>Seven-Layer Architecture</h2>
            <p className="text-gray-500 text-[14px]">Data flows top-to-bottom. Learning flows bottom-to-top.</p>
          </div>

          <div className="space-y-2">
            {LAYERS.map((layer, i) => (
              <div key={layer.id} className="flex rounded-md overflow-hidden border border-soft bg-white group">
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
        </div>
      </section>

      {/* ── API ─────────────────────────────────────────────────────────── */}
      <section id="api" className="relative py-32 px-6 bg-cream overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] opacity-20 pointer-events-none"
             style={{ background: 'radial-gradient(circle, rgba(180,107,62,0.2) 0%, transparent 60%)' }} />

        <div className="relative max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 mb-6 px-3 py-1.5 rounded-md text-copper text-[10px] font-bold uppercase tracking-widest bg-copper-soft border border-copper animate-fade-up">
                <Plug className="w-3 h-3" />
                API-First Design
              </div>
              <h2 className="text-[44px] font-heading font-bold text-charcoal mb-5 leading-[1.05] animate-fade-up delay-100"
                  style={{ letterSpacing: '-0.03em' }}>
                Plug into<br />
                <span className="text-gradient">any banking portal</span>
              </h2>
              <p className="text-gray-500 text-[16px] leading-relaxed mb-8 animate-fade-up delay-200">
                PCOP ships as a REST API. The dashboard you're about to explore is just one possible interface —
                any CRM, relationship manager tool, or internal portal can query the same endpoints.
              </p>
              <div className="space-y-3">
                {[
                  { label: 'Full customer snapshot',     sub: 'Score + signals + plan + outreach in one call' },
                  { label: 'Live AI content generation',  sub: 'HERALD writes email/SMS/push via DeepSeek in <3s' },
                  { label: 'Portfolio-level KPIs',        sub: 'Dashboard-ready aggregates and tier distributions' },
                ].map((f, i) => (
                  <div key={f.label}
                    className="group flex items-start gap-3 p-3 rounded-md hover:bg-white transition-colors animate-slide-left"
                    style={{ animationDelay: `${0.3 + i * 0.1}s` }}>
                    <div className="w-8 h-8 rounded-md bg-copper flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                      <span className="w-2 h-2 rounded-full bg-white" />
                    </div>
                    <div>
                      <p className="text-[14px] font-bold text-charcoal font-heading">{f.label}</p>
                      <p className="text-[12px] text-gray-500">{f.sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-md overflow-hidden bg-white border border-soft animate-slide-right delay-300">
              <div className="flex items-center justify-between px-4 py-3 border-b border-soft bg-cream">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-crimson" />
                    <span className="w-2.5 h-2.5 rounded-full bg-copper" />
                    <span className="w-2.5 h-2.5 rounded-full bg-copper-pale" />
                  </div>
                  <span className="ml-3 text-[10px] font-bold text-copper-dark uppercase tracking-widest">api.pcop.io</span>
                </div>
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Available Endpoints</span>
              </div>
              {[
                { m: 'GET',  p: '/api/customers',         d: 'List with risk scores & filters' },
                { m: 'GET',  p: '/api/customers/:id',     d: 'Full snapshot in one response' },
                { m: 'GET',  p: '/api/v2/signals',        d: 'All active ARGUS alarms' },
                { m: 'POST', p: '/api/outreach/generate', d: 'Live HERALD content via DeepSeek' },
                { m: 'POST', p: '/api/analysis/analyze',  d: 'AI risk analysis for customer' },
                { m: 'GET',  p: '/api/portfolio/full',    d: 'Executive dashboard data' },
                { m: 'GET',  p: '/api/kafka/stream',      d: 'SSE live event stream' },
              ].map((e, i) => (
                <div key={e.p}
                  className="flex items-center gap-3 px-4 py-2.5 border-b border-soft last:border-0 hover:bg-cream transition-colors group animate-fade-up"
                  style={{ animationDelay: `${0.4 + i * 0.05}s` }}>
                  <span className={`text-[9px] font-black px-2 py-1 rounded-md uppercase shrink-0 tracking-wider ${e.m === 'GET' ? 'bg-copper-soft text-copper-dark' : 'bg-crimson-soft text-crimson'}`}>{e.m}</span>
                  <code className="text-[12px] font-mono text-charcoal shrink-0 group-hover:text-crimson transition-colors">{e.p}</code>
                  <span className="text-[10px] text-gray-500 min-w-0 truncate">{e.d}</span>
                </div>
              ))}
              <div className="px-4 py-2.5 bg-cream border-t border-soft flex items-center justify-between">
                <span className="text-[10px] text-gray-500 font-mono">$ curl -X GET {`{API}/customers/42`}</span>
                <span className="flex items-center gap-1.5 text-[10px] text-crimson">
                  <span className="w-1.5 h-1.5 rounded-full bg-gradient-brand animate-live-pulse" />
                  ONLINE
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── BUSINESS MODEL ──────────────────────────────────────────────── */}
      <section id="business" className="relative py-24 px-6 bg-white overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full opacity-[0.04] pointer-events-none"
             style={{ background: 'radial-gradient(circle, var(--copper) 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full opacity-[0.04] pointer-events-none"
             style={{ background: 'radial-gradient(circle, var(--crimson) 0%, transparent 70%)' }} />

        <div className="relative max-w-6xl mx-auto">
          {/* Section header */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-md text-copper text-[10px] font-bold uppercase tracking-widest bg-copper-soft border border-copper animate-fade-up">
              <IndianRupee className="w-3 h-3" />
              Business Model
            </div>
            <h2 className="text-[44px] font-heading font-bold text-charcoal mb-4 leading-[1.05] animate-fade-up delay-100"
                style={{ letterSpacing: '-0.03em' }}>
              Proven Economics for<br />
              <span className="text-gradient">Indian Retail Banking</span>
            </h2>
            <p className="text-gray-500 text-[16px] max-w-xl mx-auto animate-fade-up delay-200">
              Priced for India. Built for compliance. Proven by causal measurement.
            </p>
          </div>

          {/* Market opportunity grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-20">
            {MARKET.map((m, i) => {
              const Icon = m.icon;
              return (
                <div key={m.label}
                  className="group relative p-5 rounded-md border border-soft hover:border-copper bg-cream transition-all duration-300 hover-lift overflow-hidden animate-fade-up"
                  style={{ animationDelay: `${0.2 + i * 0.08}s` }}>
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-copper/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-md bg-white border border-soft flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Icon className="w-4 h-4 text-copper" />
                    </div>
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{m.label}</span>
                  </div>
                  <p className="text-[28px] font-black text-charcoal font-heading tabular-nums tracking-tight">{m.value}</p>
                  <p className="text-[11px] text-gray-500 mt-1">{m.sub}</p>
                </div>
              );
            })}
          </div>

          {/* Pricing + ROI row */}
          <div className="grid lg:grid-cols-5 gap-4 mb-20">
            {/* Pricing table — spans 3 cols */}
            <div className="lg:col-span-3 rounded-md border border-soft bg-cream overflow-hidden animate-fade-up delay-200">
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
                {PRICING.map((p) => (
                  <div key={p.tier} className="grid grid-cols-3 gap-4 px-6 py-3.5 items-center hover:bg-white transition-colors">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-5 h-5 rounded-sm flex items-center justify-center shrink-0 ${
                        p.accent === 'crimson' ? 'bg-crimson-soft' : 'bg-copper-soft'
                      }`}>
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
              <div className="px-6 py-3 bg-white border-t border-soft flex items-center gap-2">
                <ArrowUpRight className="w-3 h-3 text-copper" />
                <span className="text-[10px] text-gray-500">72% gross margin at steady state</span>
              </div>
            </div>

            {/* ROI card — spans 2 cols */}
            <div className="lg:col-span-2 rounded-md border border-soft bg-cream overflow-hidden animate-fade-up delay-300">
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
                {ROI_ROW.map((r) => (
                  <div key={r.label} className="flex items-center justify-between py-2.5">
                    <span className={`text-[11px] ${r.bold ? 'font-bold text-charcoal' : 'text-gray-500'}`}>{r.label}</span>
                    <span className={`text-[14px] font-black tabular-nums font-heading ${
                      r.accent ? 'text-crimson' : r.bold ? 'text-charcoal' : 'text-charcoal'
                    }`}>{r.value}</span>
                  </div>
                ))}
              </div>
              <div className="px-6 py-3 bg-white border-t border-soft flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-gradient-brand animate-live-pulse" />
                <span className="text-[10px] text-gray-500">Causal uplift validated via VERDICT holdout methodology</span>
              </div>
            </div>
          </div>

          {/* Go-to-market */}
          <div className="mb-6">
            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest text-center mb-8 animate-fade-up delay-400">Go-to-Market Sequencing</p>

            {/* Full pitch doc CTA */}
            <div className="mb-8 p-5 rounded-md border border-crimson/30 bg-crimson/[0.04] flex items-center justify-between flex-wrap gap-4 animate-fade-up delay-450">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-gradient-brand flex items-center justify-center shrink-0">
                  <IndianRupee className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-[14px] font-bold text-charcoal font-heading">Full Business & Financial Pitch</p>
                  <p className="text-[11px] text-gray-500">Market sizing · pricing · 5-year TCO · Union Bank case study · GTM</p>
                </div>
              </div>
              <Link href="/business-model"
                className="group inline-flex items-center gap-1.5 text-[12px] font-bold px-5 py-2.5 rounded-md text-white bg-gradient-brand hover:opacity-90 transition-all">
                Open Pitch Document
                <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </Link>
            </div>
            <div className="grid lg:grid-cols-3 gap-4">
              {GTM_TIERS.map((g, i) => (
                <div key={g.tier}
                  className={`rounded-md border p-6 transition-all duration-300 hover-lift animate-fade-up ${g.class}`}
                  style={{ animationDelay: `${0.5 + i * 0.1}s` }}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${
                      g.accent === 'crimson' ? 'bg-crimson-soft' : 'bg-copper-soft'
                    }`}>
                      <span className={`text-[10px] font-black ${
                        g.accent === 'crimson' ? 'text-crimson' : 'text-copper'
                      }`}>{i + 1}</span>
                    </div>
                    <p className={`text-[13px] font-bold font-heading ${
                      g.accent === 'crimson' ? 'text-crimson' : 'text-copper'
                    }`}>{g.tier}</p>
                  </div>
                  <p className="text-[11px] font-bold text-charcoal mb-2">Target: {g.banks}</p>
                  <p className="text-[11px] text-gray-500 leading-relaxed">{g.why}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── SCALABILITY ─────────────────────────────────────────────────── */}
      <section id="scalability" className="relative py-24 px-6 bg-cream overflow-hidden">
        <div className="absolute top-0 left-0 w-[500px] h-[500px] rounded-full opacity-[0.04] pointer-events-none"
             style={{ background: 'radial-gradient(circle, var(--crimson) 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full opacity-[0.04] pointer-events-none"
             style={{ background: 'radial-gradient(circle, var(--copper) 0%, transparent 70%)' }} />

        <div className="relative max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-md text-copper text-[10px] font-bold uppercase tracking-widest bg-copper-soft border border-copper animate-fade-up">
              <Server className="w-3 h-3" />
              Scalability & Performance
            </div>
            <h2 className="text-[44px] font-heading font-bold text-charcoal mb-4 leading-[1.05] animate-fade-up delay-100"
                style={{ letterSpacing: '-0.03em' }}>
              Scales from One Bank to<br />
              <span className="text-gradient">a Million Customers</span>
            </h2>
            <p className="text-gray-500 text-[16px] max-w-xl mx-auto animate-fade-up delay-200">
              Microservice isolation, stateless orchestration, and a Kafka event spine — the same pattern Netflix uses for independent scaling and failure domains.
            </p>
          </div>

          {/* Architecture pillars */}
          <div className="grid lg:grid-cols-3 gap-4">
            {SCALE_PILLARS.map((p, i) => {
              const Icon = p.icon;
              return (
                <div key={p.title}
                  className="group p-6 rounded-md border border-soft bg-white transition-all duration-300 hover-lift overflow-hidden animate-fade-up"
                  style={{ animationDelay: `${0.3 + i * 0.08}s` }}>
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-copper/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
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

          {/* Architecture detail strip */}
          <div className="mt-8 p-5 rounded-md border border-soft bg-white animate-fade-up delay-500">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-md bg-copper-soft flex items-center justify-center">
                <Zap className="w-4 h-4 text-copper" />
              </div>
              <p className="text-[13px] font-bold text-charcoal font-heading">Layer Architecture — Port Map</p>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              {[
                { port: '3001', name: 'Bank API',      color: 'bg-copper-soft text-copper' },
                { port: '8000', name: 'Orchestrator',   color: 'bg-crimson-soft text-crimson' },
                { port: '8001', name: 'CHRONOS',        color: 'bg-copper-soft text-copper' },
                { port: '8002', name: 'ARGUS',          color: 'bg-crimson-soft text-crimson' },
                { port: '8004', name: 'COMPASS',        color: 'bg-copper-soft text-copper' },
                { port: '8005', name: 'HERALD',         color: 'bg-cream text-charcoal border border-soft' },
                { port: '8006', name: 'VERDICT',        color: 'bg-cream text-charcoal border border-soft' },
                { port: '8007', name: 'ORACLE',         color: 'bg-cream text-charcoal border border-soft' },
              ].map((svc) => (
                <div key={svc.port} className="flex items-center gap-2.5 p-2.5 rounded-md bg-cream">
                  <code className={`text-[10px] font-black px-2 py-1 rounded shrink-0 tracking-wider ${svc.color}`}>{svc.port}</code>
                  <span className="text-[12px] font-bold text-charcoal">{svc.name}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-gray-500">Each stage owns its own data, dependencies, and port. Communicate over HTTP internally and Kafka externally. Independent deploys, independent scaling, independent failure domains.</p>
          </div>
        </div>
      </section>

      {/* ── SECURITY & ENTERPRISE READINESS ──────────────────────────────── */}
      <section id="security" className="relative py-24 px-6 bg-white overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] opacity-[0.03] pointer-events-none"
             style={{ background: 'radial-gradient(circle, var(--copper) 0%, transparent 60%)' }} />

        <div className="relative max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-md text-crimson text-[10px] font-bold uppercase tracking-widest bg-crimson-soft border border-crimson animate-fade-up">
              <Lock className="w-3 h-3" />
              Enterprise Readiness
            </div>
            <h2 className="text-[44px] font-heading font-bold text-charcoal mb-4 leading-[1.05] animate-fade-up delay-100"
                style={{ letterSpacing: '-0.03em' }}>
              Compliance by Design,<br />
              <span className="text-gradient">Security by Default</span>
            </h2>
            <p className="text-gray-500 text-[16px] max-w-xl mx-auto animate-fade-up delay-200">
              DPDPA 2023 mapped into every data path. PII masked before any external API call. Data never leaves India.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-4">
            {SECURITY_FEATURES.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={s.title}
                  className="group relative p-6 rounded-md border border-soft bg-cream transition-all duration-300 hover-lift overflow-hidden animate-fade-up"
                  style={{ animationDelay: `${0.2 + i * 0.07}s` }}>
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-crimson/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-10 h-10 rounded-md flex items-center justify-center group-hover:scale-110 transition-transform ${
                      i % 2 === 0 ? 'bg-crimson-soft' : 'bg-copper-soft'
                    }`}>
                      <Icon className={`w-5 h-5 ${i % 2 === 0 ? 'text-crimson' : 'text-copper'}`} />
                    </div>
                    <p className="text-[14px] font-bold text-charcoal font-heading">{s.title}</p>
                  </div>
                  <p className="text-[12px] text-gray-500 leading-relaxed">{s.body}</p>
                </div>
              );
            })}
          </div>

          {/* Standards strip */}
          <div className="mt-10 grid grid-cols-2 lg:grid-cols-4 gap-3 animate-fade-up delay-500">
            {[
              { label: 'DPDPA 2023', sub: 'Full compliance mapped' },
              { label: 'TRAI Regs',  sub: 'Consent + 155-char SMS' },
              { label: 'RBI Outsourcing', sub: 'India-only data residency' },
              { label: 'Model Risk', sub: 'Holdout-gated deployment' },
            ].map((s) => (
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

      {/* ── LOGIN / CREDENTIALS ─────────────────────────────────────────── */}
      <section id="login" className="relative py-32 px-6 bg-white overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full opacity-[0.05] pointer-events-none"
             style={{ background: 'radial-gradient(circle, var(--crimson) 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full opacity-[0.05] pointer-events-none"
             style={{ background: 'radial-gradient(circle, var(--copper) 0%, transparent 70%)' }} />

        <div className="relative max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-md text-crimson text-[10px] font-bold uppercase tracking-widest bg-crimson-soft border border-crimson animate-fade-up">
              <span className="w-1.5 h-1.5 rounded-full bg-gradient-brand animate-live-pulse" />
              No sign-up required
            </div>
            <h2 className="text-[44px] font-heading font-bold text-charcoal mb-4 leading-[1.05] animate-fade-up delay-100"
                style={{ letterSpacing: '-0.03em' }}>
              Log in and<br />
              <span className="text-gradient">start exploring</span>
            </h2>
            <p className="text-gray-500 text-[16px] max-w-xl mx-auto animate-fade-up delay-200">
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
                      {c.role.split(' ').map(w=>w[0]).join('').slice(0,2)}
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

      {/* ── FOOTER ──────────────────────────────────────────────────────── */}
      <footer className="relative py-10 px-6 border-t border-soft bg-charcoal text-white overflow-hidden">
        <div className="absolute inset-0 opacity-30"
             style={{ background: 'radial-gradient(ellipse 600px 200px at 50% 0%, rgba(180,107,62,0.3) 0%, transparent 70%)' }} />
        <div className="relative max-w-6xl mx-auto flex items-center justify-between flex-wrap gap-6">
          <div className="flex items-center gap-3">
            <Image
              src="/pcop_logo.png"
              alt="PCOP"
              width={28}
              height={16}
              className="h-4 w-auto brightness-0 invert"
            />
            <div>
              <p className="text-[13px] font-bold text-white font-heading">PCOP</p>
              <p className="text-[10px] text-white/50 uppercase tracking-wider">Union Bank · IDEA 2.0 · 2026</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
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
