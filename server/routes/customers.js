const router = require('express').Router();
const { verifyToken } = require('../middleware/auth');
const localData = require('../services/localData');
const dataStore = require('../services/dataStore');

router.get('/', verifyToken, (req, res, next) => {
    try {
        const { segment, risk_tier, city, search, page = 1, limit = 20 } = req.query;
        const filters = {};
        if (segment)   filters.segment   = segment;
        if (risk_tier) filters.risk_tier = risk_tier;
        if (city)      filters.city      = city;

        let { data: results } = localData.getCustomers(filters);

        if (search) {
            const q = search.toLowerCase();
            results = results.filter(c =>
                c.full_name.toLowerCase().includes(q) ||
                c.customer_id.toLowerCase().includes(q)
            );
        }

        const total   = results.length;
        const pageNum = parseInt(page);
        const limitNum= parseInt(limit);
        const paginated = results.slice((pageNum - 1) * limitNum, pageNum * limitNum);

        res.json({ status: 'ok', data: paginated, total, page: pageNum, limit: limitNum });
    } catch (e) { next(e); }
});

router.get('/:id', verifyToken, (req, res, next) => {
    try {
        const snapshot = localData.getCustomerById(req.params.id);
        if (!snapshot) {
            return res.status(404).json({ status: 'error', message: 'Customer not found' });
        }
        res.json(snapshot);
    } catch (e) { next(e); }
});

router.get('/:id/signals', verifyToken, (req, res, next) => {
    try {
        const signals = dataStore.SIGNALS.filter(s => s.customer_id === req.params.id);
        res.json({ status: 'ok', data: signals });
    } catch (e) { next(e); }
});

router.get('/:id/transactions', verifyToken, (req, res, next) => {
    try {
        const eventsRaw = localData.getCustomerById(req.params.id);
        if (!eventsRaw) return res.status(404).json({ status: 'error', message: 'Customer not found' });

        const customer   = eventsRaw.data.customer;
        const base = { above_25L: 150000, between_10L_25L: 80000, between_5L_10L: 45000, below_5L: 25000 }[customer.annual_income_band] || 50000;

        const DEBIT_TEMPLATES = [
            { category: 'grocery',      channel: 'upi',        merchants: ['BigBasket', 'Zepto', 'Swiggy Instamart', 'DMart'] },
            { category: 'utility',      channel: 'netbanking',  merchants: ['BSES Delhi', 'Tata Power', 'Jio Postpaid', 'Airtel'] },
            { category: 'food',         channel: 'upi',        merchants: ['Zomato', 'Swiggy', 'Dominos', 'KFC'] },
            { category: 'fuel',         channel: 'pos',        merchants: ['HPCL', 'BPCL', 'Indian Oil', 'Reliance Petrol'] },
            { category: 'emi',          channel: 'nach',       merchants: ['HDFC Bank EMI', 'Home Loan EMI', 'Car Loan EMI'] },
            { category: 'shopping',     channel: 'pos',        merchants: ['Amazon', 'Flipkart', 'Myntra', 'Nykaa'] },
            { category: 'travel',       channel: 'netbanking',  merchants: ['MakeMyTrip', 'IRCTC', 'IndiGo Air', 'OYO Hotels'] },
            { category: 'insurance',    channel: 'nach',       merchants: ['LIC Premium', 'Star Health', 'HDFC Life'] },
            { category: 'entertainment',channel: 'upi',        merchants: ['Netflix', 'Hotstar', 'Spotify', 'BookMyShow'] },
            { category: 'atm',          channel: 'atm',        merchants: ['ATM Withdrawal'] },
        ];

        const txns = [];
        let runningBalance = base * 12;

        for (let i = 60; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            const dom = date.getDate();

            // Salary on 1st of month
            if (dom === 1) {
                const salary = Math.round(base * (1.7 + Math.sin(i) * 0.05));
                runningBalance += salary;
                txns.push({ txn_date: dateStr, direction: 'credit', amount: salary, category: 'salary', channel: 'neft', merchant_name: customer.employer_name || 'Employer', payment_ref: `SAL${date.getFullYear()}${String(date.getMonth()+1).padStart(2,'0')}` });
            }

            // 1-3 debit transactions per day
            const numDebits = Math.floor(1 + Math.abs(Math.sin(i * 7.3)) * 2.5);
            for (let j = 0; j < numDebits; j++) {
                const tmpl = DEBIT_TEMPLATES[Math.floor(Math.abs(Math.sin(i * 3.1 + j * 7.7)) * DEBIT_TEMPLATES.length)];
                const merchant = tmpl.merchants[Math.floor(Math.abs(Math.sin(i * 1.3 + j)) * tmpl.merchants.length)];
                const debitMultiplier = { grocery: 0.03, utility: 0.05, food: 0.02, fuel: 0.04, emi: 0.12, shopping: 0.06, travel: 0.08, insurance: 0.07, entertainment: 0.01, atm: 0.05 }[tmpl.category] || 0.03;
                const amt = Math.round(base * debitMultiplier * (0.7 + Math.abs(Math.sin(i * 2.1 + j)) * 0.6));
                runningBalance -= amt;
                txns.push({ txn_date: dateStr, direction: 'debit', amount: amt, category: tmpl.category, channel: tmpl.channel, merchant_name: merchant, payment_ref: `TXN${dateStr.replace(/-/g,'')}${j}` });
            }

            // Occasional inward transfers
            if (Math.abs(Math.sin(i * 4.9)) > 0.92) {
                const inward = Math.round(base * 0.3 * (0.8 + Math.sin(i) * 0.2));
                runningBalance += inward;
                txns.push({ txn_date: dateStr, direction: 'credit', amount: inward, category: 'transfer', channel: 'imps', merchant_name: 'Inward Transfer', payment_ref: `IMPS${dateStr.replace(/-/g,'')}` });
            }
        }

        // Sort newest first
        txns.sort((a, b) => b.txn_date.localeCompare(a.txn_date));
        res.json({ status: 'ok', data: txns });
    } catch (e) { next(e); }
});

router.get('/:id/insights', verifyToken, (req, res, next) => {
    try {
        const snapshot = localData.getCustomerById(req.params.id);
        if (!snapshot) return res.status(404).json({ status: 'error', message: 'Customer not found' });

        const lifeEvents = dataStore.LIFE_EVENTS.filter(e => e.customer_id === req.params.id);
        res.json({
            status: 'ok',
            data: {
                engagement: snapshot.data.engagement,
                crm: snapshot.data.crm_summary,
                stress: null,
                location: null,
                life_events: lifeEvents,
            },
        });
    } catch (e) { next(e); }
});

module.exports = router;
