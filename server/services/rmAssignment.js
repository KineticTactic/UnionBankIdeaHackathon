'use strict';
/**
 * rmAssignment.js — Intelligent RM Assignment Engine.
 *
 * Recommends the best RM for a new customer on three transparent axes:
 *   Fit      — specialization match (segment + geography)
 *   Capacity — workload headroom, discounted by active-risk load
 *   Fairness — anti-concentration: spread high-value and high-risk evenly
 *
 * Weights favour Capacity + Fairness over pure Fit so difficult customers
 * don't all pile onto the specialist.
 */

const { allBookProfiles, dominant, HIGH_VALUE_BALANCE, SEGMENT_RANK } = require('./rmBookQuality');
const { readJson, writeJson } = require('../utils/jsonStore');
const path = require('path');

const WEIGHTS_FILE   = path.join(__dirname, '..', 'data', 'assignmentWeights.json');
const MAX_BOOK_SIZE  = 15;

const DEFAULT_WEIGHTS = { fit: 0.35, capacity: 0.40, fairness: 0.25 };

// Segment adjacency for partial-match scoring
const SEG_ADJACENT = {
    HNW:            ['Mass Affluent'],
    'Mass Affluent': ['HNW', 'SME'],
    SME:             ['Mass Affluent', 'Mass Market'],
    'Mass Market':   ['SME'],
};

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// ── 2.1 Fit score ─────────────────────────────────────────────────────────────
function fitScore(customer, profile) {
    const custSeg  = customer.segment;
    const rmDomSeg = profile.dominantSegment;

    let segFit;
    if (!custSeg || !rmDomSeg)              segFit = 0.4;
    else if (custSeg === rmDomSeg)          segFit = 1.0;   // exact match
    else if ((SEG_ADJACENT[custSeg] || []).includes(rmDomSeg)) segFit = 0.6; // adjacent tier
    else                                    segFit = 0.2;   // mismatch

    // City clustering bonus: +0.2 if RM already serves that city
    const cityBonus = (customer.city && (profile.cities || []).includes(customer.city)) ? 0.2 : 0;

    return clamp(segFit + cityBonus, 0, 1);
}

// ── 2.2 Capacity score ────────────────────────────────────────────────────────
function capacityScore(profile) {
    if (profile.bookSize >= MAX_BOOK_SIZE) return 0;
    const headroom     = (MAX_BOOK_SIZE - profile.bookSize) / MAX_BOOK_SIZE;
    // At-risk load: RM already managing many at-risk customers has less real bandwidth.
    // At 100% atRiskPct, discount is 0.5 (never fully zeroes headroom from risk alone).
    const riskDiscount = 1 - (profile.atRiskPct / 100) * 0.5;
    return clamp(headroom * riskDiscount, 0, 1);
}

// ── 2.3 Fairness score ────────────────────────────────────────────────────────
function fairnessScore(customer, profile, allProfiles) {
    const isHighValue = (customer.balance || 0) >= HIGH_VALUE_BALANCE;
    const isHighRisk  = ['PRIORITY', 'ESCALATE'].includes(customer.risk_tier);

    const medianBookSize = _median(allProfiles.map(p => p.bookSize));
    const avgHighValue   = allProfiles.reduce((s, p) => s + p.highValueCount, 0) / allProfiles.length;

    let score = 1.0;

    // a) High-value concentration penalty
    if (isHighValue && profile.highValueCount > avgHighValue * 1.2) {
        score -= 0.35; // key-person risk — this RM already holds above-average HV customers
    }

    // b) Book-size equity: below-median → bonus; above-median → penalty
    if (profile.bookSize < medianBookSize)      score += 0.20;
    else if (profile.bookSize > medianBookSize) score -= 0.20;

    // c) Hard-book protection: don't pile high-risk onto an already stressed book
    if (isHighRisk && profile.atRiskPct > 50) {
        score -= 0.30;
    }

    return clamp(score, 0, 1);
}

function _median(arr) {
    if (!arr.length) return 0;
    const s = [...arr].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// ── 2.4 Rationale builder ─────────────────────────────────────────────────────
function _buildRationale(customer, profile, scores) {
    const parts = [];

    if (scores.fit >= 0.9)       parts.push(`${profile.dominantSegment} specialization match`);
    else if (scores.fit >= 0.6)  parts.push(`adjacent segment fit (${profile.dominantSegment} book)`);
    else                          parts.push(`segment mismatch — compensated by capacity`);

    if (scores.capacity >= 0.7)  parts.push(`strong capacity headroom (${profile.bookSize} customers)`);
    else if (scores.capacity >= 0.4) parts.push(`moderate capacity (${profile.bookSize} customers, ${profile.atRiskPct}% at-risk)`);
    else                          parts.push(`limited capacity (${profile.bookSize} customers)`);

    if (scores.fairness >= 0.8)  parts.push(`improves book balance across the team`);
    else if (scores.fairness < 0.5 && (customer.balance || 0) >= HIGH_VALUE_BALANCE)
                                  parts.push(`fairness flag: HV concentration risk on this RM`);
    else if (scores.fairness < 0.5 && ['PRIORITY','ESCALATE'].includes(customer.risk_tier))
                                  parts.push(`hard-book protection: ${profile.atRiskPct}% at-risk already`);

    if (customer.city && (profile.cities || []).includes(customer.city))
        parts.push(`serves ${customer.city} cluster`);

    return parts.join('; ') + '.';
}

// ── 2.5 Main recommender ──────────────────────────────────────────────────────
function recommendRM(customer, opts = {}) {
    const savedWeights = (() => { try { return readJson(WEIGHTS_FILE, DEFAULT_WEIGHTS); } catch { return DEFAULT_WEIGHTS; } })();
    const weights = { ...savedWeights, ...(opts.weights || {}) };

    // Normalize weights so they always sum to 1
    const wSum = weights.fit + weights.capacity + weights.fairness;
    if (wSum > 0) { weights.fit /= wSum; weights.capacity /= wSum; weights.fairness /= wSum; }

    const profiles = allBookProfiles();

    const scored = profiles.map(p => {
        const fit      = fitScore(customer, p);
        const capacity = capacityScore(p);
        const fairness = fairnessScore(customer, p, profiles);
        const total    = weights.fit * fit + weights.capacity * capacity + weights.fairness * fairness;
        return {
            rmName:          p.rmName,
            total:           +total.toFixed(3),
            breakdown:       { fit: +fit.toFixed(2), capacity: +capacity.toFixed(2), fairness: +fairness.toFixed(2) },
            bookSize:        p.bookSize,
            dominantSegment: p.dominantSegment,
            atRiskPct:       p.atRiskPct,
            highValueCount:  p.highValueCount,
            rationale:       _buildRationale(customer, p, { fit, capacity, fairness }),
        };
    });

    scored.sort((a, b) => b.total - a.total);

    return {
        recommended:  scored[0],
        alternatives: scored.slice(1, 3),
        all:          scored,
        weights:      { fit: +weights.fit.toFixed(2), capacity: +weights.capacity.toFixed(2), fairness: +weights.fairness.toFixed(2) },
    };
}

// ── Weight persistence ────────────────────────────────────────────────────────
function getWeights() {
    try { return readJson(WEIGHTS_FILE, DEFAULT_WEIGHTS); } catch { return DEFAULT_WEIGHTS; }
}

async function saveWeights(w) {
    const norm = { fit: +w.fit, capacity: +w.capacity, fairness: +w.fairness };
    await writeJson(WEIGHTS_FILE, norm);
    return norm;
}

module.exports = {
    recommendRM, fitScore, capacityScore, fairnessScore,
    getWeights, saveWeights,
    WEIGHTS: DEFAULT_WEIGHTS, MAX_BOOK_SIZE,
};
