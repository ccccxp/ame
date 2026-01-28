import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { findGameDir } from "./utils/game-finder";
import { killModTools, runMkOverlay, runOverlay, modToolsExists } from "./utils/mod-tools";
import { runSetup, AME_DIR, SKINS_DIR, MODS_DIR, OVERLAY_DIR } from "./utils/setup";

// Configuration
const SKIN_BASE_URL = "https://raw.githubusercontent.com/Alban1911/LeagueSkins/main/skins";
const PORT = 18765;

// Setup URLs - update these to your actual repo
const SETUP_CONFIG = {
  toolsUrl: "https://raw.githubusercontent.com/Alban1911/Rose/main/injection/tools",
  penguUrl: "https://github.com/PenguLoader/PenguLoader/releases/download/v1.1.6/pengu-loader-v1.1.6.zip",
  pluginUrl: "https://raw.githubusercontent.com/hoangvu12/ame/main/src",
};

// WebSocket message types
interface ApplyMessage {
  type: "apply";
  championId: string;
  skinId: string;
  baseSkinId?: string;
}

interface CleanupMessage {
  type: "cleanup";
}

type IncomingMessage = ApplyMessage | CleanupMessage;

interface StatusMessage {
  type: "status";
  status: "downloading" | "injecting" | "ready" | "error";
  message: string;
}

// Active WebSocket connections
const clients = new Set<ServerWebSocket<unknown>>();

// Type for Bun WebSocket
type ServerWebSocket<T> = {
  send(data: string | ArrayBuffer | Uint8Array): void;
  close(): void;
  readyState: number;
  data: T;
};

/**
 * Send status message to WebSocket client
 */
function sendStatus(ws: ServerWebSocket<unknown>, status: StatusMessage["status"], message: string): void {
  if (ws.readyState !== 1) return; // 1 = OPEN

  const payload: StatusMessage = { type: "status", status, message };
  ws.send(JSON.stringify(payload));
  console.log(`[ame] ${status}: ${message}`);
}

/**
 * Download a skin file (fantome or zip)
 */
async function downloadSkin(
  championId: string,
  skinId: string,
  baseSkinId: string | undefined,
  skinDir: string
): Promise<string | null> {
  mkdirSync(skinDir, { recursive: true });

  for (const ext of ["fantome", "zip"]) {
    const url = baseSkinId
      ? `${SKIN_BASE_URL}/${championId}/${baseSkinId}/${skinId}/${skinId}.${ext}`
      : `${SKIN_BASE_URL}/${championId}/${skinId}/${skinId}.${ext}`;

    const filePath = join(skinDir, `${skinId}.${ext}`);

    try {
      console.log(`[ame] Trying: ${url}`);
      const response = await fetch(url);
      if (response.ok) {
        const buffer = await response.arrayBuffer();
        await Bun.write(filePath, buffer);
        console.log(`[ame] Downloaded ${skinId}.${ext}`);
        return filePath;
      }
    } catch (err) {
      console.log(`[ame] Download failed for ${ext}: ${err}`);
    }
  }

  return null;
}

/**
 * Extract a zip/fantome file to destination
 */
async function extractArchive(archivePath: string, destDir: string): Promise<boolean> {
  try {
    const proc = Bun.spawn(
      ["powershell", "-NoProfile", "-Command", `Expand-Archive -Force '${archivePath}' '${destDir}'`],
      { stdout: "inherit", stderr: "inherit" }
    );
    const exitCode = await proc.exited;
    return exitCode === 0;
  } catch (err) {
    console.error(`[ame] Extract error: ${err}`);
    return false;
  }
}

/**
 * Handle skin apply request
 */
async function handleApply(
  ws: ServerWebSocket<unknown>,
  championId: string,
  skinId: string,
  baseSkinId?: string
): Promise<void> {
  // Find game directory
  const gameDir = findGameDir();
  if (!gameDir) {
    sendStatus(ws, "error", "League of Legends Game directory not found");
    return;
  }
  console.log(`[ame] Game dir: ${gameDir}`);

  // Check mod-tools exists
  if (!modToolsExists()) {
    sendStatus(ws, "error", "mod-tools.exe not found. Please restart ame.");
    return;
  }

  // Check for cached skin file
  const skinDir = join(SKINS_DIR, championId, skinId);
  let zipPath = join(skinDir, `${skinId}.fantome`);

  if (!existsSync(zipPath)) {
    const altPath = join(skinDir, `${skinId}.zip`);
    if (existsSync(altPath)) {
      zipPath = altPath;
    }
  }

  // Download if not cached
  if (!existsSync(zipPath)) {
    sendStatus(ws, "downloading", "Downloading skin...");
    const downloaded = await downloadSkin(championId, skinId, baseSkinId, skinDir);
    if (!downloaded) {
      sendStatus(ws, "error", "Skin not available for download");
      return;
    }
    zipPath = downloaded;
  } else {
    console.log(`[ame] Skin ${skinId} already cached`);
  }

  // Kill any previous runoverlay
  killModTools();
  await Bun.sleep(300);

  // Clean and extract to mods dir
  if (existsSync(MODS_DIR)) {
    rmSync(MODS_DIR, { recursive: true, force: true });
  }
  const modSubDir = join(MODS_DIR, `skin_${skinId}`);
  mkdirSync(modSubDir, { recursive: true });

  const extracted = await extractArchive(zipPath, modSubDir);
  if (!extracted) {
    sendStatus(ws, "error", "Failed to extract skin archive");
    return;
  }

  // Clean overlay dir
  if (existsSync(OVERLAY_DIR)) {
    rmSync(OVERLAY_DIR, { recursive: true, force: true });
  }
  mkdirSync(OVERLAY_DIR, { recursive: true });

  // Run mkoverlay
  sendStatus(ws, "injecting", "Applying skin...");
  const modName = `skin_${skinId}`;
  const mkResult = await runMkOverlay(MODS_DIR, OVERLAY_DIR, gameDir, modName);

  if (!mkResult.success) {
    sendStatus(ws, "error", `Failed to apply skin (exit code ${mkResult.exitCode})`);
    return;
  }

  // Run runoverlay
  const configPath = join(OVERLAY_DIR, "cslol-config.json");
  runOverlay(OVERLAY_DIR, configPath, gameDir);

  sendStatus(ws, "ready", "Skin applied!");
}

/**
 * Handle cleanup request
 */
function handleCleanup(): void {
  console.log("[ame] Cleanup: stopping runoverlay");
  killModTools();
  if (existsSync(OVERLAY_DIR)) {
    rmSync(OVERLAY_DIR, { recursive: true, force: true });
  }
}

/**
 * Kill Pengu Loader on exit
 */
function killPenguLoader(): void {
  try {
    Bun.spawnSync(["taskkill", "/F", "/IM", "Pengu Loader.exe"], {
      stdout: "ignore",
      stderr: "ignore",
    });
  } catch {
    // Ignore errors
  }
}

/**
 * Start the WebSocket server
 */
function startServer(): void {
  // Handle process exit
  process.on("SIGINT", () => {
    console.log("\n[ame] Shutting down...");
    handleCleanup();
    killPenguLoader();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    handleCleanup();
    killPenguLoader();
    process.exit(0);
  });

  console.log(`[ame] Starting server on port ${PORT}...`);

  const server = Bun.serve({
    port: PORT,
    fetch(req, server) {
      // Upgrade HTTP request to WebSocket
      if (server.upgrade(req)) {
        return;
      }
      // Not a WebSocket request
      return new Response("ame server running - connect via ws://localhost:18765", {
        status: 200,
      });
    },
    websocket: {
      open(ws) {
        console.log("[ame] Client connected");
        clients.add(ws);
      },
      message(ws, message) {
        try {
          const text = typeof message === "string" ? message : new TextDecoder().decode(message);
          const msg = JSON.parse(text) as IncomingMessage;

          switch (msg.type) {
            case "apply": {
              const { championId, skinId, baseSkinId } = msg;
              console.log(`[ame] Apply requested: champion=${championId} skin=${skinId} base=${baseSkinId}`);
              handleApply(ws, championId, skinId, baseSkinId);
              break;
            }
            case "cleanup": {
              handleCleanup();
              break;
            }
            default: {
              console.log(`[ame] Unknown message type: ${(msg as any).type}`);
            }
          }
        } catch (err) {
          console.error(`[ame] Message parse error: ${err}`);
        }
      },
      close(ws) {
        console.log("[ame] Client disconnected");
        clients.delete(ws);
      },
    },
  });

  console.log(`[ame] Listening on ws://localhost:${PORT}`);
  console.log("[ame] Open League client to see the skin selector.");
  console.log("[ame] Press Ctrl+C to stop.\n");
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  // Run setup (downloads dependencies if needed)
  const setupOk = await runSetup(SETUP_CONFIG);

  if (!setupOk) {
    console.error("[ame] Setup failed. Please check your internet connection and try again.");
    process.exit(1);
  }

  // Start WebSocket server
  startServer();
}

// Run
main();
