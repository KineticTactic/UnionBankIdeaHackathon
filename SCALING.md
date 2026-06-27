# PCOP Scaling Architecture

## Architecture Diagram

```
                         ┌────────────────────────────────┐
                         │   Load Balancer / Railway      │
                         └──────────────┬─────────────────┘
                                        │
              ┌─────────────────────────┼──────────────────────┐
              ▼                         ▼                       ▼
     ┌────────────────┐       ┌────────────────┐      ┌────────────────┐
     │  Express Node  │       │  Express Node  │      │  Express Node  │
     │  (stateless)   │       │  (stateless)   │      │  (stateless)   │
     └───────┬────────┘       └───────┬────────┘      └───────┬────────┘
             │                        │                        │
             └────────────────────────┼────────────────────────┘
                                      │
              ┌───────────────────────┼───────────────────────┐
              ▼                       ▼                        ▼
     ┌────────────────┐    ┌──────────────────┐    ┌─────────────────┐
     │   PostgreSQL   │    │   Redis 7         │    │  BullMQ Worker  │
     │  (system of    │    │ Pub/Sub + BullMQ  │    │  (HERALD LLM)   │
     │   record)      │    │  event bus        │    └────────┬────────┘
     └────────────────┘    └──────────────────┘             │
                                                            NVIDIA / Azure AI
              ┌────────────────────────────────────────────┐
              │              CHRONOS FastAPI                │
              │  (scoring service — writes to Postgres)     │
              └────────────────────────────────────────────┘
```

## Before vs. After

| Dimension            | Before (demo heap)                         | After (stateless + Postgres/Redis)          |
|----------------------|--------------------------------------------|---------------------------------------------|
| **State location**   | Node.js process heap                        | PostgreSQL (durable) + Redis (ephemeral)    |
| **Replicas**         | 1 only — cannot share in-memory state       | N replicas — all read/write shared Postgres  |
| **Restart behavior** | All simulation state lost                   | Postgres persists; Redis reconnects          |
| **Memory growth**    | Unbounded (signal arrays, outreach log)     | Capped: 500-entry override maps, 20 signals/customer, DB-backed history |
| **LLM calls**        | Blocking in HTTP request path               | Async via BullMQ job queue — returns 202 immediately |
| **SSE fan-out**      | In-process EventEmitter (1 process only)    | Redis Pub/Sub — any node can send to any subscriber |
| **Score authority**  | CHRONOS JSON payload returned per request   | CHRONOS writes to Postgres; Node reads from DB (circuit-break to stale score) |
| **Rate limiting**    | None                                        | 300 req/min global, 20/min login, 10/min LLM |

## Key Bottlenecks Eliminated

1. **Single-process state** — All mutable state moved to Postgres and Redis. Any number of Express replicas can serve requests.
2. **Blocking LLM calls** — POST `/api/outreach/generate` no longer waits for NVIDIA response; it enqueues a BullMQ job and returns `202 {jobId}`. Client polls `GET /api/outreach/job/:jobId`.
3. **In-memory EventEmitter for SSE** — Replaced with Redis Pub/Sub channels (`pcop:events:global`, `pcop:events:{customerId}`). SSE subscribers on any replica receive all events.
4. **Hardcoded localhost** — `CHRONOS_BASE_URL`, `BANK_API_BASE_URL`, `DATABASE_URL`, `REDIS_URL` are all env-var driven. No hardcoded hosts remain.
5. **Unbounded simulation maps** — `_capMap()` in `kafkaService.js` caps override maps at 500 entries; signal arrays cap at 20 per customer.

## Stateless API Tier Claim

**The Express tier is fully stateless.** A request can be handled by any replica:
- Customer data → Postgres (via `pg` connection pool)
- Score overrides → Postgres `scores` table (UPSERT)
- SSE events → Redis Pub/Sub (subscribed per-connection, unsubscribed on close)
- HERALD jobs → BullMQ / Redis queue (any worker picks up any job)
- Session auth → JWT (stateless by design)

Adding replicas requires only pointing a load balancer at additional containers sharing the same `DATABASE_URL` and `REDIS_URL`.

## DEMO_MODE Safety

All Postgres and Redis code is gated on `DEMO_MODE !== 'false'`. The live Railway demo continues to run with in-memory state and no infrastructure dependencies. Setting `DEMO_MODE=false` activates the production path.

## Running the Load Test

```bash
# Install autocannon globally or use npx
npm install -g autocannon

# Start the server in production mode (requires local Postgres + Redis)
DEMO_MODE=false node server/index.js &

# Run the load test (30s, 50 concurrent connections)
node server/scripts/loadtest.js --url http://localhost:8000 --duration 30
```

Target: ≥ 100 req/s at p95 < 200ms on a single Node replica with Postgres and Redis co-located.

## Scaling Runbook

| Lever                         | Action                                                      |
|-------------------------------|-------------------------------------------------------------|
| More throughput               | Add Express replicas (horizontal scale)                     |
| DB read pressure              | Add read replicas; route GET queries to replica URL          |
| Redis throughput              | Redis Cluster or Redis Sentinel                             |
| HERALD LLM backlog            | Add BullMQ worker replicas (`startHeraldWorker()` in new processes) |
| SSE connection count          | Set `MAX_SSE_PER_NODE` and add replicas; sticky sessions not required |
| Scoring latency               | CHRONOS batch scheduler runs every 5 min; on-demand rescore via `/rescore` endpoint |
