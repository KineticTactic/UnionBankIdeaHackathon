// Package pages — Dashboard view (default page).
//
// Layout:
//   ┌─ services bar (horizontal tiles) ─────────────────────────────────┐
//   │ APP ───────────────────────────────────────────────────────       │
//   │ ┌─orchestr.─┐ ┌─chronos──┐ ┌─herald──┐ ┌─client──┐ …             │
//   │ │ ● :8000 ▲ │ │ ● :8001▲ │ │ ● :8005▲ │ │ ● :3000▲ │             │
//   │ └───────────┘ └──────────┘ └─────────┘ └─────────┘               │
//   │ DOCKER ─────────────────────────────────────────────────          │
//   │ ┌─postgres──┐ ┌─redis────┐ ┌─kafka───┐ ┌─mlflow──┐                │
//   │ │ ●  docker │ │ ●  docker │ │ ●  docker │ │ ●  docker │             │
//   │ └───────────┘ └──────────┘ └─────────┘ └─────────┘               │
//   ├─ log panel ───────────────────────────────────────────────────────┤
//   │ [All] [orchestrator] [chronos] ... [client]   filter: ____       │
//   │ log lines...                                                     │
//   ├─ command input ───────────────────────────────────────────────────┤
//   │ > /command args...                                               │
//   └───────────────────────────────────────────────────────────────────┘
package pages

import (
	"fmt"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/textinput"
	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"

	"tui/internal/services"
	"tui/internal/styles"
)

// DashboardModel is the bubbletea model for the dashboard page.
type DashboardModel struct {
	Width   int
	Height  int
	Mgr     *services.Manager
	LogVP   viewport.Model
	Filter  string
	Tabs    []string // service names + "all"
	Active  int      // index into Tabs
	Input   textinput.Model
	InputOn bool
}

// NewDashboardModel builds the page.
func NewDashboardModel(mgr *services.Manager) DashboardModel {
	ti := textinput.New()
	ti.Placeholder = "type a /command (e.g. /chronos train) and press Enter"
	ti.Prompt = "│ "
	ti.CharLimit = 256

	tabs := []string{"all", "cmds"}
	for _, s := range mgr.All() {
		tabs = append(tabs, s.Name)
	}

	vp := viewport.New(0, 0)
	vp.SetContent("(no log output yet)")
	return DashboardModel{
		Mgr:    mgr,
		LogVP:  vp,
		Tabs:   tabs,
		Active: 0,
		Input:  ti,
	}
}

// SetSize updates the viewport size.
func (m *DashboardModel) SetSize(w, h int) {
	m.Width = w
	m.Height = h
	// Reserved: services bar (up to 5 lines for 2 sections with labels
	// and a wrapping row) + tab bar + command input + footer.
	// We compute the bar height from the actual rendered content.
	barH := lipgloss.Height(RenderServicesBar(m.Mgr, w))
	if barH < 1 {
		barH = 4
	}
	reserved := barH + 2 + 2 + 1
	m.LogVP.Width = w
	m.LogVP.Height = h - reserved
	if m.LogVP.Height < 3 {
		m.LogVP.Height = 3
	}
}

// Refresh rebuilds the log panel content from the broker.
func (m *DashboardModel) Refresh() {
	lines := m.Mgr.FilterLogLines(m.Tabs[m.Active], 2000)
	var sb strings.Builder
	if len(lines) == 0 {
		sb.WriteString(styles.Dim.Render("  (no log output yet for this filter)"))
	} else {
		for _, l := range lines {
			ts := l.Time.Format("15:04:05")
			tag := styles.ServiceStyle(l.Service).Render(fmt.Sprintf("%-12s", l.Service))
			text := l.Line
			if strings.HasPrefix(text, "stderr| ") {
				text = styles.Warn.Render(text)
			} else if strings.HasPrefix(text, "✗") || strings.HasPrefix(text, "ERROR") {
				text = styles.Error.Render(text)
			}
			sb.WriteString(fmt.Sprintf("%s %s  %s\n", styles.Dim.Render(ts), tag, text))
		}
	}
	m.LogVP.SetContent(sb.String())
	m.LogVP.GotoBottom()
}

// Update handles dashboard-specific messages.
func (m DashboardModel) Update(msg tea.Msg) (DashboardModel, tea.Cmd) {
	var cmd tea.Cmd
	switch msg := msg.(type) {
	case tea.KeyMsg:
		if m.InputOn {
			switch msg.String() {
			case "esc":
				m.InputOn = false
				m.Input.Blur()
				return m, nil
			case "enter":
				val := m.Input.Value()
				m.Input.SetValue("")
				m.InputOn = false
				m.Input.Blur()
				return m, m.runCommand(val)
			}
			m.Input, cmd = m.Input.Update(msg)
			return m, cmd
		}
		switch msg.String() {
		case "/":
			m.InputOn = true
			m.Input.Focus()
			return m, textinput.Blink
		case "tab", "right":
			if m.Active < len(m.Tabs)-1 {
				m.Active++
				m.Refresh()
			}
			return m, nil
		case "shift+tab", "left":
			if m.Active > 0 {
				m.Active--
				m.Refresh()
			}
			return m, nil
		case "1", "2", "3", "4", "5", "6", "7", "8", "9":
			idx := int(msg.String()[0]-'0') - 1
			if idx < len(m.Tabs) {
				m.Active = idx
				m.Refresh()
			}
			return m, nil
		}
		m.LogVP, cmd = m.LogVP.Update(msg)
		return m, cmd
	}
	m.LogVP, cmd = m.LogVP.Update(msg)
	return m, cmd
}

// runCommand dispatches a `/command` typed into the dashboard input.
func (m DashboardModel) runCommand(input string) tea.Cmd {
	cmdText := strings.TrimSpace(input)
	cmdText = strings.TrimPrefix(cmdText, "/")
	if cmdText == "" {
		return nil
	}
	// Look up the command in the config.
	entry, ok := findCommandFull(cmdText)
	if !ok {
		m.Mgr.Broker().Publish(services.LogLine{
			Service: "tui",
			Line:    "✗ command not found: /" + cmdText + " — switch to the Commands page (key 3) to browse",
			Time:    nowFn(),
		})
		return nil
	}
	return func() tea.Msg {
		// Pass the resolved service as a secondary tag so the output
		// also appears under that service's tab (e.g. "chronos").
		err := m.Mgr.RunCommand("cmd:"+entry.Name, resolveDir(entry.Dir), entry.Cmd, entry.Service)
		if err != nil {
			m.Mgr.Broker().Publish(services.LogLine{
				Service: "tui",
				Line:    "✗ command failed to start: " + err.Error(),
				Time:    nowFn(),
			})
		}
		return nil
	}
}

// View renders the dashboard.
func (m DashboardModel) View() string {
	var sb strings.Builder

	// Header — horizontal services bar (app services + docker containers).
	sb.WriteString(RenderServicesBar(m.Mgr, m.Width))
	sb.WriteString("\n")

	// Tab bar.
	sb.WriteString(m.renderTabBar())
	sb.WriteString("\n")

	// Log viewport.
	sb.WriteString(m.LogVP.View())
	sb.WriteString("\n")

	// Command input.
	if m.InputOn {
		sb.WriteString(m.Input.View())
	} else {
		sb.WriteString(styles.Dim.Render("  press / to enter a command"))
	}
	sb.WriteString("\n")

	// Footer.
	sb.WriteString(styles.Footer.Render("↑↓/PgUp PgDn scroll   ←/→ tab   1-9 jump   / command   q quit"))
	return sb.String()
}

func (m DashboardModel) renderTabBar() string {
	var sb strings.Builder
	for i, t := range m.Tabs {
		label := t
		switch t {
		case "all":
			label = "All"
		case "cmds":
			label = "Commands"
		}
		if i == m.Active {
			sb.WriteString(styles.TabOn.Render(" " + label + " "))
		} else {
			sb.WriteString(styles.TabOff.Render(" " + label + " "))
		}
		sb.WriteString(styles.TabSep.Render("│"))
	}
	return sb.String()
}

// The old 2-column renderServiceGrid has been replaced by the
// horizontal services bar in servicesbar.go.  See RenderServicesBar.

// ── helpers shared with commands.go ────────────────────────────────────────

// findCommand looks up a command in the global registry.  Injected by
// app.go at startup.
var (
	commandRegistry func(string) (CommandEntry, bool)
	resolveDir      func(string) string
	nowFn           = func() time.Time { return time.Now() }
)

// CommandEntry is the trimmed view of a command.
type CommandEntry struct {
	Name    string
	Service string
	Cmd     string
	Dir     string
}

// SetCommandRegistry wires the command lookup and dir resolver used by
// the dashboard's `/command` input and by the commands page.
func SetCommandRegistry(reg func(string) (CommandEntry, bool), dir func(string) string) {
	commandRegistry = reg
	resolveDir = dir
}

// SetNow overrides the time source (used in tests).
func SetNow(fn func() time.Time) { nowFn = fn }

// required imports kept at the bottom
var _ = lipgloss.NewStyle
