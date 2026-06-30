'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { api, getToken } from '@/lib/api';
import { RefreshCw, Radio, Zap, Activity, Send, AlertTriangle, BarChart2, Cpu } from 'lucide-react';

/* ── topic metadata ──────────────────────────────────────────────────────────── */
const TOPIC_META: Record<string, { layer: string; color: string; label: string }> = {
  'cbs.transactions':       { layer: 'L1 CBS',     color: '#8B8481', label: 'Transactions' },
  'cbs.account_updates':    { layer: 'L1 CBS',     color: '#8B8481', label: 'Account Updates' },
  'crm.customer_events':    { layer: 'L1 CRM',     color: '#8B8481', label: 'CRM Events' },
  'risk.signal_detections': { layer: 'L2 ARGUS',   color: '#6B132B', label: 'Signal Detections' },
  'risk.score_updates':     { layer: 'L3 CHRONOS', color: '#6B132B', label: 'Score Updates' },
  'engagement.activity':    { layer: 'L5 HERALD',  color: '#6B132B', label: 'Engagement' },
  'pcop.alarms.v1':         { layer: 'L2 ARGUS',   color: '#6B132B', label: 'PCOP Alarms' },
  'pcop.action_plans.v1':   { layer: 'L4 COMPASS', color: '#B46B3E', label: 'Action Plans' },
  'pcop.dispatched.v1':     { layer: 'L5 HERALD',  color: '#6B132B', label: 'Dispatched' },
  'pcop.measurements.v1':   { layer: 'L6 VERDICT', color: '#2A161B', label: 'Measurements' },
};

const TOPICS = Object.entries(TOPIC_META).map(([key, m]) => ({ key, ...m }));

/* derive a short event-type label from the topic */
function evtLabel(topic: string): { text: string; bg: string; fg: string } {
  if (topic.includes('signal'))     return { text: 'SIGNAL',      bg: 'bg-[#6B132B]',     fg: 'text-white' };
  if (topic.includes('score'))      return { text: 'SCORE',       bg: 'bg-[#B46B3E]', fg: 'text-white' };
  if (topic.includes('action'))     return { text: 'ACTION PLAN', bg: 'bg-[#B46B3E]', fg: 'text-white' };
  if (topic.includes('dispatch'))   return { text: 'DISPATCH',    bg: 'bg-[#B46B3E]', fg: 'text-white' };
  if (topic.includes('measure'))    return { text: 'MEASUREMENT', bg: 'bg-[#2A161B]', fg: 'text-white' };
  if (topic.includes('alarm'))      return { text: 'ALARM',       bg: 'bg-[#6B132B]',     fg: 'text-white' };
  if (topic.includes('transaction'))return { text: 'TXN',         bg: 'bg-[#F9F9F7]',   fg: 'text-[#6B6562]' };
  if (topic.includes('account'))    return { text: 'ACCOUNT',     bg: 'bg-[#F9F9F7]',   fg: 'text-[#6B6562]' };
  if (topic.includes('crm'))        return { text: 'CRM',         bg: 'bg-[#F4D9C0]',   fg: 'text-[#2A161B]' };
  if (topic.includes('engag'))      return { text: 'ENGAGEMENT',  bg: 'bg-[#B46B3E]',     fg: 'text-white' };
  return { text: 'EVENT', bg: 'bg-[#F9F9F7]', fg: 'text-[#6B6562]' };
}

function fmtTime(ts: string) {
  try { return new Date(ts).toLocaleTimeString('en-IN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
  catch { return ts || ''; }
}

function StatusDot({ status }: { status: string }) {
  const c = status === 'live' ? 'bg-[#6B132B]' : status === 'warning' ? 'bg-[#B46B3E]' : 'bg-[#2A161B]';
  return (
    <span className="relative flex h-2.5 w-2.5 shrink-0">
      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-50 ${c}`} />
      <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${c}`} />
    </span>
  );
}

function Spark({ counts }: { counts: number[] }) {
  const max = Math.max(...counts, 1);
  return (
    <div className="flex items-end gap-px h-5 w-14">
      {(counts.length ? counts : [0]).map((v, i) => (
        <div key={i} className="flex-1 rounded-sm transition-all" style={{
          height: `${Math.max(2, (v / max) * 20)}px`,
          background: '#6B132B',
          opacity: 0.25 + (i / Math.max(counts.length - 1, 1)) * 0.75,
        }} />
      ))}
    </div>
  );
}

/* ── main page ───────────────────────────────────────────────────────────────── */
export default function PipelinePage() {
  const [health,      setHealth]      = useState<any[]>([]);
  const [sseStatus,   setSseStatus]   = useState<any>(null);
  const [events,      setEvents]      = useState<any[]>([]);
  const [topicCounts, setTopicCounts] = useState<Record<string, number>>({});
  const [sparkData,   setSparkData]   = useState<Record<string, number[]>>({});
  const [throughput,  setThroughput]  = useState(0);
  const [connState,   setConnState]   = useState<'connecting'|'connected'|'error'>('connecting');
  const [inject,      setInject]      = useState({ topic: 'risk.signal_detections', key: 'CUST-0001', value: '' });
  const [injecting,   setInjecting]   = useState(false);
  const [injectMsg,   setInjectMsg]   = useState('');

  const eventsRef    = useRef<any[]>([]);
  const countRef     = useRef<Record<string, number>>({});
  const recentTsRef  = useRef<number[]>([]);
  const sseRef       = useRef<EventSource | null>(null);
  const logRef       = useRef<HTMLDivElement>(null);

  /* throughput: count events in the last 60s */
  useEffect(() => {
    const iv = setInterval(() => {
      const now = Date.now();
      recentTsRef.current = recentTsRef.current.filter(t => now - t < 60000);
      setThroughput(recentTsRef.current.length);
    }, 2000);
    return () => clearInterval(iv);
  }, []);

  const pushEvent = useCallback((evt: any) => {
    const withId = { ...evt, _rid: Math.random() };
    eventsRef.current = [withId, ...eventsRef.current].slice(0, 120);
    setEvents([...eventsRef.current]);
    recentTsRef.current.push(Date.now());

    const t = evt.topic || '';
    countRef.current[t] = (countRef.current[t] || 0) + 1;
    setTopicCounts({ ...countRef.current });
    setSparkData(prev => ({ ...prev, [t]: [...(prev[t] || []).slice(-9), 1] }));

    if (logRef.current) logRef.current.scrollTop = 0;
  }, []);

  const connectSSE = useCallback(() => {
    if (sseRef.current) { sseRef.current.close(); sseRef.current = null; }
    const token = getToken();
    if (!token) return;

    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const es = new EventSource(`${backendUrl}/api/kafka/stream?token=${encodeURIComponent(token)}`);
    sseRef.current = es;
    setConnState('connecting');

    es.onopen  = () => setConnState('connected');
    es.onerror = () => setConnState('error');

    es.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data);
        if (d.type === 'heartbeat') return;

        if (d.type === 'status') {
          setSseStatus(d);
          setConnState('connected');
          const hist: any[] = d.recentEvents || [];
          if (hist.length) {
            eventsRef.current = hist.map(h => ({ ...h, _rid: Math.random() }));
            setEvents([...eventsRef.current]);
            const counts: Record<string, number> = {};
            hist.forEach(h => { counts[h.topic] = (counts[h.topic] || 0) + 1; });
            countRef.current = counts;
            setTopicCounts({ ...counts });
          }
          return;
        }

        if (d.type === 'event') pushEvent(d);
      } catch {}
    };
  }, [pushEvent]);

  useEffect(() => {
    connectSSE();
    api.getAdminHealth().then(r => setHealth(r.layers || [])).catch(() => {});
    return () => sseRef.current?.close();
  }, [connectSSE]);

  const doInject = async () => {
    setInjecting(true); setInjectMsg('');
    try {
      let value: any;
      if (inject.value.trim()) {
        value = JSON.parse(inject.value);
      } else {
        value = { customer_id: inject.key, signal_type: 'manual_test', confidence: 0.92, method: 'MANUAL', cusum_value: 3.5, alarm_threshold: 3.0, evidence: 'Injected via console' };
      }
      await api.publishKafkaEvent(inject.topic, inject.key, value);
      setInjectMsg('✓ Injected — watch the stream');
    } catch (e: any) {
      setInjectMsg('Error: ' + e.message);
    }
    setInjecting(false);
    setTimeout(() => setInjectMsg(''), 4000);
  };

  const totalMsgs = sseStatus?.messagesProcessed ?? 0;

  return (
    <div className="p-6 space-y-5 bg-[#F9F9F7] min-h-screen">
      {/* header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-black text-[#2A161B] font-heading">Live Pipeline Console</h1>
          <p className="text-[13px] text-[#6B6562] mt-0.5">SSE event stream direct to port 8000 · per-topic throughput · inject test events</p>
        </div>
        <button onClick={connectSSE} className="flex items-center gap-2 px-3 py-2 rounded-md border border-soft bg-white text-[#6B6562] hover:text-[#2A161B] text-xs transition-colors">
          <RefreshCw className="w-3.5 h-3.5" /> Reconnect
        </button>
      </div>

      {/* SSE status banner */}
      <div className={`rounded-md border border-soft p-4 flex items-center gap-4 ${
        connState === 'connected' ? 'bg-[#F9F9F7]' :
        connState === 'error'     ? 'bg-[#F9F9F7]' : 'bg-[#F9F9F7]'
      }`}>
        <Radio className={`w-5 h-5 shrink-0 ${connState === 'connected' ? 'text-[#6B132B]' : connState === 'error' ? 'text-[#6B132B]' : 'text-[#B46B3E]'}`} />
        <div className="flex-1">
          <p className="font-bold text-[#2A161B] text-sm">
            Kafka {sseStatus?.mode === 'kafka' ? 'LIVE' : 'SIMULATION'} — SSE Stream
          </p>
          <p className={`text-xs ${connState === 'connected' ? 'text-[#6B132B]' : connState === 'error' ? 'text-[#6B132B]' : 'text-[#B46B3E]'}`}>
            {connState === 'connecting' ? 'Connecting to localhost:8000…' :
             connState === 'error'      ? 'Connection error — click Reconnect' :
             `Stream active · ${totalMsgs.toLocaleString()} total messages · ${throughput} events/min`}
          </p>
        </div>
        <StatusDot status={connState === 'connected' ? 'live' : connState === 'error' ? 'down' : 'warning'} />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Events',  value: totalMsgs.toLocaleString(), color: '#6B132B', Icon: Activity },
          { label: 'Events / Min',  value: throughput,                  color: '#B46B3E', Icon: Zap },
          { label: 'Topics',        value: TOPICS.length,               color: '#2A161B', Icon: BarChart2 },
          { label: 'Layers Live',   value: `${health.filter(l=>l.status==='live').length}/${health.length || 8}`, color: '#B46B3E', Icon: Cpu },
        ].map(({ label, value, color, Icon }) => (
          <div key={label} className="bg-white rounded-md border border-soft p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}18` }}>
              <Icon className="w-4 h-4" style={{ color }} />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-[#6B6562] uppercase tracking-wide">{label}</p>
              <p className="text-xl font-black text-[#2A161B] tabular-nums">{value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-5">

        {/* ── left column ── */}
        <div className="space-y-5">

          {/* live event log */}
          <div className="bg-white rounded-md border border-soft overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-soft">
              <h2 className="text-sm font-bold text-[#2A161B] flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#6B132B] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#6B132B]" />
                </span>
                Live Event Stream
              </h2>
              <span className="text-[11px] text-[#6B6562]">{events.length} buffered</span>
            </div>
            <div ref={logRef} className="divide-y divide-soft overflow-y-auto" style={{ maxHeight: 440 }}>
              {events.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-10 h-10 border-2 border-soft border-t-[#6B132B] rounded-full animate-spin mb-4" />
                  <p className="text-[#6B6562] text-sm">
                    {connState === 'connecting' ? 'Connecting…' : 'Waiting for events (simulation fires every 8s)'}
                  </p>
                </div>
              ) : events.map((evt, i) => {
                const meta = TOPIC_META[evt.topic] || { layer: '', color: '#8B8481', label: evt.topic };
                const lbl  = evtLabel(evt.topic || '');
                return (
                  <div key={evt._rid ?? i} className="flex items-start gap-3 px-5 py-2.5 hover:bg-[#F9F9F7]/60 transition-colors">
                    <div className="w-1.5 h-1.5 rounded-full mt-2 shrink-0" style={{ background: meta.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${lbl.bg} ${lbl.fg}`}>{lbl.text}</span>
                        <span className="text-[10px] font-bold text-[#6B6562]">{meta.layer}</span>
                        {evt.customerId && <span className="text-[10px] text-[#8B8481]">{evt.customerId}</span>}
                      </div>
                      <p className="text-[12px] text-[#2A161B] leading-snug">{evt.description || evt.topic}</p>
                      <p className="text-[10px] text-[#8B8481] mt-0.5">{evt.topic}</p>
                    </div>
                    <span className="text-[10px] text-[#8B8481] shrink-0 mt-1">{fmtTime(evt.ts)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* topic throughput */}
          <div className="bg-white rounded-md border border-soft overflow-hidden">
            <div className="px-5 py-3 border-b border-soft">
              <h2 className="text-sm font-bold text-[#2A161B]">Topic Throughput</h2>
              <p className="text-[11px] text-[#6B6562] mt-0.5">Message counts since page load — sparkline shows last 10 ticks</p>
            </div>
            <div className="divide-y divide-soft">
              {TOPICS.map(t => (
                <div key={t.key} className="flex items-center gap-4 px-5 py-3 hover:bg-[#F9F9F7]/50">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: t.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-[#2A161B]">{t.key}</p>
                    <p className="text-[10px] text-[#6B6562]">{t.layer} · {t.label}</p>
                  </div>
                  <Spark counts={sparkData[t.key] || [0]} />
                  <span className="text-sm font-bold text-[#2A161B] tabular-nums w-10 text-right">
                    {(topicCounts[t.key] || 0)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── right column ── */}
        <div className="space-y-5">

          {/* layer health */}
          <div className="bg-white rounded-md border border-soft overflow-hidden">
            <div className="px-5 py-3 border-b border-soft">
              <h2 className="text-sm font-bold text-[#2A161B]">Layer Health</h2>
            </div>
            <div className="divide-y divide-soft">
              {health.length === 0 ? (
                <div className="p-6 space-y-2">{[1,2,3,4,5].map(i=><div key={i} className="h-9 bg-[#F9F9F7] rounded-md animate-pulse"/>)}</div>
              ) : health.map((l: any) => (
                <div key={l.id} className="flex items-center gap-3 px-5 py-3">
                  <StatusDot status={l.status} />
                  <p className="text-sm font-medium text-[#2A161B] flex-1">{l.name}</p>
                  <span className="text-sm font-bold text-[#2A161B] tabular-nums">{l.latency_ms}<span className="text-[#6B6562] text-[10px]">ms</span></span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded w-14 text-center ${
                    l.status === 'live' ? 'bg-[#6B132B] text-white' :
                    l.status === 'warning' ? 'bg-[#B46B3E] text-white' : 'bg-[#2A161B] text-white'
                  }`}>{l.status?.toUpperCase()}</span>
                </div>
              ))}
            </div>
          </div>

          {/* inject test event */}
          <div className="bg-white rounded-md border border-soft p-5 space-y-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#B46B3E]" />
              <h2 className="text-sm font-bold text-[#2A161B]">Inject Test Event</h2>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-semibold text-[#6B6562] uppercase tracking-wide mb-1 block">Topic</label>
                <select value={inject.topic} onChange={e => setInject(p => ({ ...p, topic: e.target.value }))}
                  className="w-full rounded-md border border-soft text-xs text-[#2A161B] px-3 py-2 focus:outline-none focus:border-[#6B132B]/40 bg-white">
                  {TOPICS.map(t => <option key={t.key} value={t.key}>{t.key}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-[#6B6562] uppercase tracking-wide mb-1 block">Customer Key</label>
                <input value={inject.key} onChange={e => setInject(p => ({ ...p, key: e.target.value }))}
                  placeholder="CUST-0001"
                  className="w-full rounded-md border border-soft text-xs text-[#2A161B] px-3 py-2 focus:outline-none focus:border-[#6B132B]/40" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-[#6B6562] uppercase tracking-wide mb-1 block">
                  Payload JSON <span className="normal-case font-normal text-[#8B8481]">(optional)</span>
                </label>
                <textarea value={inject.value} onChange={e => setInject(p => ({ ...p, value: e.target.value }))}
                  rows={3} placeholder={'{\n  "signal_type": "inactivity",\n  "confidence": 0.92\n}'}
                  className="w-full rounded-md border border-soft text-[11px] text-[#2A161B] px-3 py-2 resize-none focus:outline-none focus:border-[#6B132B]/40" />
              </div>
            </div>
            <button onClick={doInject} disabled={injecting || !inject.key}
              className="w-full py-2.5 rounded-md bg-[#6B132B] text-white text-sm font-bold hover:bg-[#6B132B]/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
              {injecting
                ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Injecting…</>
                : <><Send className="w-3.5 h-3.5" />Inject Event</>}
            </button>
            {injectMsg && (
              <p className={`text-xs text-center font-semibold ${injectMsg.startsWith('Error') ? 'text-[#6B132B]' : 'text-[#B46B3E]'}`}>{injectMsg}</p>
            )}
          </div>

          {/* broker info */}
          <div className="bg-white rounded-md border border-soft p-5">
            <h2 className="text-sm font-bold text-[#2A161B] mb-3">Broker Info</h2>
            <div className="space-y-2.5 text-[12px]">
              {[
                { label: 'Mode',      value: sseStatus?.mode?.toUpperCase() || '—' },
                { label: 'Brokers',   value: (sseStatus?.brokers || ['localhost:9092']).join(', ') },
                { label: 'Topics',    value: sseStatus?.topicsConsumed?.length ?? 6 },
                { label: 'Last event',value: fmtTime(sseStatus?.lastEventAt || '') || '—' },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-center">
                  <span className="text-[#6B6562]">{label}</span>
                  <span className="text-[11px] text-[#2A161B] font-semibold">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
