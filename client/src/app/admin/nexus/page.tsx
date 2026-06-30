'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import {
  Network, RefreshCw, Search, ShieldCheck, ShieldAlert, TrendingUp,
  Sparkles, ArrowRight, CheckCircle, Ban, Layers, Users, Package,
} from 'lucide-react';
import RecommendationGraph from './RecommendationGraph';

// ── Styling maps ──────────────────────────────────────────────────────────────
const CAT_COLOR: Record<string, string> = {
  card: 'bg-purple-100 text-purple-700', loan: 'bg-red-100 text-red-700',
  deposit: 'bg-emerald-100 text-emerald-700', investment: 'bg-sky-100 text-sky-700',
  insurance: 'bg-amber-100 text-amber-700',
};
const SEG_PILL: Record<string, string> = {
  HNW: 'bg-purple-100 text-purple-700', 'Mass Affluent': 'bg-sky-100 text-sky-700',
  SME: 'bg-emerald-100 text-emerald-700', 'Mass Market': 'bg-[#F5F4F2] text-[#4A4644]',
};
const TIER_DOT: Record<string, string> = {
  PRIORITY: 'bg-red-500', ESCALATE: 'bg-orange-500', STANDARD: 'bg-amber-500',
  MONITOR: 'bg-blue-500', NONE: 'bg-emerald-500',
};
const initials = (n: string) => n.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();

// ── Score breakdown bar (segment / peer / event, weighted) ───────────────────
function FitBar({ b }: { b: { segment: number; peer: number; event: number } }) {
  const total = b.segment + b.peer + b.event || 1;
  const sc = 100 / Math.max(total, 0.0001);
  return (
    <div className="h-2.5 bg-[#F5F4F2] rounded-full overflow-hidden flex w-full">
      <div className="h-full bg-[#B46B3E]" style={{ width: `${b.segment * sc}%` }} title="segment affinity" />
      <div className="h-full bg-sky-400"    style={{ width: `${b.peer * sc}%` }}    title="peer adoption" />
      <div className="h-full bg-amber-400"  style={{ width: `${b.event * sc}%` }}   title="life event" />
    </div>
  );
}

export default function NexusPage() {
  const [overview, setOverview] = useState<any>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [graph, setGraph] = useState<any>(null);
  const [selId, setSelId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'list' | 'graph'>('graph');
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [ov, cl, gr] = await Promise.all([
        api.getNexusOverview(),
        api.getCustomers({ limit: 50 }),
        api.getNexusGraph(),
      ]);
      setOverview(ov);
      setCustomers(cl.customers || []);
      setGraph(gr);
      if (!selId && cl.customers?.length) selectCustomer(cl.customers[0].customer_id);
    } catch { /* */ }
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const [sending, setSending] = useState(false);
  const [handoff, setHandoff] = useState<any>(null);

  const selectCustomer = async (id: string) => {
    setSelId(id); setLoadingDetail(true); setHandoff(null);
    try { setDetail(await api.getNexusForCustomer(id)); }
    catch { setDetail(null); }
    setLoadingDetail(false);
  };

  const sendToCompass = async () => {
    if (!selId) return;
    setSending(true);
    try {
      const res = await api.sendNexusToCompass(selId);
      setHandoff(res);
    } catch { /* */ }
    setSending(false);
  };

  const filtered = useMemo(() =>
    customers.filter(c => !search ||
      c.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      c.segment?.toLowerCase().includes(search.toLowerCase())),
    [customers, search]);

  const s = overview?.summary;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#2A161B] flex items-center gap-2.5">
            <Network className="w-6 h-6 text-[#6B132B]" /> NEXUS Cross-Sell Intelligence
            <span className="px-2.5 py-1 rounded-full bg-[#FAF0E6] border border-[#F4D9C0] text-[10px] font-bold text-[#B46B3E] uppercase tracking-widest">
              GNN · Peer-adoption
            </span>
          </h1>
          <p className="text-[#8B8481] text-sm mt-0.5">
            Graph-based product recommendation · "customers like you also hold X" · compliance-gated → COMPASS → HERALD
          </p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#E5E0DF] bg-white text-[#6B6562] hover:text-[#2A161B] text-xs shadow-sm transition-all">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Eligible Opportunities', value: s?.total_eligible_opportunities, icon: TrendingUp, accent: 'border-l-emerald-500' },
          { label: 'Compliance-Suppressed',  value: s?.total_suppressed,             icon: Ban,        accent: 'border-l-red-500' },
          { label: 'Churn-Deferral Customers', value: s?.churn_deferral_customers,   icon: ShieldAlert,accent: 'border-l-amber-500' },
          { label: 'Avg Offers / Customer',  value: s?.avg_opportunities_per_customer, icon: Layers,   accent: 'border-l-[#6B132B]' },
        ].map(c => (
          <div key={c.label} className={`bg-white rounded-xl border border-[#E5E0DF] shadow-sm p-5 border-l-4 ${c.accent}`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold text-[#8B8481] uppercase tracking-wide mb-1">{c.label}</p>
                <p className="text-2xl font-bold text-[#2A161B] tabular-nums">{loading ? '—' : (c.value ?? '—')}</p>
              </div>
              <c.icon className="w-5 h-5 text-[#C9C3C0] mt-1" />
            </div>
          </div>
        ))}
      </div>

      {/* Recommendation graph — the collaborative-filtering visualization */}
      {graph && (
        <RecommendationGraph
          graph={graph}
          recommendation={detail?.top_offer}
          recommendations={detail?.recommendations}
          selectedId={selId}
          onSelect={selectCustomer}
        />
      )}

      {/* Master-detail */}
      <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-5 items-start">

        {/* LEFT — customer list */}
        <div className="bg-white rounded-xl border border-[#E5E0DF] shadow-sm overflow-hidden">
          <div className="p-3 border-b border-[#E5E0DF]">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8B8481]" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customer / segment…"
                className="w-full pl-8 pr-3 py-2 rounded-lg border border-[#E5E0DF] text-[12px] focus:outline-none focus:border-[#6B132B]/40" />
            </div>
          </div>
          <div className="divide-y divide-[#E5E0DF] max-h-[620px] overflow-y-auto">
            {filtered.map(c => {
              const active = selId === c.customer_id;
              return (
                <button key={c.customer_id} onClick={() => selectCustomer(c.customer_id)}
                  className={`w-full text-left px-4 py-3 transition-all relative ${active ? 'bg-[#6B132B]/[0.04]' : 'hover:bg-[#FAFAF9]'}`}>
                  {active && <span className="absolute left-0 top-0 bottom-0 w-1 bg-[#6B132B]" />}
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${active ? 'bg-[#6B132B] text-white' : 'bg-[#F5F4F2] text-[#6B6562]'}`}>
                      {initials(c.full_name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-bold text-[#2A161B] truncate">{c.full_name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${SEG_PILL[c.segment] || 'bg-[#F5F4F2] text-[#6B6562]'}`}>{c.segment}</span>
                        <span className="flex items-center gap-1 text-[10px] text-[#8B8481]">
                          <span className={`w-1.5 h-1.5 rounded-full ${TIER_DOT[c.risk_tier] || 'bg-[#C9C3C0]'}`} />
                          {c.product_count}p
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* RIGHT — recommendation detail */}
        <div className="space-y-5">
          {loadingDetail && (
            <div className="bg-white rounded-xl border border-[#E5E0DF] shadow-sm flex items-center justify-center gap-3 py-16 text-[#8B8481]">
              <RefreshCw className="w-5 h-5 animate-spin text-[#6B132B]" /> Scoring cross-sell fit…
            </div>
          )}

          {!loadingDetail && detail && (
            <>
              {/* Customer + current holdings */}
              <div className="bg-white rounded-xl border border-[#E5E0DF] shadow-sm p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-full bg-[#6B132B] flex items-center justify-center text-white text-sm font-bold shrink-0">{initials(detail.full_name)}</div>
                    <div className="min-w-0">
                      <h2 className="text-[18px] font-bold text-[#2A161B] leading-tight">{detail.full_name}</h2>
                      <div className="flex items-center gap-2 text-[12px] text-[#8B8481] mt-0.5">
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${SEG_PILL[detail.segment]}`}>{detail.segment}</span>
                        <span>{detail.city}</span><span>·</span>
                        <span className="flex items-center gap-1"><span className={`w-1.5 h-1.5 rounded-full ${TIER_DOT[detail.risk_tier]}`} />{detail.risk_tier}</span>
                      </div>
                    </div>
                  </div>
                  {detail.churn_deferral_active && (
                    <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
                      <ShieldAlert className="w-4 h-4 text-amber-600" />
                      <span className="text-[11px] font-bold text-amber-700">Churn-deferral active</span>
                    </div>
                  )}
                </div>

                <p className="text-[10px] font-bold text-[#8B8481] uppercase tracking-widest mt-5 mb-2">Currently Holds ({detail.current_products.length})</p>
                <div className="flex flex-wrap gap-2">
                  {detail.current_products.map((p: any) => (
                    <span key={p.product} className={`text-[11px] px-2.5 py-1 rounded-lg font-semibold ${CAT_COLOR[p.category] || 'bg-[#F5F4F2] text-[#4A4644]'}`}>
                      {p.label}
                    </span>
                  ))}
                </div>
              </div>

              {/* COMPASS offer banner */}
              {detail.top_offer && (
                <div className="bg-[#6B132B] rounded-xl shadow-lg text-white p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-[#F4D9C0] uppercase tracking-widest flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> Best Cross-Sell — sent to COMPASS
                      </p>
                      <p className="text-[20px] font-bold mt-1 truncate">{detail.top_offer.label}</p>
                      <p className="text-[12px] text-white/50 mt-0.5 italic">{detail.top_offer.reason_codes?.[0]?.detail}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[30px] font-bold leading-none tabular-nums">{Math.round(detail.top_offer.score * 100)}<span className="text-[14px] text-white/40">%</span></p>
                      <p className="text-[10px] text-white/30">fit</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 mt-4 pt-4 border-t border-white/10">
                    <span className="flex items-center gap-1.5 text-[11px] text-white/50">
                      NEXUS <ArrowRight className="w-3 h-3" /> COMPASS (<span className="font-mono text-white/70">{detail.top_offer.product}</span>) <ArrowRight className="w-3 h-3" /> HERALD
                    </span>
                    {!handoff?.sent ? (
                      <button onClick={sendToCompass} disabled={sending}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-[#6B132B] text-[11px] font-bold hover:bg-white/90 disabled:opacity-50 transition-colors shrink-0">
                        {sending ? <RefreshCw className="w-3 h-3 animate-spin" /> : <ArrowRight className="w-3 h-3" />}
                        Send to COMPASS
                      </button>
                    ) : (
                      <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-400/20 text-emerald-200 text-[11px] font-bold shrink-0">
                        <CheckCircle className="w-3 h-3" /> Handed to COMPASS
                      </span>
                    )}
                  </div>

                  {handoff?.sent && handoff.action_plan && (
                    <div className="mt-3 p-3 rounded-lg bg-white/5 border border-white/10 text-[11px] space-y-1">
                      <p className="text-white/40 uppercase tracking-widest text-[9px] font-bold">COMPASS Action Plan</p>
                      <p className="text-white/70"><span className="text-white/40">offer_code:</span> <span className="font-mono">{handoff.action_plan.offer_code}</span></p>
                      <p className="text-white/70"><span className="text-white/40">channel:</span> {handoff.action_plan.channel} · <span className="text-white/40">model:</span> {handoff.action_plan.model}</p>
                      <p className="text-white/50 italic">{handoff.compass_note}</p>
                    </div>
                  )}
                  {handoff && !handoff.sent && (
                    <div className="mt-3 p-3 rounded-lg bg-amber-400/10 border border-amber-400/20 text-[11px] text-amber-200">
                      {handoff.reason}
                    </div>
                  )}
                </div>
              )}

              {/* Ranked recommendations */}
              <div className="bg-white rounded-xl border border-[#E5E0DF] shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[13px] font-bold text-[#2A161B] flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-emerald-600" /> Eligible Recommendations</h3>
                  <div className="flex gap-3 text-[10px] font-semibold">
                    <span className="flex items-center gap-1 text-[#B46B3E]"><span className="w-2.5 h-2.5 rounded-sm bg-[#B46B3E]" />Segment</span>
                    <span className="flex items-center gap-1 text-sky-600"><span className="w-2.5 h-2.5 rounded-sm bg-sky-400" />Peer</span>
                    <span className="flex items-center gap-1 text-amber-600"><span className="w-2.5 h-2.5 rounded-sm bg-amber-400" />Life-event</span>
                  </div>
                </div>
                <div className="space-y-3">
                  {detail.recommendations.map((rec: any, i: number) => (
                    <div key={rec.product} className={`rounded-xl border p-4 ${i === 0 ? 'border-[#6B132B]/20 bg-[#6B132B]/[0.02]' : 'border-[#E5E0DF]'}`}>
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[11px] text-[#C9C3C0] font-mono w-4">{i + 1}</span>
                          <Package className="w-3.5 h-3.5 text-[#8B8481] shrink-0" />
                          <span className="text-[13px] font-bold text-[#2A161B] truncate">{rec.label}</span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${CAT_COLOR[rec.category]}`}>{rec.category}</span>
                          {rec.is_credit && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 font-semibold">credit</span>}
                        </div>
                        <span className="text-[14px] font-bold text-[#6B132B] tabular-nums shrink-0">{Math.round(rec.score * 100)}%</span>
                      </div>
                      <FitBar b={rec.breakdown} />
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5">
                        {rec.reason_codes.map((rc: any, j: number) => (
                          <span key={j} className="text-[11px] text-[#6B6562] flex items-center gap-1">
                            <CheckCircle className="w-3 h-3 text-emerald-500 shrink-0" /> {rc.detail}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                  {!detail.recommendations.length && (
                    <p className="text-[12px] text-[#8B8481] text-center py-4">No eligible cross-sell — customer holds most of the catalog or all offers were suppressed.</p>
                  )}
                </div>
              </div>

              {/* Suppressed (compliance story) */}
              {detail.suppressed?.length > 0 && (
                <div className="bg-white rounded-xl border border-red-100 shadow-sm p-6">
                  <h3 className="text-[13px] font-bold text-[#2A161B] flex items-center gap-1.5 mb-1">
                    <Ban className="w-4 h-4 text-red-500" /> Suppressed by Compliance ({detail.suppressed.length})
                  </h3>
                  <p className="text-[11px] text-[#8B8481] mb-3">Dropped before reaching COMPASS — every suppression is audit-logged (DPDPA Rule 4).</p>
                  <div className="space-y-2">
                    {detail.suppressed.map((rec: any) => (
                      <div key={rec.product} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-red-50/50 border border-red-100">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[12px] font-semibold text-[#4A4644] truncate">{rec.label}</span>
                          {rec.is_credit && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 font-semibold shrink-0">credit</span>}
                        </div>
                        <span className="text-[11px] text-red-600 italic text-right shrink-0 max-w-[60%] truncate" title={rec.filtered_reason}>{rec.filtered_reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Portfolio product opportunities */}
      {overview?.product_opportunities && (
        <div className="bg-white rounded-xl border border-[#E5E0DF] shadow-sm p-6">
          <h3 className="text-[13px] font-bold text-[#2A161B] flex items-center gap-1.5 mb-4">
            <Users className="w-4 h-4 text-[#6B132B]" /> Portfolio Cross-Sell Opportunities — across all {s?.customers} customers
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2.5">
            {overview.product_opportunities.map((p: any) => (
              <div key={p.product} className="flex items-center gap-3">
                <span className="text-[12px] text-[#4A4644] w-36 shrink-0 truncate">{p.label}</span>
                <div className="flex-1 h-4 bg-[#F5F4F2] rounded-full overflow-hidden relative">
                  <div className="h-full bg-emerald-400/80 rounded-full" style={{ width: `${Math.min(p.top_offer_count * 7, 100)}%` }} />
                </div>
                <span className="text-[11px] text-[#6B6562] w-28 shrink-0 text-right">
                  <span className="font-bold text-[#6B132B]">{p.top_offer_count}</span> best-fit · {p.held_pct}% held
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Honesty footer */}
      <p className="text-[10px] text-[#8B8481] text-center px-6 leading-relaxed">
        Demo scoring uses a transparent peer-adoption heuristic imitating the NEXUS-GNN (graph link-prediction trained on PKDD'99 — see NEXUS_IMPLEMENTATION.md).
        Recommendations are advisory and compliance-gated: new-credit cross-sell is suppressed for high churn-risk customers (retention takes priority).
        COMPASS makes the final pitch decision; HERALD drafts the message. Production learns weights from retention outcomes (VERDICT roadmap).
      </p>
    </div>
  );
}
