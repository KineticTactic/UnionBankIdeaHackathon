// PCOP shared schemas — TypeScript mirror.
// Keep in sync with schemas/schemas/*.py

export type RiskTier = 'critical' | 'high' | 'medium' | 'low';
export type Channel = 'email' | 'sms' | 'push' | 'call' | 'rm_visit' | 'app';
export type ReasonSource = 'sequence' | 'tabular' | 'both';

export interface BankCustomer {
  customer_id: string;
  full_name: string;
  age?: number;
  city?: string;
  segment?: string;
  archetype?: string;
  tenure_months?: number;
  tenure_years?: number;
  income?: number;
  employer?: string;
  balance?: number;
  risk_tier?: RiskTier;
  churn_score?: number;
  preferred_channel?: Channel | string;
  email_opt_in?: boolean;
  sms_opt_in?: boolean;
  push_opt_in?: boolean;
  life_event?: string | null;
  life_event_desc?: string | null;
  nps?: number;
  inactivity_days?: number;
  digital_ratio?: number;
}

export interface CustomerSnapshot {
  customer: BankCustomer;
  score?: ChurnScore | null;
  signals?: SignalResult[];
  plan?: ActionPlan | null;
  survival?: Survival | null;
  herald?: HeraldResponse | null;
  enrichment?: Record<string, unknown> | null;
  snapshot_at?: string;
}

export interface ReasonCodeV2 {
  category: string;
  description: string;
  importance: number;
  source: ReasonSource;
}

export interface ChurnScore {
  customer_id: string;
  final_score: number;
  risk_tier: RiskTier;
  tare_score?: number | null;
  habitat_score?: number | null;
  treatability_score?: number | null;
  action_score?: number | null;
  scoring_pass?: string | null;
  reason_codes: string[];
  reason_codes_v2: ReasonCodeV2[];
  anomaly_flag: boolean;
  model_version: string;
  scored_at: string;
  is_cold_start: boolean;
}

export interface Survival {
  customer_id: string;
  p7: number;
  p30: number;
  p90: number;
  survival_curve?: number[];
  urgency_horizon_days?: number | null;
}

export interface AnalyzeResponse extends ChurnScore {
  token_count: number;
  tabular_features: Record<string, number>;
  attention_weights: { position: number; token: string; weight: number }[];
  shap_values: { feature: string; shap_value: number; direction: string }[];
  fusion_tare_weight: number;
  fusion_habitat_weight: number;
  fusion_ci_lower: number;
  fusion_ci_upper: number;
  tare_duration_ms: number;
  habitat_duration_ms: number;
  fusion_duration_ms: number;
  prism_duration_ms: number;
}

export interface ModelComponentStatus {
  name: string;
  version: string;
  last_updated?: string | null;
  status: 'healthy' | 'degraded' | 'unavailable';
  metrics: Record<string, unknown>;
}

export interface ModelHealthResponse {
  fusion_tare_weight: number;
  fusion_habitat_weight: number;
  fusion_ece?: number | null;
  fusion_last_calibration?: string | null;
  aegis_drift_status: string;
  components: ModelComponentStatus[];
  overall_status: 'healthy' | 'degraded' | 'unavailable';
}

export interface PipelineError {
  error: true;
  stage: number;
  stage_name: string;
  message: string;
  detail?: string;
  correlation_id?: string;
}

export interface SignalResult {
  customer_id: string;
  signal_type: string;
  detected: boolean;
  p_value: number;
  confidence: number;
  method_used: string;
  statistic: number;
  threshold: number;
  direction?: string | null;
  onset_estimate?: string | null;
  evidence: string[];
  expires_at?: string | null;
}

export interface ActionPlan {
  channel?: Channel | null;
  offer_code?: string | null;
  offer_display?: string | null;
  timing?: string | null;
  owner_id?: string | null;
  priority: number;
  rationale?: string | null;
}

export interface HeraldRequest {
  customer_id: string;
  channel: Channel;
  action_plan?: ActionPlan | null;
  offer_code?: string | null;
  risk_tier?: RiskTier | null;
  final_score?: number | null;
  final_events: Record<string, unknown>[];
}

export interface HeraldResponse {
  customer_id: string;
  channel: Channel;
  content_id?: string | null;
  subject?: string | null;
  body: string;
  compliance_status: 'passed' | 'failed' | 'human_review';
  compliance_notes?: string | null;
  ab_variant?: string | null;
  dispatched: boolean;
  dispatch_provider_id?: string | null;
  generated_at: string;
  human_review_required: boolean;
  error?: { code: string; message: string } | null;
}

export interface ObservationResult {
  customer_id: string;
  outreach_id?: number | null;
  window_days: number;
  outcome_label: 'retained' | 'partial' | 'unresponsive' | 'churned' | 'unknown';
  score_at_measure: number;
  score_reduction: number;
  signals_cleared: boolean;
  holdout: boolean;
  products_closed: number;
  observed_at: string;
}

export interface AttributeResult {
  campaign_id: string;
  channel: string;
  n_treatment: number;
  n_holdout: number;
  treatment_retained_rate: number;
  holdout_retained_rate: number;
  naive_uplift: number;
  dr_uplift: number;
  dr_uplift_se: number;
  overestimation_bias: number;
  causal_net_calibrated: boolean;
}

export interface InsightCard {
  severity: 'high' | 'medium' | 'info';
  title: string;
  what: string;
  why: string;
  where: string;
  recommend: string;
  metric_name?: string | null;
  metric_delta?: string | null;
  affected_customers?: number | null;
}

export interface OracleCycleResult {
  cycle: 'retrain' | 'refine' | 'route' | 'narrate';
  run_date: string;
  summary: string;
  insight_cards: InsightCard[];
  artifacts: Record<string, string>;
}
