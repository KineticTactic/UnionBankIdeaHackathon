/**
 * llmClient.test.js — Groq LLM client tests.
 * Run with: node server/tests/llmClient.test.js
 *
 * All external HTTP is mocked — no Groq API key or network access required.
 * Uses the Node.js built-in assert (matching tests/compliance.test.js).
 */

'use strict';

const assert = require('assert');

// Configure BEFORE requiring config/llmClient so env is picked up.
process.env.GROQ_API_KEY    = 'gsk_TEST_KEY_must_never_leak_0000';
process.env.GROQ_MODEL      = 'test/model-x';
process.env.GROQ_ENDPOINT   = 'https://example.test/openai/v1/chat/completions';
process.env.GROQ_TIMEOUT_MS = '2000';

const config = require('../config');
const { callLLM, isConfigured, LLMError } = require('../services/llmClient');
const { parseHeraldResponse } = require('../services/heraldPrompt');

const REAL_KEY = config.groq.apiKey;
let passed = 0, failed = 0;

async function test(name, fn) {
    try {
        await fn();
        console.log(`  ✓  ${name}`);
        passed++;
    } catch (err) {
        console.error(`  ✗  ${name}`);
        console.error(`     ${err.message}`);
        failed++;
    }
}

function okResponse(payload) {
    return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => payload,
    };
}

function errResponse(status, retryAfter = null) {
    return {
        ok: false,
        status,
        headers: { get: (h) => (h.toLowerCase() === 'retry-after' ? retryAfter : null) },
        json: async () => ({}),
    };
}

function completion(content) {
    return { choices: [{ message: { role: 'assistant', content } }] };
}

function restore() {
    config.groq.apiKey = REAL_KEY;
    config.groq.timeoutMs = 2000;
    delete global.fetch;
}

const MSG = [{ role: 'user', content: 'hello' }];

// ── Tests ─────────────────────────────────────────────────────────────────────

(async () => {
    console.log('Groq LLM Client Test Suite\n' + '─'.repeat(40));

    await test('successful mocked Groq response produces generated text', async () => {
        global.fetch = async () => okResponse(completion('Dear Asha, thank you for banking with us.'));
        const resp = await callLLM(MSG, 100);
        assert.strictEqual(resp.choices[0].message.content, 'Dear Asha, thank you for banking with us.');
        restore();
    });

    await test('configured model + endpoint are used, key sent only as bearer header', async () => {
        let seenUrl, seenInit;
        global.fetch = async (url, init) => { seenUrl = url; seenInit = init; return okResponse(completion('ok')); };
        await callLLM(MSG, 100);
        assert.strictEqual(seenUrl, 'https://example.test/openai/v1/chat/completions');
        const body = JSON.parse(seenInit.body);
        assert.strictEqual(body.model, 'test/model-x');
        assert.strictEqual(body.stream, false);
        assert.strictEqual(body.max_tokens, 100);
        assert.strictEqual(body.reasoning_effort, 'low');
        assert.strictEqual(seenInit.headers.Authorization, `Bearer ${REAL_KEY}`);
        restore();
    });

    await test('missing API key uses the fallback (isConfigured false, no_key error)', async () => {
        config.groq.apiKey = '';
        assert.strictEqual(isConfigured(), false);
        let threw = null;
        try { await callLLM(MSG, 100); } catch (e) { threw = e; }
        assert.ok(threw instanceof LLMError, 'expected LLMError');
        assert.strictEqual(threw.category, 'no_key');
        restore();
    });

    await test('429 rate limit uses fallback with a bounded retry loop (<= 2 requests)', async () => {
        let calls = 0;
        global.fetch = async () => { calls++; return errResponse(429, null); };
        let threw = null;
        try { await callLLM(MSG, 100); } catch (e) { threw = e; }
        assert.ok(threw instanceof LLMError);
        assert.strictEqual(threw.category, 'rate_limit');
        assert.ok(calls >= 1 && calls <= 2, `expected bounded retries, got ${calls} calls`);
        restore();
    });

    await test('429 honours Retry-After (capped) and does not loop indefinitely', async () => {
        config.groq.timeoutMs = 2000;
        let calls = 0;
        global.fetch = async () => { calls++; return errResponse(429, '1'); };
        let threw = null;
        const start = Date.now();
        try { await callLLM(MSG, 100); } catch (e) { threw = e; }
        const elapsed = Date.now() - start;
        assert.strictEqual(threw.category, 'rate_limit');
        assert.ok(calls <= 2, `expected <= 2 calls, got ${calls}`);
        assert.ok(elapsed < 3000, `retry wait should be capped, took ${elapsed}ms`);
        restore();
    });

    await test('network failure does not crash and surfaces category=network', async () => {
        global.fetch = async () => { throw new Error('ECONNREFUSED'); };
        let threw = null;
        try { await callLLM(MSG, 100); } catch (e) { threw = e; }
        assert.ok(threw instanceof LLMError);
        assert.strictEqual(threw.category, 'network');
        restore();
    });

    await test('timeout does not crash and surfaces category=timeout', async () => {
        config.groq.timeoutMs = 50;
        global.fetch = (url, init) => new Promise((_, reject) => {
            init.signal.addEventListener('abort', () => {
                const e = new Error('aborted'); e.name = 'AbortError'; reject(e);
            });
        });
        let threw = null;
        try { await callLLM(MSG, 100); } catch (e) { threw = e; }
        assert.ok(threw instanceof LLMError);
        assert.strictEqual(threw.category, 'timeout');
        restore();
    });

    await test('empty completion is handled safely (bad_response)', async () => {
        global.fetch = async () => okResponse(completion(''));
        let threw = null;
        try { await callLLM(MSG, 100); } catch (e) { threw = e; }
        assert.ok(threw instanceof LLMError);
        assert.strictEqual(threw.category, 'bad_response');
        restore();
    });

    await test('malformed completion JSON is handled safely (bad_response)', async () => {
        global.fetch = async () => ({
            ok: true, status: 200, headers: { get: () => null },
            json: async () => { throw new Error('Unexpected token'); },
        });
        let threw = null;
        try { await callLLM(MSG, 100); } catch (e) { threw = e; }
        assert.ok(threw instanceof LLMError);
        assert.strictEqual(threw.category, 'bad_response');
        restore();
    });

    await test('existing response contract preserved (choices[0].message.content → parseHeraldResponse)', async () => {
        const payload = completion(JSON.stringify({
            email: { subject: 'A note from Union Bank', body: 'Dear Sam, thank you for choosing us.' },
            sms:   { body: 'Hi Sam, we have something for you.' },
            push:  { title: 'For you', body: 'Tap to learn more.' },
        }));
        global.fetch = async () => okResponse(payload);
        const resp = await callLLM(MSG, 100);
        const parsed = parseHeraldResponse(resp.choices[0].message.content);
        assert.ok(parsed.email.subject);
        assert.ok(parsed.email.body);
        assert.strictEqual(parsed.email.word_count, 7);
        assert.strictEqual(parsed.sms.char_count, 'Hi Sam, we have something for you.'.length);
        assert.ok(parsed.push.title);
        restore();
    });

    await test('API key is never included in error messages or logs', async () => {
        const errors = [];
        const origError = console.error, origWarn = console.warn;
        console.error = (...a) => errors.push(a.map(String).join(' '));
        console.warn  = (...a) => errors.push(a.map(String).join(' '));
        global.fetch = async () => errResponse(500, null);
        let threw = null;
        try { await callLLM(MSG, 100); } catch (e) { threw = e; }
        console.error = origError; console.warn = origWarn;
        const surface = [threw.message, threw.stack || '', JSON.stringify(threw), errors.join('\n')].join('\n');
        assert.ok(!surface.includes(REAL_KEY), 'API key leaked into error surface');
        assert.ok(!surface.includes('Bearer '), 'authorization header leaked into error surface');
        restore();
    });

    console.log('\n' + '─'.repeat(40));
    const total = passed + failed;
    console.log(`${passed}/${total} tests passed${failed > 0 ? ` · ${failed} failed` : ''}`);
    process.exit(failed > 0 ? 1 : 0);
})();
