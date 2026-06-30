'use strict';
/**
 * PCOP · Kafka Integration Service
 *
 * Connects to a Kafka broker and consumes banking event streams.
 * Falls back to a deterministic simulation when the broker is unavailable.
 *
 * In DEMO_MODE=false, event handlers write through to Postgres via repositories
 * and publish to Redis Pub/Sub via eventBus, so the API tier holds no
 * customer-scaling state and scales horizontally.
 *
 * In DEMO_MODE=true, the original in-memory path is preserved so the live demo
 * continues to work without Postgres or Redis.
 */

const { Kafka, logLevel } = require('kafkajs');
const dataStore  = require('./dataStore');
const auditLog   = require('./auditLogService');
const eventBus   = require('./eventBus');
const { readJson } = require('../utils/jsonStore');
const config     = require('../config');
const path       = require('path');

const DEMO = config.demoMode;

const ERASURE_FILE = path.join(__dirname, '..', 'data', 'erasureList.json');

function isErased(customerId) {
    try {
        const list = readJson(ERASURE_FILE, []);
        return list.some(e => e.customerId === customerId && e.status !== 'REJECTED');
    } catch { return false; }
}

// ── Configuration ─────────────────────────────────────────────────────────────

const KAFKA_BROKERS   = config.kafkaBrokers;
const KAFKA_CLIENT_ID = process.env.KAFKA_CLIENT_ID || 'pcop-intelligence-server';
const KAFKA_GROUP_ID  = process.env.KAFKA_GROUP_ID  || 'pcop-consumers';

const TOPICS = {
    TRANSACTIONS: 'cbs.transactions',
    ACCOUNTS:     'cbs.account_updates',
    CRM:          'crm.customer_events',
    SIGNALS:      'risk.signal_detections',
    SCORES:       'risk.score_updates',
    ENGAGEMENT:   'engagement.activity',
};

// ── Live state (DEMO_MODE only; prod uses Postgres + Redis) ───────────────────
// Capped at 500 entries each to prevent unbounded memory growth.

const MAX_OVERRIDE_ENTRIES = 500;

const liveState = {
    connected:         false,
    mode:              'initialising',
    brokers:           KAFKA_BROKERS,
    topicsConsumed:    Object.values(TOPICS),
    messagesProcessed: 0,
    lastEventAt:       null,
    recentEvents:      [],   // ring buffer, last 50; in prod mode served from Redis
    scoreOverrides:    {},
    signalOverrides:   {},
    crmOverrides:      {},
    transactionBuffer: {},
    accountOverrides:  {},
};

function _capMap(map) {
    const keys = Object.keys(map);
    if (keys.length > MAX_OVERRIDE_ENTRIES) delete map[keys[0]];
}

// ── Event push ────────────────────────────────────────────────────────────────

function pushEvent(topic, customerId, payload, description) {
    const evt = {
        id:          ++liveState.messagesProcessed,
        topic,
        customerId,
        description,
        payload,
        ts:          new Date().toISOString(),
    };
    liveState.lastEventAt = evt.ts;
    // Ring buffer — kept for getStatus() in DEMO_MODE
    liveState.recentEvents.unshift(evt);
    if (liveState.recentEvents.length > 50) liveState.recentEvents.pop();
    // Fan-out via Redis (or in-process EventEmitter in DEMO_MODE)
    eventBus.publishEvent(evt).catch(e => console.error('[kafkaService] eventBus error:', e.message));
}

// ── Event handlers ────────────────────────────────────────────────────────────

async function handleScoreUpdate({ customer_id, churn_score, risk_tier, model_version, reason }) {
    if (!customer_id) return;

    // DEMO_MODE: update in-memory overrides
    liveState.scoreOverrides[customer_id] = { churn_score, risk_tier, model_version, updated_at: new Date().toISOString() };
    _capMap(liveState.scoreOverrides);
    dataStore.applyScoreOverride(customer_id, { final_score: churn_score, risk_tier });

    if (!DEMO) {
        // PROD_MODE: write through to Postgres
        try {
            const scoreRepo = require('../repositories/scoreRepo');
            await scoreRepo.applyScoreOverride(customer_id, { final_score: churn_score, risk_tier, model_version });
        } catch (e) { console.error('[kafkaService] scoreRepo write error:', e.message); }
    }

    pushEvent(TOPICS.SCORES, customer_id,
        { churn_score, risk_tier, model_version },
        `Retention Risk Index updated → ${Math.round(churn_score * 100)}% (${risk_tier})`
    );
}

async function handleSignalDetection({ customer_id, signal_type, confidence, cusum_value, alarm_threshold, method, evidence }) {
    if (!customer_id) return;
    if (isErased(customer_id)) {
        console.log(`[kafkaService] Signal suppressed for erased customer ${customer_id}`);
        return;
    }

    const sig = { signal_type, confidence, cusum_value, alarm_threshold, method, detected: true, days_active: 1 };

    // DEMO_MODE: update in-memory overrides
    dataStore.applySignalOverride(customer_id, sig);
    if (!liveState.signalOverrides[customer_id]) liveState.signalOverrides[customer_id] = [];
    liveState.signalOverrides[customer_id].push(sig);
    if (liveState.signalOverrides[customer_id].length > 20)
        liveState.signalOverrides[customer_id] = liveState.signalOverrides[customer_id].slice(-20);
    _capMap(liveState.signalOverrides);

    if (!DEMO) {
        // PROD_MODE: persist to Postgres
        try {
            const signalRepo = require('../repositories/signalRepo');
            await signalRepo.insertSignal(customer_id, sig);
        } catch (e) { console.error('[kafkaService] signalRepo write error:', e.message); }
    }

    pushEvent(TOPICS.SIGNALS, customer_id,
        { signal_type, confidence, cusum_value },
        `Signal detected: ${signal_type.replace(/_/g, ' ')} · ${method} · conf ${Math.round(confidence * 100)}%`
    );

    auditLog.logEvent({
        eventType:    'SIGNAL_FIRED',
        customerId:   customer_id,
        actor:        'ARGUS',
        layer:        'ARGUS',
        payload:      { signal_type, confidence, cusum_value, alarm_threshold, method },
        modelVersion: 'ARGUS-v1.0',
    }).catch(err => console.error('[kafkaService] audit log error:', err.message));
}

function handleTransaction({ customer_id, amount, direction, category, channel, merchant_name }) {
    if (!customer_id) return;
    if (!liveState.transactionBuffer[customer_id]) liveState.transactionBuffer[customer_id] = [];
    const txn = { txn_date: new Date().toISOString().split('T')[0], amount, direction, category, channel, merchant_name, payment_ref: `TXN${Date.now()}` };
    liveState.transactionBuffer[customer_id].unshift(txn);
    if (liveState.transactionBuffer[customer_id].length > 30) liveState.transactionBuffer[customer_id].pop();
    _capMap(liveState.transactionBuffer);
    pushEvent(TOPICS.TRANSACTIONS, customer_id, txn,
        `${direction === 'credit' ? '↑ Credit' : '↓ Debit'} ₹${amount.toLocaleString('en-IN')} · ${category} via ${channel}`
    );
}

function handleCrmEvent({ customer_id, note_type, note_text, channel, resolved }) {
    if (!customer_id) return;
    if (!liveState.crmOverrides[customer_id]) liveState.crmOverrides[customer_id] = [];
    const note = { customer_id, note_type, note_text, channel, resolved, created_at: new Date().toISOString() };
    liveState.crmOverrides[customer_id].unshift(note);
    if (liveState.crmOverrides[customer_id].length > 10)
        liveState.crmOverrides[customer_id] = liveState.crmOverrides[customer_id].slice(0, 10);
    _capMap(liveState.crmOverrides);
    pushEvent(TOPICS.CRM, customer_id, note,
        `CRM ${note_type}: "${note_text.slice(0, 60)}${note_text.length > 60 ? '…' : ''}"`
    );
}

function handleAccountUpdate({ customer_id, account_type, balance_delta, status }) {
    if (!customer_id) return;
    liveState.accountOverrides[customer_id] = { account_type, balance_delta, status, updated_at: new Date().toISOString() };
    _capMap(liveState.accountOverrides);
    pushEvent(TOPICS.ACCOUNTS, customer_id,
        { account_type, balance_delta, status },
        `Account update · ${account_type} · balance Δ ₹${balance_delta >= 0 ? '+' : ''}${balance_delta.toLocaleString('en-IN')}`
    );
}

// ── Message router ────────────────────────────────────────────────────────────

function routeMessage(topic, value) {
    try {
        const payload = JSON.parse(value.toString());
        switch (topic) {
            case TOPICS.SCORES:       return handleScoreUpdate(payload);
            case TOPICS.SIGNALS:      return handleSignalDetection(payload);
            case TOPICS.TRANSACTIONS: return handleTransaction(payload);
            case TOPICS.CRM:          return handleCrmEvent(payload);
            case TOPICS.ACCOUNTS:     return handleAccountUpdate(payload);
            case TOPICS.ENGAGEMENT:   return pushEvent(topic, payload.customer_id, payload, `Engagement update: ${payload.event_type || 'activity'}`);
        }
    } catch (_) {}
}

// ── Simulation mode ───────────────────────────────────────────────────────────

const SIM_CUSTOMERS    = dataStore.CUSTOMERS.map(c => c.customer_id);
const SIM_SIGNAL_TYPES = ['transaction_frequency','salary_amount','digital_engagement','complaint_sentiment','stress_overdraft','location_city','lifecycle_mcc'];
const SIM_CATEGORIES   = ['grocery','utility','food','fuel','emi','shopping','travel'];
const SIM_CHANNELS     = ['upi','netbanking','pos','nach','atm'];
const SIM_MERCHANTS    = ['BigBasket','Swiggy','Zomato','BPCL','IRCTC','Flipkart','Amazon','PhonePe'];

let simInterval = null;
let simTick     = 0;

function getRandomItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

async function runSimulationTick() {
    simTick++;
    const id    = getRandomItem(SIM_CUSTOMERS);
    const score = await dataStore.getScore(id);
    const cust  = await dataStore.getCustomerById(id);
    if (!score || !cust) return;

    const roll = simTick % 6;

    if (roll === 0) {
        const delta    = (Math.random() - 0.5) * 0.03;
        const newScore = Math.max(0.05, Math.min(0.98, (score.final_score || score.churn_score || 0.5) + delta));
        let tier = 'NONE';
        if (newScore >= 0.80) tier = 'PRIORITY';
        else if (newScore >= 0.60) tier = 'ESCALATE';
        else if (newScore >= 0.40) tier = 'STANDARD';
        else if (newScore >= 0.20) tier = 'MONITOR';
        await handleScoreUpdate({ customer_id: id, churn_score: +newScore.toFixed(4), risk_tier: tier, model_version: 'FusionXV2-sim', reason: null });

    } else if (roll === 1) {
        const isCredit = Math.random() < 0.25;
        const salary   = Math.round((cust.income || 500000) / 12);
        const amount   = isCredit ? salary : Math.round(500 + Math.random() * 8000);
        handleTransaction({ customer_id: id, amount, direction: isCredit ? 'credit' : 'debit', category: isCredit ? 'salary' : getRandomItem(SIM_CATEGORIES), channel: getRandomItem(SIM_CHANNELS), merchant_name: getRandomItem(SIM_MERCHANTS) });

    } else if (roll === 2 && (score.final_score || 0) > 0.55) {
        const sigType    = getRandomItem(SIM_SIGNAL_TYPES);
        const threshold  = sigType === 'stress_overdraft' ? 2.5 : sigType === 'location_city' ? 3.5 : 3.0;
        const cusumValue = threshold + Math.random() * 2;
        await handleSignalDetection({ customer_id: id, signal_type: sigType, confidence: +(0.65 + Math.random() * 0.3).toFixed(2), cusum_value: +cusumValue.toFixed(2), alarm_threshold: threshold, method: getRandomItem(['CUSUM','BOCPD','SPRT']), evidence: `Simulated drift in ${sigType}` });

    } else if (roll === 3) {
        const delta = Math.round((Math.random() - 0.4) * 15000);
        handleAccountUpdate({ customer_id: id, account_type: getRandomItem(['savings','current','fd']), balance_delta: delta, status: 'active' });

    } else if (roll === 4 && (score.final_score || 0) > 0.60) {
        const complaints = [
            'Customer called about unexpected fee deduction on savings account.',
            'Delay in NEFT transfer processing — customer escalated.',
            'Net banking login issues persisted for 3 days.',
            'Request for interest rate review on personal loan.',
            'Customer reported missing transaction in statement.',
        ];
        handleCrmEvent({ customer_id: id, note_type: 'complaint', note_text: getRandomItem(complaints), channel: getRandomItem(['call','email','branch']), resolved: false });
    }
}

function startSimulation() {
    liveState.mode      = 'simulation';
    liveState.connected = false;
    console.log('[Kafka] Simulation mode active — generating banking events every 8s');
    simInterval = setInterval(() => runSimulationTick().catch(() => {}), 8_000);
    setTimeout(() => runSimulationTick().catch(() => {}), 1_500);
    setTimeout(() => runSimulationTick().catch(() => {}), 3_000);
    setTimeout(() => runSimulationTick().catch(() => {}), 4_500);
}

// ── Kafka consumer ────────────────────────────────────────────────────────────

let kafkaConsumer = null;
let kafkaProducer = null;

async function startKafka() {
    const kafka = new Kafka({
        clientId: KAFKA_CLIENT_ID,
        brokers:  KAFKA_BROKERS,
        logLevel: logLevel.NOTHING,
        retry:    { retries: 2, initialRetryTime: 300 },
        connectionTimeout: 3_000,
        requestTimeout:    5_000,
    });

    kafkaConsumer = kafka.consumer({ groupId: KAFKA_GROUP_ID });
    kafkaProducer = kafka.producer();

    await kafkaConsumer.connect();
    await kafkaProducer.connect();

    for (const topic of Object.values(TOPICS))
        await kafkaConsumer.subscribe({ topic, fromBeginning: false });

    await kafkaConsumer.run({
        eachMessage: async ({ topic, message }) => routeMessage(topic, message.value),
    });

    liveState.connected = true;
    liveState.mode      = 'kafka';
    console.log(`[Kafka] Connected to ${KAFKA_BROKERS.join(', ')} — consuming ${Object.values(TOPICS).length} topics`);
}

// ── Public API ────────────────────────────────────────────────────────────────

async function init() {
    try {
        await startKafka();
    } catch (err) {
        console.log(`[Kafka] Broker unreachable (${KAFKA_BROKERS.join(',')}) — switching to simulation mode`);
        startSimulation();
    }
}

async function publish(topic, key, value) {
    if (!kafkaProducer || liveState.mode !== 'kafka') {
        routeMessage(topic, Buffer.from(JSON.stringify(value)));
        return;
    }
    await kafkaProducer.send({ topic, messages: [{ key, value: JSON.stringify(value) }] });
}

async function shutdown() {
    if (simInterval) clearInterval(simInterval);
    try { await kafkaConsumer?.disconnect(); } catch (_) {}
    try { await kafkaProducer?.disconnect(); } catch (_) {}
}

function getStatus() {
    return {
        mode:              liveState.mode,
        connected:         liveState.connected,
        brokers:           liveState.brokers,
        topicsConsumed:    liveState.topicsConsumed,
        messagesProcessed: liveState.messagesProcessed,
        lastEventAt:       liveState.lastEventAt,
        recentEvents:      liveState.recentEvents.slice(0, 20),
        liveOverrides: {
            scores:       Object.keys(liveState.scoreOverrides).length,
            signals:      Object.keys(liveState.signalOverrides).length,
            transactions: Object.keys(liveState.transactionBuffer).length,
            crm:          Object.keys(liveState.crmOverrides).length,
        },
    };
}

// Live, override-aware accessors used by routes (e.g. portfolio
// /top-at-risk) that need to reflect the most recent Kafka events.
function getLiveScoreOverride(customerId) {
    return liveState.scoreOverrides[customerId] || null;
}

function getLiveSignalCount(customerId) {
    return (liveState.signalOverrides[customerId] || []).length;
}

module.exports = {
    init, publish, shutdown, getStatus, TOPICS,
    getLiveScoreOverride, getLiveSignalCount,
};
