/**
 * traiComplianceService.js — TRAI TCCCPR 2018 + Second Amendment 2025 compliance.
 * Classifies outreach type, validates DLT registration, checks DND registry.
 * TRAI TCCCPR 2025 — commercial communications must use registered templates and number series.
 */

const PROMOTIONAL_KEYWORDS  = ['offer', 'discount', 'upgrade', 'rate', 'benefit', 'cashback', 'reward', 'exclusive', 'earn', 'save'];
const TRANSACTIONAL_KEYWORDS = ['alert', 'statement', 'otp', 'update', 'notification', 'transaction', 'debit', 'credit'];

/**
 * Classify outreach content as PROMOTIONAL or TRANSACTIONAL.
 * Conservative: ambiguous content treated as PROMOTIONAL.
 */
function classifyOutreachType(content) {
    const lower = (content || '').toLowerCase();
    const promo  = PROMOTIONAL_KEYWORDS.some(k => lower.includes(k));
    const trans  = TRANSACTIONAL_KEYWORDS.some(k => lower.includes(k));
    if (trans && !promo) return 'TRANSACTIONAL';
    return 'PROMOTIONAL';
}

/** TRAI TCCCPR 2025 — 140-series for promotional, 160-series for transactional. */
function getRequiredNumberSeries(outreachType) {
    return outreachType === 'TRANSACTIONAL' ? '160' : '140';
}

/**
 * Validate DLT Principal Entity registration.
 * TODO (production): replace with live TRAI DLT API call to https://www.traidlt.com/api/validate
 */
function validateDltRegistration(dltEntityId) {
    if (dltEntityId === 'DEMO-DLT-001') return { valid: true, reason: 'DEMO_ENTITY_APPROVED' };
    if (!dltEntityId)  return { valid: false, reason: 'DLT_ENTITY_ID_MISSING' };
    // Stub — all non-demo IDs pass for hackathon; replace with live API in production
    return { valid: true, reason: 'DLT_ENTITY_REGISTERED' };
}

/**
 * Check TRAI DND (Do Not Disturb) registry.
 * TODO (production): call TRAI DND scrubbing API before each SMS send.
 */
function checkDndRegistry(phone) {
    // Stub — returns false (not on DND) for all demo numbers
    return { onDnd: false };
}

/**
 * Build full TRAI compliance metadata for an outreach action.
 * Throws if DLT entity is not registered.
 */
function buildOutreachMetadata(customerId, channel, content, dltEntityId) {
    const outreachType       = classifyOutreachType(content);
    const requiredNumberSeries = getRequiredNumberSeries(outreachType);
    const dltValidation      = validateDltRegistration(dltEntityId);

    if (!dltValidation.valid) throw new Error('DLT_NOT_REGISTERED');

    return {
        customerId,
        channel,
        outreachType,
        requiredNumberSeries,
        dltEntityId,
        dltValid:       dltValidation.valid,
        allowCrossSell: outreachType === 'PROMOTIONAL',
        consentRequired: true,
        timestamp:      new Date().toISOString(),
    };
}

module.exports = {
    classifyOutreachType,
    getRequiredNumberSeries,
    validateDltRegistration,
    checkDndRegistry,
    buildOutreachMetadata,
};
