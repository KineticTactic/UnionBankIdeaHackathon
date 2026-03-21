const router = require('express').Router();
const claudeService = require('../services/claudeService');
const demoServerClient = require('../services/demoServerClient');

router.post('/generate', async (req, res, next) => {
    try {
        const { customer_id, channel, analysis_result } = req.body;
        if (!customer_id) return res.status(400).json({ status: 'error', message: 'customer_id is required' });
        if (!analysis_result) return res.status(400).json({ status: 'error', message: 'analysis_result is required' });

        // Stream SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        const snapshot = await demoServerClient.getCustomerById(customer_id);

        await claudeService.generateOutreach(snapshot, analysis_result, channel || 'email', res);
    } catch (error) {
        console.error('[Outreach Route] Error:', error);
        res.write(`data: ${JSON.stringify({ type: 'error', message: 'Internal Server Error streaming outreach' })}\n\n`);
        res.end();
    }
});

module.exports = router;
