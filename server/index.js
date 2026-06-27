'use strict';
const express      = require('express');
const cors         = require('cors');
const config       = require('./config');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────

if (config.demoMode) {
    app.use(require('morgan')('dev'));
} else {
    app.use(require('pino-http')({ level: 'info' }));
}

app.use(cors({
    origin:      config.corsOrigins.includes('*') ? '*' : config.corsOrigins,
    credentials: true,
}));
app.use(express.json());

// ── Rate limiting ─────────────────────────────────────────────────────────────

const rateLimit = require('express-rate-limit');

app.use(rateLimit({
    windowMs: 60_000, max: 300, standardHeaders: true, legacyHeaders: false,
    message: { status: 'error', message: 'Too many requests' },
}));
app.use('/auth/login', rateLimit({
    windowMs: 60_000, max: 20,
    message: { status: 'error', message: 'Too many login attempts' },
}));
// LLM-facing endpoint — capped per authenticated user
app.use('/api/outreach/generate', rateLimit({
    windowMs: 60_000, max: 10,
    keyGenerator: (req) => req.headers['authorization'] || req.ip,
    message: { status: 'error', message: 'LLM rate limit — max 10 generations per minute' },
}));

// ── Routes (mounted before listen so they exist when first request arrives) ───

app.use('/auth',          require('./routes/auth'));
app.use('/api/portfolio', require('./routes/portfolio'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/analysis',  require('./routes/analysis'));
app.use('/api/outreach',  require('./routes/outreach'));
app.use('/api/chronos',   require('./routes/chronos'));
app.use('/api/v2',        require('./routes/v2'));
app.use('/api/kafka',     require('./routes/kafka'));
app.use('/api/reviews',   require('./routes/reviews'));
app.use('/api/rights',    require('./routes/dataRights'));
app.use('/api/explain',    require('./routes/explainability'));
app.use('/api/llm-usage', require('./routes/llmUsage'));

// ── Health endpoints ──────────────────────────────────────────────────────────

app.get('/healthz', (req, res) => res.json({ status: 'ok' }));

app.get('/readyz', async (req, res) => {
    if (config.demoMode) return res.json({ status: 'ready', mode: 'demo' });
    const checks = {};
    try { const { ping } = require('./db/pool'); await ping(); checks.postgres = 'ok'; }
    catch (e) { checks.postgres = e.message; }
    try {
        const eb = require('./services/eventBus');
        if (eb._pub) { await eb._pub.ping(); checks.redis = 'ok'; }
        else checks.redis = 'not_connected';
    } catch (e) { checks.redis = e.message; }
    const ready = Object.values(checks).every(v => v === 'ok');
    res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'not_ready', checks });
});

app.use((req, res) => res.status(404).json({ status: 'error', message: 'Route not found' }));
app.use(errorHandler);

// ── Startup — migration completes BEFORE listen ───────────────────────────────

let _server;

async function start() {
    if (!config.demoMode) {
        const { migrate } = require('./db/migrate');
        await migrate();
    }

    try {
        const { startHeraldWorker } = require('./queue/heraldQueue');
        startHeraldWorker();
    } catch (e) {
        console.warn('[PCOP] HERALD worker unavailable (Redis not configured):', e.message);
    }

    const kafkaService     = require('./services/kafkaService');
    const retentionService = require('./services/retentionService');
    const approvalService  = require('./services/approvalService');

    await kafkaService.init();
    retentionService.scheduleRetentionChecks();
    setInterval(async () => {
        try { await approvalService.expireStaleApprovals(); }
        catch (e) { console.error('[ApprovalExpiry ERROR]', e.message); }
    }, 60 * 60 * 1_000);

    _server = app.listen(config.port, () => {
        console.log(`[PCOP] :${config.port}  demo=${config.demoMode}  cors=${config.corsOrigins}`);
    });
    return _server;
}

// ── Graceful shutdown ─────────────────────────────────────────────────────────

async function shutdown(signal) {
    console.log(`[PCOP] ${signal} — graceful shutdown`);
    if (_server) _server.close();
    try { const { closeHeraldWorker } = require('./queue/heraldQueue'); await closeHeraldWorker(); } catch (_) {}
    try { const { shutdown: ks } = require('./services/kafkaService'); await ks(); } catch (_) {}
    try { const { pool } = require('./db/pool'); await pool.end(); } catch (_) {}
    try { await require('./services/eventBus').close(); } catch (_) {}
    process.exit(0);
}

setTimeout(() => process.exit(1), 10_000).unref(); // backstop if shutdown hangs

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

start().catch(e => { console.error('[PCOP] fatal startup error', e); process.exit(1); });
module.exports = app;
