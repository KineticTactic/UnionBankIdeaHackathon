export type RiskTier = 'critical' | 'high' | 'medium' | 'watch' | 'low';
export type Segment = 'HNW' | 'Mass Affluent' | 'Mass Market' | 'Digital Native';
export type Channel = 'email' | 'sms' | 'app' | 'call' | 'rm_visit';

export interface Customer {
    customer_id: string;
    full_name: string;
    age: number;
    city: string;
    segment: Segment;
    tenure_years: number;
    preferred_channel: Channel;
    email: string;
    employer_name: string;
    annual_income_band: string;
    churn_score: number;
    risk_tier: RiskTier;
    active_signals: string[];
    life_events: string[];
    reason_codes: string[];
    recommended_action: string;
    email_opt_in: boolean;
    sms_opt_in: boolean;
    push_opt_in: boolean;
    relationship_manager_id: string | null;
    kyc_status: string;
}

export interface Signal {
    signal_type: string;
    detected: boolean;
    confidence: number;
    evidence: string[];
    method_used: string;
    cusum_value?: number;
    alarm_threshold?: number;
}

export interface LifeEvent {
    event_id?: number;
    customer_id: string;
    event_type: string;
    confidence: number;
    evidence: string[];
    source: string;
    risk_adjustment: number;
    detected_at?: string;
}

export interface OutreachRecord {
    outreach_id: number;
    customer_id: string;
    campaign_id: string | null;
    channel: Channel;
    risk_tier: RiskTier;
    life_events: string[];
    offer_code: string;
    content_version: string;
    status: 'sent' | 'delivered' | 'opened' | 'clicked' | 'failed';
    dispatched_at: string;
    holdout_group: boolean;
    subject_line?: string;
    body_preview?: string;
}

export interface ContentPreview {
    subject_line?: string;
    body_content: string;
    cta_text?: string;
    compliance_status: 'passed' | 'failed' | 'manual_review';
}

export interface Warning {
    severity: 'critical' | 'high' | 'medium' | 'info';
    title: string;
    description: string;
    affected_customers: number;
    signal_type: string;
    timestamp: string;
}

export interface Campaign {
    campaign_id: string;
    campaign_name: string;
    campaign_type: string;
    target_segment: string | null;
    target_risk_tier: string;
    start_date: string;
    end_date: string;
    status: string;
    holdout_pct: number;
    created_by: string;
    stats?: {
        sent: number;
        delivered: number;
        opened: number;
        converted: number;
        uplift_pct?: number;
    };
}

export interface DashboardData {
    risk_distribution: Record<RiskTier, number>;
    critical_customers_today: number;
    outreach_sent_this_week: number;
    cusum_alarms_today: number;
    retention_uplift_pct: number;
    campaign_performance: { channel: string; conversion_rate: number }[];
    risk_trend_30d: { date: string; avg_score: number }[];
    insight_cards: { severity: string; title: string; description: string; timestamp: string }[];
}

export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
    status: string;
}

export interface CustomerDetail {
    customer: Customer;
    accounts: Account[];
    score_history: ScoreHistory[];
    active_signal_details: Signal[];
    life_event_details: LifeEvent[];
    engagement: EngagementSummary;
    crm_summary: CrmSummary;
    top_mccs: MccSummary[];
}

export interface Account {
    account_id: string;
    account_type: string;
    balance: number;
    status: string;
    opened_date: string;
}

export interface ScoreHistory {
    score_date: string;
    final_score: number;
    risk_tier: RiskTier;
    reason_codes: string[];
}

export interface EngagementSummary {
    days_since_last_login: number | null;
    total_sessions_30d: number;
    avg_session_duration_s: number;
    most_used_feature: string | null;
}

export interface CrmSummary {
    total_complaints: number;
    unresolved_count: number;
    avg_resolution_days?: number;
    last_complaint_at?: string;
}

export interface MccSummary {
    mcc_code: string;
    mcc_description: string;
    count: number;
}

export interface PortfolioStats {
    total_customers: number;
    critical_count: number;
    high_count: number;
    medium_count: number;
    watch_count: number;
    low_count: number;
    avg_churn_score: number;
    outreach_sent_this_week: number;
}

export interface AnalysisResult {
    customer_id: string;
    churn_score: number;
    risk_tier: RiskTier;
    active_signals: string[];
    life_events: LifeEvent[];
    recommended_action: { channel: string; offer_code: string; timing: string; rationale: string } | null;
    reason_codes: string[];
    analysis_duration_ms: number;
    model_version: string;
    scored_at: string;
    tare_score: number | null;
    habitat_score: number | null;
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

export interface ReasonCodeV2 {
    category: string;
    description: string;
    importance: number;
    source: string;
}

export interface ChronosStats {
    total_customers_scored: number;
    tier_distribution: Record<string, number>;
    avg_churn_score: number;
    last_scored_at: string | null;
    model_versions: string[];
}

export interface ModelComponent {
    name: string;
    version: string;
    last_updated: string | null;
    status: string;
    metrics: Record<string, unknown>;
}

export interface ModelHealth {
    fusion_tare_weight: number;
    fusion_habitat_weight: number;
    fusion_ece: number | null;
    fusion_last_calibration: string | null;
    aegis_drift_status: string;
    components: ModelComponent[];
}

export interface AuthUser {
    username: string;
    role: 'analyst' | 'manager' | 'admin';
    name: string;
}

// ── CHRONOS v2 types ─────────────────────────────────────────────────────────

export type UrgencyHorizon = '7d' | '30d' | '90d' | null;

export interface V2Score {
    customer_id: string;
    final_score: number;
    risk_tier: RiskTier;
    tare_score: number;
    habitat_score: number;
    graph_score: number;
    survival_7d: number;
    survival_30d: number;
    survival_90d: number;
    urgency_horizon: UrgencyHorizon;
    ensemble_disagreement: number;
    conformal_lower: number;
    conformal_upper: number;
    model_version: string;
    scored_at: string;
}

export interface ActionPlan {
    customer_id: string;
    channel: string;
    offer_code: string;
    offer_description: string;
    offer_value: string;
    timing: string;
    priority: number;
    rationale: string;
    suppressed: boolean;
    content_strategy: string;
    urgency_horizon: UrgencyHorizon;
    tone_modifiers: string[];
    generated_at: string;
}

export interface HeraldContent {
    customer_id: string;
    channel: string;
    compliance_status: string;
    content_strategy: string;
    urgency_horizon: UrgencyHorizon;
    tone_modifiers: string[];
    offer_code: string;
    generated_at: string;
    // email
    subject_line?: string;
    preview_text?: string;
    body?: string;
    ab_variant?: { subject_line: string; preview_text: string };
    // sms
    // push
    title?: string;
    cta?: string;
    // call/rm_visit
    opening?: string;
    talking_points?: string[];
}

export interface V2ModelInfo {
    name: string;
    version: string;
    status: string;
    auc?: number;
    val_loss?: number;
    training_time_s?: number;
    training_samples?: number;
    epochs?: number;
    params?: number;
    checkpoint: string;
    last_trained: string;
    description: string;
    weights?: Record<string, number>;
}

export interface V2ModelHealth {
    models: V2ModelInfo[];
    ensemble: {
        version: string;
        total_models: number;
        avg_disagreement: number;
        portfolio_urgency: Record<string, number>;
        last_calibrated: string;
    };
}

export interface CreateCustomerInput {
    full_name: string;
    age: number;
    city: string;
    segment: Segment;
    email: string;
    phone_mobile?: string;
    employer_name?: string;
    employment_type?: string;
    annual_income_band?: string;
    tenure_years?: number;
    preferred_channel?: Channel;
    email_opt_in?: boolean;
    sms_opt_in?: boolean;
    push_opt_in?: boolean;
    call_opt_in?: boolean;
}

export interface PortfolioSurvival {
    total: number;
    by_urgency: Record<string, number>;
    avg_survival_7d: number;
    avg_survival_30d: number;
    avg_survival_90d: number;
    avg_disagreement: number;
}
