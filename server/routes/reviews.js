const router = require('express').Router();
const { verifyToken } = require('../middleware/auth');
const reviewStore = require('../services/reviewStore');
const localData = require('../services/localData');

router.get('/', verifyToken, (req, res) => {
    const { status, type, priority, assignedTo, page, limit } = req.query;
    const result = reviewStore.listCases({ status, type, priority, assignedTo, page, limit });
    res.json(result);
});

router.get('/stats', verifyToken, (req, res) => {
    res.json(reviewStore.getStats());
});

router.post('/', verifyToken, (req, res) => {
    const { customer_id, type, priority, title, description, context } = req.body;
    if (!customer_id) {
        return res.status(400).json({ status: 'error', message: 'customer_id is required' });
    }
    const result = reviewStore.createCase({
        customer_id,
        type: type || 'manual',
        priority: priority || 'medium',
        title: title || 'Manual review case',
        description: description || '',
        createdBy: req.user?.username || 'system',
        context: context || {},
    });
    res.status(201).json(result);
});

router.get('/officers', verifyToken, (req, res) => {
    res.json({ status: 'ok', data: reviewStore.OFFICERS });
});

router.get('/:id', verifyToken, (req, res) => {
    const result = reviewStore.getCase(req.params.id);
    if (!result) {
        return res.status(404).json({ status: 'error', message: 'Review case not found' });
    }
    res.json(result);
});

router.patch('/:id/action', verifyToken, (req, res) => {
    const { action, comment } = req.body;
    if (!action) {
        return res.status(400).json({ status: 'error', message: 'action is required' });
    }

    const allowed = ['approve', 'reject', 'escalate', 'comment', 'start_review'];
    if (!allowed.includes(action)) {
        return res.status(400).json({ status: 'error', message: `Invalid action. Must be one of: ${allowed.join(', ')}` });
    }

    const result = reviewStore.takeAction({
        caseId: req.params.id,
        officerId: req.user?.username || null,
        officerName: req.user?.name || req.user?.username || 'Unknown',
        action,
        comment: comment || '',
    });

    if (!result) {
        return res.status(404).json({ status: 'error', message: 'Review case not found' });
    }

    if (action === 'approve') {
        const c = reviewStore.REVIEW_CASES.get(req.params.id);
        if (c?.type === 'outreach_approval') {
            try {
                const kafkaService = require('../services/kafkaService');
                kafkaService.publish('review.action', {
                    type: 'outreach.approved',
                    caseId: req.params.id,
                    customerId: c.customer_id,
                    officer: req.user?.name,
                    timestamp: new Date().toISOString(),
                });
            } catch {}
        }
    }

    res.json(result);
});

router.patch('/:id/assign', verifyToken, (req, res) => {
    const { officerId } = req.body;
    if (!officerId) {
        return res.status(400).json({ status: 'error', message: 'officerId is required' });
    }
    const result = reviewStore.assignCase(req.params.id, officerId);
    if (!result) {
        return res.status(404).json({ status: 'error', message: 'Review case not found' });
    }
    res.json(result);
});

module.exports = router;
