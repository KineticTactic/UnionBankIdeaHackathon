'use strict';
/**
 * llmClient — thin wrapper around the Groq OpenAI-compatible Chat Completions API.
 *
 * Adds:
 *   • AbortController hard timeout            (GROQ_TIMEOUT_MS)
 *   • p-limit concurrency cap                 (GROQ_MAX_CONCURRENCY)
 *   • bounded retry with backoff for transient failures (429 / 5xx / network),
 *     honouring Retry-After when the provider supplies it.
 *
 * Requests are non-streaming and authenticated server-side.  The raw
 * OpenAI-compatible payload is returned unchanged so existing callers keep
 * reading `resp.choices[0].message.content`.
 *
 * Failures are surfaced as an LLMError carrying a `category`
 * (no_key | auth | rate_limit | server | client | timeout | network |
 *  bad_response) so callers can fall back to cached/template content.
 * Error messages never include the API key, authorization header or prompt.
 */
const config = require('../config');
const pLimit = require('p-limit');

const limiter = pLimit(config.groq.maxConcurrency);

const RETRYABLE_CATEGORIES = new Set(['rate_limit', 'server', 'network', 'timeout']);
const MAX_RETRY_AFTER_MS = 5000;

class LLMError extends Error {
    constructor(message, category, status = null, retryAfterMs = null) {
        super(message);
        this.name          = 'LLMError';
        this.category      = category;
        this.status        = status;
        this.retryAfterMs  = retryAfterMs;
        this.retryable     = RETRYABLE_CATEGORIES.has(category);
    }
}

function _categoryFor(status) {
    if (status === 401 || status === 403) return 'auth';
    if (status === 429)                   return 'rate_limit';
    if (status >= 500)                    return 'server';
    return 'client';
}

function _retryAfterMs(resp) {
    const raw = resp && resp.headers && typeof resp.headers.get === 'function'
        ? resp.headers.get('retry-after')
        : null;
    if (!raw) return null;
    const seconds = Number(raw);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    const date = Date.parse(raw);
    if (Number.isFinite(date)) return Math.max(0, date - Date.now());
    return null;
}

/** True when a Groq API key is configured. */
function isConfigured() {
    return typeof config.groq.apiKey === 'string' && config.groq.apiKey.trim().length > 0;
}

async function _callOnce(messages, maxTokens, options = {}) {
    if (!isConfigured()) {
        throw new LLMError('GROQ_API_KEY is not configured', 'no_key');
    }

    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), config.groq.timeoutMs);
    try {
        const body = {
            model:       config.groq.model,
            messages,
            max_tokens:  maxTokens,
            temperature: 0.7,
            stream:      false,
            ...options,
        };
        // gpt-oss models are reasoning models — a low effort leaves room for
        // the actual completion.  Omitted entirely when not configured.
        if (config.groq.reasoningEffort) body.reasoning_effort = config.groq.reasoningEffort;

        const resp = await fetch(config.groq.endpoint, {
            method:  'POST',
            headers: {
                'Content-Type':  'application/json',
                'Authorization': `Bearer ${config.groq.apiKey}`,
            },
            body:   JSON.stringify(body),
            signal: controller.signal,
        });

        if (!resp.ok) {
            throw new LLMError(
                `Groq HTTP ${resp.status}`,
                _categoryFor(resp.status),
                resp.status,
                _retryAfterMs(resp),
            );
        }

        let data;
        try {
            data = await resp.json();
        } catch (_) {
            throw new LLMError('Groq returned malformed JSON', 'bad_response', resp.status);
        }

        const content = data && data.choices && data.choices[0]
            && data.choices[0].message && data.choices[0].message.content;
        if (typeof content !== 'string' || content.trim().length === 0) {
            throw new LLMError('Groq returned an empty completion', 'bad_response', resp.status);
        }
        return data;
    } catch (err) {
        if (err instanceof LLMError) throw err;
        if (err && err.name === 'AbortError') {
            throw new LLMError('Groq request timed out', 'timeout');
        }
        throw new LLMError('Groq network failure', 'network');
    } finally {
        clearTimeout(timer);
    }
}

function _backoffMs(attempt, err) {
    if (err && err.retryAfterMs != null) return Math.min(err.retryAfterMs, MAX_RETRY_AFTER_MS);
    return 400 * Math.pow(2, attempt);
}

async function _withRetry(fn, retries = 1) {
    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await fn();
        } catch (err) {
            lastErr = err;
            if (attempt === retries || !(err instanceof LLMError) || !err.retryable) throw err;
            await new Promise(r => setTimeout(r, _backoffMs(attempt, err)));
        }
    }
    throw lastErr;
}

/**
 * callLLM(messages, maxTokens=1200, options={}) — rate-limited, timeout-bound,
 * retried.  Resolves to the raw OpenAI-compatible payload; throws LLMError on
 * failure so the caller can fall back to cached content.
 */
function callLLM(messages, maxTokens = 1200, options = {}) {
    return limiter(() => _withRetry(() => _callOnce(messages, maxTokens, options)));
}

module.exports = { callLLM, isConfigured, LLMError };
