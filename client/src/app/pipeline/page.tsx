'use client';

import { useState } from "react";
import {
    Database, Brain, BarChart3, Compass, Sparkles, ShieldCheck, BarChart2,
    ChevronRight, CheckCircle2, Zap, Network, Activity, GitBranch, Clock
} from "lucide-react";
import ProtectedRoute from "@/components/ProtectedRoute";

interface Layer {
    id: number;
    name: string;
    codename: string;
    description: string;
    tech: string[];
    outputs: string[];
    color: string;
    bg: string;
    border: string;
    icon: React.ReactNode;
    status: "live" | "trained" | "generating";
}

const LAYERS: Layer[] = [
    {
        id: 1,
        name: "Data Ingestion",
        codename: "ARGUS",
        description: "Real-time Kafka streams + batch CDC from core banking. BankChurners dataset (10,127 customers). Feature extraction: 21 tabular features, MCC sequences, CUSUM anomaly detection.",
        tech: ["Kafka", "PostgreSQL", "Redis", "CUSUM"],
        outputs: ["customer_features", "mcc_sequences", "cusum_signals"],
        color: "text-blue-600",
        bg: "bg-blue-50",
        border: "border-blue-200",
        icon: <Database className="w-5 h-5" />,
        status: "live",
    },
    {
        id: 2,
        name: "Signal Detection",
        codename: "ARGUS-SIG",
        description: "Life event detection (job change, relocation, marriage). CUSUM-based drift alarms. Knowledge graph peer-group analysis via GraphSAGE for contagion detection.",
        tech: ["GraphSAGE", "CUSUM", "LangGraph"],
        outputs: ["life_events", "drift_alarms", "peer_signals"],
        color: "text-cyan-600",
        bg: "bg-cyan-50",
        border: "border-cyan-200",
        icon: <Network className="w-5 h-5" />,
        status: "live",
    },
    {
        id: 3,
        name: "ML Scoring",
        codename: "CHRONOS v2",
        description: "FusionXV2: 4-model ensemble. TARE (Temporal Transformer, AUC 0.93), HABITAT (GBM tabular), GraphSAGE (peer KG, AUC 0.93), DeepHitSingle (survival P(churn 7/30/90d)). Split-conformal CI.",
        tech: ["PyTorch", "XGBoost", "pycox", "PyG"],
        outputs: ["final_score", "survival_7d/30d/90d", "conformal_CI", "urgency_horizon"],
        color: "text-indigo-600",
        bg: "bg-indigo-50",
        border: "border-indigo-200",
        icon: <Brain className="w-5 h-5" />,
        status: "trained",
    },
    {
        id: 4,
        name: "Orchestration",
        codename: "COMPASS",
        description: "LangGraph agentic workflow. Next-best-action routing: channel selection (email/SMS/push/call/RM visit), timing, offer assignment. Survival-driven urgency overrides standard priority.",
        tech: ["LangGraph", "PostgreSQL", "FastAPI"],
        outputs: ["action_plan", "channel", "offer_code", "priority"],
        color: "text-violet-600",
        bg: "bg-violet-50",
        border: "border-violet-200",
        icon: <Compass className="w-5 h-5" />,
        status: "live",
    },
    {
        id: 5,
        name: "Content Generation",
        codename: "HERALD",
        description: "DeepSeek-V4-Pro-4 via Azure AI Foundry. Channel-specific content: email (subject + body + A/B), SMS (160-char), push notification, call briefing. Compliance screening + tone modifiers.",
        tech: ["DeepSeek-V4-Pro-4", "Azure AI", "LangGraph"],
        outputs: ["email_content", "sms_body", "push_alert", "call_brief"],
        color: "text-rose-600",
        bg: "bg-rose-50",
        border: "border-rose-200",
        icon: <Sparkles className="w-5 h-5" />,
        status: "live",
    },
    {
        id: 6,
        name: "Measurement",
        codename: "VERDICT",
        description: "DR-Learner (Doubly Robust) causal uplift estimation. Brier score calibration monitoring for DeepHit survival model. Feature set: 14 signals including graph_score, survival_30d, ensemble_disagreement.",
        tech: ["CausalML", "DR-Learner", "Brier Score"],
        outputs: ["uplift_estimate", "calibration_signal", "model_drift_flag"],
        color: "text-amber-600",
        bg: "bg-amber-50",
        border: "border-amber-200",
        icon: <ShieldCheck className="w-5 h-5" />,
        status: "live",
    },
    {
        id: 7,
        name: "Analytics & Retraining",
        codename: "ORACLE",
        description: "Thompson Sampling bandit for content A/B. Weekly retrain orchestration: TARE Transformer, GraphSAGE, DeepHit (on Brier > 0.25), FusionXV2 recalibration. LLM-driven insight summaries.",
        tech: ["Thompson Sampling", "LangGraph", "Plotly"],
        outputs: ["retrain_trigger", "bandit_allocation", "weekly_report"],
        color: "text-emerald-600",
        bg: "bg-emerald-50",
        border: "border-emerald-200",
        icon: <BarChart2 className="w-5 h-5" />,
        status: "live",
    },
];

const STATUS_CONFIG = {
    live:       { label: "Live", dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
    trained:    { label: "Trained", dot: "bg-indigo-500", text: "text-indigo-700", bg: "bg-indigo-50 border-indigo-200" },
    generating: { label: "Generating", dot: "bg-rose-500 animate-pulse", text: "text-rose-700", bg: "bg-rose-50 border-rose-200" },
};

function LayerCard({ layer, isSelected, onClick }: { layer: Layer; isSelected: boolean; onClick: () => void }) {
    const st = STATUS_CONFIG[layer.status];
    return (
        <button
            onClick={onClick}
            className={`w-full text-left rounded-xl border-2 p-4 transition-all duration-200 ${
                isSelected
                    ? `${layer.border} ${layer.bg} shadow-md`
                    : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
            }`}
        >
            <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-lg ${layer.bg} ${layer.border} border flex items-center justify-center ${layer.color} shrink-0`}>
                    {layer.icon}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Layer {layer.id}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${st.bg} ${st.text} uppercase tracking-wider flex items-center gap-1`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                            {st.label}
                        </span>
                    </div>
                    <p className="text-sm font-bold text-slate-900">{layer.codename}</p>
                    <p className="text-xs text-slate-500">{layer.name}</p>
                </div>
            </div>
        </button>
    );
}

function LayerDetail({ layer }: { layer: Layer }) {
    const st = STATUS_CONFIG[layer.status];
    return (
        <div className={`rounded-xl border-2 ${layer.border} ${layer.bg} p-6 space-y-5`}>
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl border ${layer.border} bg-white flex items-center justify-center ${layer.color}`}>
                        {layer.icon}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Layer {layer.id} · {layer.name}</span>
                        </div>
                        <h2 className={`text-xl font-bold ${layer.color}`}>{layer.codename}</h2>
                    </div>
                </div>
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${st.bg} ${st.text} uppercase tracking-wider flex items-center gap-1.5`}>
                    <span className={`w-2 h-2 rounded-full ${st.dot}`} />
                    {st.label}
                </span>
            </div>

            <p className="text-sm text-slate-700 leading-relaxed">{layer.description}</p>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Technology Stack</p>
                    <div className="flex flex-wrap gap-1.5">
                        {layer.tech.map(t => (
                            <span key={t} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-700">
                                {t}
                            </span>
                        ))}
                    </div>
                </div>
                <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Outputs</p>
                    <div className="flex flex-col gap-1">
                        {layer.outputs.map(o => (
                            <span key={o} className="flex items-center gap-1.5 text-xs font-mono text-slate-600">
                                <CheckCircle2 className={`w-3 h-3 ${layer.color}`} />
                                {o}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function PipelinePage() {
    const [selected, setSelected] = useState<number>(3);

    const selectedLayer = LAYERS.find(l => l.id === selected)!;

    return (
        <ProtectedRoute>
            <div className="flex flex-col gap-6 max-w-7xl pb-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">PCOP Pipeline Architecture</h1>
                        <p className="text-sm text-slate-500 mt-1">7-layer ML system · Click any layer to inspect</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400 bg-white border border-slate-200 rounded-lg px-3 py-2">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Real-time scoring · Weekly retrain cadence</span>
                    </div>
                </div>

                {/* Flow diagram */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 overflow-x-auto">
                    <div className="flex items-center gap-1 min-w-max">
                        {LAYERS.map((layer, idx) => (
                            <div key={layer.id} className="flex items-center gap-1">
                                <button
                                    onClick={() => setSelected(layer.id)}
                                    className={`flex flex-col items-center gap-2 px-3 py-3 rounded-xl border-2 transition-all min-w-[90px] ${
                                        selected === layer.id
                                            ? `${layer.border} ${layer.bg} shadow-md`
                                            : "border-slate-200 hover:border-slate-300"
                                    }`}
                                >
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                        selected === layer.id ? `bg-white ${layer.color}` : "bg-slate-100 text-slate-500"
                                    }`}>
                                        {layer.icon}
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[9px] font-bold text-slate-400 uppercase">L{layer.id}</p>
                                        <p className={`text-[10px] font-bold ${selected === layer.id ? layer.color : "text-slate-600"}`}>{layer.codename}</p>
                                    </div>
                                </button>
                                {idx < LAYERS.length - 1 && (
                                    <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-[280px_1fr] gap-6">
                    {/* Layer list */}
                    <div className="flex flex-col gap-3">
                        {LAYERS.map(layer => (
                            <LayerCard
                                key={layer.id}
                                layer={layer}
                                isSelected={selected === layer.id}
                                onClick={() => setSelected(layer.id)}
                            />
                        ))}
                    </div>

                    {/* Detail panel */}
                    <div className="flex flex-col gap-6">
                        <LayerDetail layer={selectedLayer} />

                        {/* Data flow card */}
                        <div className="bg-white rounded-xl border border-slate-200 p-5">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">End-to-End Data Flow</p>
                            <div className="space-y-2">
                                <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                                    <Database className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                                    <div>
                                        <p className="text-xs font-bold text-slate-700">Customer Event → ARGUS</p>
                                        <p className="text-[10px] text-slate-400">Kafka stream ingests transaction, login, complaint events in real-time</p>
                                    </div>
                                </div>
                                <div className="flex justify-center">
                                    <ChevronRight className="w-4 h-4 text-slate-300 rotate-90" />
                                </div>
                                <div className="flex items-start gap-3 p-3 bg-indigo-50 rounded-lg border border-indigo-100">
                                    <Brain className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
                                    <div>
                                        <p className="text-xs font-bold text-slate-700">CHRONOS v2 Scores → FusionXV2</p>
                                        <p className="text-[10px] text-slate-400">TARE 35% + HABITAT 30% + GraphSAGE 20% + DeepHit 15% with conformal CI</p>
                                    </div>
                                </div>
                                <div className="flex justify-center">
                                    <ChevronRight className="w-4 h-4 text-slate-300 rotate-90" />
                                </div>
                                <div className="flex items-start gap-3 p-3 bg-violet-50 rounded-lg border border-violet-100">
                                    <Zap className="w-4 h-4 text-violet-500 mt-0.5 shrink-0" />
                                    <div>
                                        <p className="text-xs font-bold text-slate-700">COMPASS → HERALD → Outreach</p>
                                        <p className="text-[10px] text-slate-400">Action plan drives LLM content generation → dispatched via email/SMS/push/call</p>
                                    </div>
                                </div>
                                <div className="flex justify-center">
                                    <ChevronRight className="w-4 h-4 text-slate-300 rotate-90" />
                                </div>
                                <div className="flex items-start gap-3 p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                                    <GitBranch className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                                    <div>
                                        <p className="text-xs font-bold text-slate-700">VERDICT → ORACLE → Retrain</p>
                                        <p className="text-[10px] text-slate-400">DR-Learner uplift + Brier calibration feedback → weekly model refresh cycle</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </ProtectedRoute>
    );
}
