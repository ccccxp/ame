import { spawn, execSync } from "node:child_process";
import { join } from "node:path";
import { existsSync } from "node:fs";

const TOOLS_DIR = join(process.env.LOCALAPPDATA!, "ame", "tools");

/**
 * Kill any running mod-tools processes
 */
export function killModTools(): void {
  try {
    execSync('taskkill /F /IM "mod-tools.exe"', {
      encoding: "utf-8",
      timeout: 5000,
      windowsHide: true,
      stdio: "ignore",
    });
  } catch {
    // Process not running or already killed
  }
}

/**
 * Run mod-tools mkoverlay command
 */
export async function runMkOverlay(
  modsDir: string,
  overlayDir: string,
  gameDir: string,
  modName: string
): Promise<{ success: boolean; exitCode: number }> {
  const modTools = join(TOOLS_DIR, "mod-tools.exe");

  if (!existsSync(modTools)) {
    throw new Error("mod-tools.exe not found. Please restart ame.");
  }

  const args = [
    "mkoverlay",
    modsDir,
    overlayDir,
    `--game:${gameDir}`,
    `--mods:${modName}`,
    "--noTFT",
    "--ignoreConflict",
  ];

  console.log(`[ame] Running: mod-tools.exe ${args.join(" ")}`);

  return new Promise((resolve) => {
    const proc = spawn(modTools, args, {
      windowsHide: true,
      stdio: "inherit",
    });

    proc.on("close", (code) => {
      resolve({ success: code === 0, exitCode: code ?? 1 });
    });

    proc.on("error", (err) => {
      console.error(`[ame] mod-tools error: ${err.message}`);
      resolve({ success: false, exitCode: 1 });
    });
  });
}

/**
 * Run mod-tools runoverlay command (non-blocking)
 */
export function runOverlay(
  overlayDir: string,
  configPath: string,
  gameDir: string
): void {
  const modTools = join(TOOLS_DIR, "mod-tools.exe");

  if (!existsSync(modTools)) {
    throw new Error("mod-tools.exe not found. Please restart ame.");
  }

  const args = [
    "runoverlay",
    overlayDir,
    configPath,
    `--game:${gameDir}`,
    "--opts:configless",
  ];

  console.log(`[ame] Running: mod-tools.exe ${args.join(" ")}`);

  // Start detached so it continues running
  const proc = spawn(modTools, args, {
    windowsHide: true,
    stdio: "ignore",
    detached: true,
  });

  proc.unref();
}

/**
 * Check if mod-tools.exe exists
 */
export function modToolsExists(): boolean {
  return existsSync(join(TOOLS_DIR, "mod-tools.exe"));
}
