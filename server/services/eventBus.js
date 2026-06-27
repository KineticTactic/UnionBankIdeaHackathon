'use strict';
/**
 * Redis-backed event bus — replaces the in-process EventEmitter in kafkaService.js.
 * Two dedicated ioredis connections: one for publishing, one for subscribing
 * (ioredis requires a dedicated connection in subscriber mode).
 * Enables SSE fan-out across multiple Express replicas.
 */
const Redis  = require('ioredis');
const config = require('../config');

let pub, sub;
const DEMO = config.demoMode;

// In DEMO_MODE keep the in-process EventEmitter fallback so the live demo
// continues working without a Redis instance.
const { EventEmitter } = require('events');
const localBus = new EventEmitter();
localBus.setMaxListeners(200);

const GLOBAL_CHANNEL    = 'pcop:events:global';
const RECENT_KEY        = 'pcop:events:recent';
const customerChannel   = (id) => `pcop:events:customer:${id}`;

// handler registry: channelName → Set<fn>
const _handlers = new Map();

function _initRedis() {
    if (pub) return;
    const opts = { maxRetriesPerRequest: null, lazyConnect: true, enableOfflineQueue: false };
    pub = new Redis(config.redisUrl, opts);
    sub = new Redis(config.redisUrl, opts);

    pub.on('error', (e) => console.error('[eventBus pub ERROR]', e.message));
    sub.on('error', (e) => console.error('[eventBus sub ERROR]', e.message));

    sub.on('message', (channel, message) => {
        try {
            const evt = JSON.parse(message);
            const fns = _handlers.get(channel);
            if (fns) for (const fn of fns) fn(evt);
        } catch (_) {}
    });
}

async function publishEvent(evt) {
    evt.ts = evt.ts || new Date().toISOString();

    if (DEMO) {
        // In-process fan-out for the live demo
        localBus.emit('event', evt);
        return;
    }

    _initRedis();
    const msg = JSON.stringify(evt);
    const promises = [pub.publish(GLOBAL_CHANNEL, msg)];
    if (evt.customerId) promises.push(pub.publish(customerChannel(evt.customerId), msg));
    // Ring buffer: keep last 50 events for status endpoint
    promises.push(
        pub.lpush(RECENT_KEY, msg)
            .then(() => pub.ltrim(RECENT_KEY, 0, 49))
    );
    await Promise.all(promises);
}

async function getRecentEvents(n = 20) {
    if (DEMO) return [];
    _initRedis();
    try {
        const msgs = await pub.lrange(RECENT_KEY, 0, n - 1);
        return msgs.map(m => { try { return JSON.parse(m); } catch { return null; } }).filter(Boolean);
    } catch { return []; }
}

function _subscribe(channel, handler) {
    if (DEMO) {
        localBus.on('event', handler);
        return () => localBus.off('event', handler);
    }
    _initRedis();
    if (!_handlers.has(channel)) {
        _handlers.set(channel, new Set());
        sub.subscribe(channel).catch(e => console.error('[eventBus subscribe ERROR]', e.message));
    }
    _handlers.get(channel).add(handler);
    return () => {
        const fns = _handlers.get(channel);
        if (!fns) return;
        fns.delete(handler);
        if (fns.size === 0) {
            _handlers.delete(channel);
            sub.unsubscribe(channel).catch(() => {});
        }
    };
}

function subscribeGlobal(handler) {
    return _subscribe(GLOBAL_CHANNEL, handler);
}

function subscribeCustomer(customerId, handler) {
    return _subscribe(customerChannel(customerId), handler);
}

async function close() {
    try { if (pub) await pub.quit(); } catch (_) {}
    try { if (sub) await sub.quit(); } catch (_) {}
}

// Expose pub for scoreRepo Redis cache writes
module.exports = { publishEvent, subscribeGlobal, subscribeCustomer, getRecentEvents, close, _pub: null };

// Deferred pub reference for scoreRepo (set after first _initRedis call)
Object.defineProperty(module.exports, '_pub', { get: () => pub });
