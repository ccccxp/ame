package game

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/hoangvu12/ame/internal/config"
)

var cachedGameDir string

// isValidGameDir checks if a directory contains League of Legends.exe
func isValidGameDir(dir string) bool {
	return fileExists(filepath.Join(dir, "League of Legends.exe"))
}

// getSavedGameDir reads the saved game directory from config
func getSavedGameDir() string {
	dir := config.GamePath()
	if dir != "" && isValidGameDir(dir) {
		return dir
	}
	return ""
}

// SaveGameDir persists the game directory to config
func SaveGameDir(dir string) {
	config.SetGamePath(dir)
}

// FindGameDir finds League of Legends Game directory using multiple detection methods.
// Returns the cached/saved path if still valid, otherwise runs auto-detection.
func FindGameDir() string {
	// 0. In-memory cache
	if cachedGameDir != "" && isValidGameDir(cachedGameDir) {
		return cachedGameDir
	}

	// 1. Saved path from previous run
	if dir := getSavedGameDir(); dir != "" {
		cachedGameDir = dir
		return dir
	}

	// 2. Common paths on all fixed drives
	drives := getFixedDrives()
	for _, drive := range drives {
		path := filepath.Join(drive, "Riot Games", "League of Legends", "Game")
		if isValidGameDir(path) {
			cachedGameDir = path
			SaveGameDir(path)
			return path
		}
	}

	// 3. RiotClientInstalls.json
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
					if isValidGameDir(gameDir) {
						cachedGameDir = gameDir
						SaveGameDir(gameDir)
						return gameDir
					}
				}
			}
		}
	}

	// 4. Running LeagueClientUx.exe process
	if output := runCommand("wmic", "process", "where", "name='LeagueClientUx.exe'", "get", "ExecutablePath", "/value"); output != "" {
		re := regexp.MustCompile(`ExecutablePath=(.+)`)
		if match := re.FindStringSubmatch(output); len(match) > 1 {
			exePath := strings.TrimSpace(match[1])
			gameDir := filepath.Join(exePath, "..", "Game")
			if isValidGameDir(gameDir) {
				cachedGameDir = gameDir
				SaveGameDir(gameDir)
				return gameDir
			}
		}
	}

	// 5. Registry lookup
	if output := runCommand("reg", "query", `HKLM\SOFTWARE\WOW6432Node\Riot Games, Inc\League of Legends`, "/v", "Location"); output != "" {
		re := regexp.MustCompile(`Location\s+REG_SZ\s+(.+)`)
		if match := re.FindStringSubmatch(output); len(match) > 1 {
			loc := strings.TrimSpace(match[1])
			gameDir := filepath.Join(loc, "Game")
			if isValidGameDir(gameDir) {
				cachedGameDir = gameDir
				SaveGameDir(gameDir)
				return gameDir
			}
		}
	}

	return ""
}

// PromptGameDir asks the user to manually enter the game directory.
// Returns the validated path, or empty string if the user skips.
func PromptGameDir() string {
	reader := bufio.NewReader(os.Stdin)

	fmt.Println("  Enter the path to the Game folder, for example:")
	fmt.Println("  C:\\Riot Games\\League of Legends\\Game")
	fmt.Println()

	for {
		fmt.Print("  Path (or press Enter to skip): ")
		input, _ := reader.ReadString('\n')
		input = strings.TrimSpace(input)

		if input == "" {
			return ""
		}

		// Remove surrounding quotes if user pasted a quoted path
		input = strings.Trim(input, `"'`)

		if isValidGameDir(input) {
			cachedGameDir = input
			SaveGameDir(input)
			fmt.Printf("  > %s\n", input)
			return input
		}

		fmt.Println("  ! League of Legends.exe not found in that folder.")
		fmt.Println()
	}
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
