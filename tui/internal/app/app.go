// Package app — top-level bubbletea model and routing.
package app

import (
	"context"
	"fmt"
	"os/exec"
	"strings"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/robfig/cron/v3"

	"tui/internal/config"
	"tui/internal/pages"
	"tui/internal/services"
	"tui/internal/styles"
)

// AppModel is the top-level model.
type AppModel struct {
	Width       int
	Height      int
	Page        int // 0 = dashboard, 1 = scheduler, 2 = commands
	Ready       bool
	StartBanner string

	Mgr         *services.Manager
	History     *services.TaskHistory
	Cron        *cron.Cron
	Dashboard   pages.DashboardModel
	Scheduler   pages.SchedulerModel
	Commands    pages.CommandsModel
}

// New builds the top-level model.
func New(mgr *services.Manager, hist *services.TaskHistory, tasks []config.ScheduledTask, commands []config.Command) AppModel {
	pages.SetCommandRegistry(pagesLookup(commands), config.ResolveDir)
	pages.SetCommands(commands)

	return AppModel{
		StartBanner: styles.Title.Render(" PCOP Dev Console "),
		Page:        0,
		Mgr:         mgr,
		History:     hist,
		Cron:        cron.New(),
		Dashboard:   pages.NewDashboardModel(mgr),
		Scheduler:   pages.NewSchedulerModel(mgr, hist, tasks),
		Commands:    pages.NewCommandsModel(mgr, commands),
	}
}

// pagesLookup builds the command registry lookup function.
func pagesLookup(cmds []config.Command) func(string) (pages.CommandEntry, bool) {
	return func(name string) (pages.CommandEntry, bool) {
		for _, c := range cmds {
			if c.Name == name {
				return pages.CommandEntry{
					Name:    c.Name,
					Service: c.Service,
					Cmd:     c.Cmd,
					Dir:     c.Dir,
				}, true
			}
		}
		return pages.CommandEntry{}, false
	}
}

// Init starts background timers and the health-polling loop.
func (m AppModel) Init() tea.Cmd {
	return tea.Batch(
		tea.EnterAltScreen,
		tickCmd(),
	)
}

// SetSize forwards a window-size message to all sub-pages.
func (m *AppModel) SetSize(w, h int) {
	m.Width = w
	m.Height = h
	m.Dashboard.SetSize(w, h-3)
	m.Scheduler.SetSize(w, h-3)
	m.Commands.SetSize(w, h-3)
}

type tickMsg time.Time

func tickCmd() tea.Cmd {
	return tea.Tick(2*time.Second, func(t time.Time) tea.Msg { return tickMsg(t) })
}

// Update handles the top-level key dispatch.
func (m AppModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.Ready = true
		m.SetSize(msg.Width, msg.Height)
		return m, nil
	case tickMsg:
		m.Dashboard.Refresh()
		cmds = append(cmds, tickCmd())
		return m, tea.Batch(cmds...)
	case tea.KeyMsg:
		switch msg.String() {
		case "ctrl+c", "q":
			_ = m.History.Close()
			m.Mgr.StopPolling()
			ctx := m.Cron.Stop()
			<-ctx.Done()
			m.Mgr.StopAll()
			return m, tea.Quit
		case "1":
			m.Page = 0
			return m, nil
		case "2":
			m.Page = 1
			return m, nil
		case "3":
			m.Page = 2
			return m, nil
		}
	}
	// Forward to active page.
	switch m.Page {
	case 0:
		var cmd tea.Cmd
		m.Dashboard, cmd = m.Dashboard.Update(msg)
		if cmd != nil {
			cmds = append(cmds, cmd)
		}
	case 1:
		var cmd tea.Cmd
		m.Scheduler, cmd = m.Scheduler.Update(msg)
		if cmd != nil {
			cmds = append(cmds, cmd)
		}
	case 2:
		var cmd tea.Cmd
		m.Commands, cmd = m.Commands.Update(msg)
		if cmd != nil {
			cmds = append(cmds, cmd)
		}
	}
	return m, tea.Batch(cmds...)
}

// View renders the top-level frame.
func (m AppModel) View() string {
	if !m.Ready {
		return m.StartBanner + "\n\n  initialising…\n"
	}

	var sb strings.Builder
	// Top tab bar.
	sb.WriteString(m.renderTopBar())
	sb.WriteString("\n")

	// Active page.
	switch m.Page {
	case 0:
		sb.WriteString(m.Dashboard.View())
	case 1:
		sb.WriteString(m.Scheduler.View())
	case 2:
		sb.WriteString(m.Commands.View())
	}
	return sb.String()
}

func (m AppModel) renderTopBar() string {
	var sb strings.Builder
	sb.WriteString(styles.Title.Render(" PCOP Dev Console "))
	sb.WriteString("  ")
	for i, t := range []string{"[1] Dashboard", "[2] Scheduler", "[3] Commands"} {
		idx := i
		if idx == m.Page {
			sb.WriteString(styles.TabOn.Render(" " + t + " "))
		} else {
			sb.WriteString(styles.TabOff.Render(" " + t + " "))
		}
		sb.WriteString(" ")
	}
	sb.WriteString(styles.Dim.Render("  " + m.Mgr.HealthSummary()))
	return sb.String()
}

// StartBackground starts the cron scheduler and the health-polling loop.
func (m *AppModel) StartBackground(ctx context.Context) {
	// Wire scheduled tasks.
	commandsByRef := map[string]config.Command{}
	for _, c := range config.Root.Commands {
		commandsByRef[c.Name] = c
	}
	for _, t := range config.Root.ScheduledTasks {
		if !t.Enabled {
			continue
		}
		ref, ok := commandsByRef[t.CommandRef]
		if !ok {
			continue
		}
		entry := ref
		tname := t.Name
		tref := t.CommandRef
		_, err := m.Cron.AddFunc(t.Schedule, func() {
			runID, err := m.History.StartRun(tname, tref)
			if err != nil {
				return
			}
			out := runCommandLive(config.ResolveDir(entry.Dir), entry.Cmd)
			status := "success"
			if out.ExitCode != 0 {
				status = "failed"
			}
			_ = m.History.FinishRun(runID, status, out.ExitCode, out.Combined)
		})
		if err != nil {
			m.Mgr.Broker().Publish(services.LogLine{
				Service: "scheduler",
				Line:    fmt.Sprintf("✗ could not schedule %s (%s): %s", t.Name, t.Schedule, err.Error()),
				Time:    time.Now(),
			})
		} else {
			m.Mgr.Broker().Publish(services.LogLine{
				Service: "scheduler",
				Line:    fmt.Sprintf("→ scheduled %s — %s (ref: %s)", t.Name, t.Schedule, t.CommandRef),
				Time:    time.Now(),
			})
		}
	}
	m.Cron.Start()
	go m.Mgr.PollHealthLoop(ctx)
}

func runCommandLive(dir, command string) commandResult {
	if dir == "" {
		dir = "."
	}
	cmd := exec.Command("/bin/bash", "-lc", command)
	cmd.Dir = dir
	out, err := cmd.CombinedOutput()
	res := commandResult{Combined: string(out)}
	if err != nil {
		if ee, ok := err.(*exec.ExitError); ok {
			res.ExitCode = ee.ExitCode()
		} else {
			res.ExitCode = 1
		}
	}
	return res
}

type commandResult struct {
	Combined string
	ExitCode int
}
