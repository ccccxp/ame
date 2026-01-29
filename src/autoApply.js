import { loadChampionSkins } from './api';
import { readCurrentSkin, findSkinByName } from './skin';
import { wsSend } from './websocket';
import { setAppliedSkinName, getAppliedSkinName } from './chroma';
import { setButtonState } from './ui';

const AUTO_APPLY_STABLE_MS = 10000; // 10 seconds of stability
const LOG_PREFIX = '[ame:auto]';

// State
let lastTrackedSkin = null;
let lastTrackedChampion = null;
let stableSince = null;
let autoApplyTriggered = false;
let epoch = 0; // incremented on reset; async flows bail if epoch changes

/**
 * Reset auto-apply state (called when entering/leaving champ select)
 */
export function resetAutoApply() {
  console.log(`${LOG_PREFIX} Resetting auto-apply state`);
  lastTrackedSkin = null;
  lastTrackedChampion = null;
  stableSince = null;
  autoApplyTriggered = false;
  epoch++;
}

/**
 * Check if skin and champion have been stable long enough to auto-apply.
 * Called from pollUI every 300ms.
 *
 * Tracking (lastTrackedSkin/lastTrackedChampion) always runs so that
 * in-flight triggerAutoApply() can detect mid-await changes.
 * Only the trigger decision is gated by autoApplyTriggered.
 */
export function checkAutoApply(championId) {
  const skinName = readCurrentSkin();

  // Re-arm: if user manually applied but then scrolled to a different skin, clear and re-arm
  const applied = getAppliedSkinName();
  if (applied) {
    if (skinName && skinName !== applied) {
      console.log(`${LOG_PREFIX} Skin changed from applied "${applied}" to "${skinName}", re-arming auto-apply`);
      setAppliedSkinName(null);
      setButtonState('Apply Skin', false);
      autoApplyTriggered = false;
      // Fall through to start tracking the new skin
    } else {
      return;
    }
  }

  // Need both values present
  if (!skinName || !championId) {
    stableSince = null;
    lastTrackedSkin = null;
    lastTrackedChampion = null;
    return;
  }

  // Always update tracking so in-flight triggerAutoApply() sees current values
  if (skinName !== lastTrackedSkin || championId !== lastTrackedChampion) {
    console.log(`${LOG_PREFIX} Change detected: champ ${lastTrackedChampion} -> ${championId}, skin "${lastTrackedSkin}" -> "${skinName}"`);
    lastTrackedSkin = skinName;
    lastTrackedChampion = championId;
    stableSince = Date.now();
    return;
  }

  // Only trigger if not already in-flight
  if (autoApplyTriggered) return;

  // Both values stable — check if long enough
  if (stableSince && Date.now() - stableSince >= AUTO_APPLY_STABLE_MS) {
    triggerAutoApply();
  }
}

/**
 * Trigger the auto-apply
 */
async function triggerAutoApply() {
  if (autoApplyTriggered) return;
  autoApplyTriggered = true;

  const startEpoch = epoch;
  const startSkin = lastTrackedSkin;
  const startChampion = lastTrackedChampion;

  // Re-check manual apply (may have happened between poll cycles)
  if (getAppliedSkinName()) {
    console.log(`${LOG_PREFIX} Skin already applied manually, skipping auto-apply`);
    autoApplyTriggered = false;
    return;
  }

  console.log(`${LOG_PREFIX} *** TRIGGERING AUTO-APPLY ***`);

  const skinName = startSkin;
  const championId = startChampion;
  if (!championId) {
    console.log(`${LOG_PREFIX} No champion, cannot auto-apply`);
    autoApplyTriggered = false;
    stableSince = Date.now();
    return;
  }

  const skins = await loadChampionSkins(championId);

  // Bail if phase changed (left champ select) during await
  if (epoch !== startEpoch) {
    console.log(`${LOG_PREFIX} Epoch changed during skin load, aborting auto-apply`);
    return;
  }

  if (!skins) {
    console.log(`${LOG_PREFIX} Could not load skins, cannot auto-apply`);
    autoApplyTriggered = false;
    stableSince = Date.now();
    return;
  }

  // Re-validate: champ/skin may have changed during the await
  // (checkAutoApply keeps updating lastTracked* even while we're in-flight)
  if (lastTrackedSkin !== startSkin || lastTrackedChampion !== startChampion) {
    console.log(`${LOG_PREFIX} Champ/skin changed during skin load, aborting auto-apply`);
    autoApplyTriggered = false;
    stableSince = Date.now();
    return;
  }

  const skin = findSkinByName(skins, skinName);
  if (!skin) {
    console.log(`${LOG_PREFIX} Skin not found: ${skinName}, cannot auto-apply`);
    autoApplyTriggered = false;
    stableSince = Date.now();
    return;
  }

  // Re-check: user may have manually applied during the awaits above
  if (getAppliedSkinName()) {
    console.log(`${LOG_PREFIX} Skin manually applied during auto-apply, skipping`);
    autoApplyTriggered = false;
    return;
  }

  // Final DOM check: abort if user changed skin since trigger (poll may not have run yet)
  if (readCurrentSkin() !== startSkin) {
    console.log(`${LOG_PREFIX} Skin changed since trigger, aborting auto-apply`);
    autoApplyTriggered = false;
    stableSince = Date.now();
    return;
  }

  console.log(`${LOG_PREFIX} Auto-applying: ${skinName} | Skin ID: ${skin.id} | Champion ID: ${championId}`);
  wsSend({ type: 'apply', championId, skinId: skin.id });
  setAppliedSkinName(skinName);
  setButtonState('Applied', true);

  console.log(`${LOG_PREFIX} Auto-apply completed successfully!`);
}

/**
 * Fetch and log the timer data separately (for detailed debugging)
 */
export async function fetchAndLogTimer() {
  try {
    const res = await fetch('/lol-champ-select/v1/session/timer');
    if (!res.ok) {
      console.log(`${LOG_PREFIX} Timer fetch failed: ${res.status}`);
      return null;
    }
    const timer = await res.json();
    console.log(`${LOG_PREFIX} Timer data:`, timer);
    return timer;
  } catch (e) {
    console.log(`${LOG_PREFIX} Timer fetch error:`, e.message);
    return null;
  }
}

/**
 * Fetch gameflow session for queue info (ARAM detection)
 */
export async function fetchAndLogGameflow() {
  try {
    const res = await fetch('/lol-gameflow/v1/session');
    if (!res.ok) {
      console.log(`${LOG_PREFIX} Gameflow fetch failed: ${res.status}`);
      return null;
    }
    const gameflow = await res.json();
    console.log(`${LOG_PREFIX} Gameflow data:`, {
      gameMode: gameflow.gameData?.queue?.gameMode,
      queueId: gameflow.gameData?.queue?.id,
      mapId: gameflow.map?.id,
      phase: gameflow.phase,
    });
    return gameflow;
  } catch (e) {
    console.log(`${LOG_PREFIX} Gameflow fetch error:`, e.message);
    return null;
  }
}
