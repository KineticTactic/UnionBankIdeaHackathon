'use strict';
/**
 * HERALD BullMQ job queue — decouples LLM calls from the HTTP request path.
 * POST /api/outreach/generate enqueues a job and returns 202 immediately.
 * A Worker (started at boot) processes it: calls NVIDIA, caches the result,
 * creates the approval entry, and publishes a Redis 'herald.completed' event.
 *
 * Job deduplication: jobs with the same customerId within 60 s are collapsed.
 */

const { Queue, Worker } = require('bullmq');
const Redis   = require('ioredis');
const crypto  = require('crypto');
const config  = require('../config');
const llm     = require('../services/llmClient');
const { buildHeraldPrompts, parseHeraldResponse } = require('../services/heraldPrompt');
const eventBus = require('../services/eventBus');

const QUEUE_NAME = 'herald';
let heraldQueue  = null;
let heraldWorker = null;

function _connection() {
    const conn = new Redis(config.redisUrl, { maxRetriesPerRequest: null, enableOfflineQueue: false });
    conn.on('error', () => {}); // suppress unhandled-error crashes; BullMQ logs failures internally
    return conn;
}

// ── Cache helpers ─────────────────────────────────────────────────────────────

function _briefHash(customerId, snapshot) {
    const key = `${customerId}:${snapshot?.score?.final_score || 0}:${(snapshot?.signals || []).length}`;
    return crypto.createHash('sha256').update(key).digest('hex').slice(0, 16);
}

async function _getCached(pub, cacheKey) {
    try {
        const raw = await pub.get(cacheKey);
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}

async function _setCached(pub, cacheKey, content) {
    try { await pub.set(cacheKey, JSON.stringify(content), 'EX', 3600); } catch (_) {}
}

// ── Worker processor ──────────────────────────────────────────────────────────

async function _processJob(job) {
    const { customerId, snapshot } = job.data;

    // Lazy require to avoid circular deps
    const ds          = require('../services/dataStore');
    const consentSvc  = require('../services/consentService');
    const approvalSvc = require('../services/approvalService');
    const auditLog    = require('../services/auditLogService');

    const briefHash  = _briefHash(customerId, snapshot);
    const cacheKey   = `herald:cache:${briefHash}`;
    const pub        = eventBus._pub;

    // 1. Check Redis cache
    let heraldContent = pub ? await _getCached(pub, cacheKey) : null;

    if (!heraldContent) {
        // 2. Call NVIDIA (rate-limited, timeout-bound, retried)
        if (config.nvidia.apiKey) {
            try {
                const { systemPrompt, userPrompt } = buildHeraldPrompts(snapshot);
                const resp = await llm.callNvidia([
                    { role: 'system', content: systemPrompt },
                    { role: 'user',   content: userPrompt },
                ], 1200);
                const raw = resp?.choices?.[0]?.message?.content || '';
                heraldContent = parseHeraldResponse(raw);
                if (pub) await _setCached(pub, cacheKey, heraldContent);
            } catch (err) {
                console.error(`[HERALD worker] NVIDIA failed for ${customerId}:`, err.message);
            }
        }

        // 3. Fallback to cached static content
        if (!heraldContent) {
            const cached = await ds.getHerald(customerId);
            heraldContent = cached || { email: { body: '' }, sms: { body: '' }, push: { body: '' } };
        }
    }

    // 4. Build COMPASS recommendation from snapshot
    const plan = snapshot.plan || {};
    const compassRecommendation = {
        offer:     plan.offer_display || plan.offer_code || 'personalised_offer',
        channel:   plan.channel       || 'email',
        timing:    plan.timing        || 'immediate',
        rationale: plan.rationale     || 'High churn risk detected by CHRONOS ensemble.',
    };

    // 5. Create approval entry (human-in-the-loop gate)
    const approvalId = await approvalSvc.createApprovalRequest(
        customerId, job.data.requestedBy || 'system', compassRecommendation, heraldContent
    );

    // 6. Consent snapshot for the result payload
    const channels = ['EMAIL', 'SMS', 'PUSH'];
    const consentStatus  = {};
    const allowedChannels = [];
    for (const ch of channels) {
        consentStatus[ch] = consentSvc.canSendOutreach(customerId, ch);
        if (consentStatus[ch].allowed) allowedChannels.push(ch);
    }

    // 7. Audit log
    await auditLog.logEvent({
        eventType:    'OUTREACH_QUEUED',
        customerId,
        actor:        job.data.requestedBy || 'system',
        layer:        'HERALD',
        payload:      { approvalId, allowedChannels, jobId: job.id },
        modelVersion: 'HERALD-v1.0',
    });

    // 8. Publish completion event for SSE / frontend polling
    await eventBus.publishEvent({
        topic:      'herald.completed',
        customerId,
        description: 'HERALD content generation complete — pending RM approval',
        payload:    { jobId: job.id, approvalId },
    });

    return { approvalId, pendingApproval: true, heraldContent, compassRecommendation, consentStatus, allowedChannels };
}

// ── Public API ────────────────────────────────────────────────────────────────

function enqueueHerald(customerId, snapshot, requestedBy) {
    if (!heraldQueue) throw new Error('HERALD queue not initialised — call startHeraldWorker() first');
    const briefHash = _briefHash(customerId, snapshot);
    const jobId     = `herald:${customerId}:${briefHash}`;
    return heraldQueue.add('generate', { customerId, snapshot, requestedBy }, {
        jobId,           // deduplicates identical briefs within the TTL
        removeOnComplete: { age: 3600 },
        removeOnFail:     { age: 86400 },
        attempts: 2,
        backoff:  { type: 'exponential', delay: 1000 },
    });
}

async function startHeraldWorker() {
    if (heraldWorker) return;

    // Probe Redis before creating BullMQ connections — avoids infinite retry spam.
    const probe = new Redis(config.redisUrl, {
        lazyConnect: true, connectTimeout: 1500,
        maxRetriesPerRequest: 1, enableOfflineQueue: false,
    });
    probe.on('error', () => {});
    try {
        await probe.connect();
        await probe.ping();
    } catch {
        try { probe.disconnect(); } catch (_) {}
        console.warn('[HERALD] Redis unavailable — BullMQ worker disabled, using synchronous fallback');
        return;
    }
    await probe.disconnect().catch(() => {});

    try {
        const connection = _connection();
        heraldQueue  = new Queue(QUEUE_NAME, { connection: _connection() });
        heraldWorker = new Worker(QUEUE_NAME, _processJob, {
            connection,
            concurrency: config.nvidia.maxConcurrency,
        });
        heraldWorker.on('failed', (job, err) => console.error(`[HERALD worker] job ${job?.id} failed:`, err.message));
        console.log('[HERALD] BullMQ worker started');
    } catch (exc) {
        console.warn('[HERALD] BullMQ worker unavailable, using synchronous fallback:', exc.message);
        heraldQueue  = null;
        heraldWorker = null;
    }
}

async function getJobStatus(jobId) {
    if (!heraldQueue) return { state: 'unavailable' };
    const job = await heraldQueue.getJob(jobId);
    if (!job) return { state: 'not_found' };
    const state = await job.getState();
    return {
        state,
        result:       state === 'completed' ? job.returnvalue : undefined,
        failedReason: state === 'failed'    ? job.failedReason : undefined,
    };
}

async function closeHeraldWorker() {
    try { if (heraldWorker) await heraldWorker.close(); } catch (_) {}
    try { if (heraldQueue)  await heraldQueue.close();  } catch (_) {}
}

module.exports = { enqueueHerald, startHeraldWorker, getJobStatus, closeHeraldWorker };
