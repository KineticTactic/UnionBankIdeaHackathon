export type RiskTier = 'critical' | 'high' | 'medium' | 'watch' | 'low';
export type Segment = 'HNW' | 'Mass Affluent' | 'Mass Market' | 'Digital Native';
export type Channel = 'email' | 'sms' | 'in_app' | 'call' | 'rm_visit';

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
}

export interface AnalysisResult {
    customer_id: string;
    churn_score: number;
    risk_tier: RiskTier;
    active_signals: string[];
    life_events: { event_type: string; confidence: number; evidence: string[] }[];
    recommended_action: { channel: string; offer_code: string; timing: string; rationale: string };
    reason_codes: string[];
    analysis_duration_ms: number;
    model_version: string;
    scored_at: string;
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
