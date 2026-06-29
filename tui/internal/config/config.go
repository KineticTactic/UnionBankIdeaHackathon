// Package config — TUI configuration loader.
package config

import (
	"fmt"
	"os"
	"path/filepath"

	"gopkg.in/yaml.v3"
)

// DockerService describes a single docker-compose service.
type DockerService struct {
	Name        string `yaml:"name"`
	Container   string `yaml:"container"`
	HealthCmd   string `yaml:"health_cmd"`
	Description string `yaml:"description"`
}

// AppService describes a runnable app service.
type AppService struct {
	Name        string `yaml:"name"`
	Color       string `yaml:"color"`
	Dir         string `yaml:"dir"`
	StartCmd    string `yaml:"start_cmd"`
	HealthURL   string `yaml:"health_url"`
	Port        int    `yaml:"port"`
	Kind        string `yaml:"kind"` // node | python | bash
	Description string `yaml:"description"`
}

// Command is a runnable command registered in the TUI palette.
type Command struct {
	Name        string `yaml:"name"`
	Description string `yaml:"description"`
	Service     string `yaml:"service"`
	Cmd         string `yaml:"cmd"`
	Dir         string `yaml:"dir"`
}

// ScheduledTask is a cron-scheduled command.
type ScheduledTask struct {
	Name        string `yaml:"name"`
	CommandRef  string `yaml:"command_ref"`
	Schedule    string `yaml:"schedule"`
	Enabled     bool   `yaml:"enabled"`
	Description string `yaml:"description"`
}

// Services is the top-level config structure.
type Services struct {
	DockerServices  []DockerService  `yaml:"docker_services"`
	AppServices     []AppService     `yaml:"app_services"`
	Commands        []Command        `yaml:"commands"`
	ScheduledTasks  []ScheduledTask  `yaml:"scheduled_tasks"`
}

// Root is the global services config.
var Root Services

// Load reads the services.yaml file from the TUI's config directory.
func Load() error {
	candidates := []string{
		"config/services.yaml",
		"tui/config/services.yaml",
	}
	for _, p := range candidates {
		if _, err := os.Stat(p); err == nil {
			return loadFile(p)
		}
	}
	return fmt.Errorf("could not find services.yaml in any candidate path: %v", candidates)
}

func loadFile(path string) error {
	abs, err := filepath.Abs(path)
	if err != nil {
		return err
	}
	data, err := os.ReadFile(abs)
	if err != nil {
		return err
	}
	if err := yaml.Unmarshal(data, &Root); err != nil {
		return fmt.Errorf("yaml parse error in %s: %w", abs, err)
	}
	return nil
}

// RepoRoot returns the repository root (parent of tui/).
// Resolved by walking up from the CWD.
func RepoRoot() string {
	cwd, _ := os.Getwd()
	dir := cwd
	for i := 0; i < 6; i++ {
		if filepath.Base(dir) == "tui" {
			return filepath.Dir(dir)
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	return cwd
}

// ResolveDir resolves a service's `dir:` field against the repo root.
// Relative paths are taken from the repo root; absolute paths are
// returned as-is.
func ResolveDir(dir string) string {
	if dir == "" {
		return RepoRoot()
	}
	if filepath.IsAbs(dir) {
		return dir
	}
	return filepath.Join(RepoRoot(), dir)
}
