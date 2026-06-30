'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getToken, api } from '@/lib/api';
import { ModelHealth } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts';
import { BrainCircuit, TrendingUp, Target, Layers, X } from 'lucide-react';

const MODELS = [
  {
    key:    'genesis',
    name:   'GENESIS',
    full:   'Logistic Regression Cold-Start',
    desc:   'Cold-start scorer for customers with < 90 days tenure or < 30 transaction tokens. 7 onboarding features, L2-regularised LR, Platt scaling.',
    color:  '#6B132B',
  },
  {
    key:    'habitat',
    name:   'HABITAT',
    full:   'XGBoost Tabular Scorer (Pass 1)',
    desc:   '14 behavioural features: recency, frequency, monetary, complaints, digital ratio, tenure. 300–400 rounds, focal loss for class imbalance.',
    color:  '#B46B3E',
  },
  {
    key:    'tare',
    name:   'TARE',
    full:   'Temporal Transformer Encoder',
    desc:   '2-layer Transformer (4 heads, d_model=128) on 180-token transaction sequences. Detects rhythm changes: weekend-only usage, late-night decline.',
    color:  '#2A161B',
  },
  {
    key:    'graph_sage',
    name:   'GraphSAGE',
    full:   'Customer Knowledge Graph GNN',
    desc:   '2-layer GraphSAGE on k-NN customer graph (k=15, cosine similarity). Captures peer-network churn contagion invisible to tabular models.',
    color:  '#B46B3E',
  },
];

type ArchModelKey = 'tare' | 'habitat' | 'fusion-x' | 'prism' | 'causal-net' | 'genesis' | 'sentinel' | 'aegis';

interface ArchModel {
  key: ArchModelKey;
  name: string;
  subtitle: string;
  purpose: string;
  architecture: string;
  input: string;
  output: string;
  layer: string;
}

const ARCH_MODELS: ArchModel[] = [
  {
    key: 'tare',
    name: 'TARE',
    subtitle: 'Temporal Transformer Encoder',
    purpose: 'Detect rhythm changes in customer transaction sequences that signal churn.',
    architecture: '2-layer Transformer, 4 attention heads, d_model=128. Pre-trained on 180-token sequences via masked reconstruction, then fine-tuned on churn labels.',
    input: '180-token transaction sequences (encoded action history)',
    output: 'Sequence-level embedding + churn logit',
    layer: 'Layer 3 — Ensemble Fusion & Explain',
  },
  {
    key: 'habitat',
    name: 'HABITAT',
    subtitle: 'XGBoost Tabular Scorer (Pass 1)',
    purpose: 'Score churn risk from structured behavioural features.',
    architecture: 'Gradient-boosted trees, 300–400 rounds, focal loss for class imbalance. All 14 features pass through SHAP-based feature selection.',
    input: '14 behavioural features: recency, frequency, monetary, complaints, digital ratio, tenure',
    output: 'Risk score (probability)',
    layer: 'Layer 3 — Ensemble Fusion & Explain',
  },
  {
    key: 'fusion-x',
    name: 'FUSION-X',
    subtitle: 'Bayesian Adaptive Fusion',
    purpose: 'Optimally combine TARE and HABITAT outputs into a single calibrated score.',
    architecture: 'Bayesian weight optimisation with Platt-scaled calibration. Weights adapt per-customer based on feature completeness. ECE monitored continuously.',
    input: 'TARE output logit + HABITAT score (both float)',
    output: 'Calibrated probability (0–1) with confidence interval',
    layer: 'Layer 3 — Ensemble Fusion & Explain',
  },
  {
    key: 'prism',
    name: 'PRISM',
    subtitle: '9-Category Merge & Reason Codes',
    purpose: 'Discretise the fused score into actionable risk tiers and explain why.',
    architecture: 'Rule-based binning with 9 ordinal categories. Top-3 SHAP-based reason codes extracted per customer from HABITAT and TARE feature attributions.',
    input: 'Fused probability score',
    output: 'Risk tier (1–9) + top-3 reason codes',
    layer: 'Layer 3 — Ensemble Fusion & Explain',
  },
  {
    key: 'causal-net',
    name: 'CAUSAL-NET',
    subtitle: 'Two-Tower Uplift Model',
    purpose: 'Estimate the causal effect of outreach interventions.',
    architecture: 'Two-tower neural network: one tower for treatment (contacted), one for control (not contacted). S-learner meta-learner framework.',
    input: 'Customer feature vector + fused score',
    output: 'Treatability score + optimal action score',
    layer: 'Layer 3 — Ensemble Fusion & Explain',
  },
  {
    key: 'genesis',
    name: 'GENESIS',
    subtitle: 'Logistic Regression Cold-Start',
    purpose: 'Score new customers with insufficient history for TARE/HABITAT.',
    architecture: 'L2-regularised logistic regression on 7 onboarding features (age, income, channel, product mix, etc.) with Platt scaling for calibration.',
    input: '7 onboarding features — customers with < 90 days tenure or < 30 tokens',
    output: 'Cold-start churn probability',
    layer: 'Layer 2 — Cold Start & Guardrails',
  },
  {
    key: 'sentinel',
    name: 'SENTINEL',
    subtitle: 'Real-Time Re-Scoring',
    purpose: 'Re-evaluate risk scores in real time as new events arrive.',
    architecture: 'Lightweight scorer that listens to Kafka event stream. On each new transaction or profile change, re-runs applicable model and pushes updated score.',
    input: 'Kafka event stream (transactions, profile updates)',
    output: 'Updated risk score + delta flag',
    layer: 'Layer 2 — Cold Start & Guardrails',
  },
  {
    key: 'aegis',
    name: 'AEGIS',
    subtitle: 'Drift Detection Guard',
    purpose: 'Detect data distribution drift and alert when model confidence degrades.',
    architecture: 'Statistical distribution comparison (Kolmogorov–Smirnov test) on rolling window of feature distributions vs reference. Triggers alert when p < 0.05.',
    input: 'Live feature distribution window',
    output: 'Drift alert + degraded feature names',
    layer: 'Layer 2 — Cold Start & Guardrails',
  },
];

const ARCH_INFO = ARCH_MODELS.reduce((acc, m) => {
  acc[m.key] = m;
  return acc;
}, {} as Record<ArchModelKey, ArchModel>);

function Arrow() {
  return (
    <svg width="20" height="12" viewBox="0 0 20 12" fill="none" className="shrink-0">
      <line x1="0" y1="6" x2="17" y2="6" stroke="#B46B3E" strokeWidth="1.5" />
      <polyline points="12,1 18,6 12,11" stroke="#B46B3E" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

function ArchNode({ model, onClick, selected }: { model: ArchModel; onClick: () => void; selected: boolean }) {
  const isCrimson = model.key === 'fusion-x' || model.key === 'aegis';
  const bg = selected
    ? (isCrimson ? 'bg-[#6B132B]' : 'bg-[#B46B3E]')
    : (isCrimson ? 'bg-[#6B132B]' : 'bg-[#F9F9F7] border border-soft');
  const text = isCrimson ? 'text-white' : (selected ? 'text-white' : 'text-[#2A161B]');
  const sub = isCrimson ? 'text-[#E5E0DF]' : (selected ? 'text-white/70' : 'text-[#6B6562]');
  return (
    <button
      onClick={onClick}
      className={`${bg} rounded-md px-3 py-2.5 text-center min-w-[120px] cursor-pointer transition-colors`}
    >
      <div className={`text-[12px] font-black font-heading ${text}`}>{model.name}</div>
      <div className={`text-[9px] leading-tight ${sub}`}>
        {model.subtitle.split(' ')[0]}<br/>{model.subtitle.split(' ').slice(1).join(' ')}
      </div>
    </button>
  );
}

function DetailPanel({ model, health, onClose }: { model: ArchModel; health: ModelHealth | null; onClose: () => void }) {
  const statLine = (label: string, value: string) => (
    <div className="flex justify-between text-[11px] py-1.5 border-b border-soft last:border-0">
      <span className="text-[#6B6562]">{label}</span>
      <span className="font-bold text-[#2A161B]">{value}</span>
    </div>
  );

  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[10px] text-[#6B6562] font-bold uppercase tracking-wider">{model.layer}</div>
          <h3 className="text-[16px] font-black text-[#2A161B] font-heading mt-0.5">{model.name}</h3>
          <p className="text-[11px] text-[#6B6562]">{model.subtitle}</p>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-[#F9F9F7] cursor-pointer">
          <X className="w-4 h-4 text-[#8B8481]" />
        </button>
      </div>

      <div className="space-y-2.5 mb-4">
        <p className="text-[11px] text-[#2A161B] leading-relaxed">{model.purpose}</p>
      </div>

      <div className="bg-[#F9F9F7] rounded-md p-3 mb-3">
        <p className="text-[9px] font-bold text-[#6B6562] uppercase tracking-wider mb-1">Architecture</p>
        <p className="text-[11px] text-[#2A161B] leading-relaxed">{model.architecture}</p>
      </div>

      <div className="space-y-1 mb-4">
        {statLine('Input', model.input.length > 30 ? model.input.slice(0, 30) + '…' : model.input)}
        {statLine('Output', model.output)}
        {health && model.key in health.model_aucs && (
          statLine('AUC', (health.model_aucs[model.key] || 0).toFixed(3))
        )}
        {health && model.key in health.ensemble_weights && (
          statLine('Ensemble Weight', `${((health.ensemble_weights[model.key] || 0) * 100).toFixed(0)}%`)
        )}
      </div>
    </div>
  );
}

export default function ModelsPage() {
  const router  = useRouter();
  const [health, setHealth] = useState<ModelHealth | null>(null);
  const [loading,setLoading]= useState(true);
  const [selected, setSelected] = useState<ArchModelKey | null>(null);

  useEffect(() => {
    if (!getToken()) { router.push('/login'); return; }
    api.getModelHealth()
      .then(r => setHealth(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  const FUSION_PIE = health ? MODELS.map(m => ({
    name:  m.name,
    value: (health.ensemble_weights[m.key] || 0) * 100,
    color: m.color,
  })) : [];

  return (
    <div className="p-6 space-y-6 bg-[#F9F9F7] min-h-screen">
      {/* Header */}
      <div>
        <h1 className="text-[22px] font-black text-[#2A161B] font-heading">CHRONOS Model Intelligence</h1>
        <p className="text-[13px] text-[#6B6562] mt-0.5">
          {health ? `5-model ensemble · last retrained ${health.last_retrained} · ${health.n_customers_scored} customers scored` : 'Loading…'}
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4">{Array.from({length:6}).map((_,i)=><Skeleton key={i} className="h-40 rounded-md"/>)}</div>
      ) : health && (
        <>
          {/* Summary stat row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: BrainCircuit, label: 'Fusion AUC',      value: health.fusion_auc.toFixed(3),  color: '#6B132B' },
              { icon: Target,       label: 'ECE (calibration)',value: health.fusion_ece.toFixed(4),  color: health.fusion_ece<0.05?'#B46B3E':'#6B132B' },
              { icon: TrendingUp,   label: 'GraphSAGE AUC',   value: (health.model_aucs.graph_sage||0).toFixed(3), color: '#B46B3E' },
              { icon: Layers,       label: 'Models',           value: '5',                           color: '#2A161B' },
            ].map(({icon:Icon,label,value,color}) => (
              <div key={label} className="bg-white rounded-md border border-soft p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-md flex items-center justify-center shrink-0" style={{backgroundColor:`${color}12`}}>
                  <Icon className="w-4.5 h-4.5" style={{color}} />
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-[#6B6562] uppercase tracking-wider font-heading">{label}</p>
                  <p className="text-xl font-black text-[#2A161B]">{value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Model cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {MODELS.map(m => {
              const auc    = health.model_aucs[m.key] || 0;
              const weight = (health.ensemble_weights[m.key] || 0) * 100;
              return (
                <div key={m.key} className="bg-white rounded-md border border-soft p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-[15px] font-black text-[#2A161B] font-heading">{m.name}</p>
                      <p className="text-[10px] text-[#6B6562]">{m.full}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-[18px] font-black tabular-nums" style={{color: m.color}}>
                        {weight.toFixed(0)}%
                      </div>
                      <div className="text-[9px] text-[#6B6562]">weight</div>
                    </div>
                  </div>
                  <div className="mb-3">
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="text-[#6B6562]">AUC</span>
                      <span className="font-bold text-[#2A161B]">{auc.toFixed(3)}</span>
                    </div>
                    <div className="h-2 bg-[#F9F9F7] rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{width:`${auc*100}%`, backgroundColor: m.color}} />
                    </div>
                  </div>
                  <p className="text-[11px] text-[#6B6562] leading-relaxed">{m.desc}</p>
                </div>
              );
            })}
          </div>

          {/* Architecture diagram */}
          <div className="bg-white rounded-md border border-soft p-5">
            <h2 className="text-[14px] font-bold text-[#2A161B] mb-1 font-heading">CHRONOS Architecture</h2>
            <p className="text-[11px] text-[#6B6562] mb-4">Three-layer ensemble pipeline with adaptive fusion and drift guards — click any node for details</p>
            <div className={`flex ${selected ? 'justify-between gap-6' : 'justify-center'}`}>
              <div className="flex flex-col items-center gap-4">
                {/* Layer 3 label */}
                <div className="text-[10px] font-bold text-[#6B6562] uppercase tracking-wider mb-1">Layer 3 — Ensemble Fusion &amp; Explain</div>

                {/* Layer 3 content */}
                <div className="flex items-center gap-2 md:gap-4 flex-wrap justify-center">
                  <ArchNode model={ARCH_INFO.tare} selected={selected==='tare'} onClick={() => setSelected(selected==='tare' ? null : 'tare')} />
                  <Arrow />
                  <ArchNode model={ARCH_INFO.habitat} selected={selected==='habitat'} onClick={() => setSelected(selected==='habitat' ? null : 'habitat')} />
                </div>

                {/* Arrow down to FUSION-X */}
                <div className="flex flex-col items-center -my-1">
                  <svg width="12" height="16" viewBox="0 0 12 16" fill="none"><path d="M6 0v12M1 7l5 5 5-5" stroke="#B46B3E" strokeWidth="2"/></svg>
                </div>

                {/* FUSION-X */}
                <ArchNode model={ARCH_INFO['fusion-x']} selected={selected==='fusion-x'} onClick={() => setSelected(selected==='fusion-x' ? null : 'fusion-x')} />

                {/* Arrow down to PRISM */}
                <div className="flex flex-col items-center -my-1">
                  <svg width="12" height="16" viewBox="0 0 12 16" fill="none"><path d="M6 0v12M1 7l5 5 5-5" stroke="#B46B3E" strokeWidth="2"/></svg>
                </div>

                {/* PRISM + CAUSAL-NET row */}
                <div className="flex items-center gap-2 md:gap-6 flex-wrap justify-center">
                  <ArchNode model={ARCH_INFO.prism} selected={selected==='prism'} onClick={() => setSelected(selected==='prism' ? null : 'prism')} />
                  <Arrow />
                  <ArchNode model={ARCH_INFO['causal-net']} selected={selected==='causal-net'} onClick={() => setSelected(selected==='causal-net' ? null : 'causal-net')} />
                </div>

                {/* Divider */}
                <div className="w-full border-t border-soft my-1" />

                {/* Layer 2 label */}
                <div className="text-[10px] font-bold text-[#6B6562] uppercase tracking-wider">Layer 2 — Cold Start &amp; Guardrails</div>

                <div className="flex items-center gap-2 md:gap-6 flex-wrap justify-center">
                  <ArchNode model={ARCH_INFO.genesis} selected={selected==='genesis'} onClick={() => setSelected(selected==='genesis' ? null : 'genesis')} />
                  <div className="text-[11px] text-[#8B8481]">→ scored via</div>
                  <ArchNode model={ARCH_INFO.sentinel} selected={selected==='sentinel'} onClick={() => setSelected(selected==='sentinel' ? null : 'sentinel')} />
                  <ArchNode model={ARCH_INFO.aegis} selected={selected==='aegis'} onClick={() => setSelected(selected==='aegis' ? null : 'aegis')} />
                </div>
              </div>

              {/* Detail panel */}
              {selected && ARCH_INFO[selected] && (
                <div className="w-[300px] shrink-0 border-l border-soft">
                  <DetailPanel model={ARCH_INFO[selected]} health={health} onClose={() => setSelected(null)} />
                </div>
              )}
            </div>
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Calibration curve */}
            <div className="lg:col-span-2 bg-white rounded-md border border-soft p-5">
              <h2 className="text-[14px] font-bold text-[#2A161B] mb-1 font-heading">Calibration Curve</h2>
              <p className="text-[11px] text-[#6B6562] mb-4">Predicted probability vs actual churn rate per bin · ECE={health.fusion_ece.toFixed(4)}</p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={health.calibration_points} margin={{top:4,right:4,left:-20,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E0DF" />
                  <XAxis dataKey="predicted" tickFormatter={v=>`${(v*100).toFixed(0)}%`} tick={{fontSize:10,fill:'#8B8481'}} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v=>`${(v*100).toFixed(0)}%`} tick={{fontSize:10,fill:'#8B8481'}} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v) => [`${(Number(v)*100).toFixed(1)}%`]} contentStyle={{fontSize:11,borderRadius:6,border:'1px solid #E5E0DF'}} />
                  <Line type="linear" dataKey="predicted" stroke="#8B8481" strokeWidth={1.5} strokeDasharray="4 3" dot={false} name="Perfect" />
                  <Line type="monotone" dataKey="actual" stroke="#6B132B" strokeWidth={2.5} dot={{r:4,fill:'#6B132B'}} name="FusionXV2" />
                  <Legend wrapperStyle={{fontSize:11}} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Ensemble weights donut */}
            <div className="bg-white rounded-md border border-soft p-5">
              <h2 className="text-[14px] font-bold text-[#2A161B] mb-1 font-heading">Ensemble Weights</h2>
              <p className="text-[11px] text-[#6B6562] mb-3">Brier-score-derived fusion weights</p>
              <ResponsiveContainer width="100%" height={130}>
                <PieChart>
                  <Pie data={FUSION_PIE} cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={3} dataKey="value" startAngle={90} endAngle={-270}>
                    {FUSION_PIE.map(d => <Cell key={d.name} fill={d.color} />)}
                  </Pie>
                  <Tooltip formatter={(v) => [`${Number(v).toFixed(0)}%`]} contentStyle={{fontSize:11,borderRadius:6}} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {FUSION_PIE.map(d => (
                  <div key={d.name} className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{backgroundColor:d.color}} />
                      <span className="text-[#2A161B]">{d.name}</span>
                    </div>
                    <span className="font-bold text-[#2A161B]">{d.value.toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Feature importance */}
          <div className="bg-white rounded-md border border-soft p-5">
            <h2 className="text-[14px] font-bold text-[#2A161B] mb-1 font-heading">HABITAT Feature Importance</h2>
            <p className="text-[11px] text-[#6B6562] mb-4">Mean absolute SHAP contribution across 50 customers</p>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={[...health.feature_importance].sort((a,b)=>b.importance-a.importance)}
                layout="vertical" margin={{top:0,right:20,left:130,bottom:0}}>
                <XAxis type="number" tick={{fontSize:10,fill:'#8B8481'}} axisLine={false} tickLine={false} tickFormatter={v=>v.toFixed(3)} />
                <YAxis type="category" dataKey="feature" tick={{fontSize:10,fill:'#6B6562'}} axisLine={false} tickLine={false} width={130}
                  tickFormatter={v=>v.replace(/_/g,' ')} />
                <Tooltip formatter={(v)=>[Number(v).toFixed(4),'Importance']} contentStyle={{fontSize:11,borderRadius:6,border:'1px solid #E5E0DF'}} />
                <Bar dataKey="importance" fill="#6B132B" radius={[0,3,3,0]} maxBarSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
