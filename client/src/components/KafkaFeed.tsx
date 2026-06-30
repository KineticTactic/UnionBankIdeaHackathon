'use client';

import { useEffect, useRef, useState } from 'react';
import { getToken } from '@/lib/api';
import { KafkaEvent } from '@/types';

const TOPIC_COLORS: Record<string, string> = {
  'cbs.transactions':       'bg-[#FAF0E6] text-[#8E5026]',
  'cbs.account_updates':    'bg-[#F5F4F2] text-[#6B6562]',
  'crm.customer_events':    'bg-[#FAF0E6] text-[#8E5026]',
  'risk.signal_detections': 'bg-crimson-soft text-crimson',
  'risk.score_updates':     'bg-copper-soft text-[#8E5026]',
  'engagement.activity':    'bg-[#F5F4F2] text-[#6B6562]',
};

const topicLabel = (topic: string) =>
  topic.split('.').pop()?.replace(/_/g, ' ') || topic;

interface Props {
  maxEvents?: number;
}

export default function KafkaFeed({ maxEvents = 20 }: Props) {
  const [events, setEvents]   = useState<KafkaEvent[]>([]);
  const [mode, setMode]       = useState<string>('connecting');
  const [count, setCount]     = useState(0);
  const feedRef               = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    const source = new EventSource(`/api/kafka/stream?token=${token}`);

    source.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'status' || data.type === 'heartbeat') {
          if (data.mode) setMode(data.mode);
          if (data.messagesProcessed) setCount(data.messagesProcessed);
          return;
        }
        if (data.type === 'event') {
          setEvents(prev => {
            const next = [data, ...prev].slice(0, maxEvents);
            return next;
          });
          setCount(c => c + 1);
        }
      } catch {}
    };

    source.onerror = () => { setMode('disconnected'); };

    return () => source.close();
  }, [maxEvents]);

  // Auto-scroll to top when new events arrive
  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = 0;
  }, [events]);

  return (
    <div className="flex flex-col h-full">
      {/* Status bar */}
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full bg-crimson animate-live-pulse`} />
          <span className="text-[11px] text-[#6B6562] capitalize">{mode}</span>
        </div>
        <span className="text-[10px] text-[#8B8481] tabular-nums">{count} events</span>
      </div>

      {/* Events */}
      <div ref={feedRef} className="flex-1 overflow-y-auto space-y-1 min-h-0">
        {events.length === 0 && (
          <div className="text-center text-[#8B8481] text-xs py-6">Waiting for events…</div>
        )}
        {events.map((evt, i) => (
          <div key={`${evt.id}-${i}`} className="flex items-start gap-2 py-1.5 px-2 rounded-md hover:bg-[#F9F9F7] transition-colors">
            <span className={`mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide shrink-0 ${
              TOPIC_COLORS[evt.topic] || 'bg-[#F5F4F2] text-[#6B6562]'
            }`}>
              {topicLabel(evt.topic)}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-[#2A161B] leading-tight line-clamp-1">{evt.description}</p>
              <p className="text-[9px] text-[#8B8481] mt-0.5">{evt.customerId} · {new Date(evt.ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
