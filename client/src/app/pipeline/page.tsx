'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getToken, api } from '@/lib/api';
import KafkaFeed from '@/components/KafkaFeed';
import { Skeleton } from '@/components/ui/skeleton';
import { KafkaStatus } from '@/types';
import { Zap, Database, Activity } from 'lucide-react';

const TOPICS = [
  { topic: 'cbs.transactions',       desc: 'Core Banking payment events',      color: 'bg-[#F5E6E9] text-[#6B132B]'   },
  { topic: 'cbs.account_updates',    desc: 'Balance & account changes',         color: 'bg-[#F9F9F7] text-[#6B6562]' },
  { topic: 'crm.customer_events',    desc: 'CRM complaints & notes',            color: 'bg-[#FAF0E6] text-[#B46B3E]'},
  { topic: 'risk.signal_detections', desc: 'ARGUS-generated risk signals',      color: 'bg-[#6B132B] text-white'     },
  { topic: 'risk.score_updates',     desc: 'ML score refreshes from FusionXV2', color: 'bg-[#B46B3E] text-white'},
  { topic: 'engagement.activity',    desc: 'Digital channel engagement events', color: 'bg-[#F4D9C0] text-[#2A161B]' },
];

export default function PipelinePage() {
  const router = useRouter();
  const [status, setStatus] = useState<KafkaStatus | null>(null);

  useEffect(() => {
    if (!getToken()) { router.push('/login'); return; }
    api.getKafkaStatus().then(r => setStatus(r.data)).catch(() => {});
    const interval = setInterval(() => {
      api.getKafkaStatus().then(r => setStatus(r.data)).catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, [router]);

  return (
    <div className="p-6 space-y-6 bg-[#F9F9F7] min-h-screen">
      <div>
        <h1 className="text-[22px] font-black text-[#2A161B] font-heading">Data Pipeline</h1>
        <p className="text-[13px] text-[#6B6562] mt-0.5">Kafka stream inspector · live event feed · 6 topics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-md border border-soft p-4 flex items-center gap-3">
          <div className={`w-9 h-9 rounded-md flex items-center justify-center ${status?.mode==='kafka'?'bg-[#F5E6E9]':'bg-[#FAF0E6]'}`}>
            <Zap className={`w-4 h-4 ${status?.mode==='kafka'?'text-[#6B132B]':'text-[#B46B3E]'}`} />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-[#6B6562] uppercase tracking-wider font-heading">Mode</p>
            <p className="text-[16px] font-black text-[#2A161B] capitalize">{status?.mode || 'loading'}</p>
          </div>
        </div>
        <div className="bg-white rounded-md border border-soft p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-[#F5E6E9] flex items-center justify-center">
            <Database className="w-4 h-4 text-[#6B132B]" />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-[#6B6562] uppercase tracking-wider font-heading">Events Processed</p>
            <p className="text-[16px] font-black text-[#2A161B]">{status?.messagesProcessed?.toLocaleString() || '0'}</p>
          </div>
        </div>
        <div className="bg-white rounded-md border border-soft p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-[#F5E6E9] flex items-center justify-center">
            <Activity className="w-4 h-4 text-[#6B132B]" />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-[#6B6562] uppercase tracking-wider font-heading">Last Event</p>
            <p className="text-[13px] font-bold text-[#2A161B]">
              {status?.lastEventAt ? new Date(status.lastEventAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Topic list */}
      <div className="bg-white rounded-md border border-soft p-5">
        <h2 className="text-[14px] font-bold text-[#2A161B] mb-4 font-heading">Subscribed Topics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {TOPICS.map(t => (
            <div key={t.topic} className="flex items-start gap-3 p-3 rounded-md border border-soft bg-[#F9F9F7]">
              <span className={`shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide mt-0.5 ${t.color}`}>
                {t.topic.split('.')[0]}
              </span>
              <div>
                <p className="text-[11px] font-semibold text-[#2A161B] font-mono">{t.topic}</p>
                <p className="text-[10px] text-[#6B6562]">{t.desc}</p>
              </div>
            </div>
          ))}
        </div>
        {status?.mode === 'simulation' && (
          <div className="mt-4 p-3 rounded-md bg-[#FAF0E6] border border-[#F4D9C0]">
            <p className="text-[12px] text-[#B46B3E]">
              <strong>Simulation mode:</strong> No Kafka broker detected.
              Generating realistic banking events every 8 seconds as a stand-in.
              Deploy with <code className="font-mono bg-[#F4D9C0] px-1 rounded">KAFKA_BROKERS</code> to connect to a real cluster.
            </p>
          </div>
        )}
      </div>

      {/* Live feed */}
      <div className="bg-white rounded-md border border-soft p-5">
        <h2 className="text-[14px] font-bold text-[#2A161B] mb-4 font-heading">Live Event Stream (SSE)</h2>
        <div className="h-96">
          <KafkaFeed maxEvents={40} />
        </div>
      </div>
    </div>
  );
}
