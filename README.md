# PCOP — UnionBank IdeaHackathon

## Quick start (from fresh clone)

### Prerequisites

- Node.js >= 20, pnpm (`npm install -g pnpm`)
- Docker Desktop (for PostgreSQL, Redis, MLflow)
- Python >= 3.11 with Poetry (`pip install poetry`)

### 1. Bank data server (port 3001)

```bash
cd bank
pnpm install
cp .env.example .env
pnpm dev
```

### 2. Express API gateway (port 8000)

```bash
cd server
pnpm install
# might have to run pnpm approve-builds
cp .env.example .env
# Edit server/.env to contain:
#   PORT=8000
#   BANK_API_BASE_URL=http://localhost:3001
#   JWT_SECRET=change-this-in-production
pnpm dev
```

### 3. Frontend (port 3000)

```bash
cd client
pnpm install
pnpm dev
```

Requires `.npmrc` in `client/` with:

```
onlyBuiltDependencies[]=msw
onlyBuiltDependencies[]=sharp
```

---

## Optional: ML scoring (CHRONOS)

Steps 1–3 give you a fully functional demo with hardcoded customer scores. To enable
live ML scoring (TARE + HABITAT + FusionX), also start these:

### Prerequisites

- Docker Desktop (for PostgreSQL, MLflow)
- Python >= 3.11 with Poetry (`pip install poetry`)

### 4. Docker infrastructure

```bash
cd chronos
cp .env.example .env
docker compose up -d postgres mlflow
```

### 5. CHRONOS FastAPI (port 8001)

```bash
cd chronos
poetry install
eval "$(poetry env activate)"
poetry run alembic upgrade head
uvicorn api.main:app --host 0.0.0.0 --port 8001 --reload
```

### 6. Score customers

```bash
cd chronos
poetry run python -m services.scoring.serving.batch_scorer \
  --bank-api http://localhost:3001 --write-db
```

---

## Port map

| Service             | Port |
| ------------------- | ---- |
| Frontend (Next.js)  | 3000 |
| Bank API            | 3001 |
| Express API gateway | 8000 |
| CHRONOS FastAPI     | 8001 |

## Architecture

```
Browser → Next.js (:3000) → Express (:8000) → CHRONOS FastAPI (:8001)
                                              → Bank API (:3001)
```
