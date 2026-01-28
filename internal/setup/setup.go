package setup

import (
	"archive/zip"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// Paths
var (
	AME_DIR     = filepath.Join(os.Getenv("LOCALAPPDATA"), "ame")
	TOOLS_DIR   = filepath.Join(AME_DIR, "tools")
	SKINS_DIR   = filepath.Join(AME_DIR, "skins")
	MODS_DIR    = filepath.Join(AME_DIR, "mods")
	OVERLAY_DIR = filepath.Join(AME_DIR, "overlay")
	PENGU_DIR   = filepath.Join(AME_DIR, "pengu")
	PLUGIN_DIR  = filepath.Join(PENGU_DIR, "plugins", "ame")
)

// Tool files to download
var TOOL_FILES = []string{
	"mod-tools.exe",
	"cslol-diag.exe",
	"cslol-dll.dll",
	"wad-extract.exe",
	"wad-make.exe",
}

// Plugin files to download
var PLUGIN_FILES = []string{
	"index.js",
	"api.js",
	"chroma.js",
	"constants.js",
	"skin.js",
	"styles.js",
	"ui.js",
	"websocket.js",
}

// Config holds setup URLs
type Config struct {
	ToolsURL  string
	PenguURL  string
	PluginURL string
}

// log prints status message with formatting
func log(message string, logType string) {
	prefix := "[..]"
	switch logType {
	case "success":
		prefix = "[OK]"
	case "error":
		prefix = "[ERR]"
	}
	fmt.Printf("%s %s\n", prefix, message)
}

// downloadFile downloads a file from URL to destination
func downloadFile(url, dest string) error {
	resp, err := http.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("bad status: %d", resp.StatusCode)
	}

	out, err := os.Create(dest)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, resp.Body)
	return err
}

// extractZip extracts a zip file to destination directory
func extractZip(zipPath, destDir string) error {
	r, err := zip.OpenReader(zipPath)
	if err != nil {
		return err
	}
	defer r.Close()

	for _, f := range r.File {
		fpath := filepath.Join(destDir, f.Name)

		// Prevent zip slip vulnerability
		if !strings.HasPrefix(filepath.Clean(fpath), filepath.Clean(destDir)+string(os.PathSeparator)) {
			return fmt.Errorf("invalid file path: %s", f.Name)
		}

		if f.FileInfo().IsDir() {
			os.MkdirAll(fpath, os.ModePerm)
			continue
		}

		if err := os.MkdirAll(filepath.Dir(fpath), os.ModePerm); err != nil {
			return err
		}

		outFile, err := os.OpenFile(fpath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, f.Mode())
		if err != nil {
			return err
		}

		rc, err := f.Open()
		if err != nil {
			outFile.Close()
			return err
		}

		_, err = io.Copy(outFile, rc)
		outFile.Close()
		rc.Close()

		if err != nil {
			return err
		}
	}

	return nil
}

// isPenguActivated checks if Pengu Loader is activated via registry
func isPenguActivated() bool {
	cmd := exec.Command("reg", "query",
		`HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\LeagueClientUx.exe`,
		"/v", "Debugger")
	cmd.SysProcAttr = getSysProcAttr()
	err := cmd.Run()
	return err == nil
}

// launchPenguForActivation launches Pengu Loader and waits for user to close it
func launchPenguForActivation() error {
	penguExe := filepath.Join(PENGU_DIR, "Pengu Loader.exe")
	if _, err := os.Stat(penguExe); os.IsNotExist(err) {
		log("Pengu Loader.exe not found", "error")
		return err
	}

	fmt.Println("")
	fmt.Println("  ========================================")
	fmt.Println("  Please click 'Activate' in Pengu Loader")
	fmt.Println("  then close the window to continue.")
	fmt.Println("  ========================================")
	fmt.Println("")

	cmd := exec.Command(penguExe)
	cmd.SysProcAttr = getSysProcAttr()
	err := cmd.Run()
	if err != nil {
		return err
	}

	log("Pengu Loader closed", "success")
	return nil
}

// createDirectories creates all required directories
func createDirectories() {
	dirs := []string{AME_DIR, TOOLS_DIR, SKINS_DIR, MODS_DIR, OVERLAY_DIR, PENGU_DIR, PLUGIN_DIR}
	for _, dir := range dirs {
		os.MkdirAll(dir, os.ModePerm)
	}
}

// setupModTools downloads mod-tools if not present
func setupModTools(toolsURL string) bool {
	log("Checking mod-tools...", "info")

	modToolsPath := filepath.Join(TOOLS_DIR, "mod-tools.exe")
	if _, err := os.Stat(modToolsPath); err == nil {
		log("mod-tools already installed", "success")
		return true
	}

	log("Downloading mod-tools...", "info")
	allSuccess := true

	for _, file := range TOOL_FILES {
		url := toolsURL + "/" + file
		dest := filepath.Join(TOOLS_DIR, file)
		fmt.Printf("     Downloading %s...", file)
		if err := downloadFile(url, dest); err == nil {
			fmt.Println(" OK")
		} else {
			fmt.Println(" FAILED")
			allSuccess = false
		}
	}

	if allSuccess {
		log("mod-tools installed", "success")
	} else {
		log("Some mod-tools files failed to download", "error")
	}

	return allSuccess
}

// setupPenguLoader downloads and extracts Pengu Loader if not present
func setupPenguLoader(penguURL string) bool {
	log("Checking Pengu Loader...", "info")

	penguExe := filepath.Join(PENGU_DIR, "Pengu Loader.exe")
	if _, err := os.Stat(penguExe); err == nil {
		log("Pengu Loader already installed", "success")
		return true
	}

	log("Downloading Pengu Loader...", "info")
	zipPath := filepath.Join(AME_DIR, "pengu.zip")

	if err := downloadFile(penguURL, zipPath); err != nil {
		log("Failed to download Pengu Loader", "error")
		return false
	}

	log("Extracting Pengu Loader...", "info")
	if err := extractZip(zipPath, PENGU_DIR); err != nil {
		log("Failed to extract Pengu Loader", "error")
		return false
	}

	// Clean up zip
	os.Remove(zipPath)

	log("Pengu Loader installed", "success")
	return true
}

// setupPlugin downloads plugin files
func setupPlugin(pluginURL string) bool {
	log("Checking ame plugin...", "info")
	log("Installing ame plugin...", "info")

	allSuccess := true
	for _, file := range PLUGIN_FILES {
		url := pluginURL + "/" + file
		dest := filepath.Join(PLUGIN_DIR, file)
		if err := downloadFile(url, dest); err != nil {
			log(fmt.Sprintf("Failed to download %s", file), "error")
			allSuccess = false
		}
	}

	if allSuccess {
		log("ame plugin installed", "success")
	} else {
		log("Some plugin files failed to download", "error")
	}

	return allSuccess
}

// checkPenguActivation checks and prompts for Pengu activation
func checkPenguActivation() {
	log("Checking Pengu activation...", "info")

	if isPenguActivated() {
		log("Pengu Loader already activated", "success")
		return
	}

	launchPenguForActivation()
}

// RunSetup runs the full setup process
func RunSetup(config Config) bool {
	fmt.Println("")
	fmt.Println("  ======================================")
	fmt.Println("    ame - skin changer")
	fmt.Println("  ======================================")
	fmt.Println("")

	// Create directories
	createDirectories()

	// Setup mod-tools
	if !setupModTools(config.ToolsURL) {
		log("Setup failed: mod-tools", "error")
		return false
	}

	// Setup Pengu Loader
	if !setupPenguLoader(config.PenguURL) {
		log("Setup failed: Pengu Loader", "error")
		return false
	}

	// Setup plugin
	if !setupPlugin(config.PluginURL) {
		log("Setup failed: plugin", "error")
		return false
	}

	// Check activation
	checkPenguActivation()

	fmt.Println("")
	log("Setup complete!", "success")
	fmt.Println("")

	return true
}
