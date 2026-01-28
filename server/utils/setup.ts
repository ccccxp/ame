import { existsSync, mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

// Paths
const AME_DIR = join(process.env.LOCALAPPDATA!, "ame");
const TOOLS_DIR = join(AME_DIR, "tools");
const SKINS_DIR = join(AME_DIR, "skins");
const MODS_DIR = join(AME_DIR, "mods");
const OVERLAY_DIR = join(AME_DIR, "overlay");
const PENGU_DIR = join(AME_DIR, "pengu");
const PLUGIN_DIR = join(PENGU_DIR, "plugins", "ame");

// URLs
const TOOLS_BASE_URL = "https://raw.githubusercontent.com/user/repo/main/tools";
const PENGU_ZIP_URL = "https://github.com/user/repo/releases/download/v1.1.6/pengu-loader-v1.1.6.zip";
const PLUGIN_BASE_URL = "https://raw.githubusercontent.com/user/repo/main/src";

// Tool files to download
const TOOL_FILES = [
  "mod-tools.exe",
  "cslol-diag.exe",
  "cslol-dll.dll",
  "wad-extract.exe",
  "wad-make.exe",
];

// Plugin files to download
const PLUGIN_FILES = [
  "index.js",
  "api.js",
  "chroma.js",
  "constants.js",
  "skin.js",
  "styles.js",
  "ui.js",
  "websocket.js",
];

/**
 * Print status message with formatting
 */
function log(message: string, type: "info" | "success" | "error" = "info"): void {
  const prefix = type === "success" ? "[OK]" : type === "error" ? "[ERR]" : "[..]";
  console.log(`${prefix} ${message}`);
}

/**
 * Download a file from URL to destination
 */
async function downloadFile(url: string, dest: string): Promise<boolean> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return false;
    }
    const buffer = await response.arrayBuffer();
    writeFileSync(dest, Buffer.from(buffer));
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract a zip file using PowerShell
 */
async function extractZip(zipPath: string, destDir: string): Promise<boolean> {
  try {
    const proc = Bun.spawn(
      ["powershell", "-NoProfile", "-Command", `Expand-Archive -Force '${zipPath}' '${destDir}'`],
      { stdout: "inherit", stderr: "inherit" }
    );
    const exitCode = await proc.exited;
    return exitCode === 0;
  } catch {
    return false;
  }
}

/**
 * Check if Pengu Loader is activated via registry
 */
function isPenguActivated(): boolean {
  try {
    execSync(
      'reg query "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\LeagueClientUx.exe" /v Debugger',
      { encoding: "utf-8", timeout: 5000, windowsHide: true, stdio: "pipe" }
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Launch Pengu Loader and wait for user to close it
 */
async function launchPenguForActivation(): Promise<void> {
  const penguExe = join(PENGU_DIR, "Pengu Loader.exe");
  if (!existsSync(penguExe)) {
    log("Pengu Loader.exe not found", "error");
    return;
  }

  console.log("");
  console.log("  ========================================");
  console.log("  Please click 'Activate' in Pengu Loader");
  console.log("  then close the window to continue.");
  console.log("  ========================================");
  console.log("");

  const proc = Bun.spawn([penguExe], {
    stdout: "ignore",
    stderr: "ignore",
  });

  await proc.exited;
  log("Pengu Loader closed", "success");
}

/**
 * Create all required directories
 */
function createDirectories(): void {
  const dirs = [AME_DIR, TOOLS_DIR, SKINS_DIR, MODS_DIR, OVERLAY_DIR, PENGU_DIR, PLUGIN_DIR];
  for (const dir of dirs) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }
}

/**
 * Setup mod-tools
 */
async function setupModTools(toolsUrl: string): Promise<boolean> {
  log("Checking mod-tools...");

  const modToolsPath = join(TOOLS_DIR, "mod-tools.exe");
  if (existsSync(modToolsPath)) {
    log("mod-tools already installed", "success");
    return true;
  }

  log("Downloading mod-tools...");
  let allSuccess = true;

  for (const file of TOOL_FILES) {
    const url = `${toolsUrl}/${file}`;
    const dest = join(TOOLS_DIR, file);
    process.stdout.write(`     Downloading ${file}...`);
    const ok = await downloadFile(url, dest);
    if (ok) {
      console.log(" OK");
    } else {
      console.log(" FAILED");
      allSuccess = false;
    }
  }

  if (allSuccess) {
    log("mod-tools installed", "success");
  } else {
    log("Some mod-tools files failed to download", "error");
  }

  return allSuccess;
}

/**
 * Setup Pengu Loader
 */
async function setupPenguLoader(penguUrl: string): Promise<boolean> {
  log("Checking Pengu Loader...");

  const penguExe = join(PENGU_DIR, "Pengu Loader.exe");
  if (existsSync(penguExe)) {
    log("Pengu Loader already installed", "success");
    return true;
  }

  log("Downloading Pengu Loader...");
  const zipPath = join(AME_DIR, "pengu.zip");

  const ok = await downloadFile(penguUrl, zipPath);
  if (!ok) {
    log("Failed to download Pengu Loader", "error");
    return false;
  }

  log("Extracting Pengu Loader...");
  const extracted = await extractZip(zipPath, PENGU_DIR);
  if (!extracted) {
    log("Failed to extract Pengu Loader", "error");
    return false;
  }

  // Clean up zip
  try {
    unlinkSync(zipPath);
  } catch {}

  log("Pengu Loader installed", "success");
  return true;
}

/**
 * Setup ame plugin
 */
async function setupPlugin(pluginUrl: string): Promise<boolean> {
  log("Checking ame plugin...");

  const indexPath = join(PLUGIN_DIR, "index.js");

  // Always update plugin to latest version
  log("Installing ame plugin...");

  let allSuccess = true;
  for (const file of PLUGIN_FILES) {
    const url = `${pluginUrl}/${file}`;
    const dest = join(PLUGIN_DIR, file);
    const ok = await downloadFile(url, dest);
    if (!ok) {
      log(`Failed to download ${file}`, "error");
      allSuccess = false;
    }
  }

  if (allSuccess) {
    log("ame plugin installed", "success");
  } else {
    log("Some plugin files failed to download", "error");
  }

  return allSuccess;
}

/**
 * Check and activate Pengu Loader
 */
async function checkPenguActivation(): Promise<void> {
  log("Checking Pengu activation...");

  if (isPenguActivated()) {
    log("Pengu Loader already activated", "success");
    return;
  }

  await launchPenguForActivation();
}

export interface SetupConfig {
  toolsUrl: string;
  penguUrl: string;
  pluginUrl: string;
}

/**
 * Run full setup process
 * Returns true if setup succeeded, false otherwise
 */
export async function runSetup(config: SetupConfig): Promise<boolean> {
  console.log("");
  console.log("  ======================================");
  console.log("    ame - skin changer");
  console.log("  ======================================");
  console.log("");

  // Create directories
  createDirectories();

  // Setup mod-tools
  const toolsOk = await setupModTools(config.toolsUrl);
  if (!toolsOk) {
    log("Setup failed: mod-tools", "error");
    return false;
  }

  // Setup Pengu Loader
  const penguOk = await setupPenguLoader(config.penguUrl);
  if (!penguOk) {
    log("Setup failed: Pengu Loader", "error");
    return false;
  }

  // Setup plugin
  const pluginOk = await setupPlugin(config.pluginUrl);
  if (!pluginOk) {
    log("Setup failed: plugin", "error");
    return false;
  }

  // Check activation
  await checkPenguActivation();

  console.log("");
  log("Setup complete!", "success");
  console.log("");

  return true;
}

export { AME_DIR, TOOLS_DIR, SKINS_DIR, MODS_DIR, OVERLAY_DIR, PENGU_DIR, PLUGIN_DIR };
