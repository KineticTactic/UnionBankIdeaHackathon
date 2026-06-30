'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/hooks/useAuth';
import { Eye, EyeOff, AlertCircle, TrendingUp, Activity, Shield, Brain } from 'lucide-react';

const DEMO = [
  { user: 'analyst',   pass: 'analyst123',  role: 'Risk Analyst',       desc: 'Read-only · signals & analytics' },
  { user: 'rm_user',   pass: 'rm123',       role: 'Relationship Mgr',   desc: 'Outreach queue · customer notes' },
  { user: 'admin',     pass: 'admin123',    role: 'Administrator',      desc: 'Full platform access'           },
];

const STATS = [
  { icon: Brain,      value: '0.93',  label: 'GraphSAGE AUC' },
  { icon: Activity,   value: '9',     label: 'Signal Streams' },
  { icon: Shield,     value: '7',     label: 'AI/ML Layers'  },
  { icon: TrendingUp, value: '< 4h',  label: 'Detection Lag' },
];

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const { login } = useAuth();
  const router    = useRouter();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      router.push('/dashboard');
    } catch {
      setError('Invalid credentials. Try the demo accounts below.');
    } finally {
      setLoading(false);
    }
  };

  const fill = (u: string, p: string) => { setUsername(u); setPassword(p); setError(''); };

  return (
    <div className="w-full min-h-screen flex bg-cream">

      {/* ── Left panel — gradient + dot grid ──────────────────────────── */}
      <div className="hidden lg:flex lg:w-[52%] flex-col justify-between relative overflow-hidden bg-white border-r border-soft">

        {/* Mesh gradient blobs */}
        <div className="absolute inset-0 bg-mesh-gradient animate-pulse-soft" />
        <div className="absolute top-[20%] left-[15%] w-[500px] h-[500px] opacity-70 pointer-events-none"
             style={{ background: 'radial-gradient(circle, rgba(180,107,62,0.5) 0%, transparent 60%)' }} />
        <div className="absolute bottom-[10%] right-[10%] w-[400px] h-[400px] opacity-60 pointer-events-none"
             style={{ background: 'radial-gradient(circle, rgba(107,19,43,0.4) 0%, transparent 60%)' }} />

        {/* Dot grid */}
        <div className="absolute inset-0 bg-dot-grid" />

        {/* Content */}
        <div className="relative z-10 p-12 flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-auto">
            <Image
              src="/pcop_logo.png"
              alt="PCOP"
              width={48}
              height={26}
              className="h-7 w-auto"
              priority
            />
            <div>
              <p className="text-charcoal text-[15px] font-bold tracking-tight leading-none font-heading">PCOP</p>
              <p className="text-gray-400 text-[10px] tracking-widest uppercase mt-0.5">Union Bank</p>
            </div>
          </div>

          {/* Hero text */}
          <div className="my-auto">
            <div className="inline-flex items-center gap-2 mb-6 px-3 py-1.5 rounded-md bg-crimson-soft border border-crimson">
              <span className="w-1.5 h-1.5 rounded-full bg-gradient-brand animate-live-pulse" />
              <span className="text-crimson text-[10px] font-semibold uppercase tracking-widest">IDEA 2.0 Hackathon 2026</span>
            </div>

            <h1 className="text-charcoal font-heading font-bold leading-[1.05] mb-4"
                style={{ fontSize: 'clamp(2.2rem, 3.5vw, 3.2rem)', letterSpacing: '-0.02em' }}>
              Predict.<br />Personalise.<br />
              <span className="text-crimson">Retain.</span>
            </h1>

            <p className="text-gray-500 text-[14px] leading-relaxed max-w-[380px]">
              Seven-layer AI/ML platform identifying retail banking customers at risk of attrition — weeks before any explicit signal.
            </p>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3 mt-auto">
            {STATS.map(s => (
              <div key={s.label} className="rounded-md p-4 bg-cream border border-soft">
                <s.icon className="w-4 h-4 text-crimson mb-2" />
                <p className="text-charcoal text-[22px] font-black leading-none font-heading">{s.value}</p>
                <p className="text-gray-400 text-[10px] mt-1 uppercase tracking-wider">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Footer */}
          <p className="text-gray-400 text-[10px] mt-8 uppercase tracking-widest">
            Union Bank · IDEA 2.0 · Hackathon 2026
          </p>
        </div>
      </div>

      {/* ── Right panel — cream background with white form card ────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        {/* Mobile logo */}
        <div className="flex lg:hidden items-center gap-2.5 mb-10">
          <Image
            src="/pcop_logo.png"
            alt="PCOP"
            width={36}
            height={20}
            className="h-5 w-auto"
            priority
          />
          <span className="text-charcoal text-[15px] font-bold font-heading">PCOP · Union Bank</span>
        </div>

        <div className="w-full max-w-[400px] bg-white border border-soft rounded-md p-8">
          <h2 className="text-[28px] font-heading font-bold text-charcoal mb-1" style={{ letterSpacing: '-0.02em' }}>
            Welcome back
          </h2>
          <p className="text-gray-500 text-[14px] mb-8">Sign in to the intelligence platform</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div>
              <label className="block text-[12px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="analyst / manager / admin"
                required autoFocus autoComplete="username"
                className="w-full px-4 py-3 text-[14px] rounded-md border bg-white text-charcoal placeholder:text-gray-400 outline-none transition-all"
                style={{ borderColor: username ? 'var(--crimson)' : 'var(--border-color)' }}
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-[12px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required autoComplete="current-password"
                  className="w-full px-4 py-3 pr-11 text-[14px] rounded-md border bg-white text-charcoal placeholder:text-gray-400 outline-none transition-all"
                  style={{ borderColor: password ? 'var(--crimson)' : 'var(--border-color)' }}
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-charcoal transition-colors">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2.5 px-4 py-3 rounded-md bg-crimson-soft border border-crimson">
                <AlertCircle className="w-4 h-4 text-crimson shrink-0" />
                <span className="text-[13px] text-crimson">{error}</span>
              </div>
            )}

            {/* Submit */}
            <button type="submit" disabled={loading || !username || !password}
              className="w-full py-3.5 rounded-md text-[14px] font-bold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed mt-2 bg-gradient-brand hover:opacity-90">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in…
                </span>
              ) : 'Sign In'}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-8">
            <div className="flex-1 h-px bg-soft" />
            <span className="text-[11px] text-gray-500 uppercase tracking-widest">Demo accounts</span>
            <div className="flex-1 h-px bg-soft" />
          </div>

          {/* Demo accounts */}
          <div className="space-y-2">
            {DEMO.map(d => (
              <button key={d.user} onClick={() => fill(d.user, d.pass)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-md border border-soft bg-white hover:border-crimson hover:bg-crimson-soft transition-all text-left group">
                <div className="w-8 h-8 rounded-md bg-crimson-soft flex items-center justify-center shrink-0">
                  <span className="text-crimson text-[10px] font-black">{d.user.slice(0,2).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-charcoal group-hover:text-crimson transition-colors">{d.role}</p>
                  <p className="text-[11px] text-gray-500">{d.desc}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[11px] font-mono font-semibold text-gray-500">{d.user}</p>
                  <p className="text-[10px] text-gray-400 group-hover:text-crimson transition-colors">click to fill →</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
