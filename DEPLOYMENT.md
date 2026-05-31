# PCOP — Deployment Guide

> **What actually needs to deploy:** Two Node.js services only.
> NVIDIA DeepSeek V4 Pro is used for HERALD — everything else runs standalone.

---

## Stack Reality Check

The full PCOP repo contains 7 layers, Python ML training code, PostgreSQL migrations, and Kafka config.
**None of that is needed to run the demo.** Here is what actually matters at runtime:

| Service | Runtime need | Size | Notes |
|---------|-------------|------|-------|
| **Express backend** | ✅ Required | ~50 MB | All API routes, auth, in-memory data |
| **Next.js frontend** | ✅ Required | ~200 MB build | Dashboard, customer pages, analytics |
| `server/services/localData.js` | ✅ Built-in | — | All 20 customers, signals, portfolio data — no DB needed |
| `chronos/data/*.json` | ✅ Built-in | 43 KB | Pre-computed ML scores, action plans, HERALD content |
| Kafka simulation | ✅ Auto-on | — | Activates when no broker is available — no setup needed |
| **NVIDIA API** | ✅ Keep | — | DeepSeek V4 Pro for HERALD outreach generation only |
| CHRONOS FastAPI (Python) | ❌ Skip | ~2 GB | Scores are pre-computed — FastAPI not needed for demo |
| PostgreSQL | ❌ Skip | — | `localData.js` replaces the DB entirely |
| Bank API (port 3001) | ❌ Skip | — | `localData.js` is already the fallback |
| Redis | ❌ Skip | — | Not wired into the server |

---

## Options Comparison

| Platform | Frontend | Backend | Cost | Cold start | Setup |
|----------|----------|---------|------|------------|-------|
| **Render** | Render | Render | Free | 60–90s on first hit | Easy |
| **Railway** | Railway | Railway | $5/mo free credit | None | Easiest |
| **Fly.io** | Fly.io | Fly.io | Free tier (3 VMs) | None | Docker required |
| **Vercel + Render** | Vercel | Render | Free | 60–90s backend | Moderate |

---

## Option A — Render (Recommended for free tier)

### Part 1 — Deploy backend on Render

1. Go to https://render.com → Sign up with GitHub

2. Click **New** → **Web Service**

3. Connect `KineticTactic/UnionBankIdeaHackathon`, branch **main**

4. Configure:

   | Field | Value |
   |-------|-------|
   | **Name** | `pcop-server` |
   | **Root Directory** | *(leave blank)* |
   | **Environment** | `Node` |
   | **Build Command** | `cd server && npm install --production` |
   | **Start Command** | `node server/index.js` |
   | **Instance Type** | Free |

5. Add environment variables (click **Advanced** → **Add Environment Variable**):

   | Key | Value |
   |-----|-------|
   | `PORT` | `10000` |
   | `NODE_ENV` | `production` |
   | `JWT_SECRET` | *(random 32+ char string)* |
   | `NVIDIA_ENDPOINT` | `https://integrate.api.nvidia.com/v1/chat/completions` |
   | `NVIDIA_API_KEY` | *(your NVIDIA API key)* |
   | `NVIDIA_MODEL` | `deepseek-ai/deepseek-v4-pro` |

   > **Note:** Render free tier uses port `10000`. Set `PORT=10000`.

6. Click **Create Web Service**. Wait for deploy (~3 minutes).

7. Copy the service URL (e.g., `https://pcop-server.onrender.com`). This is your `BACKEND_URL`.

8. **Warm-up tip:** Free tier spins down after 15 min inactivity. Before your demo, open `https://pcop-server.onrender.com/auth/login` in a browser to wake it up.

---

### Part 2 — Deploy frontend on Render

1. Click **New** → **Web Service**

2. Connect the same repo, branch **main**

3. Configure:

   | Field | Value |
   |-------|-------|
   | **Name** | `pcop-client` |
   | **Root Directory** | `client` |
   | **Environment** | `Node` |
   | **Build Command** | `npm install && npm run build` |
   | **Start Command** | `npm start` |
   | **Instance Type** | Free |

4. Add environment variables:

   | Key | Value |
   |-----|-------|
   | `NODE_ENV` | `production` |
   | `API_BACKEND_URL` | *(your backend URL from Part 1)* |

5. Click **Create Web Service**.

6. Once done, open the frontend URL — PCOP landing page should appear.

### Updating after code changes

Both services auto-deploy whenever you push to `main`. Just `git push origin main`.

---

## Option B — Railway

Railway hosts both services from the same repo with no cold starts.

### Step 1 — Backend service

1. Go to https://railway.app → **New Project** → **Deploy from GitHub repo**
2. Select `KineticTactic/UnionBankIdeaHackathon`, branch **main**
3. Add a service → **Settings**:

   | Setting | Value |
   |---------|-------|
   | **Build Command** | `cd server && npm install --production` |
   | **Start Command** | `node server/index.js` |
   | **Port** | `8000` |

4. **Variables** tab:

   | Key | Value |
   |-----|-------|
   | `PORT` | `8000` |
   | `NODE_ENV` | `production` |
   | `JWT_SECRET` | *(random string)* |
   | `NVIDIA_ENDPOINT` | `https://integrate.api.nvidia.com/v1/chat/completions` |
   | `NVIDIA_API_KEY` | *(your NVIDIA API key)* |
   | `NVIDIA_MODEL` | `deepseek-ai/deepseek-v4-pro` |

5. Deploy → note the **Public URL** — this is your `BACKEND_URL`.

### Step 2 — Frontend service

1. Add another service from the same repo, branch **main**
2. **Settings**:

   | Setting | Value |
   |---------|-------|
   | **Root Directory** | `client` |
   | **Build Command** | `npm install && npm run build` |
   | **Start Command** | `npm start` |
   | **Port** | `3000` |

3. **Variables**: `API_BACKEND_URL` = your backend URL from Step 1

4. Deploy.

---

## Environment Variables Reference

### Backend (Express server)

| Variable | Required | Value |
|----------|----------|-------|
| `PORT` | Yes | `8000` (Railway) or `10000` (Render) |
| `NODE_ENV` | Yes | `production` |
| `JWT_SECRET` | Yes | Any random 32+ character string |
| `NVIDIA_ENDPOINT` | For HERALD | `https://integrate.api.nvidia.com/v1/chat/completions` |
| `NVIDIA_API_KEY` | For HERALD | Your NVIDIA API key |
| `NVIDIA_MODEL` | For HERALD | `deepseek-ai/deepseek-v4-pro` |

If `NVIDIA_*` vars are not set, HERALD outreach generation falls back to pre-generated cached content. Everything else — dashboard, customers, risk scores, signals — works without them.

### Frontend (Next.js)

| Variable | When | Value |
|----------|------|-------|
| `API_BACKEND_URL` | Build time | Full URL of the backend |
| `NODE_ENV` | Runtime | `production` |

---

## Quick Reference — Demo Credentials

| Username | Password | Role |
|----------|----------|------|
| `admin` | `admin123` | System Administrator |
| `rm_user` | `rm123` | Relationship Manager |
| `risk_user` | `risk123` | Risk Officer |

---

## Troubleshooting

### Dashboard shows all zeros
Frontend cannot reach the backend. Check `API_BACKEND_URL` is set and includes `https://`.
Open the backend URL in a browser — you should see `{"status":"error","message":"Route not found"}`.

### Login returns "Invalid credentials"
`JWT_SECRET` not set. Verify it exists in your platform's environment variables.

### HERALD outreach generation fails
Check `NVIDIA_API_KEY` and `NVIDIA_ENDPOINT` in the backend environment. The rest of the platform works without these.

### Render — 503 on first load
Free tier cold start. Wait 90 seconds, then try again. Pre-warm by opening the backend URL before your demo.

---

## Local Development

```bash
# Terminal 1 — backend
cd server && node index.js        # http://localhost:8000

# Terminal 2 — frontend
cd client && npm run dev           # http://localhost:3000
```

Frontend proxies all `/api/*` and `/auth/*` calls to `http://localhost:8000` via Next.js rewrites.
