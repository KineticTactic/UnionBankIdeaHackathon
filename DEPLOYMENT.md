# PCOP — Deployment Guide

> **What actually needs to deploy:** Two Node.js services only.
> Azure AI endpoint (DeepSeek-V4) is kept for HERALD — everything else runs standalone.

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
| **Azure AI endpoint** | ✅ Keep | — | DeepSeek-V4 for HERALD outreach generation only |
| CHRONOS FastAPI (Python) | ❌ Skip | ~2 GB | Scores are pre-computed — FastAPI not needed for demo |
| PostgreSQL | ❌ Skip | — | `localData.js` replaces the DB entirely |
| Bank API (port 3001) | ❌ Skip | — | `localData.js` is already the fallback |
| Redis | ❌ Skip | — | Not wired into the server |

---

## Options Comparison

| Platform | Frontend | Backend | Cost | Cold start | Setup |
|----------|----------|---------|------|------------|-------|
| **Vercel + Render** | Vercel | Render | Free | 60–90s on first hit | Easy |
| **Railway** | Railway | Railway | $5/mo free credit | None | Easiest |
| **Fly.io** | Fly.io | Fly.io | Free tier (3 VMs) | None | Docker required |
| **Vercel + Koyeb** | Vercel | Koyeb | Free | None | Moderate |

**Recommended for a live hackathon demo:** Railway — no cold starts, GitHub auto-deploy, $5/month free credit is more than enough.

**Recommended for zero-cost:** Vercel + Render — warm up the backend 2 minutes before your demo.

---

## Option A — Railway (Recommended)

Railway is a single platform that can host both services from the same GitHub repo. No Docker needed.

### Step 1 — Create a Railway account

Go to https://railway.app → Sign in with GitHub.
Add a payment method (required but you are charged nothing under $5/month — the demo will use well under that).

### Step 2 — Create a new project

1. Click **New Project**
2. Select **Deploy from GitHub repo**
3. Select `KineticTactic/UnionBankIdeaHackathon`
4. Select branch: **ap1**
5. Railway will ask what to deploy — click **Add Service** instead of letting it auto-detect

### Step 3 — Add the backend service

1. Inside the project, click **+ New** → **GitHub Repo** → select the same repo, branch `ap1`
2. Click on the new service → **Settings** tab
3. Set these fields:

   | Setting | Value |
   |---------|-------|
   | **Root Directory** | *(leave blank — repo root)* |
   | **Build Command** | `cd server && npm install --production` |
   | **Start Command** | `node server/index.js` |
   | **Port** | `8000` |

4. Go to **Variables** tab → add:

   | Key | Value |
   |-----|-------|
   | `PORT` | `8000` |
   | `NODE_ENV` | `production` |
   | `JWT_SECRET` | *(generate below)* |
   | `AZURE_AI_ENDPOINT` | `https://kensara.services.ai.azure.com/models/chat/completions?api-version=2024-05-01-preview` |
   | `AZURE_AI_API_KEY` | *(your Azure AI key from AZURE.txt)* |
   | `AZURE_AI_MODEL` | `DeepSeek-V4-Pro-4` |

   **Generate JWT_SECRET** — run this in PowerShell and copy the output:
   ```powershell
   -join ((65..90)+(97..122)+(48..57) | Get-Random -Count 48 | ForEach-Object {[char]$_})
   ```

5. Click **Deploy**. Wait for it to finish.
6. Click **Settings** → note the **Public URL** (e.g., `https://pcop-server-production.up.railway.app`). This is your `BACKEND_URL`.

### Step 4 — Add the frontend service

1. Click **+ New** → **GitHub Repo** → same repo, branch `ap1`
2. **Settings** tab:

   | Setting | Value |
   |---------|-------|
   | **Root Directory** | `client` |
   | **Build Command** | `npm install && npm run build` |
   | **Start Command** | `npm start` |
   | **Port** | `3000` |

3. **Variables** tab:

   | Key | Value |
   |-----|-------|
   | `NODE_ENV` | `production` |
   | `API_BACKEND_URL` | *(the backend Public URL from Step 3)* |

4. Click **Deploy**.

5. Click the frontend service → **Settings** → copy the **Public URL**. Open it in your browser.

### Step 5 — Verify

Visit the frontend URL → you should see the PCOP landing page → click **Access Demo Platform** → log in with:

| Username | Password |
|----------|----------|
| `admin` | `admin123` |
| `manager` | `manager123` |
| `analyst` | `analyst123` |

The dashboard should load with live data.

### Updating after code changes

Railway auto-deploys whenever you push to `ap1`. Every `git push origin ap1` triggers a rebuild of both services automatically. No manual steps needed.

---

## Option B — Vercel + Render (Fully Free)

### Part 1 — Deploy backend on Render

1. Go to https://render.com → Sign up with GitHub (no credit card needed for free tier)

2. Click **New** → **Web Service**

3. Connect the GitHub repo `KineticTactic/UnionBankIdeaHackathon`, branch `ap1`

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
   | `JWT_SECRET` | *(random string — generate same way as above)* |
   | `AZURE_AI_ENDPOINT` | `https://kensara.services.ai.azure.com/models/chat/completions?api-version=2024-05-01-preview` |
   | `AZURE_AI_API_KEY` | *(your Azure AI key)* |
   | `AZURE_AI_MODEL` | `DeepSeek-V4-Pro-4` |

   > **Note:** Render free tier uses port `10000`, not `8000`. Set `PORT=10000`.

6. Click **Create Web Service**. Wait for deploy (~3 minutes).

7. Copy the service URL (e.g., `https://pcop-server.onrender.com`). This is your `BACKEND_URL`.

8. **Warm-up tip:** The free tier spins down after 15 min inactivity. Before your demo, open `https://pcop-server.onrender.com/auth/login` in a browser to wake it up.

---

### Part 2 — Deploy frontend on Vercel

1. Go to https://vercel.com → Sign up with GitHub (completely free)

2. Click **Add New** → **Project**

3. Import `KineticTactic/UnionBankIdeaHackathon`

4. Configure:

   | Field | Value |
   |-------|-------|
   | **Framework Preset** | Next.js |
   | **Root Directory** | `client` |
   | **Build Command** | *(leave as default: `next build`)* |
   | **Output Directory** | *(leave as default: `.next`)* |
   | **Install Command** | `npm install` |

5. Expand **Environment Variables** and add:

   | Name | Value |
   |------|-------|
   | `API_BACKEND_URL` | *(your Render URL from Part 1)* |
   | `NODE_ENV` | `production` |

6. Click **Deploy**.

7. Once done, Vercel gives you a URL like `https://union-bank-idea-hackathon.vercel.app`. Open it — PCOP landing page should appear.

### Updating after code changes

- **Backend (Render):** Auto-deploys on push to `ap1` — just `git push`.
- **Frontend (Vercel):** Auto-deploys on push to `ap1` — just `git push`.

If you change the backend URL, go to Vercel → Project → Settings → Environment Variables → update `API_BACKEND_URL` → trigger a redeploy.

---

## Option C — Fly.io (Docker, Free Tier)

Good choice if you want Docker-native deploys with no cold starts and 3 free VMs.

### Install flyctl

```powershell
winget install Fly.io.flyctl
fly auth login
```

### Deploy backend

```powershell
# From repo root
fly launch `
  --name pcop-server `
  --dockerfile server/Dockerfile `
  --region sin `
  --no-deploy

# Set secrets
fly secrets set `
  JWT_SECRET="<random>" `
  AZURE_AI_ENDPOINT="https://kensara.services.ai.azure.com/models/chat/completions?api-version=2024-05-01-preview" `
  AZURE_AI_API_KEY="<your-key>" `
  AZURE_AI_MODEL="DeepSeek-V4-Pro-4" `
  --app pcop-server

fly deploy --app pcop-server
```

Note the backend URL: `https://pcop-server.fly.dev`

### Deploy frontend

```powershell
cd client

fly launch `
  --name pcop-client `
  --dockerfile Dockerfile `
  --build-arg API_BACKEND_URL=https://pcop-server.fly.dev `
  --region sin `
  --no-deploy

fly deploy --app pcop-client

cd ..
```

Open `https://pcop-client.fly.dev`.

---

## Environment Variables Reference

### Backend (Express server)

| Variable | Required | Value |
|----------|----------|-------|
| `PORT` | Yes | `8000` (Railway/Fly) or `10000` (Render) |
| `NODE_ENV` | Yes | `production` |
| `JWT_SECRET` | Yes | Any random 32+ character string |
| `AZURE_AI_ENDPOINT` | For HERALD | Azure AI DeepSeek endpoint URL |
| `AZURE_AI_API_KEY` | For HERALD | Azure AI API key |
| `AZURE_AI_MODEL` | For HERALD | `DeepSeek-V4-Pro-4` |
| `CHRONOS_DATA_DIR` | No | Auto-set by Dockerfile to `/app/chronos_data` |

If `AZURE_AI_*` vars are not set, the HERALD outreach generation falls back to a Claude-based summary. Everything else — dashboard, customers, risk scores, signals — works without them.

### Frontend (Next.js)

| Variable | When | Value |
|----------|------|-------|
| `API_BACKEND_URL` | Build time | Full URL of the backend (e.g. `https://pcop-server.up.railway.app`) |
| `NODE_ENV` | Runtime | `production` |

---

## Quick Reference — Demo Credentials

| Username | Password | Role | Access |
|----------|----------|------|--------|
| `admin` | `admin123` | System Administrator | Full platform |
| `manager` | `manager123` | Portfolio Manager | Portfolio + campaigns |
| `analyst` | `analyst123` | Risk Analyst | Analytics + signals |

---

## Troubleshooting

### Dashboard shows all zeros
The frontend cannot reach the backend. Check:
- `API_BACKEND_URL` is set correctly and includes `https://`
- Open the backend URL directly in a browser → you should see `{"status":"error","message":"Route not found"}` (a JSON response, not HTML)

### Login returns "Invalid credentials"
The backend is reachable but auth is broken. Likely cause: `JWT_SECRET` was not set. Verify it exists in your platform's environment variables.

### HERALD outreach generation fails
The Azure AI key or endpoint is wrong. Check `AZURE_AI_API_KEY` and `AZURE_AI_ENDPOINT` in the backend environment. The rest of the platform works without these.

### Render — 503 on first load
The free tier spun down. Wait 90 seconds for the cold start, then try again. Open the backend health URL before your demo to pre-warm it.

### Railway — builds fail with pnpm error (frontend)
Railway may auto-detect pnpm from `pnpm-lock.yaml` in the `client/` directory. If the build fails, add `RAILWAY_NPM_INSTALL_FLAGS=--legacy-peer-deps` or set the install command explicitly to `npm install`.

---

## Local Development (Quick Reference)

```powershell
# Terminal 1 — backend
cd server
node index.js        # runs on http://localhost:8000

# Terminal 2 — frontend
cd client
npm run dev          # runs on http://localhost:3000
```

The frontend proxies all `/api/*` and `/auth/*` calls to `http://localhost:8000` automatically via Next.js rewrites.
