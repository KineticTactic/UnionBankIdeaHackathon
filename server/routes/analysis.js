const router = require('express').Router();
const { verifyToken } = require('../middleware/auth');
const dataStore = require('../services/dataStore');

router.get('/dashboard', verifyToken, (req, res) => {
    const { DASHBOARD_DATA } = dataStore;
    res.json({
        status: 'ok',
        data: DASHBOARD_DATA
    });
});

router.get('/warnings', verifyToken, (req, res) => {
    const { WARNINGS } = dataStore;
    res.json({
        status: 'ok',
        data: WARNINGS.slice(0, 50)
    });
});

module.exports = router;
