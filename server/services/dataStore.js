const CUSTOMER_IDS = [
    'C-00000001', 'C-00000002', 'C-00000003', 'C-00000004', 'C-00000005',
    'C-00000006', 'C-00000007', 'C-00000008', 'C-00000009', 'C-00000010',
    'C-00000011', 'C-00000012', 'C-00000013', 'C-00000014', 'C-00000015',
    'C-00000016', 'C-00000017', 'C-00000018', 'C-00000019', 'C-00000020'
];

const CHURN_SCORES = {
    'C-00000001': { churn_score: 0.87, risk_tier: 'critical', reason_codes: ['Employer changed to Infosys', 'City shifted to Bangalore', 'Unresolved fee complaint'] },
    'C-00000002': { churn_score: 0.71, risk_tier: 'high', reason_codes: ['Transaction frequency declining', 'App engagement decay'] },
    'C-00000003': { churn_score: 0.34, risk_tier: 'watch', reason_codes: ['Mild transaction frequency decline'] },
    'C-00000004': { churn_score: 0.62, risk_tier: 'medium', reason_codes: ['Complaint sentiment drift', 'Overdraft events increasing'] },
    'C-00000005': { churn_score: 0.19, risk_tier: 'low', reason_codes: [] },
    'C-00000006': { churn_score: 0.91, risk_tier: 'critical', reason_codes: ['BOCPD joint alarm', 'Bereavement CRM note', 'Transaction volume collapse'] },
    'C-00000007': { churn_score: 0.78, risk_tier: 'high', reason_codes: ['Engagement decay', 'Competitor rate change signal'] },
    'C-00000008': { churn_score: 0.44, risk_tier: 'medium', reason_codes: ['Salary credit decreased 18%'] },
    'C-00000009': { churn_score: 0.55, risk_tier: 'medium', reason_codes: ['Complaint sentiment deteriorating', 'Transaction frequency decline'] },
    'C-00000010': { churn_score: 0.22, risk_tier: 'low', reason_codes: [] },
    'C-00000011': { churn_score: 0.66, risk_tier: 'high', reason_codes: ['Digital engagement drop', 'Complaint sentiment drift'] },
    'C-00000012': { churn_score: 0.89, risk_tier: 'critical', reason_codes: ['Job change detected', 'All engagement signals firing', 'Market signal active'] },
    'C-00000013': { churn_score: 0.41, risk_tier: 'medium', reason_codes: ['Mild salary drift', 'Retirement signal detected'] },
    'C-00000014': { churn_score: 0.73, risk_tier: 'high', reason_codes: ['Transaction city shifted to Pune', 'MCC relocation pattern'] },
    'C-00000015': { churn_score: 0.29, risk_tier: 'watch', reason_codes: ['Mild financial stress MCC signal'] },
    'C-00000016': { churn_score: 0.82, risk_tier: 'critical', reason_codes: ['All engagement signals active', 'SPRT complaint count alarm'] },
    'C-00000017': { churn_score: 0.38, risk_tier: 'watch', reason_codes: ['Mild transaction frequency decline'] },
    'C-00000018': { churn_score: 0.68, risk_tier: 'high', reason_codes: ['Engagement decay across all channels'] },
    'C-00000019': { churn_score: 0.51, risk_tier: 'medium', reason_codes: ['Financial stress indicators', 'Unresolved complaint'] },
    'C-00000020': { churn_score: 0.47, risk_tier: 'medium', reason_codes: ['Salary drift detected', 'Wedding MCC pattern'] }
};

const LIFE_EVENTS = [
    { customer_id: 'C-00000001', event_type: 'job_change', confidence: 0.85, evidence: ['Employer ref changed TCS→Infosys', 'KYC employer updated'], source: 'rule_ml', risk_adjustment: 0.15 },
    { customer_id: 'C-00000001', event_type: 'relocation', confidence: 0.80, evidence: ['>60% transactions in Bangalore', 'Rental agency payment in Bangalore'], source: 'rule_ml', risk_adjustment: 0.10 },
    { customer_id: 'C-00000006', event_type: 'bereavement', confidence: 0.75, evidence: ['CRM note mentions probate', 'MCC 7261 transaction', 'Transaction volume collapse'], source: 'llm_reasoning', risk_adjustment: 0.20 },
    { customer_id: 'C-00000008', event_type: 'salary_change', confidence: 0.82, evidence: ['Salary dropped from 65000 to 53000', 'Same employer retained'], source: 'rule_ml', risk_adjustment: 0.08 },
    { customer_id: 'C-00000012', event_type: 'job_change', confidence: 0.79, evidence: ['New employer detected in salary ref'], source: 'rule_ml', risk_adjustment: 0.12 },
    { customer_id: 'C-00000013', event_type: 'retirement', confidence: 0.65, evidence: ['Age 58', 'Mild salary drift', 'Enquiry about pension products'], source: 'llm_reasoning', risk_adjustment: 0.05 },
    { customer_id: 'C-00000014', event_type: 'relocation', confidence: 0.88, evidence: ['City shifted Hyderabad→Pune', 'MCC 6552 real estate payment'], source: 'rule_ml', risk_adjustment: 0.10 },
    { customer_id: 'C-00000019', event_type: 'financial_stress', confidence: 0.72, evidence: ['Overdraft events', 'Repayment difficulty in CRM'], source: 'rule_ml', risk_adjustment: 0.15 },
    { customer_id: 'C-00000020', event_type: 'marriage', confidence: 0.76, evidence: ['MCC 5944 jewellery store', 'MCC 7011 hotel booking', 'Wedding venue payment'], source: 'rule_ml', risk_adjustment: -0.05 }
];

const SIGNAL_TYPES = ['transaction_frequency', 'salary_amount', 'digital_engagement', 'complaint_sentiment', 'stress_overdraft', 'location_city', 'lifecycle_mcc', 'joint_bocpd'];

const SIGNALS = [
    { customer_id: 'C-00000001', signal_type: 'location_city', detected: true, confidence: 0.92, evidence: ['City shift from Mumbai to Bangalore'], cusum_value: 4.2, alarm_threshold: 3.5, method_used: 'CUSUM' },
    { customer_id: 'C-00000001', signal_type: 'transaction_frequency', detected: true, confidence: 0.85, evidence: ['Frequency dropped 35%'], cusum_value: 3.8, alarm_threshold: 3.0, method_used: 'CUSUM' },
    { customer_id: 'C-00000002', signal_type: 'digital_engagement', detected: true, confidence: 0.78, evidence: ['App logins down 40%'], cusum_value: 3.2, alarm_threshold: 3.0, method_used: 'CUSUM' },
    { customer_id: 'C-00000004', signal_type: 'stress_overdraft', detected: true, confidence: 0.72, evidence: ['3 overdraft events in 30 days'], cusum_value: 2.9, alarm_threshold: 2.5, method_used: 'BOCPD' },
    { customer_id: 'C-00000006', signal_type: 'lifecycle_mcc', detected: true, confidence: 0.95, evidence: ['MCC 7261 funeral service'], cusum_value: 5.1, alarm_threshold: 3.0, method_used: 'BOCPD' },
    { customer_id: 'C-00000006', signal_type: 'transaction_frequency', detected: true, confidence: 0.88, evidence: ['Volume collapsed 90%'], cusum_value: 6.2, alarm_threshold: 3.0, method_used: 'CUSUM' },
    { customer_id: 'C-00000007', signal_type: 'digital_engagement', detected: true, confidence: 0.81, evidence: ['Feature views down 50%'], cusum_value: 3.5, alarm_threshold: 3.0, method_used: 'CUSUM' },
    { customer_id: 'C-00000008', signal_type: 'salary_amount', detected: true, confidence: 0.90, evidence: ['Salary dropped 18%'], cusum_value: 4.0, alarm_threshold: 3.0, method_used: 'CUSUM' },
    { customer_id: 'C-00000009', signal_type: 'complaint_sentiment', detected: true, confidence: 0.76, evidence: ['Negative sentiment in CRM'], cusum_value: 2.8, alarm_threshold: 2.5, method_used: 'CUSUM' },
    { customer_id: 'C-00000011', signal_type: 'digital_engagement', detected: true, confidence: 0.74, evidence: ['App engagement down 45%'], cusum_value: 3.1, alarm_threshold: 3.0, method_used: 'CUSUM' },
    { customer_id: 'C-00000012', signal_type: 'salary_amount', detected: true, confidence: 0.88, evidence: ['Employer reference changed'], cusum_value: 4.5, alarm_threshold: 3.0, method_used: 'CUSUM' },
    { customer_id: 'C-00000012', signal_type: 'digital_engagement', detected: true, confidence: 0.92, evidence: ['All engagement signals firing'], cusum_value: 5.0, alarm_threshold: 3.0, method_used: 'BOCPD' },
    { customer_id: 'C-00000013', signal_type: 'salary_amount', detected: true, confidence: 0.68, evidence: ['Mild salary drift detected'], cusum_value: 2.2, alarm_threshold: 2.5, method_used: 'CUSUM' },
    { customer_id: 'C-00000014', signal_type: 'location_city', detected: true, confidence: 0.91, evidence: ['City shift Hyderabad→Pune'], cusum_value: 4.8, alarm_threshold: 3.5, method_used: 'CUSUM' },
    { customer_id: 'C-00000016', signal_type: 'digital_engagement', detected: true, confidence: 0.89, evidence: ['Engagement signals active'], cusum_value: 4.2, alarm_threshold: 3.0, method_used: 'SPRT' },
    { customer_id: 'C-00000018', signal_type: 'digital_engagement', detected: true, confidence: 0.77, evidence: ['Decay across all channels'], cusum_value: 3.3, alarm_threshold: 3.0, method_used: 'CUSUM' },
    { customer_id: 'C-00000019', signal_type: 'stress_overdraft', detected: true, confidence: 0.73, evidence: ['Overdraft events', 'Repayment issues'], cusum_value: 2.7, alarm_threshold: 2.5, method_used: 'BOCPD' },
    { customer_id: 'C-00000020', signal_type: 'lifecycle_mcc', detected: true, confidence: 0.82, evidence: ['Jewellery + hotel MCCs'], cusum_value: 3.4, alarm_threshold: 3.0, method_used: 'rule_ml' }
];

const CAMPAIGNS = [
    {
        campaign_id: 'CAMP-2025-Q1-RET',
        campaign_name: 'Q1 2025 Retention Drive',
        campaign_type: 'retention',
        target_segment: null,
        target_risk_tier: 'critical,high',
        start_date: '2025-01-01',
        end_date: '2025-03-31',
        status: 'completed',
        holdout_pct: 15.0,
        created_by: 'admin'
    },
    {
        campaign_id: 'CAMP-2025-Q2-LIFE',
        campaign_name: 'Q2 Lifecycle Outreach',
        campaign_type: 'lifecycle',
        target_segment: 'Mass Affluent',
        target_risk_tier: 'medium',
        start_date: '2025-04-01',
        end_date: '2025-06-30',
        status: 'active',
        holdout_pct: 15.0,
        created_by: 'admin'
    },
    {
        campaign_id: 'CAMP-2025-Q2-DIG',
        campaign_name: 'Digital Native Re-engagement',
        campaign_type: 'engagement',
        target_segment: 'Digital Native',
        target_risk_tier: 'high,critical',
        start_date: '2025-05-01',
        end_date: '2025-06-30',
        status: 'active',
        holdout_pct: 15.0,
        created_by: 'admin'
    }
];

let outreachRecords = [];
let outreachIdCounter = 1;

const generateOutreachRecords = () => {
    const channels = ['email', 'sms', 'app', 'call', 'rm_visit'];
    const statuses = ['sent', 'delivered', 'opened', 'clicked', 'failed'];
    const customers = CUSTOMER_IDS.slice(0, 15);

    customers.forEach((customerId, idx) => {
        const numRecords = Math.floor(Math.random() * 3) + 1;
        for (let i = 0; i < numRecords; i++) {
            const campaignIdx = idx % CAMPAIGNS.length;
            const channel = channels[Math.floor(Math.random() * channels.length)];
            const status = statuses[Math.floor(Math.random() * statuses.length)];
            const daysAgo = Math.floor(Math.random() * 90);
            const date = new Date();
            date.setDate(date.getDate() - daysAgo);

            outreachRecords.push({
                outreach_id: outreachIdCounter++,
                customer_id: customerId,
                campaign_id: CAMPAIGNS[campaignIdx].campaign_id,
                channel,
                risk_tier: CHURN_SCORES[customerId]?.risk_tier || 'medium',
                life_events: LIFE_EVENTS.filter(e => e.customer_id === customerId).map(e => e.event_type),
                offer_code: `OFFER-${campaignIdx + 1}-${Math.floor(Math.random() * 100)}`,
                content_version: `v1.${Math.floor(Math.random() * 3)}`,
                status,
                dispatched_at: date.toISOString(),
                holdout_group: Math.random() < 0.15,
                subject_line: channel === 'email' ? `Important Update for Your Account` : null,
                body_preview: `Dear Customer, we wanted to reach out regarding your recent account activity...`
            });
        }
    });

    outreachRecords.sort((a, b) => new Date(b.dispatched_at) - new Date(a.dispatched_at));
};

generateOutreachRecords();

const UPLIFT_RESULTS = [
    { uplift_id: 1, campaign_id: 'CAMP-2025-Q1-RET', channel: 'email', segment: 'HNW', risk_tier: 'critical', treatment_retention_rate: 0.78, holdout_retention_rate: 0.62, uplift_pct: 0.258, psm_adjusted: true, sample_size_treatment: 45, sample_size_holdout: 12 },
    { uplift_id: 2, campaign_id: 'CAMP-2025-Q1-RET', channel: 'sms', segment: 'HNW', risk_tier: 'critical', treatment_retention_rate: 0.72, holdout_retention_rate: 0.62, uplift_pct: 0.161, psm_adjusted: true, sample_size_treatment: 38, sample_size_holdout: 10 },
    { uplift_id: 3, campaign_id: 'CAMP-2025-Q1-RET', channel: 'call', segment: 'Mass Affluent', risk_tier: 'high', treatment_retention_rate: 0.85, holdout_retention_rate: 0.71, uplift_pct: 0.197, psm_adjusted: true, sample_size_treatment: 52, sample_size_holdout: 14 },
    { uplift_id: 4, campaign_id: 'CAMP-2025-Q1-RET', channel: 'app', segment: 'Digital Native', risk_tier: 'high', treatment_retention_rate: 0.68, holdout_retention_rate: 0.58, uplift_pct: 0.172, psm_adjusted: false, sample_size_treatment: 61, sample_size_holdout: 16 },
    { uplift_id: 5, campaign_id: 'CAMP-2025-Q2-LIFE', channel: 'email', segment: 'Mass Affluent', risk_tier: 'medium', treatment_retention_rate: 0.82, holdout_retention_rate: 0.75, uplift_pct: 0.093, psm_adjusted: false, sample_size_treatment: 78, sample_size_holdout: 20 }
];

const WARNINGS = [
    { severity: 'critical', title: 'Critical Churn Risk - C-00000006', description: 'Bereavement signal detected. Transaction volume collapsed. Immediate outreach recommended.', affected_customers: 1, signal_type: 'lifecycle_mcc', timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
    { severity: 'critical', title: 'Critical Churn Risk - C-00000001', description: 'Employer changed and city shifted to Bangalore. Multiple risk signals active.', affected_customers: 1, signal_type: 'location_city', timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString() },
    { severity: 'critical', title: 'Critical Churn Risk - C-00000012', description: 'Job change detected with complete engagement drop. High risk of account closure.', affected_customers: 1, signal_type: 'digital_engagement', timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString() },
    { severity: 'critical', title: 'Critical Churn Risk - C-00000016', description: 'All engagement signals firing. SPRT complaint count alarm triggered.', affected_customers: 1, signal_type: 'digital_engagement', timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString() },
    { severity: 'high', title: 'High Risk Alert - C-00000014', description: 'City shift from Hyderabad to Pune detected. MCC relocation pattern confirmed.', affected_customers: 1, signal_type: 'location_city', timestamp: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString() },
    { severity: 'high', title: 'High Risk Alert - C-00000002', description: 'App engagement decaying. Transaction frequency declining for 6 weeks.', affected_customers: 1, signal_type: 'digital_engagement', timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() },
    { severity: 'high', title: 'High Risk Alert - C-00000007', description: 'Engagement decay across channels. Competitor rate change signal active.', affected_customers: 1, signal_type: 'digital_engagement', timestamp: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString() },
    { severity: 'high', title: 'High Risk Alert - C-00000018', description: 'Engagement decay across all channels detected over past 30 days.', affected_customers: 1, signal_type: 'digital_engagement', timestamp: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString() },
    { severity: 'medium', title: 'Medium Risk - C-00000008', description: 'Salary credit decreased 18%. Monitor for continued decline.', affected_customers: 1, signal_type: 'salary_amount', timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString() },
    { severity: 'medium', title: 'Medium Risk - C-00000019', description: 'Financial stress indicators. Overdraft events and repayment difficulty.', affected_customers: 1, signal_type: 'stress_overdraft', timestamp: new Date(Date.now() - 60 * 60 * 60 * 1000).toISOString() }
];

const DASHBOARD_DATA = {
    risk_distribution: {
        critical: 4,
        high: 4,
        medium: 6,
        watch: 0,
        low: 6
    },
    critical_customers_today: 4,
    outreach_sent_this_week: 47,
    cusum_alarms_today: 12,
    retention_uplift_pct: 18.5,
    campaign_performance: [
        { channel: 'email', conversion_rate: 0.082 },
        { channel: 'sms', conversion_rate: 0.045 },
        { channel: 'app', conversion_rate: 0.068 },
        { channel: 'call', conversion_rate: 0.124 },
        { channel: 'rm_visit', conversion_rate: 0.156 }
    ],
    risk_trend_30d: generateRiskTrend30d(),
    insight_cards: [
        { severity: 'critical', title: 'Bereavement Alert', description: 'C-00000006: MCC 7261 funeral service detected. Transaction volume collapsed 90%. Consider empathetic outreach and estate planning support.', timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
        { severity: 'critical', title: 'Job Change Cluster', description: 'Multiple customers (C-00000001, C-00000012) show employer changes. Cross-sell opportunity for salary account and new employee benefits.', timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString() },
        { severity: 'warning', title: 'Digital Engagement Decline', description: 'Digital Native segment showing 25% engagement drop. Consider targeted app feature announcements and push notifications.', timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() }
    ]
};

function generateRiskTrend30d() {
    const trend = [];
    const baseScore = 0.52;
    for (let i = 30; i >= 1; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const variance = (Math.random() * 0.08) - 0.04;
        const dayOfWeek = date.getDay();
        const weekendEffect = (dayOfWeek === 0 || dayOfWeek === 6) ? 0.02 : 0;
        trend.push({
            date: date.toISOString().split('T')[0],
            avg_score: Math.max(0.35, Math.min(0.65, baseScore + variance - weekendEffect))
        });
    }
    return trend;
}

function getScoreHistory(customerId, days = 90) {
    const currentScore = CHURN_SCORES[customerId]?.churn_score || 0.5;
    const history = [];
    let score = 0.15 + Math.random() * 0.15;

    for (let i = days; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const progress = (days - i) / days;
        const targetScore = currentScore * progress + 0.15 * (1 - progress);
        const variance = (Math.random() * 0.06) - 0.03;
        score = Math.max(0.1, Math.min(0.95, targetScore + variance));

        let tier = 'low';
        if (score >= 0.85) tier = 'critical';
        else if (score >= 0.65) tier = 'high';
        else if (score >= 0.40) tier = 'medium';
        else if (score >= 0.25) tier = 'watch';

        history.push({
            score_date: date.toISOString().split('T')[0],
            final_score: Math.round(score * 10000) / 10000,
            risk_tier: tier,
            reason_codes: []
        });
    }
    return history;
}

module.exports = {
    CUSTOMER_IDS,
    CHURN_SCORES,
    LIFE_EVENTS,
    SIGNAL_TYPES,
    SIGNALS,
    CAMPAIGNS,
    outreachRecords,
    UPLIFT_RESULTS,
    WARNINGS,
    DASHBOARD_DATA,
    getScoreHistory,
    addOutreachRecord: (record) => {
        record.outreach_id = outreachIdCounter++;
        record.dispatched_at = new Date().toISOString();
        outreachRecords.unshift(record);
        return record;
    }
};
