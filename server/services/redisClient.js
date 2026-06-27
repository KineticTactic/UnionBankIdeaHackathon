'use strict';
/**
 * Singleton ioredis client for one-off commands (keys, get, mget, incr).
 * eventBus.js keeps its own pub/sub connections; this is for command-only use.
 */
const Redis  = require('ioredis');
const config = require('../config');

let _client = null;

function getClient() {
    if (!_client) {
        _client = new Redis(config.redisUrl, {
            maxRetriesPerRequest: 3,
            lazyConnect: true,
            enableOfflineQueue: false,
        });
        _client.on('error', (e) => console.warn('[redisClient ERROR]', e.message));
    }
    return _client;
}

module.exports = { getClient };
