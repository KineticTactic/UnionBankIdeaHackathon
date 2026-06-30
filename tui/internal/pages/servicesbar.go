// Package pages — horizontal services bar.
//
// A single-row, auto-wrapping tile strip shown at the top of the
// dashboard.  Each tile is a small rounded card showing one running
// service or docker container:
//
//	┌──────────────┐ ┌──────────────┐ ┌──────────────┐
//	│ ● orchestr.  │ │ ● chronos    │ │ ● postgres   │
//	│   :8000  ▲   │ │   :8001  ▲   │ │   docker ▲   │
//	└──────────────┘ └──────────────┘ └──────────────┘
//
// Tiles flow left-to-right and wrap to additional rows based on the
// terminal width.  Status (healthy / degraded / crashed / stopped) is
// indicated by a colored dot, a colored border, and a one-line status
// badge.
package pages

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/lipgloss"

	"tui/internal/services"
	"tui/internal/styles"
)

// Tile is the rendered string for one service card.
type Tile struct {
	rendered string
	width    int
}

// RenderServicesBar builds the full horizontal services bar.
// `width` is the terminal width; tiles wrap to additional rows.
func RenderServicesBar(mgr *services.Manager, width int) string {
	if width <= 0 {
		return ""
	}

	appStates := mgr.All()
	dockStates := mgr.AllDocker()

	// Build tiles in two rows: app services on top, docker below.
	// The order is deterministic (insertion order in the manager).
	var appTiles, dockerTiles []Tile
	for _, s := range appStates {
		appTiles = append(appTiles, renderAppTile(s))
	}
	for _, d := range dockStates {
		dockerTiles = append(dockerTiles, renderDockerTile(d))
	}

	var sb strings.Builder
	if len(appTiles) > 0 {
		sb.WriteString(styles.BarLabel.Render("APP"))
		sb.WriteString(styles.BarSection.Render("─"))
		sb.WriteString("\n")
		sb.WriteString(wrapTiles(appTiles, width))
		sb.WriteString("\n")
	}

	// Only show the DOCKER section if docker is reachable AND at least
	// one registered container has been observed as ever running.
	// This avoids cluttering the bar with offline placeholders when the
	// operator is running the app services directly without the
	// docker-compose stack.
	hasDocker := false
	for _, d := range dockStates {
		if d.LastCheck.IsZero() {
			continue // never polled yet
		}
		if d.Running {
			hasDocker = true
			break
		}
	}
	if hasDocker && len(dockerTiles) > 0 {
		sb.WriteString(styles.BarLabel.Render("DOCKER"))
		sb.WriteString(styles.BarSection.Render("─"))
		sb.WriteString("\n")
		sb.WriteString(wrapTiles(dockerTiles, width))
		sb.WriteString("\n")
	} else if len(dockStates) > 0 {
		// Show a single hint line so the operator knows the docker
		// section exists but is empty (e.g. compose stack not up).
		sb.WriteString(styles.BarLabel.Render("DOCKER"))
		sb.WriteString(styles.Dim.Render("─ (no containers running — start with `docker compose up -d`)"))
		sb.WriteString("\n")
	}
	return sb.String()
}

// renderAppTile builds the card for one app service.
func renderAppTile(s services.ServiceState) Tile {
	dot := renderDot(s.Health)
	status := compactStatus(s)
	tileStyle := tileStyleFor(s.Health)

	// First line: dot · name (color of service)
	nameStyled := lipgloss.NewStyle().
		Foreground(styles.ResolveColor(s.Name)).
		Bold(true).
		Render(truncate(s.Name, 11))

	row1 := dot + " " + nameStyled

	// Second line: port (dim) + status badge
	port := styles.Dim.Render(fmt.Sprintf(":%d", s.Port))
	badge := styles.StatusStyle(s.Health).Render(status)
	row2 := port + "  " + badge

	content := row1 + "\n" + row2
	return Tile{
		rendered: tileStyle.Render(content),
		width:    lipgloss.Width(tileStyle.Render(content)),
	}
}

// renderDockerTile builds the card for one docker container.
func renderDockerTile(d services.DockerState) Tile {
	dot := renderDockerDot(d)
	status := "stopped"
	if d.Running {
		status = "running"
	}
	tileStyle := dockerTileStyleFor(d)

	nameStyled := lipgloss.NewStyle().
		Foreground(styles.ResolveColor(d.Name)).
		Bold(true).
		Render(truncate(d.Name, 11))

	row1 := dot + " " + nameStyled

	// Show container port / state badge
	badgeText := status
	if d.Running && d.Health != "" && d.Health != "none" {
		badgeText = d.Health
	}
	badge := styles.StatusStyle(badgeText).Render(badgeText)
	dockerLabel := styles.Dim.Render("docker")
	row2 := dockerLabel + "  " + badge

	content := row1 + "\n" + row2
	return Tile{
		rendered: tileStyle.Render(content),
		width:    lipgloss.Width(tileStyle.Render(content)),
	}
}

// wrapTiles joins tiles left-to-right with a 1-space gap, wrapping
// to new rows when the line would exceed `width`.  Uses lipgloss's
// JoinHorizontal so the multi-line tile boxes line up correctly.
func wrapTiles(tiles []Tile, width int) string {
	if len(tiles) == 0 {
		return ""
	}

	// Step 1: build rows greedily.  A row is a list of tiles whose
	// combined width (with gaps) does not exceed `width`.
	var rows [][]Tile
	var cur []Tile
	curW := 0
	const gap = 1
	for _, t := range tiles {
		w := t.width
		if w == 0 {
			firstLine := strings.SplitN(t.rendered, "\n", 2)[0]
			w = lipgloss.Width(firstLine)
		}
		if curW == 0 {
			cur = append(cur, t)
			curW = w
			continue
		}
		if curW+gap+w > width {
			rows = append(rows, cur)
			cur = []Tile{t}
			curW = w
			continue
		}
		cur = append(cur, t)
		curW += gap + w
	}
	if len(cur) > 0 {
		rows = append(rows, cur)
	}

	// Step 2: render each row using JoinHorizontal so the boxes
	// align line-by-line.
	var out []string
	for _, row := range rows {
		strs := make([]string, len(row))
		for i, t := range row {
			strs[i] = t.rendered
		}
		out = append(out, lipgloss.JoinHorizontal(gap, strs...))
	}
	return strings.Join(out, "\n")
}

func renderDot(health string) string {
	// Deprecated: the old dashboard 2-col grid used this.  The new
	// services bar in servicesbar.go has its own renderers.  Kept
	// here as a no-op so the package still compiles.
	return styles.Dim.Render("○")
}

func renderDockerDot(d services.DockerState) string {
	if !d.Running {
		return styles.Dim.Render("○")
	}
	switch d.Health {
	case "healthy":
		return styles.OK.Render("●")
	case "starting":
		return styles.Warn.Render("●")
	case "unhealthy":
		return styles.Error.Render("●")
	default:
		// No healthcheck — treat running as healthy
		return styles.OK.Render("●")
	}
}

func compactStatus(s services.ServiceState) string {
	switch s.Status {
	case "running":
		if s.Health == "healthy" {
			return "up"
		}
		if s.Health == "degraded" {
			return "warn"
		}
		if s.Health == "unhealthy" {
			return "down"
		}
		return "starting"
	case "starting":
		return "starting"
	case "crashed":
		return "crashed"
	case "stopped":
		return "stopped"
	default:
		return s.Status
	}
}

func tileStyleFor(health string) lipgloss.Style {
	switch health {
	case "healthy":
		return styles.TileHealthy
	case "degraded":
		return styles.TileDegraded
	case "unhealthy":
		return styles.TileCrashed
	case "starting":
		return styles.TileDegraded
	default:
		return styles.TileStopped
	}
}

func dockerTileStyleFor(d services.DockerState) lipgloss.Style {
	if !d.Running {
		return styles.TileStopped
	}
	switch d.Health {
	case "healthy":
		return styles.TileHealthy
	case "starting":
		return styles.TileDegraded
	case "unhealthy":
		return styles.TileCrashed
	default:
		// No healthcheck on the container — green border
		return styles.TileHealthy
	}
}
