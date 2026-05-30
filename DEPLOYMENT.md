# PCOP — Azure Deployment Guide

> Full from-scratch deployment guide for the PCOP banking intelligence platform on Azure Container Apps.
> Tested with the Azure $200 free credit plan. Estimated cost: **$9–15/month**.

---

## What Gets Deployed

| Container | Image | Port | Description |
|-----------|-------|------|-------------|
| `pcop-server` | Express API | 8000 | Backend — all routes, Kafka simulation, pre-computed ML data |
| `pcop-client` | Next.js 16 | 3000 | Frontend — dashboard, customer detail, analytics, signals |

No separate database or Kafka broker needed for the demo. The server uses an in-memory data store and Kafka simulation fallback automatically.

---

## Prerequisites

### 1. Docker Desktop

Download and install from https://www.docker.com/products/docker-desktop

Make sure Docker is running before proceeding (`docker info` should succeed).

### 2. Azure CLI

```powershell
winget install Microsoft.AzureCLI
```

Restart your terminal after installation, then verify:

```powershell
az --version
```

### 3. Log in to Azure

```powershell
az login
```

A browser window opens. Sign in with the account that has your $200 credit. Confirm the right subscription is active:

```powershell
az account show
```

---

## Step 1 — Clone the Repository

```powershell
git clone https://github.com/KineticTactic/UnionBankIdeaHackathon.git
cd UnionBankIdeaHackathon
git checkout ap1
```

---

## Step 2 — Set Your Variables

Run these once at the top of your session. Change `REGISTRY` to something globally unique — lowercase letters and numbers only, no hyphens.

```powershell
$RG       = "pcop-rg"
$LOCATION = "eastus"
$REGISTRY = "pcopregistry2026"    # <-- change this, must be globally unique
$ENV_NAME = "pcop-env"
```

---

## Step 3 — Create Azure Infrastructure

```powershell
# Resource group
az group create --name $RG --location $LOCATION

# Container Registry (Basic tier ≈ $5/month)
az acr create `
  --resource-group $RG `
  --name $REGISTRY `
  --sku Basic `
  --admin-enabled true

# Save the registry server address
$ACR_SERVER = (az acr show --name $REGISTRY --query loginServer -o tsv)
Write-Host "Registry: $ACR_SERVER"

# Log Docker in to your registry
az acr login --name $REGISTRY

# Container Apps environment (the shared compute plane)
az containerapp env create `
  --name $ENV_NAME `
  --resource-group $RG `
  --location $LOCATION
```

---

## Step 4 — Build and Push the Backend Image

> Run from the **repo root** — the Dockerfile needs access to `chronos/data/`.

```powershell
docker build -f server/Dockerfile -t pcop-server:latest .

docker tag  pcop-server:latest "$ACR_SERVER/pcop-server:latest"
docker push                     "$ACR_SERVER/pcop-server:latest"
```

---

## Step 5 — Deploy the Backend Container App

```powershell
# Generate a strong JWT secret and save it — you will need it later
$JWT_SECRET = -join ((65..90) + (97..122) + (48..57) |
    Get-Random -Count 48 |
    ForEach-Object { [char]$_ })
Write-Host "JWT_SECRET: $JWT_SECRET"
# ↑ COPY THIS VALUE SOMEWHERE SAFE

# Registry credentials
$ACR_USER = (az acr credential show --name $REGISTRY --query username           -o tsv)
$ACR_PASS = (az acr credential show --name $REGISTRY --query "passwords[0].value" -o tsv)

# Deploy
az containerapp create `
  --name                pcop-server `
  --resource-group      $RG `
  --environment         $ENV_NAME `
  --image               "$ACR_SERVER/pcop-server:latest" `
  --registry-server     $ACR_SERVER `
  --registry-username   $ACR_USER `
  --registry-password   $ACR_PASS `
  --target-port         8000 `
  --ingress             external `
  --min-replicas        0 `
  --max-replicas        1 `
  --cpu                 0.5 `
  --memory              1Gi `
  --env-vars            "PORT=8000" "JWT_SECRET=$JWT_SECRET" "NODE_ENV=production"

# Capture the backend URL
$BACKEND_FQDN = (az containerapp show `
  --name           pcop-server `
  --resource-group $RG `
  --query "properties.configuration.ingress.fqdn" -o tsv)

$BACKEND_URL = "https://$BACKEND_FQDN"
Write-Host "Backend URL: $BACKEND_URL"
```

### Verify the backend is working

```powershell
Invoke-RestMethod `
  -Uri         "$BACKEND_URL/auth/login" `
  -Method      POST `
  -ContentType "application/json" `
  -Body        '{"username":"admin","password":"admin123"}'
```

Expected response:

```json
{
  "status": "ok",
  "message": "Login successful",
  "token": "eyJ..."
}
```

If you see a token, the backend is live. Continue to Step 6.

---

## Step 6 — Build and Push the Frontend Image

> The backend URL must be baked into the Next.js build so the proxy rewrites point to the right server.

```powershell
cd client

docker build `
  --build-arg API_BACKEND_URL=$BACKEND_URL `
  -t pcop-client:latest .

docker tag  pcop-client:latest "$ACR_SERVER/pcop-client:latest"
docker push                     "$ACR_SERVER/pcop-client:latest"

cd ..
```

---

## Step 7 — Deploy the Frontend Container App

```powershell
az containerapp create `
  --name                pcop-client `
  --resource-group      $RG `
  --environment         $ENV_NAME `
  --image               "$ACR_SERVER/pcop-client:latest" `
  --registry-server     $ACR_SERVER `
  --registry-username   $ACR_USER `
  --registry-password   $ACR_PASS `
  --target-port         3000 `
  --ingress             external `
  --min-replicas        0 `
  --max-replicas        1 `
  --cpu                 0.5 `
  --memory              1Gi `
  --env-vars            "NODE_ENV=production"

# Get the frontend URL
$FRONTEND_FQDN = (az containerapp show `
  --name           pcop-client `
  --resource-group $RG `
  --query "properties.configuration.ingress.fqdn" -o tsv)

Write-Host "Frontend URL: https://$FRONTEND_FQDN"
```

Open `https://<FRONTEND_FQDN>` in your browser. You should see the PCOP landing page.

---

## Demo Credentials

| Username | Password | Role | Access |
|----------|----------|------|--------|
| `admin` | `admin123` | System Administrator | Full platform + model management |
| `manager` | `manager123` | Portfolio Manager | Customer portfolio + campaigns |
| `analyst` | `analyst123` | Risk Analyst | Analytics + signals (read-only) |

---

## Updating After Code Changes

### Backend only

```powershell
docker build -f server/Dockerfile -t pcop-server:latest .
docker tag  pcop-server:latest "$ACR_SERVER/pcop-server:latest"
docker push                     "$ACR_SERVER/pcop-server:latest"

az containerapp update `
  --name           pcop-server `
  --resource-group $RG `
  --image          "$ACR_SERVER/pcop-server:latest"
```

### Frontend only

```powershell
cd client

docker build `
  --build-arg API_BACKEND_URL=$BACKEND_URL `
  -t pcop-client:latest .

docker tag  pcop-client:latest "$ACR_SERVER/pcop-client:latest"
docker push                     "$ACR_SERVER/pcop-client:latest"

az containerapp update `
  --name           pcop-client `
  --resource-group $RG `
  --image          "$ACR_SERVER/pcop-client:latest"

cd ..
```

### Both at once (full redeploy)

```powershell
# 1. Backend
docker build -f server/Dockerfile -t "$ACR_SERVER/pcop-server:latest" .
docker push "$ACR_SERVER/pcop-server:latest"
az containerapp update --name pcop-server --resource-group $RG --image "$ACR_SERVER/pcop-server:latest"

# 2. Frontend
cd client
docker build --build-arg API_BACKEND_URL=$BACKEND_URL -t "$ACR_SERVER/pcop-client:latest" .
docker push "$ACR_SERVER/pcop-client:latest"
az containerapp update --name pcop-client --resource-group $RG --image "$ACR_SERVER/pcop-client:latest"
cd ..
```

---

## Environment Variables Reference

### Backend (`pcop-server`)

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | Yes | Set to `8000` |
| `JWT_SECRET` | Yes | Random string — must match across restarts |
| `NODE_ENV` | Yes | Set to `production` |
| `CHRONOS_DATA_DIR` | Auto-set | Set by Dockerfile to `/app/chronos_data` |
| `KAFKA_BROKERS` | No | Leave unset — simulation mode activates automatically |
| `BANK_API_BASE_URL` | No | Leave unset — local data fallback activates automatically |
| `CHRONOS_API_URL` | No | Leave unset — pre-computed JSON is used instead |

### Frontend (`pcop-client`)

| Variable | When | Description |
|----------|------|-------------|
| `API_BACKEND_URL` | **Build time** | Full HTTPS URL of `pcop-server` — passed as `--build-arg` |
| `NODE_ENV` | Runtime | Set to `production` |

---

## Cost Breakdown

| Resource | Tier | Approx. Monthly Cost |
|----------|------|----------------------|
| Azure Container Registry | Basic | ~$5.00 |
| `pcop-server` Container App | 0.5 vCPU · 1 GB · scales to 0 | ~$2–5 |
| `pcop-client` Container App | 0.5 vCPU · 1 GB · scales to 0 | ~$2–5 |
| **Total** | | **~$9–15 / month** |

**With $200 credit:** 13–22 months of runway.

The `--min-replicas 0` setting means containers scale to zero when idle — you pay nothing when nobody is using the app.

---

## Troubleshooting

### View live logs

```powershell
az containerapp logs show --name pcop-server --resource-group $RG --follow
az containerapp logs show --name pcop-client --resource-group $RG --follow
```

### Backend returns 502 / times out

The container is cold-starting from zero. Wait 15–20 seconds and refresh. This only happens on the first request after a period of inactivity.

### Login returns "Invalid credentials"

The backend is reachable but something is wrong with the auth. Check:

```powershell
# Should list JWT_SECRET and PORT
az containerapp show `
  --name pcop-server `
  --resource-group $RG `
  --query "properties.template.containers[0].env"
```

### Frontend shows blank data / all zeros

The frontend can't reach the backend. Verify:

1. Visit `$BACKEND_URL/auth/login` in a browser — you should see JSON, not an HTML error page
2. Confirm `API_BACKEND_URL` was passed correctly during `docker build`
3. Check if the backend container is running:

```powershell
az containerapp show `
  --name pcop-server `
  --resource-group $RG `
  --query "properties.runningStatus"
```

### Re-check your backend URL after session restart

If you close your terminal, run this to restore `$BACKEND_URL`:

```powershell
$BACKEND_FQDN = (az containerapp show `
  --name pcop-server --resource-group pcop-rg `
  --query "properties.configuration.ingress.fqdn" -o tsv)
$BACKEND_URL = "https://$BACKEND_FQDN"
$ACR_SERVER  = (az acr show --name pcopregistry2026 --query loginServer -o tsv)
Write-Host "Backend : $BACKEND_URL"
Write-Host "Registry: $ACR_SERVER"
```

---

## Tear Down (Stop All Billing)

Delete the entire resource group to remove everything at once:

```powershell
az group delete --name pcop-rg --yes --no-wait
```

This removes the registry, both container apps, and the environment in one command.

---

## Port Map (Local Dev Reference)

| Service | Port | Start command |
|---------|------|---------------|
| Frontend (Next.js) | 3000 | `npm run dev` in `client/` |
| Bank data API | 3001 | `npm run dev` in `bank/` |
| Express API gateway | 8000 | `node index.js` in `server/` |
| CHRONOS FastAPI (ML) | 8001 | `uvicorn api.main:app --port 8001` in `chronos/` |
