// Package services — Docker integration.
package services

import (
	"context"
	"encoding/json"
	"fmt"
	"os/exec"
	"strings"
	"time"
)

// DockerStatus describes the live state of a container.
type DockerStatus struct {
	Name     string
	Running  bool
	Health   string // healthy | starting | unhealthy | none
	Image    string
	State    string
	ExitCode int
}

// CheckDockerService runs `docker inspect` to see if a container is running.
func CheckDockerService(containerName string) (DockerStatus, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	out, err := exec.CommandContext(ctx, "docker", "inspect", containerName, "--format", "{{.State.Running}}|{{.State.Health.Status}}|{{.State.Status}}|{{.State.ExitCode}}|{{.Config.Image}}").Output()
	if err != nil {
		return DockerStatus{Name: containerName, Running: false}, fmt.Errorf("docker inspect: %w", err)
	}
	parts := strings.Split(strings.TrimSpace(string(out)), "|")
	if len(parts) < 5 {
		return DockerStatus{Name: containerName, Running: false}, fmt.Errorf("unexpected inspect output: %q", string(out))
	}
	running := parts[0] == "true"
	health := parts[1]
	if health == "<no value>" {
		health = "none"
	}
	image := parts[4]
	if i := strings.LastIndex(image, "/"); i >= 0 {
		image = image[i+1:]
	}
	return DockerStatus{
		Name:     containerName,
		Running:  running,
		Health:   health,
		State:    parts[2],
		ExitCode: atoiSafe(parts[3]),
		Image:    image,
	}, nil
}

// StartDockerService runs `docker compose up -d <service>`.
// `composeFile` is the absolute path to docker-compose.yml.
func StartDockerService(composeFile, serviceName string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, "docker", "compose", "-f", composeFile, "up", "-d", serviceName)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("docker compose up: %w\n%s", err, string(out))
	}
	return nil
}

// GetDockerLogs returns the last N lines of a container's logs.
func GetDockerLogs(containerName string, lines int) ([]string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, "docker", "logs", "--tail", fmt.Sprintf("%d", lines), containerName)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("docker logs: %w", err)
	}
	return splitLines(string(out)), nil
}

// DockerAvailable returns true if the `docker` CLI is on PATH.
func DockerAvailable() bool {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	if err := exec.CommandContext(ctx, "docker", "version", "--format", "{{.Server.Version}}").Run(); err != nil {
		return false
	}
	return true
}

// RunningContainerCount returns the number of containers whose name
// matches the docker-compose project.
func RunningContainerCount() int {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, "docker", "ps", "--format", "{{.Names}}")
	out, err := cmd.Output()
	if err != nil {
		return 0
	}
	return len(splitLines(strings.TrimSpace(string(out))))
}

// ContainerListRaw returns the JSON output of `docker ps -a`.
func ContainerListRaw() ([]map[string]any, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, "docker", "ps", "-a", "--format", "{{json .}}")
	out, err := cmd.Output()
	if err != nil {
		return nil, err
	}
	var result []map[string]any
	for _, line := range splitLines(strings.TrimSpace(string(out))) {
		var m map[string]any
		if err := json.Unmarshal([]byte(line), &m); err == nil {
			result = append(result, m)
		}
	}
	return result, nil
}

// ── helpers ────────────────────────────────────────────────────────────────
func splitLines(s string) []string {
	if s == "" {
		return nil
	}
	return strings.Split(s, "\n")
}

func atoiSafe(s string) int {
	n := 0
	for _, c := range s {
		if c < '0' || c > '9' {
			return 0
		}
		n = n*10 + int(c-'0')
	}
	return n
}
