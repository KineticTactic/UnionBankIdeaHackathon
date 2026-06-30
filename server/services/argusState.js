'use strict';
/**
 * argusState.js — in-process agent state for the ARGUS signal-detection
 * layer.  ARGUS agents (transaction, recency, salary, sentiment, engagement,
 * stress) are stateful statistical detectors that need their state objects
 * persisted across evaluation calls for the same customer.
 *
 * For the hackathon demo we keep this in process memory; production would
 * back it with Postgres or Redis.  The state is rebuilt from Bank-API data
 * the first time a customer is evaluated, then mutated in place on each
 * subsequent call so the detection methods can detect drift.
 */

const _states = new Map();   // customer_id -> { agent_type -> { state_obj, mu, sigma, ... } }
const MAX_ENTRIES = 5000;

/**
 * Return the persisted agent states for a customer, creating an empty
 * state bag if none exists yet.
 */
function getStates(customerId) {
    if (!_states.has(customerId)) _states.set(customerId, {});
    return _states.get(customerId);
}

function _cap() {
    if (_states.size > MAX_ENTRIES) {
        const first = _states.keys().next().value;
        _states.delete(first);
    }
}

/**
 * Reset a customer's state — useful when the orchestrator wants to
 * force a fresh evaluation after major account change.
 */
function resetStates(customerId) {
    _states.delete(customerId);
}

/**
 * Return aggregate stats (for /api/argus/state-summary admin endpoint).
 */
function getSummary() {
    let totalStates = 0;
    for (const bag of _states.values()) totalStates += Object.keys(bag).length;
    return { customers_tracked: _states.size, total_agent_states: totalStates, cap: MAX_ENTRIES };
}

module.exports = { getStates, resetStates, getSummary, _cap };
