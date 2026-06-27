/**
 * jsonStore.js — safe concurrent JSON file read/write utility.
 * Uses a per-file write queue (single-writer pattern) to prevent race
 * conditions when multiple async requests mutate compliance data files.
 */

const fs   = require('fs');
const path = require('path');

// Per-file write queues: filePath → { queue: [fn], processing: bool }
const queues = new Map();

function getQueue(filePath) {
    if (!queues.has(filePath)) queues.set(filePath, { queue: [], processing: false });
    return queues.get(filePath);
}

function processQueue(filePath) {
    const q = getQueue(filePath);
    if (q.processing || q.queue.length === 0) return;
    q.processing = true;
    const next = q.queue.shift();
    Promise.resolve()
        .then(() => next())
        .catch(err => console.error(`[jsonStore ERROR] write failed for ${filePath}:`, err))
        .finally(() => {
            q.processing = false;
            processQueue(filePath);
        });
}

function enqueue(filePath, fn) {
    return new Promise((resolve, reject) => {
        const q = getQueue(filePath);
        q.queue.push(async () => {
            try { resolve(await fn()); }
            catch (err) { reject(err); }
        });
        processQueue(filePath);
    });
}

// Ensure directory exists before writing
function ensureDir(filePath) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/** Read JSON file. Returns defaultValue if file does not exist. */
function readJson(filePath, defaultValue = null) {
    try {
        if (!fs.existsSync(filePath)) return defaultValue;
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (err) {
        console.error(`[jsonStore ERROR] readJson failed for ${filePath}:`, err.message);
        return defaultValue;
    }
}

/** Write data as JSON to filePath. Queued to prevent concurrent write corruption. */
function writeJson(filePath, data) {
    return enqueue(filePath, () => {
        ensureDir(filePath);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    });
}

/** Append a single item to a JSON array file. Creates file if absent. */
function appendToJson(filePath, item) {
    return enqueue(filePath, () => {
        ensureDir(filePath);
        const arr = readJson(filePath, []);
        arr.push(item);
        fs.writeFileSync(filePath, JSON.stringify(arr, null, 2), 'utf8');
    });
}

module.exports = { readJson, writeJson, appendToJson };
