// Package services — SQLite-backed task history for the scheduler page.
package services

import (
	"database/sql"
	"fmt"
	"sync"
	"time"

	_ "modernc.org/sqlite"
)

// TaskRecord is one row of the scheduler task history.
type TaskRecord struct {
	ID         int64
	Name       string
	CommandRef string
	Started    time.Time
	Finished   time.Time
	Status     string // success | failed | running
	ExitCode   int
	Output     string
}

// TaskHistory wraps a SQLite database.
type TaskHistory struct {
	mu sync.Mutex
	db *sql.DB
}

// NewTaskHistory opens (or creates) the task history DB at the given path.
func NewTaskHistory(path string) (*TaskHistory, error) {
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}
	if _, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS task_runs (
			id           INTEGER PRIMARY KEY AUTOINCREMENT,
			name         TEXT NOT NULL,
			command_ref  TEXT NOT NULL,
			started_at   DATETIME NOT NULL,
			finished_at  DATETIME,
			status       TEXT NOT NULL,
			exit_code    INTEGER NOT NULL DEFAULT 0,
			output       TEXT NOT NULL DEFAULT ''
		)
	`); err != nil {
		db.Close()
		return nil, fmt.Errorf("create table: %w", err)
	}
	return &TaskHistory{db: db}, nil
}

// Close closes the DB.
func (h *TaskHistory) Close() error {
	if h == nil || h.db == nil {
		return nil
	}
	return h.db.Close()
}

// StartRun inserts a new "running" record and returns its ID.
func (h *TaskHistory) StartRun(name, commandRef string) (int64, error) {
	h.mu.Lock()
	defer h.mu.Unlock()
	res, err := h.db.Exec(
		`INSERT INTO task_runs (name, command_ref, started_at, status) VALUES (?, ?, ?, 'running')`,
		name, commandRef, time.Now().UTC(),
	)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

// FinishRun marks a task as completed.
func (h *TaskHistory) FinishRun(id int64, status string, exitCode int, output string) error {
	h.mu.Lock()
	defer h.mu.Unlock()
	_, err := h.db.Exec(
		`UPDATE task_runs SET finished_at = ?, status = ?, exit_code = ?, output = ? WHERE id = ?`,
		time.Now().UTC(), status, exitCode, output, id,
	)
	return err
}

// LastRun returns the most recent run for a task name.
func (h *TaskHistory) LastRun(name string) (*TaskRecord, error) {
	h.mu.Lock()
	defer h.mu.Unlock()
	row := h.db.QueryRow(
		`SELECT id, name, command_ref, started_at, finished_at, status, exit_code, output
		   FROM task_runs WHERE name = ? ORDER BY started_at DESC LIMIT 1`,
		name,
	)
	var r TaskRecord
	var finished sql.NullTime
	if err := row.Scan(&r.ID, &r.Name, &r.CommandRef, &r.Started, &finished, &r.Status, &r.ExitCode, &r.Output); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	if finished.Valid {
		r.Finished = finished.Time
	}
	return &r, nil
}

// AllLastRuns returns the most recent run for every task name.
func (h *TaskHistory) AllLastRuns() (map[string]*TaskRecord, error) {
	h.mu.Lock()
	defer h.mu.Unlock()
	rows, err := h.db.Query(`
		SELECT t.id, t.name, t.command_ref, t.started_at, t.finished_at, t.status, t.exit_code, t.output
		  FROM task_runs t
		  INNER JOIN (
		    SELECT name, MAX(started_at) AS max_started
		      FROM task_runs GROUP BY name
		  ) latest ON t.name = latest.name AND t.started_at = latest.max_started
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make(map[string]*TaskRecord)
	for rows.Next() {
		var r TaskRecord
		var finished sql.NullTime
		if err := rows.Scan(&r.ID, &r.Name, &r.CommandRef, &r.Started, &finished, &r.Status, &r.ExitCode, &r.Output); err != nil {
			return nil, err
		}
		if finished.Valid {
			r.Finished = finished.Time
		}
		out[r.Name] = &r
	}
	return out, nil
}
