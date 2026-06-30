// quick visual test of the services bar
package main

import (
	"fmt"
	"strings"

	"tui/internal/pages"
	"tui/internal/services"
)

func main() {
	broker := services.NewLogBroker(100)
	mgr := services.NewManager(broker)

	// Register a representative slice of app services
	for _, s := range []services.ServiceState{
		{Name: "orchestrator", Port: 8000, Health: "healthy", Status: "running"},
		{Name: "bank", Port: 3001, Health: "healthy", Status: "running"},
		{Name: "argus", Port: 8002, Health: "healthy", Status: "running"},
		{Name: "chronos", Port: 8001, Health: "degraded", Status: "running"},
		{Name: "compass", Port: 8004, Health: "healthy", Status: "running"},
		{Name: "herald", Port: 8005, Health: "healthy", Status: "running"},
		{Name: "verdict", Port: 8006, Health: "unhealthy", Status: "running"},
		{Name: "oracle", Port: 8007, Health: "healthy", Status: "running"},
		{Name: "client", Port: 3000, Health: "healthy", Status: "running"},
		{Name: "scoring", Port: 8010, Health: "healthy", Status: "stopped"},
	} {
		mgr.Register(s)
	}
	for _, d := range []services.DockerState{
		{Name: "postgres", Container: "pcop_postgres", Running: true, Health: "healthy"},
		{Name: "redis", Container: "pcop_redis", Running: true, Health: "healthy"},
		{Name: "kafka", Container: "pcop_kafka", Running: true, Health: "none"},
		{Name: "mlflow", Container: "pcop_mlflow", Running: false, Health: "none"},
	} {
		mgr.RegisterDocker(d)
	}

	for _, w := range []int{160, 120, 80} {
		fmt.Printf("\n========= width = %d =========\n", w)
		bar := pages.RenderServicesBar(mgr, w)
		fmt.Println(strings.TrimRight(bar, "\n"))
	}
}
