'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { RefreshCw, Zap, Radio } from 'lucide-react';

const TOPICS = [
  { name: 'pcop.alarms.v1',       from: 'L2 ARGUS',   to: 'L4 COMPASS' },
  { name: 'pcop.action_plans.v1', from: 'L4 COMPASS', to: 'L5 HERALD'  },
  { name: 'pcop.dispatched.v1',   from: 'L5 HERALD',  to: 'L6 VERDICT' },
  { name: 'pcop.measurements.v1', from: 'L6 VERDICT', to: 'L7 ORACLE'  },
];

function PulseDot({ status }: { status: string }) {
  const c = status === 'live' ? 'bg-emerald-400' : status === 'warning' ? 'bg-amber-400' : 'bg-red-400';
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-60 ${c}`} />
      <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${c}`} />
    </span>
  );
}

export default function PipelinePage() {
  const [health, setHealth] = useState<any[]>([]);
  const [kafka,  setKafka]  = useState<any>(null);
  const [stages, setStages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [h, k] = await Promise.all([api.getAdminHealth(), api.getKafkaStatus()]);
      setHealth(h.layers || []);
      setKafka(k);
      // Try /health/stages
      try {
        const s = await fetch('/health/stages').then(r => r.json());
        setStages(s.stages || []);
      } catch {}
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 8000);
    return () => clearInterval(iv);
  }, []);

  if (loading && !health.length) return (
    <div className="flex items-center justify-center h-64 text-white/30 text-sm animate-pulse">Loading pipeline…</div>
  );

  const kafkaEvents: any[] = kafka?.recent_events || kafka?.recentEvents || [];
  const kafkaMode   = kafka?.mode || 'DEMO';
  const connected   = kafka?.connected ?? true;
  const msgCount    = kafka?.messages || kafka?.totalMessages || kafkaEvents.length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Live Pipeline & Health</h1>
          <p className="text-white/40 text-sm mt-0.5">Real-time Kafka topic flow + per-service health probes</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/6 hover:bg-white/10 text-white/60 hover:text-white text-xs transition-all">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Kafka status banner */}
      <div className={`rounded-xl border p-4 flex items-center gap-4 ${connected ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
        <Radio className={`w-5 h-5 ${connected ? 'text-emerald-400' : 'text-red-400'}`} />
        <div className="flex-1">
          <p className="text-sm font-bold text-white">Kafka Simulation — {kafkaMode}</p>
          <p className={`text-xs ${connected ? 'text-emerald-400/70' : 'text-red-400/70'}`}>{connected ? 'Connected' : 'Disconnected'} · {msgCount} messages processed</p>
        </div>
        <PulseDot status={connected ? 'live' : 'down'} />
      </div>

      {/* Kafka topic flow */}
      <div className="rounded-xl border border-white/8 bg-white/3 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-4">Kafka Topic Flow</p>
        <div className="flex items-center gap-2 flex-wrap">
          {TOPICS.map((t, i) => (
            <div key={t.name} className="flex items-center gap-2">
              <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-center min-w-[100px]">
                <p className="text-[10px] text-white/35 font-semibold">{t.from}</p>
              </div>
              <div className="flex flex-col items-center gap-0.5 min-w-[120px]">
                <div className="relative w-full h-5 flex items-center">
                  <div className="w-full h-px bg-white/15" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="bg-[#0a1628] px-1 text-[8px] text-sky-400/80 font-mono whitespace-nowrap">{t.name}</span>
                  </div>
                  {/* animated packet */}
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-sky-400 opacity-80"
                    style={{ animation: `slideRight ${1.5 + i * 0.4}s linear infinite` }} />
                </div>
                <style>{`@keyframes slideRight { from { left: 0; } to { left: 100%; } }`}</style>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-center min-w-[100px]">
                <p className="text-[10px] text-white/35 font-semibold">{t.to}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Layer health */}
        <div className="rounded-xl border border-white/8 bg-white/3 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-4">Layer Health</p>
          <div className="space-y-2">
            {health.map((l: any) => (
              <div key={l.id} className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0">
                <PulseDot status={l.status} />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">{l.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-white tabular-nums">{l.latency_ms}<span className="text-white/30 text-[10px]">ms</span></p>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border w-14 text-center ${
                  l.status === 'live' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
                  l.status === 'warning' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' :
                  'bg-red-500/15 text-red-400 border-red-500/30'
                }`}>{l.status?.toUpperCase()}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent events */}
        <div className="rounded-xl border border-white/8 bg-white/3 p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40">Recent Events</p>
            <Zap className="w-4 h-4 text-white/20" />
          </div>
          {kafkaEvents.length === 0 ? (
            <div className="space-y-2">
              {['ARGUS alarm fired — CUST-0001 inactivity spike',
                'COMPASS action plan generated — email + FD offer',
                'HERALD content approved — dispatched via SendGrid',
                'VERDICT interaction — email opened (CUST-0001)',
                'ORACLE REFINE — promoted 3 prompt variants',
                'ARGUS alarm fired — CUST-0008 salary credit stopped',
                'COMPASS NBA — phone channel selected (PRIORITY)',
              ].map((evt, i) => (
                <div key={i} className="flex items-start gap-2.5 py-2 border-b border-white/5 last:border-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-sky-400 mt-1.5 shrink-0" />
                  <p className="text-[12px] text-white/60 leading-relaxed">{evt}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {kafkaEvents.slice(0, 20).map((evt: any, i: number) => (
                <div key={i} className="flex items-start gap-2.5 py-2 border-b border-white/5 last:border-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-sky-400 mt-1.5 shrink-0" />
                  <p className="text-[12px] text-white/60 leading-relaxed">
                    {evt.type || evt.event_type || evt.signal_type || JSON.stringify(evt).slice(0, 60)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
