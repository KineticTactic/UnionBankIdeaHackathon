// Centralized compliance configuration — read from env with safe defaults.
// DPDPA 2023, TRAI TCCCPR 2025, RBI AI Governance Guidelines 2024.
module.exports = {
    dltEntityId:                process.env.DLT_ENTITY_ID                  || 'DEMO-DLT-001',
    consentAuditRetentionDays:  parseInt(process.env.CONSENT_AUDIT_RETENTION_YEARS || '7')  * 365,
    signalRetentionDays:        parseInt(process.env.SIGNAL_RETENTION_YEARS        || '2')  * 365,
    scoreRetentionDays:         parseInt(process.env.SCORE_RETENTION_YEARS         || '2')  * 365,
    approvalRetentionDays:      parseInt(process.env.APPROVAL_RETENTION_YEARS      || '1')  * 365,
    biasAuditMaxAgeDays:        parseInt(process.env.BIAS_AUDIT_MAX_AGE_DAYS       || '90'),
    approvalExpiryHours:        parseInt(process.env.OUTREACH_APPROVAL_EXPIRY_HOURS|| '48'),
    // RBI AI Governance 2024 — Human override required before adverse customer-facing actions
    humanOverrideRequired:      process.env.HUMAN_OVERRIDE_REQUIRED !== 'false',
    dataLocalizationMode:       process.env.DATA_LOCALIZATION_MODE          || 'INDIA_ONLY',
};
