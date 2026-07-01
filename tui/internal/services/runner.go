// Package services — process + docker orchestration for the TUI.
package services

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"
)

// LogLine is one line of output captured from a subprocess.
type LogLine struct {
	Service string   // primary service tag (used to look up colour)
	Tags    []string // additional service tags — a line matches a tab if its
	//                // primary Service OR any Tag equals the tab name.
	Line string
	Time time.Time
}

// ServiceProc wraps a running subprocess.
type ServiceProc struct {
	Name    string
	Color   string
	Cmd     *exec.Cmd
	Dir     string
	Command string
	Started time.Time
	Exited  bool
	ExitMsg string
	cancel  context.CancelFunc
}

// LogBroker is a thread-safe fan-out for log lines.
type LogBroker struct {
	mu      sync.RWMutex
	lines   []LogLine
	max     int
	stopped bool
	stopCh  chan struct{}
}

func NewLogBroker(max int) *LogBroker {
	return &LogBroker{
		lines:  make([]LogLine, 0, max),
		max:    max,
		stopCh: make(chan struct{}),
	}
}

// Publish adds a line and evicts the oldest if over capacity.
func (b *LogBroker) Publish(line LogLine) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.lines = append(b.lines, line)
	if len(b.lines) > b.max {
		b.lines = b.lines[len(b.lines)-b.max:]
	}
}

// Snapshot returns a copy of all current lines.
func (b *LogBroker) Snapshot() []LogLine {
	b.mu.RLock()
	defer b.mu.RUnlock()
	out := make([]LogLine, len(b.lines))
	copy(out, b.lines)
	return out
}

// Stop signals the broker to stop accepting new lines.
func (b *LogBroker) Stop() {
	b.mu.Lock()
	defer b.mu.Unlock()
	if !b.stopped {
		b.stopped = true
		close(b.stopCh)
	}
}

// runner.go — process execution.

func StartProcess(name, dir, command string, broker *LogBroker, extraTags ...string) (*ServiceProc, error) {
	if dir == "" {
		dir, _ = os.Getwd()
	}
	// Run via /bin/bash -lc so env vars are inherited and complex
	// commands (pipes, globs) work.
	ctx, cancel := context.WithCancel(context.Background())
	cmd := exec.CommandContext(ctx, "/bin/bash", "-lc", command)
	cmd.Dir = dir
	cmd.Env = os.Environ()
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		cancel()
		return nil, fmt.Errorf("stdout pipe: %w", err)
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		cancel()
		return nil, fmt.Errorf("stderr pipe: %w", err)
	}

	if err := cmd.Start(); err != nil {
		cancel()
		return nil, fmt.Errorf("start %s: %w", name, err)
	}

	proc := &ServiceProc{
		Name:    name,
		Cmd:     cmd,
		Dir:     dir,
		Command: command,
		Started: time.Now(),
		cancel:  cancel,
	}

	// Stream stdout + stderr to broker.
	go scanToBroker(name, extraTags, stdout, broker, false)
	go scanToBroker(name, extraTags, stderr, broker, true)

	// Wait for exit in a goroutine and update state.
	go func() {
		_ = cmd.Wait()
		proc.Exited = true
		proc.ExitMsg = fmt.Sprintf("exited with code %d", cmd.ProcessState.ExitCode())
		broker.Publish(LogLine{
			Service: name,
			Tags:    extraTags,
			Line:    "→ process " + proc.ExitMsg,
			Time:    time.Now(),
		})
	}()

	broker.Publish(LogLine{
		Service: name,
		Tags:    extraTags,
		Line:    fmt.Sprintf("→ started in %s: %s", dir, command),
		Time:    time.Now(),
	})
	return proc, nil
}

func scanToBroker(name string, tags []string, r io.Reader, broker *LogBroker, isStderr bool) {
	sc := bufio.NewScanner(r)
	sc.Buffer(make([]byte, 64*1024), 1024*1024)
	for sc.Scan() {
		prefix := ""
		if isStderr {
			prefix = "stderr| "
		}
		broker.Publish(LogLine{
			Service: name,
			Tags:    tags,
			Line:    prefix + sc.Text(),
			Time:    time.Now(),
		})
	}
}

// Stop kills the process group (so child processes are also killed).
func (p *ServiceProc) Stop() {
	if p == nil || p.Exited {
		return
	}
	if p.Cmd != nil && p.Cmd.Process != nil {
		// Kill the process group created by Setpgid.
		_ = syscall.Kill(-p.Cmd.Process.Pid, syscall.SIGTERM)
	}
	go func() {
		time.Sleep(2 * time.Second)
		if p.Cmd != nil && p.Cmd.Process != nil {
			_ = syscall.Kill(-p.Cmd.Process.Pid, syscall.SIGKILL)
		}
	}()
}

// IsRunning returns true if the process is still alive.
func (p *ServiceProc) IsRunning() bool {
	if p == nil {
		return false
	}
	if p.Exited {
		return false
	}
	if p.Cmd == nil || p.Cmd.Process == nil {
		return false
	}
	// On Unix, sending signal 0 just checks for existence.
	if err := p.Cmd.Process.Signal(syscall.Signal(0)); err != nil {
		return false
	}
	return true
}

// ParseCommand splits a start_cmd into parts, honouring simple quoting
// and the common "FOO=bar cmd" prefix syntax.
func ParseCommand(s string) []string {
	var out []string
	var cur strings.Builder
	inSingle, inDouble := false, false
	for i := 0; i < len(s); i++ {
		c := s[i]
		switch {
		case c == '\'' && !inDouble:
			inSingle = !inSingle
		case c == '"' && !inSingle:
			inDouble = !inDouble
		case (c == ' ' || c == '\t') && !inSingle && !inDouble:
			if cur.Len() > 0 {
				out = append(out, cur.String())
				cur.Reset()
			}
		default:
			cur.WriteByte(c)
		}
	}
	if cur.Len() > 0 {
		out = append(out, cur.String())
	}
	return out
}

// KillPortOccupants finds and kills any process listening on the given
// ports.  Used at TUI startup so stale processes from a previous run
// do not block the new services from binding their required ports.
//
// Implementation notes:
//   - macOS / Linux: uses `lsof -nP -tiTCP:PORT -sTCP:LISTEN` to print
//     only the PID(s) listening on PORT.
//   - Falls back to `lsof -ti:PORT` if the narrow LISTEN filter fails.
//   - Each found PID is sent SIGKILL (signal 9) to ensure a hard stop;
//     the TUI is about to respawn the service in that port anyway.
//   - All activity is published to `broker` under the "tui-preflight"
//     service so it shows up in the log ring buffer / dashboard tab.
//
// Returns the number of processes actually killed.
func KillPortOccupants(ports []int, broker *LogBroker) int {
	// De-dupe and drop zero / negative ports.
	seen := make(map[int]bool)
	clean := make([]int, 0, len(ports))
	for _, p := range ports {
		if p <= 0 || seen[p] {
			continue
		}
		seen[p] = true
		clean = append(clean, p)
	}
	if len(clean) == 0 {
		return 0
	}

	const tag = "tui-preflight"
	broker.Publish(LogLine{
		Service: tag,
		Line:    fmt.Sprintf("→ preflight: checking %d port(s): %s", len(clean), joinInts(clean, ", ")),
		Time:    time.Now(),
	})

	killed := 0
	for _, port := range clean {
		pids := findPidsOnPort(port)
		if len(pids) == 0 {
			broker.Publish(LogLine{
				Service: tag,
				Line:    fmt.Sprintf("  port %d: free", port),
				Time:    time.Now(),
			})
			continue
		}
		for _, pid := range pids {
			proc, err := os.FindProcess(pid)
			if err != nil {
				broker.Publish(LogLine{
					Service: tag,
					Line:    fmt.Sprintf("  port %d: pid %d lookup failed: %v", port, pid, err),
					Time:    time.Now(),
				})
				continue
			}
			if err := proc.Signal(syscall.SIGKILL); err != nil {
				broker.Publish(LogLine{
					Service: tag,
					Line:    fmt.Sprintf("  port %d: pid %d kill failed: %v", port, pid, err),
					Time:    time.Now(),
				})
				continue
			}
			killed++
			broker.Publish(LogLine{
				Service: tag,
				Line:    fmt.Sprintf("  port %d: killed pid %d", port, pid),
				Time:    time.Now(),
			})
		}
	}
	broker.Publish(LogLine{
		Service: tag,
		Line:    fmt.Sprintf("→ preflight done: %d process(es) killed", killed),
		Time:    time.Now(),
	})
	return killed
}

// findPidsOnPort returns the PIDs of processes listening on the given
// TCP port.  Tries the LISTEN-state filter first, then falls back to a
// broader query so we still catch processes even if `lsof` is older.
func findPidsOnPort(port int) []int {
	// `lsof -nP -tiTCP:PORT -sTCP:LISTEN`  →  PIDs only, numeric, LISTEN.
	args := []string{"-nP", "-tiTCP:" + strconv.Itoa(port), "-sTCP:LISTEN"}
	if out, ok := runLsof(args); ok {
		return parsePids(out)
	}
	// Fallback: any process touching this port.
	if out, ok := runLsof([]string{"-nP", "-ti:" + strconv.Itoa(port)}); ok {
		return parsePids(out)
	}
	return nil
}

func runLsof(args []string) (string, bool) {
	cmd := exec.Command("lsof", args...)
	out, err := cmd.Output()
	if err != nil {
		return "", false
	}
	return string(out), true
}

func parsePids(s string) []int {
	var pids []int
	for _, line := range strings.Split(strings.TrimSpace(s), "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		pid, err := strconv.Atoi(line)
		if err != nil {
			continue
		}
		if pid > 0 {
			pids = append(pids, pid)
		}
	}
	return pids
}

func joinInts(xs []int, sep string) string {
	parts := make([]string, len(xs))
	for i, x := range xs {
		parts[i] = strconv.Itoa(x)
	}
	return strings.Join(parts, sep)
}
