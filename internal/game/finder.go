package game

import (
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
)

// FindGameDir finds League of Legends Game directory using multiple detection methods
func FindGameDir() string {
	// 1. Common paths on all fixed drives
	drives := getFixedDrives()
	for _, drive := range drives {
		path := filepath.Join(drive, "Riot Games", "League of Legends", "Game")
		if fileExists(filepath.Join(path, "League of Legends.exe")) {
			return path
		}
	}

	// 2. RiotClientInstalls.json
	rcPath := `C:\ProgramData\Riot Games\RiotClientInstalls.json`
	if data, err := os.ReadFile(rcPath); err == nil {
		var rc map[string]interface{}
		if err := json.Unmarshal(data, &rc); err == nil {
			var paths []string

			if assoc, ok := rc["associated_client"].(map[string]interface{}); ok {
				for key := range assoc {
					paths = append(paths, key)
				}
			}
			if def, ok := rc["rc_default"].(string); ok {
				paths = append(paths, def)
			}
			if live, ok := rc["rc_live"].(string); ok {
				paths = append(paths, live)
			}

			leagueRe := regexp.MustCompile(`(?i)league`)
			for _, p := range paths {
				if leagueRe.MatchString(p) {
					candidate := filepath.Join(p, "..")
					gameDir := filepath.Join(candidate, "Game")
					if fileExists(filepath.Join(gameDir, "League of Legends.exe")) {
						return gameDir
					}
				}
			}
		}
	}

	// 3. Running LeagueClientUx.exe process
	if output := runCommand("wmic", "process", "where", "name='LeagueClientUx.exe'", "get", "ExecutablePath", "/value"); output != "" {
		re := regexp.MustCompile(`ExecutablePath=(.+)`)
		if match := re.FindStringSubmatch(output); len(match) > 1 {
			exePath := strings.TrimSpace(match[1])
			gameDir := filepath.Join(exePath, "..", "Game")
			if fileExists(filepath.Join(gameDir, "League of Legends.exe")) {
				return gameDir
			}
		}
	}

	// 4. Registry lookup
	if output := runCommand("reg", "query", `HKLM\SOFTWARE\WOW6432Node\Riot Games, Inc\League of Legends`, "/v", "Location"); output != "" {
		re := regexp.MustCompile(`Location\s+REG_SZ\s+(.+)`)
		if match := re.FindStringSubmatch(output); len(match) > 1 {
			loc := strings.TrimSpace(match[1])
			gameDir := filepath.Join(loc, "Game")
			if fileExists(filepath.Join(gameDir, "League of Legends.exe")) {
				return gameDir
			}
		}
	}

	return ""
}

// getFixedDrives returns list of accessible drives (C:, D:, etc.)
func getFixedDrives() []string {
	var drives []string

	// Try drives A-Z
	for i := 'A'; i <= 'Z'; i++ {
		drive := string(i) + `:\`
		if info, err := os.Stat(drive); err == nil && info.IsDir() {
			// Check if accessible by trying to read directory
			if _, err := os.ReadDir(drive); err == nil {
				drives = append(drives, drive)
			}
		}
	}

	return drives
}

// fileExists checks if a file exists
func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

// runCommand runs a command and returns its output
func runCommand(name string, args ...string) string {
	cmd := exec.Command(name, args...)
	cmd.SysProcAttr = getSysProcAttr()
	output, err := cmd.Output()
	if err != nil {
		return ""
	}
	return string(output)
}
