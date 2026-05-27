/**
 * PCOP v2 API routes — serves pre-computed CHRONOS v2 demo data
 * (GraphSAGE + DeepHit Survival + Temporal Transformer + FusionXV2)
 */
const router = require('express').Router();
const { verifyToken } = require('../middleware/auth');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', '..', 'chronos', 'data');

function loadJson(filename) {
    try {
        const fp = path.join(DATA_DIR, filename);
        if (!fs.existsSync(fp)) return null;
        return JSON.parse(fs.readFileSync(fp, 'utf8'));
    } catch {
        return null;
    }
}

// ── lazy-load with caching ──────────────────────────────────────────────────
let _scores = null;
let _plans  = null;
let _content = null;

function scores()  { return _scores  || (_scores  = loadJson('scores_v2.json'))     || []; }
function plans()   { return _plans   || (_plans   = loadJson('action_plans.json'))  || []; }
function content() { return _content || (_content = loadJson('herald_content.json')) || []; }

function scoresMap()  { return Object.fromEntries(scores().map(s => [s.customer_id, s])); }
function plansMap()   { return Object.fromEntries(plans().map(p  => [p.customer_id, p])); }
function contentMap() { return Object.fromEntries(content().map(c => [c.customer_id, c])); }

// ── CHRONOS v2 scores ───────────────────────────────────────────────────────
router.get('/scores', verifyToken, (req, res) => {
    const all = scores();
    const { tier, urgency } = req.query;
    let filtered = all;
    if (tier) filtered = filtered.filter(s => s.risk_tier === tier);
    if (urgency) filtered = filtered.filter(s => s.urgency_horizon === urgency);
    res.json({ status: 'ok', data: filtered, total: filtered.length });
});

router.get('/scores/:customerId', verifyToken, (req, res) => {
    const s = scoresMap()[req.params.customerId];
    if (!s) return res.status(404).json({ status: 'error', message: 'Score not found' });
    res.json({ status: 'ok', data: s });
});

// ── COMPASS action plans ────────────────────────────────────────────────────
router.get('/action-plans', verifyToken, (req, res) => {
    res.json({ status: 'ok', data: plans(), total: plans().length });
});

router.get('/action-plans/:customerId', verifyToken, (req, res) => {
    const p = plansMap()[req.params.customerId];
    if (!p) return res.status(404).json({ status: 'error', message: 'Action plan not found' });
    res.json({ status: 'ok', data: p });
});

// ── HERALD generated content ────────────────────────────────────────────────
router.get('/content', verifyToken, (req, res) => {
    res.json({ status: 'ok', data: content(), total: content().length });
});

router.get('/content/:customerId', verifyToken, (req, res) => {
    const c = contentMap()[req.params.customerId];
    if (!c) return res.status(404).json({ status: 'error', message: 'Content not found' });
    res.json({ status: 'ok', data: c });
});

// ── Model health (real training metrics) ────────────────────────────────────
router.get('/model-health', verifyToken, (req, res) => {
    res.json({
        status: 'ok',
        data: {
            models: [
                {
                    name: 'GraphSAGE Knowledge Graph',
                    version: 'chronos-v2-graph-1.0',
                    status: 'healthy',
                    auc: 0.9300,
                    training_time_s: 25.6,
                    training_samples: 10127,
                    checkpoint: 'graph_sage.pt',
                    last_trained: '2026-05-27T03:00:07Z',
                    description: 'Customer–Product k-NN graph, 2-layer GraphSAGE, Focal BCE loss',
                },
                {
                    name: 'Temporal Transformer TARE',
                    version: 'chronos-v2-transformer-1.0',
                    status: 'healthy',
                    val_loss: 0.0956,
                    epochs: 5,
                    training_time_s: 980,
                    training_samples: 10127,
                    params: 454657,
                    checkpoint: 'transformer_tare_final.pt',
                    last_trained: '2026-05-27T03:16:27Z',
                    description: 'Pre-LN TransformerEncoder, masked action prediction pretraining',
                },
                {
                    name: 'DeepHit Survival',
                    version: 'chronos-v2-deephit-1.0',
                    status: 'healthy',
                    val_loss: 0.0931,
                    num_durations: 90,
                    training_time_s: 109.8,
                    training_samples: 20127,
                    checkpoint: 'deephit_net.pt',
                    last_trained: '2026-05-27T03:23:57Z',
                    description: 'DeepHitSingle, 90 time bins, 360-day horizon, Brier < 0.25',
                    survival_horizons: { '7d': 'P(churn in 7 days)', '30d': 'P(churn in 30 days)', '90d': 'P(churn in 90 days)' },
                },
                {
                    name: 'HABITAT XGBoost',
                    version: 'chronos-v1-habitat-2.1',
                    status: 'healthy',
                    auc: 0.8820,
                    training_samples: 10127,
                    checkpoint: 'habitat_pass1.json',
                    last_trained: '2026-05-27T02:27:20Z',
                    description: '14-feature tabular ensemble, Focal loss, SHAP interpretability',
                },
                {
                    name: 'FusionX v2',
                    version: 'chronos-v2-fusion-1.0',
                    status: 'healthy',
                    weights: { tare: 0.35, habitat: 0.30, graph: 0.20, deephit: 0.15 },
                    method: 'split_conformal_prediction',
                    alpha: 0.10,
                    description: '4-model weighted ensemble with conformal prediction CI (α=0.10)',
                },
            ],
            ensemble: {
                version: 'FusionXV2',
                total_models: 4,
                avg_disagreement: 0.092,
                portfolio_urgency: {
                    '7d':  scores().filter(s => s.urgency_horizon === '7d').length,
                    '30d': scores().filter(s => s.urgency_horizon === '30d').length,
                    '90d': scores().filter(s => s.urgency_horizon === '90d').length,
                    safe:  scores().filter(s => !s.urgency_horizon).length,
                },
                last_calibrated: '2026-05-27T03:24:00Z',
            },
        },
    });
});

// ── Portfolio survival summary ───────────────────────────────────────────────
router.get('/portfolio-survival', verifyToken, (req, res) => {
    const all = scores();
    const byUrgency = { '7d': 0, '30d': 0, '90d': 0, safe: 0 };
    all.forEach(s => { byUrgency[s.urgency_horizon || 'safe']++; });

    const avgSurv7d  = all.reduce((a, s) => a + s.survival_7d,  0) / all.length;
    const avgSurv30d = all.reduce((a, s) => a + s.survival_30d, 0) / all.length;
    const avgSurv90d = all.reduce((a, s) => a + s.survival_90d, 0) / all.length;

    res.json({
        status: 'ok',
        data: {
            total: all.length,
            by_urgency: byUrgency,
            avg_survival_7d:  Math.round(avgSurv7d  * 1000) / 1000,
            avg_survival_30d: Math.round(avgSurv30d * 1000) / 1000,
            avg_survival_90d: Math.round(avgSurv90d * 1000) / 1000,
            avg_disagreement: Math.round(all.reduce((a, s) => a + s.ensemble_disagreement, 0) / all.length * 1000) / 1000,
        },
    });
});

module.exports = router;
