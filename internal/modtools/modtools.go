package modtools

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
	"time"
)

var TOOLS_DIR = filepath.Join(os.Getenv("LOCALAPPDATA"), "ame", "tools")

// KillModTools kills any running mod-tools processes
func KillModTools() {
	cmd := exec.Command("taskkill", "/F", "/IM", "mod-tools.exe")
	cmd.SysProcAttr = getSysProcAttr()
	cmd.Run() // Ignore errors - process might not be running
}

// RunMkOverlay runs mod-tools mkoverlay command
func RunMkOverlay(modsDir, overlayDir, gameDir, modName string) (bool, int) {
	modTools := filepath.Join(TOOLS_DIR, "mod-tools.exe")

	if _, err := os.Stat(modTools); os.IsNotExist(err) {
		return false, 1
	}

	args := fmt.Sprintf(`mkoverlay "%s" "%s" "--game:%s" --mods:%s --noTFT --ignoreConflict`,
		modsDir, overlayDir, gameDir, modName)

	fmt.Printf("[ame] Running: %s %s\n", modTools, args)

	cmd := exec.Command(modTools, "mkoverlay", modsDir, overlayDir,
		fmt.Sprintf("--game:%s", gameDir),
		fmt.Sprintf("--mods:%s", modName),
		"--noTFT", "--ignoreConflict")
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Dir = TOOLS_DIR

	err := cmd.Run()
	if err != nil {
		fmt.Printf("[ame] mkoverlay error: %v\n", err)
		if exitErr, ok := err.(*exec.ExitError); ok {
			return false, exitErr.ExitCode()
		}
		return false, 1
	}

	return true, 0
}

// RunOverlay runs mod-tools runoverlay command (detached, like Bun version)
func RunOverlay(overlayDir, configPath, gameDir string) error {
	modTools := filepath.Join(TOOLS_DIR, "mod-tools.exe")

	if _, err := os.Stat(modTools); os.IsNotExist(err) {
		return fmt.Errorf("mod-tools.exe not found")
	}

	fmt.Printf("[ame] Running: %s runoverlay \"%s\" \"%s\" \"--game:%s\" --opts:configless\n",
		modTools, overlayDir, configPath, gameDir)

	cmd := exec.Command(modTools, "runoverlay",
		overlayDir, configPath,
		fmt.Sprintf("--game:%s", gameDir),
		"--opts:configless")

	// Match Bun's behavior: detached: true, stdio: "ignore"
	// This means no stdin/stdout/stderr and CREATE_NEW_PROCESS_GROUP | DETACHED_PROCESS
	cmd.Stdin = nil
	cmd.Stdout = nil
	cmd.Stderr = nil
	cmd.Dir = TOOLS_DIR
	cmd.SysProcAttr = &syscall.SysProcAttr{
		CreationFlags: syscall.CREATE_NEW_PROCESS_GROUP | 0x00000008, // DETACHED_PROCESS
	}

	err := cmd.Start()
	if err != nil {
		fmt.Printf("[ame] Failed to start runoverlay: %v\n", err)
		return err
	}

	fmt.Printf("[ame] runoverlay started with PID %d\n", cmd.Process.Pid)

	// Release the process so it continues independently
	cmd.Process.Release()

	// Wait a moment and check if mod-tools is running
	time.Sleep(1 * time.Second)

	checkCmd := exec.Command("tasklist", "/FI", "IMAGENAME eq mod-tools.exe", "/NH")
	checkCmd.SysProcAttr = getSysProcAttr()
	output, _ := checkCmd.Output()
	outputStr := string(output)
	fmt.Printf("[ame] runoverlay process check: %s\n", outputStr)

	return nil
}

// Exists checks if mod-tools.exe exists
func Exists() bool {
	modTools := filepath.Join(TOOLS_DIR, "mod-tools.exe")
	_, err := os.Stat(modTools)
	return err == nil
}
