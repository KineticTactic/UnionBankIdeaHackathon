'use strict';
/**
 * Thin wrapper around the NVIDIA DeepSeek endpoint.
 * Adds: AbortController hard timeout, exponential-backoff retry (2 attempts),
 * and a p-limit concurrency limiter so we never burst past NVIDIA_MAX_CONCURRENCY
 * parallel in-flight requests.
 */
const config = require('../config');
const pLimit = require('p-limit');

const limiter = pLimit(config.nvidia.maxConcurrency);

async function _callOnce(messages, maxTokens) {
    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), config.nvidia.timeoutMs);
    try {
        const resp = await fetch(config.nvidia.endpoint, {
            method:  'POST',
            headers: {
                'Content-Type':  'application/json',
                'Authorization': `Bearer ${config.nvidia.apiKey}`,
            },
            body:   JSON.stringify({ model: config.nvidia.model, messages, max_tokens: maxTokens, temperature: 0.7 }),
            signal: controller.signal,
        });
        if (!resp.ok) throw new Error(`NVIDIA HTTP ${resp.status}`);
        return await resp.json();
    } finally {
        clearTimeout(timer);
    }
}

async function _withRetry(fn, retries = 2) {
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await fn();
        } catch (err) {
            if (attempt === retries) throw err;
            await new Promise(r => setTimeout(r, 300 * Math.pow(2, attempt)));
        }
    }
}

/**
 * callNvidia(messages, maxTokens) — rate-limited, timeout-bound, retried.
 * Throws on failure so the caller can fall back to cached content.
 */
function callNvidia(messages, maxTokens = 1200) {
    return limiter(() => _withRetry(() => _callOnce(messages, maxTokens)));
}

module.exports = { callNvidia };
