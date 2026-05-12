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
    severity: 'critical' | 'medium' | 'info';
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
}

export interface AuthUser {
    username: string;
    role: 'analyst' | 'manager' | 'admin';
    name: string;
}
