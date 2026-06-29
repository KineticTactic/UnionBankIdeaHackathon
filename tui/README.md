# PCOP Dev Console — Bubbletea TUI

A single-binary TUI that runs and monitors the entire PCOP stack: every
microservice, every Docker dependency, the in-process scheduler, and a
full command palette with 27 pre-configured operations.

```
┌─ PCOP Dev Console ────────── [1] Dashboard  [2] Scheduler  [3] Commands ─┐
│ APP SERVICES            STATUS SUMMARY                                    │
│ ● orchestrator :8000   running=4 healthy=4 starting=0 crashed=0 total=9   │
│ ● bank         :3001                                                       │
│ ● chronos      :8001                                                       │
│ ● argus        :8002                                                       │
│ ...                                                                       │
│ ──────────────────────────────────────────────────────────────────────── │
│ LOGS   [All] [orchestrator] [chronos] [argus] ...                        │
│ 14:22:01 orchestrator  → started in ./server: node index.js              │
│ 14:22:03 chronos       → CHRONOS scheduler started with 11 jobs          │
│ ...                                                                       │
│ > /                                                                       │
└───────────────────────────────────────────────────────────────────────────┘
```

## Pages

| Key | Page         | What it does                                                            |
|----|--------------|-------------------------------------------------------------------------|
| `1` | **Dashboard** | Service status grid, color-coded log panel, `/` command input.        |
| `2` | **Scheduler** | Every cron-scheduled task, last-run history (SQLite), re-run.         |
| `3` | **Commands**  | Searchable command palette. 27 operations across all layers.         |

## Quick start

```bash
# from the repo root
cp .env.example .env

# Option A: bring up everything via Docker (postgres/redis/kafka/mlflow)
docker compose up -d postgres redis kafka mlflow

# Option B: run services directly without the docker stack
cd tui && go run . --no-start   # don't auto-spawn (manual start in other tabs)

# Most common: full auto-mode
cd tui && go run .
```

The TUI auto-detects the repo root (walks up looking for `docker-compose.yml`),
loads `tui/config/services.yaml`, spawns every app service, starts the
background health poller, imports any recent Docker logs, and shows the
dashboard.

## Key bindings

### Dashboard
| Key           | Action |
|---------------|--------|
| `1` `2` `3`   | Switch page |
| `←` `→`       | Switch log filter tab |
| `1`–`9`       | Jump directly to tab N |
| `↑` `↓` `PgUp` `PgDn` | Scroll logs |
| `/`           | Focus command input — type a registered command (e.g. `/chronos train`) |
| `q` `Ctrl+C`  | Quit (graceful shutdown of all child processes) |

### Scheduler
| Key           | Action |
|---------------|--------|
| `↑` `↓`       | Select task |
| `r`           | Re-run the selected task now (history is recorded) |
| `l`           | View the last run's captured output |

### Commands
| Key           | Action |
|---------------|--------|
| `/`           | Focus filter input |
| `↑` `↓`       | Navigate the filtered list |
| `Enter`       | Run the highlighted command (output streams below) |

## Adding a service

Edit `tui/config/services.yaml`. The TUI parses it on every startup.

```yaml
app_services:
  - name: my-new-service
    color: "#FF6B6B"
    dir: ./my-new-service
    start_cmd: "uvicorn main:app --host 0.0.0.0 --port 9000"
    health_url: http://localhost:9000/health
    port: 9000
    kind: python
    description: "One-liner about the service"
```

The service appears on the dashboard immediately, with its own colored
log channel, tab, and color.

## Adding a command

```yaml
commands:
  - name: "my training script"
    description: "Train the foo model"
    service: my-new-service
    cmd: "python3 train.py --epochs 10"
    dir: ./my-new-service
```

The command is now available in:
- the Commands page (filterable list)
- the Dashboard's `/` input (`/my training script`)
- the Scheduler (referenced by `command_ref`)

## Adding a scheduled task

```yaml
scheduled_tasks:
  - name: "my training"
    command_ref: "my training script"
    schedule: "0 2 * * *"
    enabled: true
    description: "Daily at 02:00 UTC"
```

The cron expression uses the standard 5-field format.  Task history is
persisted to `tui/data/task_history.db` (SQLite, pure Go via
`modernc.org/sqlite`).

## Architecture

```
tui/
├── main.go                  # entry point
├── go.mod                   # module: tui
├── config/
│   └── services.yaml        # service + command + schedule registry
├── internal/
│   ├── app/app.go           # top-level bubbletea model, page routing
│   ├── pages/
│   │   ├── dashboard.go     # default page (key 1)
│   │   ├── scheduler.go     # page 2
│   │   └── commands.go      # page 3
│   ├── services/
│   │   ├── manager.go       # process lifecycle + health polling
│   │   ├── docker.go        # docker inspect / logs / compose up
│   │   ├── runner.go        # subprocess + log broker
│   │   └── history.go       # SQLite task history
│   ├── config/config.go     # YAML loader
│   └── styles/colors.go     # lipgloss color palette
└── data/
    └── task_history.db      # created on first run
```

## Design notes

- **No precomputed data.** Every pipeline run uses live data from the
  Bank API (`http://localhost:3001`) — the dashboard logs every health
  probe in real time, and the e2e test script refuses to run if any
  stage returns a mock-shaped response.
- **All services are children of the TUI.** The TUI spawns them via
  `os/exec`, captures stdout+stderr into a shared `LogBroker` (ring
  buffer, 2000 lines), and SIGTERMs the whole process group on quit.
- **Health is polled, not pushed.** Every 2 seconds the TUI GETs each
  service's `/health` endpoint and updates the dashboard dots.  No
  external service discovery is required.
- **Scheduler is in-process.** `robfig/cron/v3` runs in a goroutine;
  task history lives in a single SQLite file owned by the TUI.

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| All services show `unhealthy` | Bank / CHRONOS / etc. not running | Start them, or `cd tui && go run . --no-start` |
| `TUI exited with error: could not open a new TTY` | Run from a non-TTY context | Run in iTerm / Terminal / VSCode terminal |
| `Error: services.yaml not found` | TUI run from a non-repo dir | Run from inside the repo, or set `--config` |
| Stages show `crashed` after exit code 137 | `SIGKILL` after grace timeout — usually a port conflict | Stop the conflicting process or change the port in `services.yaml` |
| `e2e_test.py` reports `mock markers found` | A stage is returning a hardcoded response | Run with `--no-cache` and check the stage's `__main__` block for any `random.seed(...)` patterns |
