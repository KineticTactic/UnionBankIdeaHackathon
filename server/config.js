'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const _list = (s, def) => (s || def || '').split(',').map(x => x.trim()).filter(Boolean);

module.exports = {
    port:            parseInt(process.env.PORT || '8000'),
    host:            process.env.HOST || '0.0.0.0',
    jwtSecret:       process.env.JWT_SECRET || 'pcop-hackathon-2026-secret',
    jwtExpiresIn:    process.env.JWT_EXPIRES_IN || '8h',

    // true by default — live demo stays on JSON/simulation; flip to false for Postgres/Redis
    demoMode: process.env.DEMO_MODE !== 'false',

    databaseUrl: process.env.DATABASE_URL || 'postgresql://pcop:pcop_dev@localhost:5432/pcop',
    redisUrl:    process.env.REDIS_URL    || 'redis://localhost:6379',

    // ── Upstream service URLs (orchestrator → stages) ──
    bankApiBaseUrl:   process.env.BANK_API_BASE_URL   || 'http://localhost:3001',
    chronosBaseUrl:   process.env.CHRONOS_BASE_URL    || 'http://localhost:8001',
    argusBaseUrl:     process.env.ARGUS_BASE_URL      || 'http://localhost:8002',
    compassBaseUrl:   process.env.COMPASS_BASE_URL    || 'http://localhost:8004',
    heraldBaseUrl:    process.env.HERALD_BASE_URL     || 'http://localhost:8005',
    verdictBaseUrl:   process.env.VERDICT_BASE_URL    || 'http://localhost:8006',
    oracleBaseUrl:    process.env.ORACLE_BASE_URL     || 'http://localhost:8007',
    kafkaBrokers:     _list(process.env.KAFKA_BROKERS, 'localhost:9092'),

    // ── Groq LLM (HERALD outreach + call analysis + optional translation) ──
    // OpenAI-compatible Chat Completions API.  The key is server-side only and
    // is never sent to the browser.  Model is overridable per environment.
    groq: {
        endpoint:       process.env.GROQ_ENDPOINT        || 'https://api.groq.com/openai/v1/chat/completions',
        apiKey:         process.env.GROQ_API_KEY          || '',
        model:          process.env.GROQ_MODEL            || 'openai/gpt-oss-20b',
        // gpt-oss models are reasoning models; without a low effort the
        // reasoning tokens consume the whole max_tokens budget and the
        // completion content comes back empty.  Set GROQ_REASONING_EFFORT to
        // an empty string to omit the parameter for non-reasoning models.
        reasoningEffort: process.env.GROQ_REASONING_EFFORT === undefined
                            ? 'low'
                            : (process.env.GROQ_REASONING_EFFORT || null),
        timeoutMs:      parseInt(process.env.GROQ_TIMEOUT_MS      || '45000'),
        maxConcurrency: parseInt(process.env.GROQ_MAX_CONCURRENCY || '5'),
    },

    corsOrigins:    _list(process.env.CORS_ORIGINS, '*'),
    maxSsePerNode:  parseInt(process.env.MAX_SSE_PER_NODE || '1000'),

    enableKafkaSimulation: process.env.ENABLE_KAFKA_SIMULATION !== 'false',

    // Stage registry — used by TUI and health-check preflight in /readyz.
    stages: {
        bank:     { port: parseInt(process.env.BANK_PORT    || '3001'), name: 'bank'     },
        chronos:  { port: parseInt(process.env.CHRONOS_PORT || '8001'), name: 'chronos'  },
        argus:    { port: parseInt(process.env.ARGUS_PORT   || '8002'), name: 'argus'    },
        compass:  { port: parseInt(process.env.COMPASS_PORT || '8004'), name: 'compass'  },
        herald:   { port: parseInt(process.env.HERALD_PORT  || '8005'), name: 'herald'   },
        verdict:  { port: parseInt(process.env.VERDICT_PORT || '8006'), name: 'verdict'  },
        oracle:   { port: parseInt(process.env.ORACLE_PORT  || '8007'), name: 'oracle'   },
    },
};
