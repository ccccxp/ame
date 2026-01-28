package modtools

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
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

	args := []string{
		"mkoverlay",
		modsDir,
		overlayDir,
		"--game:" + gameDir,
		"--mods:" + modName,
		"--noTFT",
		"--ignoreConflict",
	}

	fmt.Printf("[ame] Running: mod-tools.exe %s\n", args)

	cmd := exec.Command(modTools, args...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.SysProcAttr = getSysProcAttr()

	err := cmd.Run()
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			return false, exitErr.ExitCode()
		}
		return false, 1
	}

	return true, 0
}

// RunOverlay runs mod-tools runoverlay command (non-blocking/detached)
func RunOverlay(overlayDir, configPath, gameDir string) error {
	modTools := filepath.Join(TOOLS_DIR, "mod-tools.exe")

	if _, err := os.Stat(modTools); os.IsNotExist(err) {
		return fmt.Errorf("mod-tools.exe not found")
	}

	args := []string{
		"runoverlay",
		overlayDir,
		configPath,
		"--game:" + gameDir,
		"--opts:configless",
	}

	fmt.Printf("[ame] Running: mod-tools.exe %v\n", args)

	cmd := exec.Command(modTools, args...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.SysProcAttr = getDetachedSysProcAttr()

	err := cmd.Start()
	if err != nil {
		fmt.Printf("[ame] Failed to start runoverlay: %v\n", err)
		return err
	}
	fmt.Printf("[ame] runoverlay started with PID %d\n", cmd.Process.Pid)
	return nil
}

// Exists checks if mod-tools.exe exists
func Exists() bool {
	modTools := filepath.Join(TOOLS_DIR, "mod-tools.exe")
	_, err := os.Stat(modTools)
	return err == nil
}
