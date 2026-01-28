import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

/**
 * Find League of Legends Game directory using multiple detection methods
 */
export function findGameDir(): string | null {
  // 1. Common paths on all fixed drives
  const drives = getFixedDrives();
  for (const drive of drives) {
    const path = join(drive, "Riot Games", "League of Legends", "Game");
    if (existsSync(join(path, "League of Legends.exe"))) {
      return path;
    }
  }

  // 2. RiotClientInstalls.json
  const rcPath = "C:\\ProgramData\\Riot Games\\RiotClientInstalls.json";
  if (existsSync(rcPath)) {
    try {
      const rc = JSON.parse(readFileSync(rcPath, "utf-8"));
      const paths: string[] = [];

      if (rc.associated_client) {
        for (const key of Object.keys(rc.associated_client)) {
          paths.push(key);
        }
      }
      if (rc.rc_default) paths.push(rc.rc_default);
      if (rc.rc_live) paths.push(rc.rc_live);

      for (const p of paths) {
        if (/league/i.test(p)) {
          const candidate = join(p, "..");
          const gameDir = join(candidate, "Game");
          if (existsSync(join(gameDir, "League of Legends.exe"))) {
            return gameDir;
          }
        }
      }
    } catch {
      // Ignore parse errors
    }
  }

  // 3. Running LeagueClientUx.exe process
  try {
    const output = execSync(
      'wmic process where "name=\'LeagueClientUx.exe\'" get ExecutablePath /value',
      { encoding: "utf-8", timeout: 5000, windowsHide: true }
    );
    const match = output.match(/ExecutablePath=(.+)/);
    if (match) {
      const exePath = match[1].trim();
      const gameDir = join(exePath, "..", "Game");
      if (existsSync(join(gameDir, "League of Legends.exe"))) {
        return gameDir;
      }
    }
  } catch {
    // Process not running or wmic failed
  }

  // 4. Registry lookup
  try {
    const output = execSync(
      'reg query "HKLM\\SOFTWARE\\WOW6432Node\\Riot Games, Inc\\League of Legends" /v Location',
      { encoding: "utf-8", timeout: 5000, windowsHide: true }
    );
    const match = output.match(/Location\s+REG_SZ\s+(.+)/);
    if (match) {
      const loc = match[1].trim();
      const gameDir = join(loc, "Game");
      if (existsSync(join(gameDir, "League of Legends.exe"))) {
        return gameDir;
      }
    }
  } catch {
    // Registry key not found
  }

  return null;
}

/**
 * Get list of fixed drives (C:, D:, etc.)
 */
function getFixedDrives(): string[] {
  const drives: string[] = [];

  // Try to enumerate drives A-Z
  for (let i = 65; i <= 90; i++) {
    const drive = `${String.fromCharCode(i)}:\\`;
    try {
      const stats = statSync(drive);
      if (stats.isDirectory()) {
        // Check if it's a fixed drive by trying to read it
        try {
          readdirSync(drive);
          drives.push(drive);
        } catch {
          // Not accessible
        }
      }
    } catch {
      // Drive doesn't exist
    }
  }

  return drives;
}
