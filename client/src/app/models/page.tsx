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
import { BrainCircuit, TrendingUp, Target, Layers } from 'lucide-react';

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

export default function ModelsPage() {
  const router  = useRouter();
  const [health, setHealth] = useState<ModelHealth | null>(null);
  const [loading,setLoading]= useState(true);

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
