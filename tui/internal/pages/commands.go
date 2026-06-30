// Package pages — Commands palette (page 3).
package pages

import (
	"fmt"
	"os/exec"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/textinput"
	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"

	"tui/internal/config"
	"tui/internal/services"
	"tui/internal/styles"
)

// CommandsModel is the bubbletea model for the commands page.
type CommandsModel struct {
	Width   int
	Height  int
	Mgr     *services.Manager
	Input   textinput.Model
	Output  viewport.Model
	Cmds    []config.Command
	Filter  string
	Selected int
}

// NewCommandsModel builds the page.
func NewCommandsModel(mgr *services.Manager, cmds []config.Command) CommandsModel {
	ti := textinput.New()
	ti.Placeholder = "type to filter commands (e.g. 'chronos', 'pipeline')"
	ti.Prompt = "filter: "
	ti.CharLimit = 256

	vp := viewport.New(0, 0)
	vp.SetContent("(run a command to see its output here)")
	return CommandsModel{
		Mgr:    mgr,
		Input:  ti,
		Output: vp,
		Cmds:   cmds,
	}
}

// SetSize updates the page size.
func (m *CommandsModel) SetSize(w, h int) {
	m.Width = w
	m.Height = h
	m.Output.Width = w
	m.Output.Height = h - 6
}

// filtered returns the commands matching the current filter.
func (m *CommandsModel) filtered() []config.Command {
	if m.Filter == "" {
		return m.Cmds
	}
	f := strings.ToLower(m.Filter)
	out := []config.Command{}
	for _, c := range m.Cmds {
		if strings.Contains(strings.ToLower(c.Name), f) || strings.Contains(strings.ToLower(c.Service), f) {
			out = append(out, c)
		}
	}
	return out
}

// Update handles page-specific keys.
func (m CommandsModel) Update(msg tea.Msg) (CommandsModel, tea.Cmd) {
	var cmd tea.Cmd
	switch msg := msg.(type) {
	case tea.KeyMsg:
		if m.Input.Focused() {
			switch msg.String() {
			case "esc":
				m.Input.Blur()
				return m, nil
			case "enter":
				if len(m.filtered()) == 1 {
					return m, m.runCommand(m.filtered()[0])
				}
				m.Input.Blur()
				return m, nil
			}
			prev := m.Filter
			m.Input, cmd = m.Input.Update(msg)
			m.Filter = m.Input.Value()
			if prev != m.Filter {
				m.Selected = 0
			}
			return m, cmd
		}
		switch msg.String() {
		case "/":
			m.Input.Focus()
			return m, textinput.Blink
		case "up", "k":
			if m.Selected > 0 {
				m.Selected--
			}
		case "down", "j":
			if m.Selected < len(m.filtered())-1 {
				m.Selected++
			}
		case "enter":
			fl := m.filtered()
			if len(fl) > 0 && m.Selected < len(fl) {
				return m, m.runCommand(fl[m.Selected])
			}
		}
	}
	m.Output, cmd = m.Output.Update(msg)
	return m, cmd
}

func (m CommandsModel) runCommand(c config.Command) tea.Cmd {
	dir := config.ResolveDir(c.Dir)
	m.Mgr.Broker().Publish(services.LogLine{
		Service: "tui",
		Line:    fmt.Sprintf("→ running: /%s   (in %s)", c.Name, dir),
		Time:    time.Now(),
	})
	return func() tea.Msg {
		// Route the output through the broker so the dashboard tabs
		// (and the underlying service's tab) can show the same lines.
		// Use a background command so it streams line-by-line instead
		// of blocking until completion.
		if err := m.Mgr.RunCommand("cmd:"+c.Name, dir, c.Cmd, c.Service); err != nil {
			m.Mgr.Broker().Publish(services.LogLine{
				Service: "tui",
				Line:    "✗ command failed to start: " + err.Error(),
				Time:    time.Now(),
			})
		}
		// The Commands page shows the same output in its own pane via
		// the periodic broker snapshot (see the runOnce helper below).
		return nil
	}
}

// View renders the page.
func (m CommandsModel) View() string {
	var sb strings.Builder
	sb.WriteString(styles.Subtitle.Render("  Available Commands"))
	sb.WriteString("\n")
	sb.WriteString(m.Input.View())
	sb.WriteString("\n")

	fl := m.filtered()
	for i, c := range fl {
		row := fmt.Sprintf("  /%-26s  %-32s  [%s]",
			c.Name, truncate(c.Description, 32), styles.ServiceStyle(c.Service).Render(c.Service),
		)
		if i == m.Selected {
			sb.WriteString(styles.TabOn.Render(" " + row + " "))
		} else {
			sb.WriteString(row)
		}
		sb.WriteString("\n")
	}
	sb.WriteString("\n")
	if m.Output.Height > 0 {
		sb.WriteString(styles.Subtitle.Render("  Output"))
		sb.WriteString("\n")
		sb.WriteString(m.Output.View())
	}
	sb.WriteString("\n")
	sb.WriteString(styles.Footer.Render("/ filter   ↑↓ navigate   enter run   q back"))
	return sb.String()
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n-1] + "…"
}

// ── command registry helpers ──────────────────────────────────────────────

var registry struct {
	cmds []config.Command
}

func SetCommands(cmds []config.Command) {
	registry.cmds = cmds
}

// Short aliases for the dashboard's `/` input.  These let users type
// terse commands like `/argus demo` instead of the full
// "DEMO · bulk-eval + open dashboard + open critical customer" name.
// Lookup tries the alias first, then falls back to the exact name.
var commandAliases = map[string]string{
	"argus demo":        "DEMO · bulk-eval + open dashboard + open critical customer",
	"argus demo signals": "DEMO · bulk-eval + open signals page",
	"argus eval all":    "argus evaluate all 50 customers",
	"argus eval":        "argus evaluate CUST-001 (orchestrator bridge)",
	"argus eval reset":  "argus evaluate CUST-001 (fresh state)",
	"argus demo customer": "argus reset + eval CUST-043",
	"argus state":       "argus state summary",
	"argus reset":       "argus reset CUST-001",
	"argus reset 43":    "argus reset CUST-043",
	"open dashboard":    "open client dashboard",
	"open customer":     "open client customer CUST-001",
	"open 43":           "open client customer CUST-043",
	"open signals":      "open client signals page",
	"open admin":        "open client admin portal",
	"simulate burst":    "simulator burst 50",
	"simulate critical": "simulator scenario critical-cascade",
	"pipeline":          "pipeline run",
}

func findCommand(name string) (CommandEntry, bool) {
	// Try alias first (case-insensitive, trimmed).
	key := strings.ToLower(strings.TrimSpace(name))
	if real, ok := commandAliases[key]; ok {
		name = real
	}
	for _, c := range registry.cmds {
		if c.Name == name {
			return CommandEntry{Name: c.Name, Service: c.Service, Cmd: c.Cmd, Dir: c.Dir}, true
		}
	}
	return CommandEntry{}, false
}

// findCommandFull looks up by name; full entry is returned.
func findCommandFull(name string) (CommandEntry, bool) { return findCommand(name) }

func lookupCommandByRef(name string) (CommandEntry, bool) {
	return findCommand(name)
}

// captureCommand runs a shell command and returns the combined output.
type commandResult struct {
	Combined string
	ExitCode int
}

func captureCommand(dir, command string) commandResult {
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
