'use strict';
/**
 * rmBookQuality.js — per-RM book profile builder.
 * Used by rmAssignment.js (capacity + fairness scoring) and admin analytics.
 */

const ds = require('./dataStore');

const RM_NAMES = [
    'Aditya Sharma', 'Deepa Krishnan', 'Sunita Nair', 'Vikram Joshi',
    'Rohit Kapoor', 'Ritu Malhotra', 'Anand Pillai', 'Priya Menon',
];

const SEGMENT_RANK = { HNW: 4, 'Mass Affluent': 3, SME: 2, 'Mass Market': 1 };
const HIGH_VALUE_BALANCE = 1_000_000;

function dominant(mix) {
    if (!mix || !Object.keys(mix).length) return null;
    return Object.entries(mix).sort((a, b) => b[1] - a[1])[0][0];
}

function buildProfile(rmName) {
    const customers = ds.CUSTOMERS.filter(c => c.relationship_manager === rmName);
    const bookSize  = customers.length;

    const segmentMix = {};
    const tierMix    = {};
    const cities     = [];
    let   atRiskCount     = 0;
    let   highValueCount  = 0;
    let   totalChurn      = 0;
    let   scoredCount     = 0;

    for (const c of customers) {
        segmentMix[c.segment] = (segmentMix[c.segment] || 0) + 1;
        const score = ds.SCORES_MAP[c.customer_id] || {};
        const tier  = score.risk_tier || c.risk_tier || 'NONE';
        tierMix[tier] = (tierMix[tier] || 0) + 1;
        if (['PRIORITY', 'ESCALATE'].includes(tier)) atRiskCount++;
        if ((c.balance || 0) >= HIGH_VALUE_BALANCE) highValueCount++;
        if (score.final_score != null) { totalChurn += score.final_score; scoredCount++; }
        if (c.city) cities.push(c.city);
    }

    const atRiskPct       = bookSize ? (atRiskCount / bookSize) * 100 : 0;
    const avgChurnScore   = scoredCount ? totalChurn / scoredCount : 0;
    const dominantSeg     = dominant(segmentMix);
    const dominantSegRank = SEGMENT_RANK[dominantSeg] || 1;

    // Book quality index — higher is healthier (used for analytics, not assignment)
    const bqi = Math.max(0, 1 - avgChurnScore - atRiskPct / 200);

    return {
        rmName,
        bookSize,
        segmentMix,
        tierMix,
        atRiskCount,
        atRiskPct: +atRiskPct.toFixed(1),
        highValueCount,
        avgChurnScore: +avgChurnScore.toFixed(3),
        bookQualityIndex: +bqi.toFixed(3),
        dominantSegment: dominantSeg,
        dominantSegmentRank: dominantSegRank,
        cities: [...new Set(cities)],
    };
}

function allBookProfiles() {
    return RM_NAMES.map(buildProfile);
}

module.exports = { allBookProfiles, buildProfile, RM_NAMES, dominant, HIGH_VALUE_BALANCE, SEGMENT_RANK };
