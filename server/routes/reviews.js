'use strict';
const path = require('path');
const fs   = require('fs');
const router = require('express').Router();
const { verifyToken, requireRole } = require('../middleware/auth');
const ds = require('../services/dataStore');

// Review queue — persisted to data/reviews.json so the admin portal
// can list/resolve it across server restarts.  In-memory is the
// source of truth during the process lifetime; writes flush to disk
// on every mutation.
const REVIEWS_FILE = path.join(__dirname, '..', 'data', 'reviews.json');

function _load() {
    try { return JSON.parse(fs.readFileSync(REVIEWS_FILE, 'utf8')); }
    catch (e) { return null; }
}
function _save(list) {
    try { fs.writeFileSync(REVIEWS_FILE, JSON.stringify(list, null, 2), 'utf8'); }
    catch (e) { console.error('[reviews] save failed:', e.message); }
}

function _seed() {
    return ds.CUSTOMERS
        .filter(c => ['PRIORITY', 'ESCALATE'].includes(c.risk_tier))
        .slice(0, 10)
        .map((c, i) => ({
            id:          `REV-${String(i + 1).padStart(4, '0')}`,
            customer_id: c.customer_id,
            full_name:   c.full_name,
            risk_tier:   c.risk_tier,
            churn_score: c.churn_score,
            action:      ds.PLANS_MAP[c.customer_id]?.action || 'EMAIL',
            status:      'pending',
            created_at:  new Date(Date.now() - i * 3_600_000).toISOString(),
            reviewed_at: null,
            reviewer:    null,
            notes:       null,
            actionLog:   [],
        }));
}

let reviewQueue = _load();
if (!reviewQueue) {
    reviewQueue = _seed();
    _save(reviewQueue);
}

function _persist() { _save(reviewQueue); }

// GET /api/reviews
router.get('/', verifyToken, (req, res) => {
    const { status } = req.query;
    const list = status ? reviewQueue.filter(r => r.status === status) : reviewQueue;
    res.json({ status: 'ok', reviews: list.map(({ actionLog, ...r }) => r), total: list.length });
});

// GET /api/reviews/stats
router.get('/stats', verifyToken, (req, res) => {
    const pending   = reviewQueue.filter(r => r.status === 'pending').length;
    const approved  = reviewQueue.filter(r => r.status === 'approved').length;
    const rejected  = reviewQueue.filter(r => r.status === 'rejected').length;
    const in_review = reviewQueue.filter(r => r.status === 'in_review').length;
    res.json({ status: 'ok', data: { pending, in_review, approved, rejected, total: reviewQueue.length } });
});

// GET /api/reviews/officers
router.get('/officers', verifyToken, (req, res) => {
    res.json({ status: 'ok', data: [
        { id: 'manager', name: 'Portfolio Manager', role: 'manager' },
        { id: 'admin',   name: 'Administrator',     role: 'admin' },
    ]});
});

// GET /api/reviews/:id
router.get('/:id', verifyToken, async (req, res) => {
    const r = reviewQueue.find(x => x.id === req.params.id);
    if (!r) return res.status(404).json({ status: 'error', message: 'Not found' });
    const snap = await ds.getCustomerSnapshot(r.customer_id);
    const { actionLog, ...review } = r;
    res.json({ status: 'ok', review, snapshot: snap });
});

// POST /api/reviews/:id/approve
router.post('/:id/approve', verifyToken, requireRole(['manager', 'admin']), (req, res) => {
    const r = reviewQueue.find(x => x.id === req.params.id);
    if (!r) return res.status(404).json({ status: 'error', message: 'Not found' });
    r.status      = 'approved';
    r.reviewed_at = new Date().toISOString();
    r.reviewer    = req.user.name;
    r.notes       = req.body.notes || null;
    _persist();
    const { actionLog, ...review } = r;
    res.json({ status: 'ok', review });
});

// POST /api/reviews/:id/reject
router.post('/:id/reject', verifyToken, requireRole(['manager', 'admin']), (req, res) => {
    const r = reviewQueue.find(x => x.id === req.params.id);
    if (!r) return res.status(404).json({ status: 'error', message: 'Not found' });
    r.status      = 'rejected';
    r.reviewed_at = new Date().toISOString();
    r.reviewer    = req.user.name;
    r.notes       = req.body.notes || null;
    _persist();
    const { actionLog, ...review } = r;
    res.json({ status: 'ok', review });
});

// POST /api/reviews/:id/action
router.post('/:id/action', verifyToken, (req, res) => {
    const r = reviewQueue.find(x => x.id === req.params.id);
    if (!r) return res.status(404).json({ status: 'error', message: 'Not found' });
    const { action, comment } = req.body;
    if (action === 'start_review') r.status = 'in_review';
    else if (action === 'escalate') r.status = 'escalated';
    r.actionLog.push({ id: `${r.id}-${Date.now()}`, action, comment: comment || null, timestamp: new Date().toISOString(), actor: req.user?.name || 'system' });
    _persist();
    const { actionLog, ...review } = r;
    res.json({ status: 'ok', review });
});

// ── PATCH /api/reviews/:id/resolve — admin resolve endpoint ────────────────
router.patch('/:id/resolve', verifyToken, requireRole(['admin', 'manager']), (req, res) => {
    const r = reviewQueue.find(x => x.id === req.params.id);
    if (!r) return res.status(404).json({ status: 'error', message: 'Not found' });
    const { outcome, notes, notify_rm } = req.body;
    r.status      = 'resolved';
    r.reviewed_at = new Date().toISOString();
    r.reviewer    = req.user.name;
    r.notes       = notes || r.notes || null;
    if (outcome) r.outcome = outcome;
    r.actionLog.push({
        id: `${r.id}-${Date.now()}`,
        action: 'resolved',
        comment: notes || null,
        timestamp: new Date().toISOString(),
        actor: req.user.name,
    });
    _persist();
    if (notify_rm) console.log(`[Admin] Notifying RM of resolution: ${req.params.id}`);
    const { actionLog, ...review } = r;
    res.json({ status: 'ok', escalation: review });
});

// Export the in-memory queue so the admin route can call helpers
// (e.g. listing without HTTP round-trip).
module.exports = router;
module.exports.getReviewQueue = () => reviewQueue;
module.exports.persistQueue   = _persist;
