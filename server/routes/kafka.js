'use strict';
/**
 * Kafka stream status and control endpoints.
 * GET  /api/kafka/status       — current mode, message counts, recent events
 * GET  /api/kafka/stream       — SSE live event stream (Redis-backed, multi-replica safe)
 * POST /api/kafka/publish      — manually inject a test event
 */
const express      = require('express');
const router       = express.Router();
const { verifyToken: auth } = require('../middleware/auth');
const kafkaService = require('../services/kafkaService');
const eventBus     = require('../services/eventBus');
const config       = require('../config');

// Per-node SSE connection counter to enforce MAX_SSE_PER_NODE
let sseCount = 0;

// ── Status snapshot ──────────────────────────────────────────────────────────

router.get('/status', auth, async (req, res) => {
    const status = kafkaService.getStatus();
    // Augment recentEvents from Redis ring buffer when in prod mode
    if (!config.demoMode) {
        try {
            status.recentEvents = await eventBus.getRecentEvents(20);
        } catch (_) {}
    }
    res.json({ status: 'ok', data: status });
});

// ── SSE live event stream ────────────────────────────────────────────────────

router.get('/stream', auth, (req, res) => {
    if (sseCount >= config.maxSsePerNode) {
        return res.status(503).json({ status: 'error', message: 'SSE connection limit reached on this node' });
    }
    sseCount++;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Send current status immediately on connect
    res.write(`data: ${JSON.stringify({ type: 'status', ...kafkaService.getStatus() })}\n\n`);

    // Heartbeat every 15 s to keep the connection alive through proxies
    const heartbeat = setInterval(() => {
        res.write(`data: ${JSON.stringify({ type: 'heartbeat', ts: new Date().toISOString() })}\n\n`);
    }, 15_000);

    // Subscribe via Redis pub/sub (or in-process EventEmitter in DEMO_MODE)
    const { customerId } = req.query;
    const onEvent = (evt) => {
        res.write(`data: ${JSON.stringify({ type: 'event', ...evt })}\n\n`);
    };

    const unsubscribe = customerId
        ? eventBus.subscribeCustomer(customerId, onEvent)   // scoped — customer detail page
        : eventBus.subscribeGlobal(onEvent);                // global  — dashboard

    req.on('close', () => {
        sseCount = Math.max(0, sseCount - 1);
        clearInterval(heartbeat);
        unsubscribe();
    });
});

// ── Manual event injection (demo / testing) ──────────────────────────────────

router.post('/publish', auth, async (req, res) => {
    const { topic, key, value } = req.body;
    if (!topic || !value)
        return res.status(400).json({ status: 'error', message: 'topic and value are required' });
    try {
        await kafkaService.publish(topic, key || 'manual', value);
        res.json({ status: 'ok', message: 'Event published', topic, value });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

module.exports = router;
