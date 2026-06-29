// Package pages — Scheduler view (page 2).
//
// Shows every scheduled task from config/services.yaml, its last-run
// history, and offers Re-run / View log / Edit / Disable actions.
package pages

import (
	"fmt"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/table"
	tea "github.com/charmbracelet/bubbletea"

	"tui/internal/config"
	"tui/internal/services"
	"tui/internal/styles"
)

// SchedulerModel is the bubbletea model for the scheduler page.
type SchedulerModel struct {
	Width    int
	Height   int
	Mgr      *services.Manager
	History  *services.TaskHistory
	Table    table.Model
	Tasks    []config.ScheduledTask
	Selected int
	ReRunOut string
	ReRunAt  time.Time
}

// NewSchedulerModel builds the page.
func NewSchedulerModel(mgr *services.Manager, hist *services.TaskHistory, tasks []config.ScheduledTask) SchedulerModel {
	cols := []table.Column{
		{Title: "Task",       Width: 28},
		{Title: "Schedule",   Width: 16},
		{Title: "Last Run",   Width: 22},
		{Title: "Status",     Width: 12},
		{Title: "Enabled",    Width: 8},
	}
	rows := []table.Row{}
	for _, t := range tasks {
		rows = append(rows, table.Row{
			t.Name,
			t.Schedule,
			"— not run —",
			"—",
			boolStr(t.Enabled),
		})
	}
	t := table.New(
		table.WithColumns(cols),
		table.WithRows(rows),
		table.WithFocused(true),
		table.WithHeight(12),
	)
	sm := SchedulerModel{
		Mgr:     mgr,
		History: hist,
		Table:   t,
		Tasks:   tasks,
	}
	sm.refreshLastRuns()
	return sm
}

func boolStr(b bool) string {
	if b {
		return "yes"
	}
	return "no"
}

func (m *SchedulerModel) refreshLastRuns() {
	if m.History == nil {
		return
	}
	all, err := m.History.AllLastRuns()
	if err != nil {
		return
	}
	rows := []table.Row{}
	for _, t := range m.Tasks {
		last := all[t.Name]
		lastRun, status := "— not run —", "—"
		if last != nil {
			if !last.Finished.IsZero() {
				lastRun = last.Finished.Format("2006-01-02 15:04:05")
			} else {
				lastRun = last.Started.Format("2006-01-02 15:04:05")
			}
			status = last.Status
		}
		rows = append(rows, table.Row{
			t.Name,
			t.Schedule,
			lastRun,
			status,
			boolStr(t.Enabled),
		})
	}
	m.Table.SetRows(rows)
}

// SetSize updates the page size.
func (m *SchedulerModel) SetSize(w, h int) {
	m.Width = w
	m.Height = h
	m.Table.SetWidth(w)
	m.Table.SetHeight(h - 8)
}

// Update handles scheduler-specific keys.
func (m SchedulerModel) Update(msg tea.Msg) (SchedulerModel, tea.Cmd) {
	var cmd tea.Cmd
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "up", "k":
			m.Table.MoveUp(1)
		case "down", "j":
			m.Table.MoveDown(1)
		case "r":
			return m, m.reRunSelected()
		case "l":
			m.ReRunOut = m.SelectedOutput()
		}
	}
	m.Table, cmd = m.Table.Update(msg)
	return m, cmd
}

func (m *SchedulerModel) selectedTask() *config.ScheduledTask {
	idx := m.Table.Cursor()
	if idx < 0 || idx >= len(m.Tasks) {
		return nil
	}
	return &m.Tasks[idx]
}

// SelectedOutput returns the cached output of the most recent run of
// the currently-selected task.
func (m *SchedulerModel) SelectedOutput() string {
	t := m.selectedTask()
	if t == nil || m.History == nil {
		return ""
	}
	r, err := m.History.LastRun(t.Name)
	if err != nil || r == nil {
		return "(no output recorded yet)"
	}
	if r.Output == "" {
		return "(no output captured)"
	}
	return r.Output
}

func (m SchedulerModel) reRunSelected() tea.Cmd {
	t := m.selectedTask()
	if t == nil {
		return nil
	}
	entry, ok := lookupCommandByRef(t.CommandRef)
	if !ok {
		m.Mgr.Broker().Publish(services.LogLine{
			Service: "scheduler",
			Line:    fmt.Sprintf("✗ command_ref not found: %s", t.CommandRef),
			Time:    time.Now(),
		})
		return nil
	}
	// Insert a "running" history record synchronously so the table refreshes.
	runID, err := m.History.StartRun(t.Name, t.CommandRef)
	if err != nil {
		m.Mgr.Broker().Publish(services.LogLine{
			Service: "scheduler",
			Line:    fmt.Sprintf("✗ could not record run: %s", err.Error()),
			Time:    time.Now(),
		})
		return nil
	}
	m.refreshLastRuns()
	return func() tea.Msg {
		out := captureCommand(resolveDir(entry.Dir), entry.Cmd)
		status := "success"
		if out.ExitCode != 0 {
			status = "failed"
		}
		_ = m.History.FinishRun(runID, status, out.ExitCode, out.Combined)
		m.Mgr.Broker().Publish(services.LogLine{
			Service: "scheduler",
			Line:    fmt.Sprintf("→ %s finished (%s) — exit %d", t.Name, status, out.ExitCode),
			Time:    time.Now(),
		})
		m.refreshLastRuns()
		return nil
	}
}

// View renders the page.
func (m SchedulerModel) View() string {
	var sb strings.Builder
	sb.WriteString(styles.Subtitle.Render("  Scheduled Tasks"))
	sb.WriteString("\n")
	sb.WriteString(m.Table.View())
	sb.WriteString("\n")
	if m.ReRunOut != "" {
		sb.WriteString(styles.Subtitle.Render("  Selected output"))
		sb.WriteString("\n")
		out := m.ReRunOut
		if len(out) > 2000 {
			out = out[len(out)-2000:]
		}
		sb.WriteString(styles.Box.Render(out))
		sb.WriteString("\n")
	}
	sb.WriteString(styles.Footer.Render("↑↓ navigate   r re-run now   l view log   q back"))
	return sb.String()
}
