import { IN_GAME_CONTAINER_ID } from './constants';
import { wsSend, wsSendApply, getLastApplyPayload, isOverlayActive, setOverlayActive } from './websocket';
import { getChampionSkins } from './api';
import { isDefaultSkin } from './skin';

const RECONNECT_SELECTORS = [
  '.game-in-progress-container',
  '.rcp-fe-lol-game-in-progress',
  '.reconnect-container',
];

function findReconnectContainer() {
  for (const sel of RECONNECT_SELECTORS) {
    const el = document.querySelector(sel);
    if (el) return el;
  }
  return null;
}

function buildDropdown() {
  const skins = getChampionSkins();
  if (!skins) return null;

  const nonDefault = skins.filter(s => !isDefaultSkin(s));
  if (nonDefault.length === 0) return null;

  const dropdown = document.createElement('lol-uikit-framed-dropdown');
  dropdown.className = 'ame-ingame-dropdown';

  for (const skin of nonDefault) {
    const opt = document.createElement('lol-uikit-dropdown-option');
    opt.setAttribute('slot', 'lol-uikit-dropdown-option');
    opt.setAttribute('data-skin-id', String(skin.id));
    opt.setAttribute('data-skin-name', skin.name);
    opt.textContent = skin.name;
    dropdown.appendChild(opt);
  }

  // Mark the currently applied skin as selected (try skinId first, fall back to baseSkinId for chromas)
  const payload = getLastApplyPayload();
  if (payload) {
    const match = dropdown.querySelector(`lol-uikit-dropdown-option[data-skin-id="${payload.skinId}"]`)
      || dropdown.querySelector(`lol-uikit-dropdown-option[data-skin-id="${payload.baseSkinId}"]`);
    if (match) match.setAttribute('selected', '');
  }

  dropdown.addEventListener('change', () => {
    const selected = dropdown.querySelector('lol-uikit-dropdown-option[selected]');
    if (!selected) return;
    const skinId = parseInt(selected.getAttribute('data-skin-id'), 10);
    if (isNaN(skinId)) return;

    const lastPayload = getLastApplyPayload();
    const championId = lastPayload?.championId;
    if (!championId) return;

    wsSendApply({ type: 'apply', championId, skinId });
    updateInGameStatus();
  });

  return dropdown;
}

export function ensureInGameUI() {
  if (document.getElementById(IN_GAME_CONTAINER_ID)) return;
  const parent = findReconnectContainer();
  if (!parent) return;

  const container = document.createElement('div');
  container.id = IN_GAME_CONTAINER_ID;

  // Add skin dropdown if skins are available
  const dropdown = buildDropdown();
  if (dropdown) {
    container.appendChild(dropdown);
  }

  const btn = document.createElement('lol-uikit-flat-button');
  btn.className = 'ame-ingame-action';

  btn.addEventListener('click', () => {
    if (isOverlayActive()) {
      wsSend({ type: 'cleanup' });
      setOverlayActive(false);
      updateInGameStatus();
    } else {
      const dd = container.querySelector('.ame-ingame-dropdown');
      const selected = dd?.querySelector('lol-uikit-dropdown-option[selected]');
      const skinId = selected ? parseInt(selected.getAttribute('data-skin-id'), 10) : null;
      const lastPayload = getLastApplyPayload();
      const championId = lastPayload?.championId;

      if (championId && skinId && !isNaN(skinId)) {
        wsSendApply({ type: 'apply', championId, skinId });
        updateInGameStatus();
      }
    }
  });

  container.appendChild(btn);

  // Hide everything if no skins available
  if (!dropdown) {
    btn.style.display = 'none';
  }

  // Ensure parent is a positioning context for our absolute container
  const pos = window.getComputedStyle(parent).position;
  if (pos === 'static' || !pos) parent.style.position = 'relative';

  parent.appendChild(container);

  updateInGameStatus();
}

export function removeInGameUI() {
  const el = document.getElementById(IN_GAME_CONTAINER_ID);
  if (el) el.remove();
}

export function updateInGameStatus() {
  const container = document.getElementById(IN_GAME_CONTAINER_ID);
  if (!container) return;

  const btn = container.querySelector('.ame-ingame-action');
  const dropdown = container.querySelector('.ame-ingame-dropdown');
  if (!btn) return;

  const active = isOverlayActive();
  const hasSkins = !!dropdown;

  if (active) {
    // Overlay running — only show Remove button, hide dropdown
    btn.textContent = 'Remove Skin';
    btn.removeAttribute('disabled');
    btn.style.display = '';
    if (dropdown) dropdown.style.display = 'none';
  } else if (hasSkins) {
    // Not active, skins available — show dropdown + Apply button
    btn.textContent = 'Apply Skin';
    btn.removeAttribute('disabled');
    btn.style.display = '';
    dropdown.style.display = '';
  } else {
    // No skins at all
    btn.style.display = 'none';
  }
}
