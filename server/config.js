'use strict';
require('dotenv').config();

module.exports = {
    port:            parseInt(process.env.PORT || '8000'),
    jwtSecret:       process.env.JWT_SECRET || 'pcop-hackathon-2026-secret',
    jwtExpiresIn:    process.env.JWT_EXPIRES_IN || '8h',

    // true by default — live demo stays on JSON/simulation; flip to false for Postgres/Redis
    demoMode: process.env.DEMO_MODE !== 'false',

    databaseUrl: process.env.DATABASE_URL || 'postgresql://pcop:pcop_dev@localhost:5432/pcop',
    redisUrl:    process.env.REDIS_URL    || 'redis://localhost:6379',

    bankApiBaseUrl: process.env.BANK_API_BASE_URL || 'http://localhost:3001',
    chronosBaseUrl: process.env.CHRONOS_BASE_URL  || 'http://localhost:8001',
    kafkaBrokers:  (process.env.KAFKA_BROKERS     || 'localhost:9092').split(','),

    nvidia: {
        endpoint:       process.env.NVIDIA_ENDPOINT      || 'https://integrate.api.nvidia.com/v1/chat/completions',
        apiKey:         process.env.NVIDIA_API_KEY        || '',
        model:          process.env.NVIDIA_MODEL          || 'deepseek-ai/deepseek-v4-pro',
        timeoutMs:      parseInt(process.env.NVIDIA_TIMEOUT_MS      || '15000'),
        maxConcurrency: parseInt(process.env.NVIDIA_MAX_CONCURRENCY || '5'),
    },

    corsOrigins:   (process.env.CORS_ORIGINS    || '*').split(','),
    maxSsePerNode:  parseInt(process.env.MAX_SSE_PER_NODE || '1000'),

    // Legacy — kept for any remaining references
    anthropicApiKey:   process.env.ANTHROPIC_API_KEY   || '',
    claudeModel:       process.env.CLAUDE_MODEL        || 'claude-3-sonnet-20240229',
    useClaudeFallback: process.env.USE_CLAUDE_FALLBACK === 'true',
};
