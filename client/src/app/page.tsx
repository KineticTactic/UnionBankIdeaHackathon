'use client';

import { useState } from 'react';
import Link from 'next/link';
import { JetBrains_Mono, Instrument_Serif } from 'next/font/google';

const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });
const serif = Instrument_Serif({ subsets: ['latin'], weight: '400', style: ['normal', 'italic'], variable: '--font-serif', display: 'swap' });

const METRICS = [
    { value: '0.93', suffix: '', label: 'GraphSAGE AUC', sub: 'Network risk model' },
    { value: '20', suffix: '', label: 'Customers Live', sub: 'Real-time monitoring' },
    { value: '7', suffix: '', label: 'AI Layers', sub: 'End-to-end pipeline' },
    { value: '<50', suffix: 'ms', label: 'Scoring Latency', sub: 'ONNX Runtime' },
    { value: '90', suffix: 'D', label: 'Survival Horizon', sub: 'DeepHit model' },
];

const LAYERS = [
    { n: '01', name: 'Data Ingestion', desc: 'CBS transactions, account events, CRM notes across 6 live Kafka topics', tag: 'Kafka · Node.js' },
    { n: '02', name: 'ARGUS · Signal Detection', desc: '18 active behavioural signals detected via CUSUM, BOCPD, and SPRT', tag: 'Python · Statistical' },
    { n: '03', name: 'Precision Risk Engine', desc: 'GraphSAGE + DeepHit Survival + Temporal Transformer + HABITAT XGBoost ensemble', tag: 'PyTorch · ONNX · AUC 0.93' },
    { n: '04', name: 'COMPASS · Action Intelligence', desc: 'LangGraph orchestration — next-best-action with survival-driven routing', tag: 'LangGraph · Python' },
    { n: '05', name: 'HERALD · Outreach Engine', desc: 'Azure AI · DeepSeek-V4 personalised messages per channel per customer', tag: 'DeepSeek-V4 · Azure AI' },
    { n: '06', name: 'VERDICT · Measurement', desc: 'DR-Learner doubly robust causal uplift attribution per campaign', tag: 'Causal ML · Python' },
    { n: '07', name: 'ORACLE · Analytics', desc: 'Portfolio intelligence, scheduled model retraining, MLflow drift monitoring', tag: 'APScheduler · MLflow' },
];

const CREDENTIALS = [
    { user: 'admin', pass: 'admin123', role: 'System Administrator', access: 'Full platform · model mgmt · all data', badge: 'ADMIN', color: '#ef4444' },
    { user: 'manager', pass: 'manager123', role: 'Portfolio Manager', access: 'Customer portfolio · outreach · analytics', badge: 'MANAGER', color: '#f59e0b' },
    { user: 'analyst', pass: 'analyst123', role: 'Risk Analyst', access: 'Signals · analytics · read-only', badge: 'ANALYST', color: '#3b82f6' },
];

const STEPS = [
    {
        icon: (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" /><path d="M3 12h3m12 0h3M12 3v3m0 12v3" /><path d="m5.6 5.6 2.1 2.1m8.6 8.6 2.1 2.1M5.6 18.4l2.1-2.1m8.6-8.6 2.1-2.1" />
            </svg>
        ),
        title: 'Predict',
        sub: 'Precision Risk Engine',
        desc: '4-model ensemble scores every customer on churn probability, survival horizon, and departure timing. GraphSAGE captures peer-network contagion; DeepHit outputs 7/30/90-day survival curves.',
    },
    {
        icon: (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
        ),
        title: 'Intervene',
        sub: 'COMPASS + HERALD',
        desc: 'LangGraph selects the optimal offer, channel, and timing. Azure AI · DeepSeek then writes a personalised outreach message — SMS, email, or RM visit script — tailored to the risk tier.',
    },
    {
        icon: (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3v18h18" /><path d="m7 16 4-4 4 4 5-5" />
            </svg>
        ),
        title: 'Measure',
        sub: 'VERDICT + ORACLE',
        desc: 'Doubly Robust Learner isolates the true causal uplift of each outreach from confounders. ORACLE closes the loop by retraining models on new outcomes and surfacing portfolio-level insights.',
    },
];

export default function LandingPage() {
    const [copied, setCopied] = useState<string | null>(null);

    const copy = (user: string, pass: string) => {
        navigator.clipboard.writeText(`${user} / ${pass}`).catch(() => {});
        setCopied(user);
        setTimeout(() => setCopied(null), 2000);
    };

    return (
        <div className={`${mono.variable} ${serif.variable}`} style={{ background: '#06090f', color: '#e2e8f0', fontFamily: 'system-ui, -apple-system, sans-serif', overflowX: 'hidden' }}>
            <style>{`
                @keyframes pulseAmber {
                    0%, 100% { opacity: 1; text-shadow: 0 0 24px rgba(245,158,11,0.5); }
                    50%       { opacity: 0.75; text-shadow: 0 0 48px rgba(245,158,11,0.9); }
                }
                @keyframes fadeUp {
                    from { opacity: 0; transform: translateY(28px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
                @keyframes scanline {
                    0%   { transform: translateY(-100%); }
                    100% { transform: translateY(100vh); }
                }

                .hero-1 { animation: fadeUp .65s ease-out .05s both; }
                .hero-2 { animation: fadeUp .65s ease-out .18s both; }
                .hero-3 { animation: fadeUp .65s ease-out .30s both; }
                .hero-4 { animation: fadeUp .65s ease-out .44s both; }

                .metric-val {
                    font-family: var(--font-mono), 'Courier New', monospace;
                    color: #f59e0b;
                    animation: pulseAmber 3.5s ease-in-out infinite;
                }

                .dot-grid {
                    background-image: radial-gradient(circle, rgba(37,99,235,0.16) 1px, transparent 1px);
                    background-size: 28px 28px;
                }

                .layer-row {
                    border: 1px solid transparent;
                    border-radius: 10px;
                    transition: background .15s, border-color .15s;
                    padding: 18px 20px;
                }
                .layer-row:hover {
                    background: rgba(37,99,235,0.05);
                    border-color: rgba(59,130,246,0.22);
                }

                .cred-row {
                    cursor: pointer;
                    transition: background .12s;
                    border-bottom: 1px solid rgba(26,39,68,0.9);
                }
                .cred-row:last-child { border-bottom: none; }
                .cred-row:hover { background: rgba(59,130,246,0.09); }

                .btn-primary {
                    background: #2563eb;
                    transition: background .15s, box-shadow .15s, transform .1s;
                }
                .btn-primary:hover {
                    background: #1d4ed8;
                    box-shadow: 0 0 28px rgba(37,99,235,0.45);
                    transform: translateY(-1px);
                }
                .btn-ghost {
                    border: 1px solid rgba(59,130,246,0.28);
                    transition: border-color .15s, background .15s;
                }
                .btn-ghost:hover {
                    border-color: rgba(59,130,246,0.55);
                    background: rgba(59,130,246,0.07);
                }
                .step-card {
                    background: rgba(10,16,32,0.85);
                    border: 1px solid #1a2744;
                    border-radius: 14px;
                    transition: border-color .2s, box-shadow .2s, transform .2s;
                }
                .step-card:hover {
                    border-color: rgba(59,130,246,0.35);
                    box-shadow: 0 0 32px rgba(59,130,246,0.08);
                    transform: translateY(-3px);
                }
            `}</style>

            {/* ── NAVBAR ─────────────────────────────────────────────── */}
            <nav style={{
                position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
                background: 'rgba(6,9,15,0.88)', backdropFilter: 'blur(16px)',
                borderBottom: '1px solid #131e35',
                height: '56px', display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', padding: '0 28px',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        width: '36px', height: '36px', borderRadius: '9px',
                        background: 'linear-gradient(145deg, #1e3a8a, #1d4ed8)',
                        border: '1px solid rgba(59,130,246,0.45)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <span style={{ fontFamily: 'var(--font-mono), monospace', color: '#fff', fontSize: '11px', fontWeight: 900, letterSpacing: '.05em' }}>UB</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#e2e8f0', letterSpacing: '.02em' }}>PCOP</span>
                        <span style={{ fontSize: '10px', color: '#475569', letterSpacing: '.07em', textTransform: 'uppercase', fontFamily: 'var(--font-mono), monospace' }}>Predictive Customer Outreach</span>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                        <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e' }} />
                        <span style={{ fontSize: '11px', color: '#475569', fontFamily: 'var(--font-mono), monospace', letterSpacing: '.06em' }}>LIVE · AZURE</span>
                    </div>
                    <Link href="/login" className="btn-primary" style={{
                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                        padding: '8px 18px', borderRadius: '7px',
                        fontSize: '13px', fontWeight: 600, color: '#fff', textDecoration: 'none',
                    }}>
                        View Demo <span style={{ fontSize: '15px' }}>→</span>
                    </Link>
                </div>
            </nav>

            {/* ── HERO ───────────────────────────────────────────────── */}
            <section className="dot-grid" style={{
                minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative', overflow: 'hidden', paddingTop: '56px',
            }}>
                {/* Glow orbs */}
                <div style={{ position: 'absolute', top: '8%', right: '-4%', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(37,99,235,0.11) 0%, transparent 70%)', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', bottom: '5%', left: '-6%', width: '450px', height: '450px', background: 'radial-gradient(circle, rgba(37,99,235,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', top: '40%', left: '50%', transform: 'translate(-50%,-50%)', width: '900px', height: '400px', background: 'radial-gradient(ellipse, rgba(37,99,235,0.04) 0%, transparent 65%)', pointerEvents: 'none' }} />

                <div style={{ textAlign: 'center', maxWidth: '820px', padding: '40px 24px', position: 'relative', zIndex: 1 }}>
                    {/* Badge */}
                    <div className="hero-1" style={{
                        display: 'inline-flex', alignItems: 'center', gap: '10px',
                        padding: '7px 16px', marginBottom: '40px',
                        background: 'rgba(37,99,235,0.09)', border: '1px solid rgba(59,130,246,0.22)',
                        borderRadius: '100px',
                    }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e' }} />
                        <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono), monospace', color: '#64748b', letterSpacing: '.1em', textTransform: 'uppercase' }}>
                            UnionBank IdeaHackathon 2026 · Sandbox
                        </span>
                    </div>

                    {/* Headline */}
                    <h1 className="hero-2" style={{
                        fontFamily: 'var(--font-serif), Georgia, "Times New Roman", serif',
                        fontStyle: 'italic',
                        fontSize: 'clamp(52px, 8.5vw, 92px)',
                        fontWeight: 400,
                        lineHeight: 1.04,
                        letterSpacing: '-0.025em',
                        color: '#f1f5f9',
                        marginBottom: '28px',
                    }}>
                        Banking Intelligence,<br />
                        <span style={{ color: '#3b82f6' }}>Engineered.</span>
                    </h1>

                    {/* Subtitle */}
                    <p className="hero-3" style={{ fontSize: '16px', color: '#94a3b8', lineHeight: 1.75, maxWidth: '560px', margin: '0 auto 36px' }}>
                        Seven AI layers — from signal detection to personalised outreach — running on a live Kafka pipeline with trained ML models and Azure AI generation.
                    </p>

                    {/* Layer chips */}
                    <div className="hero-3" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginBottom: '52px' }}>
                        {['ARGUS', 'Risk Engine', 'COMPASS', 'HERALD', 'VERDICT', 'ORACLE'].map((l) => (
                            <span key={l} style={{
                                padding: '5px 12px', fontSize: '10px', letterSpacing: '.07em',
                                fontFamily: 'var(--font-mono), monospace', color: '#475569',
                                border: '1px solid #131e35', borderRadius: '5px',
                                background: 'rgba(10,16,32,0.7)',
                            }}>{l}</span>
                        ))}
                    </div>

                    {/* CTAs */}
                    <div className="hero-4" style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <Link href="/login" className="btn-primary" style={{
                            display: 'inline-flex', alignItems: 'center', gap: '8px',
                            padding: '14px 30px', borderRadius: '9px',
                            fontSize: '15px', fontWeight: 600, color: '#fff', textDecoration: 'none',
                        }}>
                            Access Demo Platform
                            <span style={{ fontSize: '17px' }}>→</span>
                        </Link>
                        <a href="#architecture" className="btn-ghost" style={{
                            display: 'inline-flex', alignItems: 'center', gap: '8px',
                            padding: '14px 30px', borderRadius: '9px',
                            fontSize: '15px', fontWeight: 500, color: '#94a3b8', textDecoration: 'none',
                        }}>
                            View Architecture
                        </a>
                    </div>
                </div>
            </section>

            {/* ── METRICS RIBBON ─────────────────────────────────────── */}
            <section style={{ background: '#080d18', borderTop: '1px solid #131e35', borderBottom: '1px solid #131e35' }}>
                <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)' }}>
                    {METRICS.map((m, i) => (
                        <div key={m.label} style={{
                            padding: '32px 28px',
                            borderLeft: i === 0 ? '2px solid #f59e0b' : '1px solid #131e35',
                        }}>
                            <div className="metric-val" style={{ fontSize: '42px', fontWeight: 700, lineHeight: 1, marginBottom: '10px', letterSpacing: '-0.02em' }}>
                                {m.value}
                                {m.suffix && <span style={{ fontSize: '22px', fontWeight: 400, opacity: .65 }}>{m.suffix}</span>}
                            </div>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>{m.label}</div>
                            <div style={{ fontSize: '11px', color: '#475569', fontFamily: 'var(--font-mono), monospace', letterSpacing: '.04em' }}>{m.sub}</div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── HOW IT WORKS ───────────────────────────────────────── */}
            <section id="features" style={{ padding: '100px 28px', maxWidth: '1200px', margin: '0 auto' }}>
                <div style={{ textAlign: 'center', marginBottom: '64px' }}>
                    <div style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '10px', color: '#3b82f6', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: '16px' }}>Intelligence Pipeline</div>
                    <h2 style={{ fontFamily: 'var(--font-serif), Georgia, serif', fontStyle: 'italic', fontSize: 'clamp(32px, 4vw, 48px)', fontWeight: 400, color: '#f1f5f9', letterSpacing: '-.02em' }}>
                        Predict. Intervene. Measure.
                    </h2>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                    {STEPS.map((s) => (
                        <div key={s.title} className="step-card" style={{ padding: '36px 32px' }}>
                            <div style={{
                                width: '48px', height: '48px', borderRadius: '12px',
                                background: 'rgba(37,99,235,0.12)', border: '1px solid rgba(59,130,246,0.25)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: '#3b82f6', marginBottom: '24px',
                            }}>
                                {s.icon}
                            </div>
                            <div style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '10px', color: '#475569', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: '8px' }}>{s.sub}</div>
                            <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#f1f5f9', marginBottom: '16px', letterSpacing: '-.01em' }}>{s.title}</h3>
                            <p style={{ fontSize: '14px', color: '#64748b', lineHeight: 1.75 }}>{s.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── PLATFORM LAYERS ────────────────────────────────────── */}
            <section id="architecture" style={{ padding: '100px 28px', background: '#080d18', borderTop: '1px solid #131e35', borderBottom: '1px solid #131e35' }}>
                <div style={{ maxWidth: '900px', margin: '0 auto' }}>
                    <div style={{ textAlign: 'center', marginBottom: '64px' }}>
                        <div style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '10px', color: '#3b82f6', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: '16px' }}>Architecture</div>
                        <h2 style={{ fontFamily: 'var(--font-serif), Georgia, serif', fontStyle: 'italic', fontSize: 'clamp(30px, 4vw, 44px)', fontWeight: 400, color: '#f1f5f9', letterSpacing: '-.02em' }}>
                            Seven Layers, One Pipeline
                        </h2>
                    </div>

                    <div style={{ position: 'relative' }}>
                        {/* Vertical connector line */}
                        <div style={{ position: 'absolute', left: '20px', top: '24px', bottom: '24px', width: '1px', background: 'linear-gradient(to bottom, transparent, #1a2744 10%, #1a2744 90%, transparent)', zIndex: 0 }} />

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {LAYERS.map((l, idx) => (
                                <div key={l.n} className="layer-row" style={{ display: 'flex', alignItems: 'flex-start', gap: '20px', position: 'relative', zIndex: 1 }}>
                                    {/* Number badge */}
                                    <div style={{
                                        width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0,
                                        background: idx === 2 ? 'rgba(37,99,235,0.18)' : 'rgba(10,16,32,0.9)',
                                        border: idx === 2 ? '1px solid rgba(59,130,246,0.45)' : '1px solid #1a2744',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}>
                                        <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '11px', fontWeight: 700, color: idx === 2 ? '#3b82f6' : '#475569', letterSpacing: '.04em' }}>{l.n}</span>
                                    </div>

                                    {/* Content */}
                                    <div style={{ flex: 1, paddingTop: '8px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px', flexWrap: 'wrap' }}>
                                            <span style={{ fontSize: '14px', fontWeight: 600, color: '#e2e8f0' }}>{l.name}</span>
                                            <span style={{
                                                fontSize: '10px', fontFamily: 'var(--font-mono), monospace', letterSpacing: '.06em',
                                                padding: '2px 8px', borderRadius: '4px',
                                                background: idx === 2 ? 'rgba(37,99,235,0.12)' : 'rgba(26,39,68,0.8)',
                                                color: idx === 2 ? '#60a5fa' : '#475569',
                                                border: idx === 2 ? '1px solid rgba(59,130,246,0.25)' : '1px solid #1a2744',
                                            }}>{l.tag}</span>
                                        </div>
                                        <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.6 }}>{l.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* ── DEMO CREDENTIALS ───────────────────────────────────── */}
            <section style={{ padding: '100px 28px' }}>
                <div style={{ maxWidth: '860px', margin: '0 auto' }}>
                    <div style={{ textAlign: 'center', marginBottom: '48px' }}>
                        <div style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '10px', color: '#f59e0b', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: '16px' }}>Sandbox Access</div>
                        <h2 style={{ fontFamily: 'var(--font-serif), Georgia, serif', fontStyle: 'italic', fontSize: 'clamp(30px, 4vw, 44px)', fontWeight: 400, color: '#f1f5f9', letterSpacing: '-.02em' }}>
                            Three Access Levels. One Demo.
                        </h2>
                        <p style={{ fontSize: '15px', color: '#64748b', marginTop: '16px' }}>Click any row to copy credentials to clipboard.</p>
                    </div>

                    {/* Terminal card */}
                    <div style={{ border: '1px solid #1a2744', borderRadius: '14px', overflow: 'hidden', background: '#080d18', boxShadow: '0 0 60px rgba(37,99,235,0.06)' }}>
                        {/* Title bar */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 18px', background: '#0a1020', borderBottom: '1px solid #1a2744' }}>
                            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444' }} />
                            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b' }} />
                            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#22c55e' }} />
                            <span style={{ marginLeft: '10px', fontFamily: 'var(--font-mono), monospace', fontSize: '11px', color: '#334155', letterSpacing: '.06em' }}>
                                DEMO ACCESS · SANDBOX ENVIRONMENT
                            </span>
                            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e' }} />
                                <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '10px', color: '#334155' }}>ONLINE</span>
                            </div>
                        </div>

                        {/* Table header */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.3fr 1.8fr auto', gap: '0', padding: '12px 24px', borderBottom: '1px solid #131e35', background: 'rgba(10,16,32,0.5)' }}>
                            {['USERNAME', 'PASSWORD', 'ROLE', 'ACCESS LEVEL', ''].map((h) => (
                                <span key={h} style={{ fontSize: '9px', fontFamily: 'var(--font-mono), monospace', color: '#334155', letterSpacing: '.1em', textTransform: 'uppercase' }}>{h}</span>
                            ))}
                        </div>

                        {/* Credential rows */}
                        {CREDENTIALS.map((c) => (
                            <div
                                key={c.user}
                                className="cred-row"
                                onClick={() => copy(c.user, c.pass)}
                                style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.3fr 1.8fr auto', gap: '0', padding: '18px 24px', alignItems: 'center' }}
                            >
                                <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '13px', fontWeight: 700, color: '#e2e8f0', letterSpacing: '.04em' }}>{c.user}</span>
                                <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '13px', color: '#94a3b8', letterSpacing: '.04em' }}>{c.pass}</span>
                                <div>
                                    <span style={{
                                        fontSize: '10px', fontFamily: 'var(--font-mono), monospace', letterSpacing: '.07em',
                                        padding: '3px 9px', borderRadius: '4px', fontWeight: 700,
                                        background: `${c.color}18`, color: c.color, border: `1px solid ${c.color}35`,
                                    }}>{c.badge}</span>
                                </div>
                                <span style={{ fontSize: '12px', color: '#475569' }}>{c.access}</span>
                                <div style={{
                                    width: '68px', textAlign: 'right',
                                    fontFamily: 'var(--font-mono), monospace', fontSize: '10px',
                                    color: copied === c.user ? '#22c55e' : '#334155',
                                    letterSpacing: '.04em', transition: 'color .2s',
                                }}>
                                    {copied === c.user ? '✓ COPIED' : '⌘ COPY'}
                                </div>
                            </div>
                        ))}

                        {/* Warning strip */}
                        <div style={{ padding: '12px 24px', background: 'rgba(245,158,11,0.05)', borderTop: '1px solid rgba(245,158,11,0.12)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '11px', color: '#f59e0b' }}>⚠</span>
                            <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '10px', color: '#92400e', letterSpacing: '.05em' }}>
                                SANDBOX ENVIRONMENT · Synthetic data only · No real customer PII
                            </span>
                        </div>

                        {/* CTA */}
                        <div style={{ padding: '28px 24px', borderTop: '1px solid #131e35', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                            <div>
                                <div style={{ fontSize: '14px', fontWeight: 600, color: '#e2e8f0', marginBottom: '4px' }}>Ready to explore the platform?</div>
                                <div style={{ fontSize: '12px', color: '#475569' }}>Use any of the credentials above. All features are fully functional.</div>
                            </div>
                            <Link href="/login" className="btn-primary" style={{
                                display: 'inline-flex', alignItems: 'center', gap: '8px',
                                padding: '13px 28px', borderRadius: '9px', flexShrink: 0,
                                fontSize: '14px', fontWeight: 700, color: '#fff', textDecoration: 'none', letterSpacing: '.02em',
                            }}>
                                Launch Platform →
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── FOOTER ─────────────────────────────────────────────── */}
            <footer style={{ borderTop: '1px solid #131e35', background: '#080d18', padding: '40px 28px' }}>
                <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            width: '32px', height: '32px', borderRadius: '8px',
                            background: 'linear-gradient(145deg, #1e3a8a, #1d4ed8)',
                            border: '1px solid rgba(59,130,246,0.35)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <span style={{ fontFamily: 'var(--font-mono), monospace', color: '#fff', fontSize: '10px', fontWeight: 900 }}>UB</span>
                        </div>
                        <div>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: '#94a3b8' }}>Union Bank · PCOP v2.0</div>
                            <div style={{ fontSize: '11px', color: '#334155', fontFamily: 'var(--font-mono), monospace' }}>IdeaHackathon 2026</div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                        {['Azure AI · DeepSeek', 'LangGraph', 'PyTorch · ONNX', 'Next.js 16', 'Kafka'].map((t) => (
                            <span key={t} style={{
                                fontSize: '10px', fontFamily: 'var(--font-mono), monospace',
                                padding: '4px 10px', borderRadius: '4px',
                                border: '1px solid #1a2744', color: '#334155',
                                background: 'rgba(10,16,32,0.6)',
                            }}>{t}</span>
                        ))}
                    </div>

                    <div style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '11px', color: '#334155' }}>
                        © 2026 Union Bank
                    </div>
                </div>
            </footer>
        </div>
    );
}
