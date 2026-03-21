const router = require('express').Router();
const analysisService = require('../services/analysisService');

router.post('/run', async (req, res, next) => {
    try {
        const { customer_id } = req.body;
        if (!customer_id) {
            return res.status(400).json({ status: 'error', message: 'customer_id is required' });
        }

        const result = await analysisService.runAnalysis(customer_id);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

module.exports = router;
