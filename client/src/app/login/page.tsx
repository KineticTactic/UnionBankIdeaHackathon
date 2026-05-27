'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Lock, User, AlertCircle, ShieldCheck } from 'lucide-react';

export default function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError]       = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();
    const { login } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        try {
            await login(username, password);
            router.push('/dashboard');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Invalid credentials');
        } finally {
            setIsLoading(false);
        }
    };

    const fillDemo = (u: string, p: string) => { setUsername(u); setPassword(p); };

    return (
        <div className="min-h-screen flex bg-[#F4F6F9]">
            {/* Left panel */}
            <div className="hidden lg:flex lg:w-1/2 bg-blue-700 flex-col justify-between p-12">
                <div>
                    <div className="flex items-center gap-3 mb-16">
                        <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center">
                            <span className="text-white text-sm font-black">UB</span>
                        </div>
                        <span className="text-white font-bold text-lg">Union Bank</span>
                    </div>
                    <h1 className="text-4xl font-bold text-white leading-tight mb-4">
                        Predictive Customer<br />Outreach Platform
                    </h1>
                    <p className="text-blue-200 text-base leading-relaxed max-w-sm">
                        AI-powered churn intelligence. FusionXV2 ensemble scoring, DeepHit survival analysis, and LLM-generated personalised outreach.
                    </p>
                </div>
                <div className="flex flex-col gap-3">
                    {[
                        { label: "CHRONOS v2", sub: "GraphSAGE + Transformer + DeepHit + XGBoost" },
                        { label: "COMPASS", sub: "LangGraph next-best-action orchestration" },
                        { label: "HERALD", sub: "DeepSeek-V4 personalised content generation" },
                    ].map(f => (
                        <div key={f.label} className="flex items-center gap-3">
                            <ShieldCheck className="w-4 h-4 text-blue-300 shrink-0" />
                            <div>
                                <span className="text-white text-sm font-semibold">{f.label}</span>
                                <span className="text-blue-300 text-xs ml-2">{f.sub}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Right panel */}
            <div className="flex-1 flex items-center justify-center p-8">
                <div className="w-full max-w-sm">
                    {/* Mobile logo */}
                    <div className="flex items-center gap-2.5 mb-10 lg:hidden">
                        <div className="w-8 h-8 rounded-lg bg-blue-700 flex items-center justify-center">
                            <span className="text-white text-xs font-black">UB</span>
                        </div>
                        <span className="font-bold text-slate-900">PCOP · Union Bank</span>
                    </div>

                    <h2 className="text-2xl font-bold text-slate-900 mb-1">Sign in</h2>
                    <p className="text-sm text-slate-500 mb-8">Access your intelligence dashboard</p>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider block mb-1.5">Username</label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <Input
                                    type="text"
                                    placeholder="analyst / manager / admin"
                                    value={username}
                                    onChange={e => setUsername(e.target.value)}
                                    required
                                    className="pl-9 h-11 bg-white border-slate-200 text-sm"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider block mb-1.5">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <Input
                                    type="password"
                                    placeholder="••••••••••"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    required
                                    className="pl-9 h-11 bg-white border-slate-200 text-sm"
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                                <p className="text-sm text-red-600">{error}</p>
                            </div>
                        )}

                        <Button
                            type="submit"
                            className="w-full h-11 bg-blue-700 hover:bg-blue-800 font-semibold text-sm mt-2"
                            disabled={isLoading}
                        >
                            {isLoading ? 'Signing in...' : 'Sign in to PCOP'}
                        </Button>
                    </form>

                    <div className="mt-8 pt-6 border-t border-slate-200">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Quick access — demo accounts</p>
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { u: 'analyst', p: 'analyst123', label: 'Analyst' },
                                { u: 'manager', p: 'manager123', label: 'Manager' },
                                { u: 'admin',   p: 'admin123',   label: 'Admin' },
                            ].map(d => (
                                <button
                                    key={d.u}
                                    type="button"
                                    onClick={() => fillDemo(d.u, d.p)}
                                    className="p-2.5 bg-white border border-slate-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors text-center"
                                >
                                    <p className="text-xs font-semibold text-slate-700">{d.label}</p>
                                    <p className="text-[10px] text-slate-400 mt-0.5">{d.p}</p>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
