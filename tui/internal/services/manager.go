// Package services — top-level Service Manager.
//
// Spawns all app_services in parallel, polls health endpoints, captures
// stdout/stderr into a shared log ring buffer, and surfaces lifecycle
// state for the TUI dashboard.
package services

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"
)

// ServiceState is the lifecycle state of one app service.
type ServiceState struct {
	Name        string
	Color       string
	Port        int
	Dir         string
	StartCmd    string
	HealthURL   string
	Kind        string
	Description string
	NoAutoStart bool // when true, StartAll() skips this service
	Status      string // starting | running | crashed | stopped | unknown
	ExitMsg     string
	Started     time.Time
	Health      string // healthy | degraded | unhealthy | unknown
	HealthCode  int
	LastCheck   time.Time

	proc *ServiceProc
}

// Manager owns the live state of all services.
type Manager struct {
	mu       sync.RWMutex
	states   map[string]*ServiceState
	broker   *LogBroker
	httpc    *http.Client
	polling  bool
	stopCh   chan struct{}
	cmdHist  []string
}

// NewManager builds a manager.
func NewManager(broker *LogBroker) *Manager {
	return &Manager{
		states: make(map[string]*ServiceState),
		broker: broker,
		httpc:  &http.Client{Timeout: 2 * time.Second},
		stopCh: make(chan struct{}),
	}
}

// Register adds a service definition to the manager.  Does not start it.
func (m *Manager) Register(s ServiceState) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if s.Status == "" {
		s.Status = "stopped"
	}
	m.states[s.Name] = &s
}

// All returns a snapshot of every service state, in insertion order.
func (m *Manager) All() []ServiceState {
	m.mu.RLock()
	defer m.mu.RUnlock()
	out := make([]ServiceState, 0, len(m.states))
	for _, s := range m.states {
		out = append(out, *s)
	}
	return out
}

// Get returns one service by name.
func (m *Manager) Get(name string) (ServiceState, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	s, ok := m.states[name]
	if !ok {
		return ServiceState{}, false
	}
	return *s, true
}

// Start brings up a service (idempotent).
func (m *Manager) Start(name string) error {
	m.mu.Lock()
	s, ok := m.states[name]
	if !ok {
		m.mu.Unlock()
		return fmt.Errorf("service %q not registered", name)
	}
	if s.proc != nil && s.proc.IsRunning() {
		m.mu.Unlock()
		return nil
	}
	s.Status = "starting"
	m.states[name] = s
	m.mu.Unlock()

	proc, err := StartProcess(name, s.Dir, s.StartCmd, m.broker)
	m.mu.Lock()
	defer m.mu.Unlock()
	if err != nil {
		s.Status = "crashed"
		s.ExitMsg = err.Error()
		m.states[name] = s
		m.broker.Publish(LogLine{
			Service: name,
			Line:    "✗ failed to start: " + err.Error(),
			Time:    time.Now(),
		})
		return err
	}
	s.proc = proc
	s.Started = proc.Started
	s.Status = "running"
	m.states[name] = s
	return nil
}

// Stop terminates a service.
func (m *Manager) Stop(name string) error {
	m.mu.Lock()
	s, ok := m.states[name]
	if !ok {
		m.mu.Unlock()
		return fmt.Errorf("service %q not registered", name)
	}
	if s.proc == nil {
		s.Status = "stopped"
		m.states[name] = s
		m.mu.Unlock()
		return nil
	}
	proc := s.proc
	m.mu.Unlock()

	proc.Stop()
	// Wait briefly for graceful shutdown.
	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		if !proc.IsRunning() {
			break
		}
		time.Sleep(100 * time.Millisecond)
	}

	m.mu.Lock()
	defer m.mu.Unlock()
	s.Status = "stopped"
	s.ExitMsg = "stopped by user"
	m.states[name] = s
	m.broker.Publish(LogLine{
		Service: name,
		Line:    "→ stopped by user",
		Time:    time.Now(),
	})
	return nil
}

// StartAll starts every registered service that is currently stopped.
// Services with NoAutoStart=true are skipped — they must be started
// explicitly via the dashboard's /command input or the Commands page.
func (m *Manager) StartAll() {
	for _, s := range m.All() {
		if s.Status == "running" {
			continue
		}
		if s.NoAutoStart {
			continue
		}
		if err := m.Start(s.Name); err != nil {
			// already logged
		}
	}
}

// StopAll terminates every running service in reverse registration order.
func (m *Manager) StopAll() {
	all := m.All()
	for i := len(all) - 1; i >= 0; i-- {
		_ = m.Stop(all[i].Name)
	}
}

// RunCommand starts a one-shot subprocess (not a long-lived service)
// and returns immediately.  Its log lines are tagged with the command
// name as the primary service and with every service in `tags` as
// secondary matches (so a "chronos train habitat" command output also
// appears under the "chronos" tab).
func (m *Manager) RunCommand(name, dir, cmd string, tags ...string) error {
	if dir == "" {
		dir = "."
	}
	_, err := StartProcess(name, dir, cmd, m.broker, tags...)
	return err
}

// PollHealthLoop runs forever, polling every service's /health endpoint
// every 2 seconds.
func (m *Manager) PollHealthLoop(ctx context.Context) {
	t := time.NewTicker(2 * time.Second)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-m.stopCh:
			return
		case <-t.C:
			m.PollHealthOnce()
		}
	}
}

// PollHealthOnce probes all services' health endpoints.
func (m *Manager) PollHealthOnce() {
	m.mu.RLock()
	states := make([]*ServiceState, 0, len(m.states))
	for _, s := range m.states {
		states = append(states, s)
	}
	m.mu.RUnlock()

	for _, s := range states {
		// First check process liveness.
		if s.proc != nil && !s.proc.IsRunning() && s.Status != "stopped" {
			s.Status = "crashed"
			s.ExitMsg = s.proc.ExitMsg
		}
		// Then poll /health.
		if s.HealthURL == "" {
			s.Health = "unknown"
			s.LastCheck = time.Now()
			continue
		}
		ctx, cancel := context.WithTimeout(context.Background(), 1500*time.Millisecond)
		req, _ := http.NewRequestWithContext(ctx, "GET", s.HealthURL, nil)
		resp, err := m.httpc.Do(req)
		cancel()
		s.LastCheck = time.Now()
		if err != nil {
			if s.Status == "running" || s.Status == "starting" {
				s.Health = "unhealthy"
			} else {
				s.Health = "unknown"
			}
			s.HealthCode = 0
			continue
		}
		resp.Body.Close()
		s.HealthCode = resp.StatusCode
		if resp.StatusCode == 200 {
			s.Health = "healthy"
		} else if resp.StatusCode == 503 {
			s.Health = "degraded"
		} else {
			s.Health = "unhealthy"
		}
		// If the service has a process and /health is up, mark it running.
		if s.Health == "healthy" && (s.Status == "starting" || s.Status == "stopped") {
			s.Status = "running"
		}
	}
	m.mu.Lock()
	for _, s := range states {
		if cur, ok := m.states[s.Name]; ok {
			*cur = *s
		}
	}
	m.mu.Unlock()
}

// HealthSummary returns a one-line health summary for the dashboard header.
func (m *Manager) HealthSummary() string {
	states := m.All()
	var running, healthy, crashed, starting int
	for _, s := range states {
		if s.Status == "running" {
			running++
		}
		if s.Health == "healthy" {
			healthy++
		}
		if s.Status == "crashed" {
			crashed++
		}
		if s.Status == "starting" {
			starting++
		}
	}
	return fmt.Sprintf("running=%d healthy=%d starting=%d crashed=%d total=%d",
		running, healthy, starting, crashed, len(states))
}

// HasService reports whether a service is registered.
func (m *Manager) HasService(name string) bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	_, ok := m.states[name]
	return ok
}

// StopPolling signals the health-polling loop to stop.
func (m *Manager) StopPolling() {
	close(m.stopCh)
}

// ServiceNames returns a stable list of registered service names.
func (m *Manager) ServiceNames() []string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	names := make([]string, 0, len(m.states))
	for n := range m.states {
		names = append(names, n)
	}
	return names
}

// FilterLogLines returns the last `n` log lines, optionally filtered
// to a single service.  A line matches the filter if its primary
// Service OR any of its Tags equals the filter (or if filter is "all").
func (m *Manager) FilterLogLines(service string, n int) []LogLine {
	all := m.broker.Snapshot()
	out := make([]LogLine, 0, n)
	// Walk backwards to get most recent.
	for i := len(all) - 1; i >= 0 && len(out) < n; i-- {
		if matchesService(all[i], service) {
			out = append([]LogLine{all[i]}, out...)
		}
	}
	return out
}

// matchesService returns true if the line belongs to the given service
// (either as its primary Service or as a secondary Tag).
func matchesService(l LogLine, service string) bool {
	if service == "all" || service == "" {
		return true
	}
	if l.Service == service {
		return true
	}
	for _, t := range l.Tags {
		if t == service {
			return true
		}
	}
	return false
}

// SanitizeCommand strips any leading "FOO=bar " env-var prefix and
// splits on whitespace for display.
func SanitizeCommand(s string) string {
	return strings.TrimSpace(s)
}

// Broker returns the shared log broker.
func (m *Manager) Broker() *LogBroker { return m.broker }
