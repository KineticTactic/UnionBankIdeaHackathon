// Command tui runs the PCOP dev console.
//
// Usage:
//
//	tui
//	tui --config tui/config/services.yaml
//	tui --no-start          # don't auto-spawn app services
//	tui --no-banner         # skip the PCOP startup banner
package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"time"

	tea "github.com/charmbracelet/bubbletea"

	"tui/internal/app"
	"tui/internal/config"
	"tui/internal/services"
	"tui/internal/styles"
)

func main() {
	configPath := flag.String("config", "config/services.yaml", "path to services.yaml")
	noStart := flag.Bool("no-start", false, "don't auto-spawn app services")
	noBanner := flag.Bool("no-banner", false, "skip the PCOP startup banner")
	dryRun := flag.Bool("dry-run", false, "print config and exit")
	flag.Parse()
	_ = configPath

	// Locate the repo root from the cwd (TUI is always run from inside
	// the repo, either from the repo root or from tui/).
	if err := cdToRepoRoot(); err != nil {
		fmt.Fprintln(os.Stderr, "warning: could not find repo root:", err)
	}

	// Load services.yaml.
	if err := config.Load(); err != nil {
		fmt.Fprintln(os.Stderr, "could not load services.yaml:", err)
		os.Exit(1)
	}

	if *dryRun {
		fmt.Printf("loaded %d docker services, %d app services, %d commands, %d scheduled tasks\n",
			len(config.Root.DockerServices),
			len(config.Root.AppServices),
			len(config.Root.Commands),
			len(config.Root.ScheduledTasks),
		)
		return
	}

	// Build manager + log broker.
	broker := services.NewLogBroker(2000)
	mgr := services.NewManager(broker)
	for _, s := range config.Root.AppServices {
		mgr.Register(services.ServiceState{
			Name:        s.Name,
			Color:       s.Color,
			Port:        s.Port,
			Dir:         config.ResolveDir(s.Dir),
			StartCmd:    s.StartCmd,
			HealthURL:   s.HealthURL,
			Kind:        s.Kind,
			Description: s.Description,
			NoAutoStart: s.NoAutoStart,
		})
	}
	for _, d := range config.Root.DockerServices {
		mgr.RegisterDocker(services.DockerState{
			Name:        d.Name,
			Container:   d.Container,
			Description: d.Description,
		})
	}

	// Import recent docker logs into the broker (if docker is available).
	if services.DockerAvailable() {
		_ = services.RunningContainerCount() // smoke test
		for _, d := range config.Root.DockerServices {
			status, err := services.CheckDockerService(d.Container)
			if err == nil && status.Running {
				lines, _ := services.GetDockerLogs(d.Container, 20)
				for _, l := range lines {
					broker.Publish(services.LogLine{
						Service: d.Name,
						Line:    l,
						Time:    time.Now(),
					})
				}
			}
		}
	}

	// Build scheduler history DB.
	histPath := filepath.Join("tui", "data", "task_history.db")
	_ = os.MkdirAll(filepath.Dir(histPath), 0o755)
	hist, err := services.NewTaskHistory(histPath)
	if err != nil {
		fmt.Fprintln(os.Stderr, "warning: could not open task history:", err)
	}

	// Build the top-level model.
	model := app.New(mgr, hist, config.Root.ScheduledTasks, config.Root.Commands)

	// Banner (optional, skipped by --no-banner).
	if !*noBanner {
		fmt.Println(styles.Title.Render("  PCOP "))
		fmt.Println(styles.Subtitle.Render("  Predictive Customer Outreach Platform"))
		fmt.Println(styles.Dim.Render("  Starting services..."))
		fmt.Println()
		time.Sleep(500 * time.Millisecond)
	}

	// Start services unless disabled.
	if !*noStart {
		// Preflight: kill any stale processes still holding the ports
		// we are about to bind to, so a previous run cannot block startup.
		services.KillPortOccupants(mgr.Ports(), broker)
		mgr.StartAll()
	}

	// Start background goroutines.
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	model.StartBackground(ctx)

	// Run bubbletea.
	p := tea.NewProgram(model, tea.WithAltScreen(), tea.WithMouseCellMotion())
	if _, err := p.Run(); err != nil {
		fmt.Fprintln(os.Stderr, "tui exited with error:", err)
		os.Exit(1)
	}
	_ = hist.Close()
}

// cdToRepoRoot walks up from cwd until it finds a directory with a
// `docker-compose.yml` (the canonical PCOP marker).
func cdToRepoRoot() error {
	cwd, _ := os.Getwd()
	dir := cwd
	for i := 0; i < 6; i++ {
		if _, err := os.Stat(filepath.Join(dir, "docker-compose.yml")); err == nil {
			return os.Chdir(dir)
		}
		if _, err := os.Stat(filepath.Join(dir, "tui", "config", "services.yaml")); err == nil {
			return os.Chdir(dir)
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	return fmt.Errorf("could not find repo root from %s", cwd)
}
