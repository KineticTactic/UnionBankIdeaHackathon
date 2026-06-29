// Package styles — central color palette and lipgloss style helpers.
package styles

import "github.com/charmbracelet/lipgloss"

// Color palette — one per service.  Read from config/services.yaml
// at startup; the defaults below are the canonical mapping.
var Palette = map[string]lipgloss.Color{
	"orchestrator": lipgloss.Color("#7C3AED"),
	"bank":         lipgloss.Color("#0EA5E9"),
	"argus":        lipgloss.Color("#DC2626"),
	"chronos":      lipgloss.Color("#2563EB"),
	"compass":      lipgloss.Color("#F59E0B"),
	"herald":       lipgloss.Color("#EC4899"),
	"verdict":      lipgloss.Color("#14B8A6"),
	"oracle":       lipgloss.Color("#A855F7"),
	"client":       lipgloss.Color("#059669"),
	"infra":        lipgloss.Color("#6B7280"),
	"mlflow":       lipgloss.Color("#0891B2"),
}

// ResolveColor returns the registered color for a service, or grey
// if the service is unknown.
func ResolveColor(name string) lipgloss.Color {
	if c, ok := Palette[name]; ok {
		return c
	}
	return lipgloss.Color("#9CA3AF")
}

// Status dot colors.
var (
	ColorHealthy   = lipgloss.Color("#22C55E") // green
	ColorDegraded  = lipgloss.Color("#F59E0B") // amber
	ColorCrashed   = lipgloss.Color("#EF4444") // red
	ColorUnknown   = lipgloss.Color("#6B7280") // grey
)

// Common text styles.
var (
	Title    = lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("#FAFAFA")).Background(lipgloss.Color("#1F2937")).Padding(0, 1)
	Subtitle = lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("#E5E7EB"))
	Label    = lipgloss.NewStyle().Foreground(lipgloss.Color("#9CA3AF"))
	Value    = lipgloss.NewStyle().Foreground(lipgloss.Color("#F3F4F6")).Bold(true)
	Bold     = lipgloss.NewStyle().Bold(true)
	Dim      = lipgloss.NewStyle().Foreground(lipgloss.Color("#6B7280"))
	Error    = lipgloss.NewStyle().Foreground(lipgloss.Color("#EF4444")).Bold(true)
	Warn     = lipgloss.NewStyle().Foreground(lipgloss.Color("#F59E0B"))
	OK       = lipgloss.NewStyle().Foreground(lipgloss.Color("#22C55E"))
	TabOn    = lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("#FAFAFA")).Background(lipgloss.Color("#3B82F6")).Padding(0, 1)
	TabOff   = lipgloss.NewStyle().Foreground(lipgloss.Color("#9CA3AF")).Padding(0, 1)
	TabSep   = lipgloss.NewStyle().Foreground(lipgloss.Color("#374151"))
	Box      = lipgloss.NewStyle().Border(lipgloss.RoundedBorder()).BorderForeground(lipgloss.Color("#374151")).Padding(0, 1)
	Footer   = lipgloss.NewStyle().Foreground(lipgloss.Color("#9CA3AF")).Padding(0, 1)
)

// Colorize renders text in a service's color.
func Colorize(name, text string) string {
	return lipgloss.NewStyle().Foreground(ResolveColor(name)).Render(text)
}

// ServiceStyle returns a style with the service's color as the foreground.
func ServiceStyle(name string) lipgloss.Style {
	return lipgloss.NewStyle().Foreground(ResolveColor(name))
}

// StatusStyle returns a style for a service status string.
func StatusStyle(status string) lipgloss.Style {
	switch status {
	case "healthy", "running", "ok", "ready":
		return lipgloss.NewStyle().Foreground(ColorHealthy).Bold(true)
	case "degraded", "starting":
		return lipgloss.NewStyle().Foreground(ColorDegraded).Bold(true)
	case "crashed", "stopped", "down", "unhealthy":
		return lipgloss.NewStyle().Foreground(ColorCrashed).Bold(true)
	default:
		return lipgloss.NewStyle().Foreground(ColorUnknown)
	}
}
