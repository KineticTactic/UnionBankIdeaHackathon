# PCOP — Predictive Customer Outreach Platform

> **Union Bank iDEA 2.0 Hackathon 2026** · Team MoneyLords · Indian Institute of Technology Guwahati

<div align="center">
	<code><img width="50" src="https://raw.githubusercontent.com/marwin1991/profile-technology-icons/refs/heads/main/icons/next_js.png" alt="Next.js" title="Next.js"/></code>
	<code><img width="50" src="https://raw.githubusercontent.com/marwin1991/profile-technology-icons/refs/heads/main/icons/react.png" alt="React" title="React"/></code>
	<code><img width="50" src="https://raw.githubusercontent.com/marwin1991/profile-technology-icons/refs/heads/main/icons/typescript.png" alt="TypeScript" title="TypeScript"/></code>
	<code><img width="50" src="https://raw.githubusercontent.com/marwin1991/profile-technology-icons/refs/heads/main/icons/tailwind_css.png" alt="Tailwind CSS" title="Tailwind CSS"/></code>
	<code><img width="50" src="https://raw.githubusercontent.com/marwin1991/profile-technology-icons/refs/heads/main/icons/node_js.png" alt="Node.js" title="Node.js"/></code>
	<code><img width="50" src="https://raw.githubusercontent.com/marwin1991/profile-technology-icons/refs/heads/main/icons/python.png" alt="Python" title="Python"/></code>
	<code><img width="50" src="https://raw.githubusercontent.com/marwin1991/profile-technology-icons/refs/heads/main/icons/docker.png" alt="Docker" title="Docker"/></code>
	<code><img width="50" src="https://raw.githubusercontent.com/marwin1991/profile-technology-icons/refs/heads/main/icons/kafka.png" alt="Kafka" title="Kafka"/></code>
</div>

---

## Table of Contents

1. [Executive Overview](#1-executive-overview)
2. [Live Demo and Submission Links](#2-live-demo-and-submission-links)
3. [Important — Backend Warm-Up Guide](#3-important--backend-warm-up-guide)
4. [Prototype Status and Scope](#4-prototype-status-and-scope)
5. [Demo Credentials](#5-demo-credentials)
6. [Key Features and Demonstration Workflow](#6-key-features-and-demonstration-workflow)
7. [Groq LLM Integration](#7-groq-llm-integration)
8. [System Architecture (Seven-Layer Blueprint)](#8-system-architecture-seven-layer-blueprint)
9. [Current Technology Stack](#9-current-technology-stack)
10. [Local Development Guide](#10-local-development-guide)
11. [Datasets and Model Performance](#11-datasets-and-model-performance)
12. [Known Limitations and Production Roadmap](#12-known-limitations-and-production-roadmap)
13. [Team and Project Documentation](#13-team-and-project-documentation)

---

## 1. Executive Overview

### The Business Challenge

In retail banking, acquiring a new customer is estimated to cost **5 to 7 times more** than retaining an existing one. Despite this, customer retention programs face significant operational hurdles:

- **Detection Latency:** Traditional batch-scoring churn models run on weekly or monthly cycles, often reporting attrition risk 2 to 7 days after critical behavioral shifts occur. By the time a report reaches a branch, the customer has frequently finalized their switch to a competitor.
- **Signal Blindness:** Surface-level churn indicators (such as a drop in account balance or fewer ATM visits) are reactions rather than root causes. Without context from transaction velocity, digital channel engagement, and customer service grievances, banks cannot diagnose why a customer is disengaging.
- **Generic Outreach Ineffectiveness:** Bulk marketing emails and templated retention messages consistently see engagement rates below 3%, compared to 12–18% for timely, personalized interventions tailored to specific life events or product needs.
- **Operational Choke Points:** Branch Relationship Managers (RMs) lack structured, compliance-checked tools to quickly evaluate risk, compose contextual follow-ups in the customer's preferred language, and log interactions in an auditable trail.

### The PCOP Solution

**PCOP (Predictive Customer Outreach Platform)** is an intelligent retention platform designed for **Union Bank of India**. Built as an integrated decision-support application for Relationship Managers and banking administrators, PCOP closes the gap between risk detection and effective customer engagement:

1. **Continuous Risk Signal Tracking:** Synthesizes multi-stream account activity, digital engagement ratios, and transaction cadence into clear, interpretable risk tiers.
2. **AI-Assisted Customer Insights:** Delivers instant diagnostic summaries explaining *why* a customer is at risk, highlighting key drivers and life events.
3. **Contextual Outreach Composition:** Generates tailored, multi-channel communications (email, SMS, push notifications) using advanced large language models via the Groq API, with automatic multilingual translation across Indian and global languages.
4. **Regulatory & Human-in-the-Loop Governance:** Enforces strict regulatory compliance (DPDPA 2023 purpose limitation, TRAI TCCCPR 2025 consent checks and DND registry validation, and RBI AI Governance 2024 human review before message dispatch).

---

## 2. Live Demo and Submission Links

| Resource | Link / Status | Description |
|---|---|---|
| **Live Application (Frontend)** | [https://pcop-client.onrender.com](https://pcop-client.onrender.com) | Deployed Next.js 16 web application hosted on Render |
| **Backend Health Check** | [https://pcop-server.onrender.com/healthz](https://pcop-server.onrender.com/healthz) | Express REST API gateway health probe on Render |
| **GitHub Repository** | [https://github.com/KineticTactic/UnionBankIdeaHackathon](https://github.com/KineticTactic/UnionBankIdeaHackathon) | Complete project source code and revision history |
| **Demo Video** | `Demo video: to be added` | Final recorded demonstration walkthrough |
| **Technical Walkthrough Notebook** | [Open in Google Colab](https://colab.research.google.com/drive/1tOCU-VWpDs-SW6dNmlDM_rAdbpCsEbit?usp=sharing) | End-to-end data pipeline, modeling, and validation notebook |
| **Architecture Specification** | [ARCHITECTURE.md](file:///Users/kinetic/dev/hackathon/UnionBankIdeaHackathon/ARCHITECTURE.md) | Multi-stage service registry, Pydantic contracts, and schemas |
| **Deployment Guide** | [DEPLOYMENT.md](file:///Users/kinetic/dev/hackathon/UnionBankIdeaHackathon/DEPLOYMENT.md) | Standalone and cloud deployment instructions |
| **Regulatory Compliance Guide** | [COMPLIANCE.md](file:///Users/kinetic/dev/hackathon/UnionBankIdeaHackathon/COMPLIANCE.md) | DPDPA 2023, TRAI 2025, and RBI AI Governance 2024 compliance details |
| **System Scaling Blueprint** | [SCALING.md](file:///Users/kinetic/dev/hackathon/UnionBankIdeaHackathon/SCALING.md) | Scaling roadmap from prototype to 5M+ retail accounts |
| **Terminal Dev Console (TUI)** | [tui/README.md](file:///Users/kinetic/dev/hackathon/UnionBankIdeaHackathon/tui/README.md) | Go Bubbletea terminal operator interface documentation |

---

## 3. Important — Backend Warm-Up Guide

> [!WARNING]
> ### IMPORTANT — WAKE UP THE BACKEND BEFORE OPENING PCOP
>
> Both the frontend and backend are hosted on Render's free tier. The backend service automatically spins down after 15 minutes of inactivity and may take 60 to 90 seconds to wake up.
>
> **Follow this exact sequence before launching the application:**
>
> 1. Open the **[PCOP backend health check](https://pcop-server.onrender.com/healthz)** first.
> 2. Wait until the endpoint finishes waking up and returns the JSON response:
>    ```json
>    {"status":"ok"}
>    ```
> 3. If the endpoint returns a `503`, displays a "Service Unavailable" loading page, or takes several seconds to connect, wait and refresh until the expected health response appears.
> 4. **Only after the backend reports `{"status":"ok"}`, open the [PCOP frontend](https://pcop-client.onrender.com).**
>
> *Opening the frontend before the backend has finished its cold start can result in failed API requests, an empty dashboard, or login credential errors.*

---

## 4. Prototype Status and Scope

To ensure complete transparency for hackathon reviewers and prospective banking stakeholders, the current hosted deployment is classified as a **working prototype and interactive demonstration**, not a live Core Banking System.

Please note the following technical boundaries of the hosted deployment:

- **Synthetic Customer Data:** The hosted application operates on a curated dataset of **50 synthetic retail banking customer records** (`CUST-001` through `CUST-050`). No real customer Personally Identifiable Information (PII) or production bank accounts are used.
- **Precomputed Risk Scoring:** In the lightweight hosted deployment, customer risk scores, survival probabilities, and segment assignments are precomputed and loaded from static snapshots (`server/data/scores.json`). Heavy Python-based ML training and inference microservices (CHRONOS) are not executed live on Render to remain within free-tier container memory constraints.
- **Simulated Event Activity:** Account activity, transaction alerts, and signal updates are driven by an in-memory simulation engine (`/api/kafka/stream` via Server-Sent Events) rather than a live external Apache Kafka cluster.
- **Decoupled Seven-Layer Architecture:** While the repository contains code and specifications for a comprehensive seven-layer architecture (L1 to L7), the hosted demo is powered by two focused services: the Express API server and the Next.js frontend. All required customer, signal, and portfolio states are served directly by the backend gateway.
- **LLM Content Generation & Fallback:** Personalized outreach drafting via Groq's Chat Completions API is active when the server-side `GROQ_API_KEY` is configured. If the key is not set or the external provider is unavailable, HERALD seamlessly falls back to pre-generated, compliant template drafts.
- **Outreach Send Action Reality:** The standard "Approve & Send" action validates DPDPA and TRAI consent rules, logs an immutable audit event, and updates the customer's status in the demo outreach log. **It simulates communication dispatch and does not deliver real external SMS or emails to random numbers.** Where third-party sandbox integrations exist (e.g., Resend for email or Twilio for WhatsApp), dispatches are strictly restricted to verified developer sandbox test addresses.
- **Human-in-the-Loop Operations:** In adherence to RBI AI Governance guidelines, the platform is designed as an interactive decision-support tool. It does **not** autonomously contact customers or alter customer financial records without explicit Relationship Manager review and approval.

---

## 5. Demo Credentials

The hosted application enforces role-based access control (RBAC). Use any of the confirmed demo accounts below on the [Sign In page](https://pcop-client.onrender.com/login):

| Role | Username | Password | Purpose & Accessible Views |
|---|---|---|---|
| **System Administrator** | `admin` | `admin123` | Full platform access, Admin Command Center, Architecture Map, RM Management, Compliance Hub, Audit Reports, and System Settings. |
| **Relationship Manager** | `rm_user` | `rm123` | RM Portal, My Day, My Book, Outreach Composer, Customer 360 profiles, Call Scripts, and Outcome Logs. |
| **Risk Officer** | `risk_user` | `risk123` | Risk analytics, Signal Monitor, ARGUS change detection, Model metrics, and Compliance Audits. |

> [!NOTE]
> *These accounts are demonstration credentials pre-configured in the server authentication store. Do not enter production banking passwords or real credentials.*

---

## 6. Key Features and Demonstration Workflow

The hosted prototype demonstrates an end-to-end retention workflow across several dedicated operational interfaces:

### 1. Relationship Manager Workspace & Portfolio Overview
- **My Day (`/rm/today`):** A prioritized daily agenda for Relationship Managers, highlighting urgent follow-ups, pending customer approvals, and daily outreach targets.
- **Portfolio Overview (`/dashboard`):** At-a-glance portfolio health metrics, attrition risk distribution (CRITICAL, HIGH, MEDIUM, LOW), and real-time activity event feeds.
- **My Book (`/rm/book`):** A searchable, filterable directory of the 50 synthetic customers assigned to the RM, categorized by tenure, risk tier, balance, and segment.

### 2. Customer 360 & AI-Assisted Risk Analysis
- **Customer Profile (`/customers/[id]` and `/rm/customers/[id]`):** In-depth customer view showing financial health, demographic data, product holdings, digital interaction ratios, and recorded life events.
- **Risk Indicators & Supporting Signals (`/signals`):** Granular behavioural triggers detected across customer activity, such as sudden balance depletion, digital inactivity spikes, and complaint escalations.
- **AI-Assisted Analysis Modal (`POST /api/analysis/analyze`):** On-demand diagnostic engine summarizing key churn drivers and providing strategic recommendations for customer retention.

### 3. Five-Step Outreach Composer (`/rm/compose/[id]`)
A structured human-in-the-loop workflow guiding the Relationship Manager from message drafting to dispatch:
1. **Generate Content:** Drafts channel-tailored retention messages (Email, SMS, and Push notification) using Groq LLM (or compliant template fallback).
2. **Translate / Transcreate:** Translates outreach into regional Indian languages (Hindi, Bengali, Tamil, Telugu, Marathi, Gujarati, Kannada, Malayalam, Punjabi, Urdu) or international languages, preserving financial nuance.
3. **Compliance Verification:** Checks customer consent against DPDPA 2023 purpose limitations, TRAI TCCCPR 2025 Digital Consent Acquisition (DCA), and DND registry status before proceeding.
4. **Review & Inline Editing:** Allows the RM to personalize and modify subject lines, body text, or tone before approval.
5. **Approve & Dispatch:** Records human authorization, creates an audit log entry, and simulates delivery across consented channels (with optional Resend/Twilio sandbox dispatches when configured).

### 4. Additional Relationship Manager Views
- **Call Briefing & Script Generator (`/rm/calls`):** Dynamic talking points and objection-handling scripts tailored to customer risk profiles.
- **Follow-up Tasks (`/rm/tasks`):** Workflow queue tracking scheduled check-ins, customer promises, and follow-up deadlines.
- **Outcome Log (`/rm/outcomes`):** Historical record tracking whether past outreach resulted in customer retention, cross-sell conversion, or disengagement.
- **RM Performance Dashboard (`/rm/performance`):** Key performance indicators assessing portfolio retention rates, outreach completion, and customer satisfaction scores.

### 5. Administrator Command Center (`/admin/*`)
- **Command Center (`/admin`):** High-level operational oversight across the customer book, active alerts, and system health.
- **Architecture Topology (`/admin/architecture`):** Visual map tracing data flow across the platform's architectural layers.
- **RM Assignment & Onboarding (`/admin/onboarding`, `/admin/rms`):** Tools for balancing customer portfolio distribution and managing Relationship Manager accounts.
- **Escalations Queue (`/admin/escalations`):** Workflow for reviewing high-risk accounts requiring supervisory intervention.
- **NEXUS Recommendation Engine (`/admin/nexus`):** Force-directed product affinity graph matching customer segments to cross-sell opportunities based on peer adoption and life events.
- **Compliance Hub & Audit Trail (`/admin/compliance`, `/admin/audit`):** Centralized logs verifying consent status, DLT template references, and human review timestamps for regulatory compliance.

---

## 7. Groq LLM Integration

PCOP leverages Groq's high-speed, OpenAI-compatible Chat Completions API to generate contextual retention messages within the HERALD outreach engine (`server/services/llmClient.js`).

### Technical Specifications

- **API Compatibility:** OpenAI-compatible Chat Completions endpoint (`https://api.groq.com/openai/v1/chat/completions`).
- **Default Model:** `openai/gpt-oss-20b` (configured in `server/config.js`).
- **Reasoning Parameter:** `GROQ_REASONING_EFFORT=low` is configured by default for reasoning models, ensuring prompt reasoning tokens do not exhaust the output token budget.
- **Configurable Model Selection:** The active model can be changed without modifying application code by setting the `GROQ_MODEL` environment variable to any supported Groq model (e.g., `llama-3.3-70b-versatile` or `mixtral-8x7b-32768`).
- **Official Documentation:** [https://console.groq.com/docs](https://console.groq.com/docs)

### Operational Reliability & Safety

- **Separation of Concerns:** Groq is utilized strictly for natural language drafting and multilingual translation. **It never computes churn risk scores, alters risk tiers, or determines financial eligibility.**
- **Concurrency & Rate Limiting:** Hardened with a `p-limit` concurrency cap (`GROQ_MAX_CONCURRENCY=5`), client-side token rate limits, and an `AbortController` timeout (`GROQ_TIMEOUT_MS=45000`).
- **Exponential Backoff:** Automatically retries transient errors (`429 Too Many Requests`, `5xx Server Errors`, and network drops) once with exponential backoff, honoring HTTP `Retry-After` response headers.
- **Graceful Fallback:** If `GROQ_API_KEY` is not provided in the environment or the API endpoint becomes unreachable, the platform automatically falls back to rule-based template copy. The core dashboard, customer book, and risk scores remain fully operational.
- **Hosted Environment Note:** In the live Render deployment, Groq generation is active if `GROQ_API_KEY` has been provisioned in Render's environment settings; otherwise, the transparent fallback ensures uninterrupted demonstration capability.

---

## 8. System Architecture (Seven-Layer Blueprint)

The broader PCOP system design organizes banking intelligence into a seven-layer pipeline:

```
 ┌────────────────────────────────────────────────────────────────────────┐
 │  Layer 1 · Bank Data Ingestion (bank/)                                 │
 │  Ingests CBS account balances, transaction logs, and CRM records.      │
 └──────────────────────────────────┬─────────────────────────────────────┘
                                    ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │  Layer 2 · ARGUS — Statistical Change Detection (L2_ARGUS/)            │
 │  Multi-stream detectors (CUSUM, BOCPD, SPRT) with BH-FDR false-alarm   │
 │  control to spot early behavioral deviations.                          │
 └──────────────────────────────────┬─────────────────────────────────────┘
                                    ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │  Layer 3 · CHRONOS — Multi-Model Risk Engine (L3_CHRONOS/)             │
 │  Ensemble combining XGBoost (HABITAT), GRU sequence models (TARE),     │
 │  GraphSAGE network graph, and DeepHit survival modeling.               │
 └──────────────────────────────────┬─────────────────────────────────────┘
                                    ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │  Layer 4 · COMPASS — Action Intelligence & Decisioning (L4_COMPASS/)   │
 │  Agentic next-best-action decisioning mapping risk to retention offers.│
 └──────────────────────────────────┬─────────────────────────────────────┘
                                    ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │  Layer 5 · HERALD — Multichannel Outreach Engine (L5_HERALD/)          │
 │  Groq LLM-powered personalized messaging across Email, SMS, and Push.  │
 └──────────────────────────────────┬─────────────────────────────────────┘
                                    ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │  Layer 6 · VERDICT — Causal Uplift & Measurement (L6_VERDICT/)         │
 │  Doubly-robust causal estimation measuring incremental retention ROI.  │
 └──────────────────────────────────┬─────────────────────────────────────┘
                                    ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │  Layer 7 · ORACLE — Governance & Retraining (L7_ORACLE/)               │
 │  Continuous model drift monitoring, feedback loops, and audit trails.  │
 └────────────────────────────────────────────────────────────────────────┘
```

> **Design vs. Hosted Scope:** In production, each layer can operate as an independent containerized microservice connected via Apache Kafka. In the **hosted Render demonstration**, the essential functionality of Layers 1–5 is integrated directly into the Node.js Express server (`server/`) and Next.js frontend (`client/`), serving precomputed scores and simulated events without requiring heavy distributed infrastructure.

---

## 9. Current Technology Stack

| Component | Technology | Role in Platform |
|---|---|---|
| **Frontend Framework** | Next.js 16.2 (App Router) · React 19 · TypeScript 5 | Responsive operator console, Customer 360, Outreach Composer |
| **Styling & Components** | Tailwind CSS · shadcn/ui · Lucide React | Banking UI design system, accessible components |
| **Data Visualization** | Recharts v3 | Portfolio risk distribution, churn trend curves, score gauges |
| **API Gateway / Backend**| Node.js 20 · Express 5 · REST | API routing, JWT authentication, rate limiting, data stores |
| **Event Streaming** | Server-Sent Events (SSE) · KafkaJS | Real-time simulation feed delivering live customer activity |
| **LLM & Outreach** | Groq Chat Completions API (`openai/gpt-oss-20b`) | Personalized content generation and multilingual translation |
| **Cloud Hosting** | Render (Free Tier Web Services) | Containerized live deployment for `pcop-client` and `pcop-server` |
| **Operator Console** | Go 1.22+ · Bubbletea · Lipgloss | High-throughput terminal dashboard (Dev Console) |
| **ML Engineering (Local)**| Python 3.11 · PyTorch · XGBoost · ONNX Runtime · PyG | Model training, GraphSAGE embeddings, DeepHit survival analysis |
| **Reference Infra** | PostgreSQL 16 · Redis 7 · Apache Kafka · MLflow | Full-scale enterprise backend infrastructure (Docker Compose) |

---

## 10. Local Development Guide

Developers can run PCOP locally in either a lightweight hosted-equivalent mode or the full multi-service architecture.

### Mode A: Lightweight Local Demo (Recommended)

Requires only **Node.js 20+** and **npm**. Runs the identical lightweight setup deployed on Render (no Docker, Python, or external databases required).

#### Terminal 1: Backend API Gateway
```bash
cd server
npm install
node index.js
```
*The server boots on `http://localhost:8000` with synthetic data and in-memory event simulation active.*

#### Terminal 2: Next.js Frontend
```bash
cd client
npm install
npm run dev
```
*The web interface boots on `http://localhost:3000`. Next.js automatically proxies API calls to `http://localhost:8000`.*

Open your browser to `http://localhost:3000` and sign in using `admin` / `admin123`.

---

### Mode B: Full Multi-Service & Machine Learning Stack

For contributors developing the Python ML models or running the complete seven-layer microservice pipeline.

#### Prerequisites
- **Node.js:** v20+
- **Python:** v3.11+ with Poetry
- **Go:** v1.22+ (for the Bubbletea TUI console)
- **Docker & Docker Compose:** for PostgreSQL, Redis, Kafka, and MLflow

#### 1. Start Infrastructure Dependencies
```bash
cp .env.example .env
docker compose up -d
```
*Starts PostgreSQL (`5432`), Redis (`6379`), Kafka (`9092`), and MLflow (`5000`).*

#### 2. Option 1: Launch via the Bubbletea Dev Console (Go)
The unified terminal console starts all microservices and displays live, color-coded process logs:
```bash
cd tui
go run .
```

#### 3. Option 2: Launch Microservices Manually
```bash
# Bank Demo Data Server (port 3001)
cd bank && npm install && npm run dev &

# Express API Gateway (port 8000)
cd server && npm install && node index.js &

# CHRONOS FastAPI Scoring Service (port 8001)
cd L3_CHRONOS && poetry install && poetry run uvicorn api.main:app --port 8001 &

# ARGUS Signal Detection Service (port 8002)
cd L2_ARGUS && PYTHONPATH=. uvicorn services.api.main:app --port 8002 &

# Frontend Web Client (port 3000)
cd client && npm install && npm run dev
```

#### 4. Run the Pipeline Validation Test
```bash
python3 scripts/e2e_test.py --limit 5
```
*Executes an end-to-end trace through Bank → ARGUS → CHRONOS → COMPASS → HERALD → VERDICT → ORACLE.*

#### 5. Simulate Live Event Activity
```bash
# Generate a burst of 50 simulated banking events
python3 scripts/simulate_events.py --burst 50

# Simulate a cascade of high-risk churn signals on customer CUST-001
python3 scripts/simulate_events.py --scenario critical_cascade --customer CUST-001
```

---

## 11. Datasets and Model Performance

All evaluations were conducted during development on **synthetic datasets and public banking benchmarks**. No confidential customer PII was used.

### Datasets Used for Exploration & Training

| Dataset | Source / Volume | Purpose in System |
|---|---|---|
| **Demo Customer Book** | `server/data/customers.json` (50 records) | Synthetic customer records (`CUST-001`–`CUST-050`) for the hosted prototype |
| **Bank Customer Churn** | Kaggle benchmark (10,000 records) | Baseline tabular training for HABITAT (XGBoost) and GENESIS (Logistic Regression) |
| **UCI Bank Marketing** | UCI ML Repository (45,000 records) | Cold-start feature calibration and engagement priors |
| **MBD-mini Dataset** | HuggingFace (50,000 records) | Sequence encoder pre-training for TARE temporal models |
| **Synthetic Action Sequences** | Derived from BankChurners (10,000 sequences) | Behavioral transition and sequence modeling |
| **Synthetic Survival Cohort** | Generated via `generate_demo_data.py` (20,000 records) | DeepHit multi-horizon survival analytics |
| **Customer-Product Graph** | Constructed synthetic graph (10,127 nodes) | GraphSAGE relational network embedding evaluations |

### Offline Model Validation Metrics

The following metrics represent offline experimental results achieved on benchmark hold-out sets during model training:

| Model Component | Architecture / Algorithm | Evaluation Metric | Hold-out Metric Value |
|---|---|---|---|
| **GraphSAGE** | Graph Neural Network (2-layer inductive) | Area Under ROC Curve (AUC) | **0.93** (10K-node synthetic graph) |
| **HABITAT** | Gradient-boosted trees (XGBoost) | Area Under ROC Curve (AUC) | **0.88** (BankChurners test split) |
| **DeepHit** | Multi-horizon survival analysis | Brier Score | **< 0.25** (synthetic survival set) |
| **TARE** | Gated Recurrent Unit (GRU sequence encoder)| Validation Loss | **0.0956** |
| **FusionXV2** | Conformal ensemble meta-learner | Expected Calibration Error (ECE) | **0.032** |
| **WARDEN** | Benjamini-Hochberg FDR control (α = 0.05) | Family-Wise Error Rate (FWER) | Reduced from **37%** naive to **5%** |

---

## 12. Known Limitations and Production Roadmap

As a hackathon prototype, PCOP currently exhibits known boundaries that inform its future production deployment roadmap:

1. **Synthetic Data Boundaries:** All customer financial profiles, credit cards, and KYC fields are synthetic. Deployment within Union Bank will require integration with production Finacle CBS instances and data pipelines under enterprise security review.
2. **Precomputed vs. Real-Time Inference:** The hosted demonstration relies on cached model outputs. In full production, CHRONOS scoring models would run as distributed inference microservices backed by GPU acceleration or ONNX Runtime clusters.
3. **Event Stream Simulation:** The live feed in the prototype uses an in-memory event simulation. Enterprise rollout requires connection to an enterprise-grade Apache Kafka or Confluent cluster with automated schema registry enforcement.
4. **Outreach Dispatch Sandboxing:** Production deployment requires formal integration with bank-approved, TRAI-compliant Distributed Ledger Technology (DLT) telecom gateways for commercial SMS/WhatsApp dispatch, and secure SMTP relays for customer email delivery.
5. **Graph Embeddings at Scale:** Scaling GraphSAGE to millions of customer nodes will require a distributed vector database (such as Milvus or Pinecone) and periodic batch graph re-indexing as outlined in [SCALING.md](file:///Users/kinetic/dev/hackathon/UnionBankIdeaHackathon/SCALING.md).

---

## 13. Team and Project Documentation

### Team MoneyLords — Indian Institute of Technology Guwahati

- **Isam Ahammed** · Statistical Signal Detection & Machine Learning (L2 ARGUS, L3 CHRONOS)
- **Atrijo Pal** · Agentic Orchestration, Outreach & Causal Measurement (L4 COMPASS, L5 HERALD, L6 VERDICT, L7 ORACLE)
- **Rudrajeet Pal** · Full-Stack Web Architecture, REST Gateway & Developer Console (Server, Client, TUI)

### Submission Details
- **Hackathon:** Union Bank iDEA 2.0 Hackathon 2026
- **Problem Statement:** #4 — Predictive Customer Outreach & Retention

### Repository Documentation Index
- [ARCHITECTURE.md](file:///Users/kinetic/dev/hackathon/UnionBankIdeaHackathon/ARCHITECTURE.md) — Comprehensive technical design, layer specifications, and inter-service schemas.
- [DEPLOYMENT.md](file:///Users/kinetic/dev/hackathon/UnionBankIdeaHackathon/DEPLOYMENT.md) — Detailed instructions for deploying to cloud environments (Render, Railway, Fly.io).
- [COMPLIANCE.md](file:///Users/kinetic/dev/hackathon/UnionBankIdeaHackathon/COMPLIANCE.md) — Exhaustive mapping of DPDPA 2023, TRAI TCCCPR 2025, and RBI AI Governance 2024 compliance controls.
- [SCALING.md](file:///Users/kinetic/dev/hackathon/UnionBankIdeaHackathon/SCALING.md) — Capacity planning and architecture roadmap for scaling to 5,000,000+ retail customers.
- [tui/README.md](file:///Users/kinetic/dev/hackathon/UnionBankIdeaHackathon/tui/README.md) — User guide for the Go Bubbletea terminal-based developer and operations console.
