'use strict';
/**
 * GET /api/llm-usage
 *
 * Reads LLM call counters from Redis keys pcop:llm_calls:* (set by nvidia_client.py).
 * Falls back to zeros in DEMO_MODE (no Redis) so the endpoint is always safe to call.
 */
const { Router } = require('express');
const config     = require('../config');

const router = Router();

router.get('/', async (req, res) => {
    if (config.demoMode) {
        return res.json({
            source: 'demo',
            note: 'DEMO_MODE=true — LLM counters only populate in production (Redis required)',
            totals: {},
            by_node: {},
        });
    }

    try {
        const redis = require('../services/redisClient');
        const client = redis.getClient();

        const totalKey = 'pcop:llm_calls:total';
        const keys = await client.keys('pcop:llm_calls:*');

        const nodeKeys = keys.filter(k => k !== totalKey);
        const values   = nodeKeys.length
            ? await client.mget(...nodeKeys)
            : [];

        const by_node = {};
        nodeKeys.forEach((k, i) => {
            const node = k.replace('pcop:llm_calls:', '');
            by_node[node] = parseInt(values[i] || '0', 10);
        });

        const totalRaw = await client.get(totalKey);
        const total = parseInt(totalRaw || '0', 10);

        return res.json({
            source: 'redis',
            totals: { all_nodes: total },
            by_node,
            window: '24h rolling',
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

module.exports = router;
