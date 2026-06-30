'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getToken, api } from '@/lib/api';
import { Campaign, OutreachRecord, RiskTier } from '@/types';
import RiskBadge from '@/components/RiskBadge';
import { Skeleton } from '@/components/ui/skeleton';
import { Mail, MessageSquare, Bell, Phone, Users, TrendingUp, Send } from 'lucide-react';
import { ApprovalQueuePanel } from '@/components/compliance/ApprovalQueuePanel';

const CHANNEL_ICONS: Record<string, React.ElementType> = {
  email: Mail, sms: MessageSquare, push: Bell, phone: Phone,
};

const STATUS_STYLES: Record<string, string> = {
  sent:      'bg-[#F9F9F7] text-[#6B6562]',
  delivered: 'bg-[#FAF0E6] text-[#B46B3E]',
  opened:    'bg-[#F4D9C0] text-[#2A161B]',
  clicked:   'bg-[#F5E6E9] text-[#6B132B]',
  failed:    'bg-[#F5E6E9] text-[#6B132B]',
};

export default function OutreachPage() {
  const router  = useRouter();
  const [campaigns,   setCampaigns]  = useState<Campaign[]>([]);
  const [records,     setRecords]    = useState<OutreachRecord[]>([]);
  const [selected,    setSelected]   = useState<OutreachRecord | null>(null);
  const [loading,     setLoading]    = useState(true);
  const [filterChan,  setFilterChan] = useState('');
  const [filterStatus,setFilterStatus]=useState('');

  useEffect(() => {
    if (!getToken()) { router.push('/login'); return; }
    Promise.all([api.getCampaigns(), api.getOutreach({ limit: 100 })])
      .then(([cRes, oRes]) => {
        setCampaigns(cRes.campaigns || []);
        setRecords(oRes.records || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  const filtered = records.filter(r =>
    (!filterChan   || r.channel === filterChan) &&
    (!filterStatus || r.status  === filterStatus)
  );

  const stats = {
    sent:       records.length,
    opened:     records.filter(r=>['opened','clicked'].includes(r.status)).length,
    clicked:    records.filter(r=>r.status==='clicked').length,
    open_rate:  records.length ? (records.filter(r=>['opened','clicked'].includes(r.status)).length / records.length * 100).toFixed(1) : '0',
    click_rate: records.length ? (records.filter(r=>r.status==='clicked').length / records.length * 100).toFixed(1) : '0',
  };

  return (
    <div className="p-6 space-y-6 bg-[#F9F9F7] min-h-screen">
      <div>
        <h1 className="text-[22px] font-black text-[#2A161B] font-heading">HERALD Outreach Hub</h1>
        <p className="text-[13px] text-[#6B6562] mt-0.5">Hyper-personalised content generation · campaigns · dispatch status</p>
      </div>

      {/* RM Approval Queue — RBI AI Governance 2024 human-in-the-loop */}
      <ApprovalQueuePanel />

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Dispatched', value: stats.sent,       icon: Send },
          { label: 'Opened',           value: stats.opened,     icon: Mail },
          { label: 'Open Rate',        value: `${stats.open_rate}%`, icon: TrendingUp },
          { label: 'Click Rate',       value: `${stats.click_rate}%`, icon: Users },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-white rounded-md border border-soft p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-[#F5E6E9] flex items-center justify-center shrink-0">
              <Icon className="w-4 h-4 text-[#6B132B]" />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-[#6B6562] uppercase tracking-wider font-heading">{label}</p>
              <p className="text-xl font-black text-[#2A161B]">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {loading ? <Skeleton className="h-48 rounded-md" /> : (
        <>
          {/* Campaign cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {campaigns.map(c => {
              const ChannelIcon = CHANNEL_ICONS[c.channel] || Mail;
              const conversion  = c.customers > 0 ? ((c.conversions/c.customers)*100).toFixed(1) : '0';
              return (
                <div key={c.id} className="bg-white rounded-md border border-soft p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-[14px] font-bold text-[#2A161B] font-heading">{c.name}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <ChannelIcon className="w-3.5 h-3.5 text-[#6B6562]" />
                        <span className="text-[11px] text-[#6B6562] capitalize">{c.channel}</span>
                      </div>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      c.status==='active' ? 'bg-[#F5E6E9] text-[#6B132B]' : 'bg-[#F9F9F7] text-[#6B6562]'
                    }`}>
                      {c.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-[#F9F9F7] rounded-md p-2">
                      <p className="text-[16px] font-black text-[#2A161B]">{c.customers}</p>
                      <p className="text-[9px] text-[#6B6562]">customers</p>
                    </div>
                    <div className="bg-[#F9F9F7] rounded-md p-2">
                      <p className="text-[16px] font-black text-[#2A161B]">{c.opens}</p>
                      <p className="text-[9px] text-[#6B6562]">opens</p>
                    </div>
                    <div className="bg-[#FAF0E6] rounded-md p-2">
                      <p className="text-[16px] font-black text-[#B46B3E]">{conversion}%</p>
                      <p className="text-[9px] text-[#B46B3E]">conv.</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Filters + records table */}
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 bg-white rounded-md border border-soft overflow-hidden">
              {/* Filters */}
              <div className="flex gap-3 p-4 border-b border-soft bg-[#F9F9F7]">
                <select value={filterChan} onChange={e=>setFilterChan(e.target.value)}
                  className="px-3 py-1.5 text-[12px] rounded-md border border-soft bg-white text-[#2A161B] focus:outline-none focus:ring-2 focus:ring-[#6B132B]/20">
                  <option value="">All Channels</option>
                  {['email','sms','push','phone'].map(c=><option key={c} value={c}>{c}</option>)}
                </select>
                <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}
                  className="px-3 py-1.5 text-[12px] rounded-md border border-soft bg-white text-[#2A161B] focus:outline-none focus:ring-2 focus:ring-[#6B132B]/20">
                  <option value="">All Statuses</option>
                  {['sent','delivered','opened','clicked','failed'].map(s=><option key={s} value={s}>{s}</option>)}
                </select>
                <span className="text-[12px] text-[#6B6562] self-center">{filtered.length} records</span>
              </div>

              {/* Table */}
              <div className="overflow-y-auto max-h-[500px]">
                <table className="w-full text-[12px]">
                  <thead className="sticky top-0 bg-[#F9F9F7] border-b border-soft">
                    <tr className="text-[10px] text-[#6B6562] uppercase tracking-wider font-heading">
                      {['Customer','Channel','Status','Offer','Dispatched'].map(h=>(
                        <th key={h} className="text-left py-2.5 px-4 font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(r => {
                      const ChIcon = CHANNEL_ICONS[r.channel] || Mail;
                      return (
                        <tr key={r.id}
                          onClick={() => setSelected(r === selected ? null : r)}
                          className={`border-b border-soft cursor-pointer transition-colors ${r===selected?'bg-[#F9F9F7]':'hover:bg-[#F9F9F7]'}`}>
                          <td className="py-2 px-4 font-semibold text-[#2A161B]">{r.customer_id}</td>
                          <td className="py-2 px-4">
                            <span className="flex items-center gap-1.5 text-[#6B6562]">
                              <ChIcon className="w-3.5 h-3.5" />
                              {r.channel}
                            </span>
                          </td>
                          <td className="py-2 px-4">
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase ${STATUS_STYLES[r.status]||'bg-[#F9F9F7] text-[#6B6562]'}`}>
                              {r.status}
                            </span>
                          </td>
                          <td className="py-2 px-4 text-[#6B6562]">{r.offer_code.replace(/_/g,' ')}</td>
                          <td className="py-2 px-4 text-[#6B6562]">{new Date(r.dispatched_at).toLocaleDateString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Content preview panel */}
            {selected && (
              <div className="w-full lg:w-80 bg-white rounded-md border border-soft p-5 shrink-0">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[13px] font-bold text-[#2A161B] font-heading">Content Preview</p>
                  <button onClick={()=>setSelected(null)} className="text-[#6B6562] hover:text-[#2A161B] text-[18px] leading-none">×</button>
                </div>
                <p className="text-[11px] text-[#6B6562] mb-3">{selected.customer_id} · {selected.channel} · {selected.status}</p>
                <div className="bg-[#F9F9F7] rounded-md border border-soft p-3">
                  <p className="text-[12px] text-[#2A161B] leading-relaxed">{selected.content_preview}</p>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
