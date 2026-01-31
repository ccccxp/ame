import { CHROMA_BTN_CLASS, CHROMA_PANEL_ID } from './constants';
import {
  getSkinOffset,
  getSkinKeyFromItem,
  findSkinByCarouselKey,
  getSkinNameFromItem,
  readCurrentSkin,
  getChromaData,
  isItemVisible
} from './skin';
import { getMyChampionId, getChampionSkins } from './api';
import { getLastChampionId } from './state';
import { onChromaSelected, prefetchChroma } from './autoApply';

let activeChromaPanel = null;
let activeChromaButton = null;
const chromaButtonDataMap = new WeakMap();

export function closeChromaPanel() {
  if (activeChromaPanel) activeChromaPanel.remove();
  activeChromaPanel = null;
  activeChromaButton = null;
}

// --- Click-outside handler ---

function onClickOutsideChroma(e) {
  const panel = activeChromaPanel || document.getElementById(CHROMA_PANEL_ID);
  const btn = document.querySelector(`.${CHROMA_BTN_CLASS}`);
  if (panel && !panel.contains(e.target) && (!btn || !btn.contains(e.target))) {
    closeChromaPanel();
    document.removeEventListener('click', onClickOutsideChroma, true);
  }
}

// --- Button creation ---

function createChromaButton() {
  const button = document.createElement('div');
  button.className = CHROMA_BTN_CLASS;
  button.classList.add('chroma-button', 'chroma-selection', 'uikit-framed-icon', 'ember-view');

  const outerMask = document.createElement('div');
  outerMask.className = 'outer-mask interactive';

  const frameColor = document.createElement('div');
  frameColor.className = 'frame-color';

  const content = document.createElement('div');
  content.className = 'content';

  const innerMask = document.createElement('div');
  innerMask.className = 'inner-mask inner-shadow';

  frameColor.appendChild(content);
  frameColor.appendChild(innerMask);
  outerMask.appendChild(frameColor);
  button.appendChild(outerMask);

  return button;
}

function getOrCreateChromaButton(container, data) {
  if (!container) return null;
  let btn = container.querySelector(`.${CHROMA_BTN_CLASS}`);
  if (!btn) {
    btn = createChromaButton();
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const payload = chromaButtonDataMap.get(btn);
      if (!payload) return;
      if (activeChromaPanel) {
        closeChromaPanel();
        document.removeEventListener('click', onClickOutsideChroma, true);
      } else {
        createChromaPanel(payload.skin, payload.chromas, btn, payload.championId || null);
      }
    });
    container.appendChild(btn);
  }
  if (data) chromaButtonDataMap.set(btn, data);
  return btn;
}

// --- Panel creation ---

function getChromaImageUrl(champId, chroma) {
  if (!chroma || !champId || !chroma.id) return '';
  return `/lol-game-data/assets/v1/champion-chroma-images/${champId}/${chroma.id}.png`;
}

function getChromaPreviewPath(chroma) {
  if (!chroma) return '';
  return chroma.chromaPreviewPath || chroma.chromaPath || chroma.chromaPreview
    || chroma.imagePath || chroma.splashPath || chroma.tilePath || '';
}

function createChromaPanel(skinData, chromas, buttonEl, championId) {
  closeChromaPanel();

  const carousel = buttonEl.closest('.skin-selection-carousel') || document.querySelector('.skin-selection-carousel');
  const champId = championId || getLastChampionId();

  const flyout = document.createElement('lol-uikit-flyout-frame');
  flyout.id = CHROMA_PANEL_ID;
  flyout.className = 'flyout';
  flyout.setAttribute('orientation', 'top');
  flyout.setAttribute('show', 'true');
  Object.assign(flyout.style, { position: 'absolute', overflow: 'visible', zIndex: '10000' });

  (carousel || document.body).appendChild(flyout);

  const flyoutContent = document.createElement('lc-flyout-content');
  flyoutContent.dataset.ameChroma = '1';

  const modal = document.createElement('div');
  modal.className = 'champ-select-chroma-modal chroma-view ember-view';

  // Preview image area
  const chromaInfo = document.createElement('div');
  chromaInfo.className = 'chroma-information';
  chromaInfo.style.backgroundImage = "url('lol-game-data/assets/content/src/LeagueClient/GameModeAssets/Classic_SRU/img/champ-select-flyout-background.jpg')";

  const chromaImage = document.createElement('div');
  chromaImage.className = 'chroma-information-image';
  if (chromas.length > 0) {
    const imgUrl = getChromaImageUrl(champId, chromas[0]) || getChromaPreviewPath(chromas[0]);
    if (imgUrl) chromaImage.style.backgroundImage = `url('${imgUrl}')`;
  }

  const skinName = document.createElement('div');
  skinName.className = 'child-skin-name';
  skinName.textContent = skinData.name;
  const disabledNote = document.createElement('div');
  disabledNote.className = 'child-skin-disabled-notification';
  skinName.appendChild(disabledNote);

  chromaInfo.appendChild(chromaImage);
  chromaInfo.appendChild(skinName);

  // Chroma color swatches
  const scrollable = document.createElement('lol-uikit-scrollable');
  scrollable.className = 'chroma-selection';
  scrollable.setAttribute('overflow-masks', 'enabled');
  scrollable.setAttribute('scrolled-bottom', 'false');
  scrollable.setAttribute('scrolled-top', 'true');

  for (let i = 0; i < chromas.length; i++) {
    const chroma = chromas[i];

    const wrapper = document.createElement('div');
    wrapper.className = 'ember-view';

    const btn = document.createElement('div');
    btn.className = 'chroma-skin-button';
    if (i === 0) btn.classList.add('selected');

    const contents = document.createElement('div');
    contents.className = 'contents';
    const colors = chroma.colors || [];
    if (colors.length >= 2) {
      contents.style.background = `linear-gradient(135deg, ${colors[0]} 50%, ${colors[1]} 50%)`;
    } else if (colors.length === 1) {
      contents.style.background = colors[0];
    } else {
      contents.style.background = '#27211C';
    }

    btn.appendChild(contents);
    wrapper.appendChild(btn);
    scrollable.appendChild(wrapper);

    btn.addEventListener('click', () => {
      selectChroma(skinData, chroma);
      scrollable.querySelectorAll('.chroma-skin-button').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
    btn.addEventListener('mouseenter', () => {
      const preview = getChromaImageUrl(champId, chroma) || getChromaPreviewPath(chroma);
      if (preview) chromaImage.style.backgroundImage = `url('${preview}')`;
      if (skinName.firstChild) {
        skinName.firstChild.nodeValue = chroma.name || skinData.name;
      } else {
        skinName.textContent = chroma.name || skinData.name;
        skinName.appendChild(disabledNote);
      }
    });
  }

  modal.appendChild(chromaInfo);
  modal.appendChild(scrollable);
  flyoutContent.appendChild(modal);
  flyout.querySelectorAll('lc-flyout-content[data-ame-chroma="1"]').forEach(el => el.remove());
  flyout.appendChild(flyoutContent);

  activeChromaPanel = flyout;
  activeChromaButton = buttonEl;

  // Position the flyout above the button
  const container = carousel || document.body;
  const containerRect = container.getBoundingClientRect();
  const btnRect = buttonEl.getBoundingClientRect();
  const modalRect = modal.getBoundingClientRect();
  const width = modalRect.width || 305;
  const height = modalRect.height || 340;
  flyout.style.left = `${Math.round(btnRect.left - containerRect.left + btnRect.width / 2 - width / 2)}px`;
  flyout.style.top = `${Math.round(btnRect.top - containerRect.top - height - 8)}px`;
  flyout.style.bottom = '';

  setTimeout(() => document.addEventListener('click', onClickOutsideChroma, true), 0);
}

async function selectChroma(skinData, chroma) {
  const championId = await getMyChampionId();
  if (!championId) return;

  const triggerButton = activeChromaButton;

  onChromaSelected(chroma.id, skinData.id);
  prefetchChroma(championId, chroma.id, skinData.id);

  closeChromaPanel();
  document.removeEventListener('click', onClickOutsideChroma, true);

  // Update button swatch color to reflect selected chroma
  const contentEl = triggerButton?.querySelector('.content');
  if (contentEl) {
    const colors = chroma.colors || [];
    if (colors.length >= 2) {
      contentEl.style.background = `linear-gradient(135deg, ${colors[0]} 50%, ${colors[1]} 50%)`;
    } else if (colors.length === 1) {
      contentEl.style.background = colors[0];
    }
  }
}

// --- ensureChromaButton: broken into focused helpers ---

function findCenterItem(skinItems) {
  const selectedItem = document.querySelector('.skin-selection-item-selected, .skin-selection-item.selected');

  let closestItem = null;
  let closestDelta = Number.POSITIVE_INFINITY;

  for (const item of skinItems) {
    const offset = getSkinOffset(item);
    if (offset !== null && offset !== undefined) {
      const delta = Math.abs(offset);
      if (delta < closestDelta) {
        closestDelta = delta;
        closestItem = item;
      }
    }
  }

  const offset0Item = Array.from(skinItems).find(item => isItemVisible(item) && getSkinOffset(item) === 0);

  if (selectedItem && isItemVisible(selectedItem)) return selectedItem;
  if (offset0Item) return offset0Item;
  return closestItem;
}

function resolveChromaData(centerItem, championSkins) {
  const skinKeyFromItem = getSkinKeyFromItem(centerItem);
  let skinName = getSkinNameFromItem(centerItem) || readCurrentSkin();

  // Try matching by carousel key first (most reliable)
  if (skinKeyFromItem !== null && championSkins) {
    const skinByKey = findSkinByCarouselKey(championSkins, skinKeyFromItem);
    if (skinByKey?.chromas?.length > 0) {
      return { skin: skinByKey, chromas: skinByKey.chromas };
    }
  }

  // Fall back to name-based matching
  let chromaData = (skinName && championSkins) ? getChromaData(championSkins, skinName) : null;

  if (!chromaData) {
    const altName = readCurrentSkin();
    if (altName && altName !== skinName) {
      chromaData = getChromaData(championSkins, altName);
    }
  }

  return chromaData;
}

function syncChromaButtons(skinItems, championSkins) {
  const champId = getLastChampionId();

  for (const item of skinItems) {
    const key = getSkinKeyFromItem(item);
    let data = null;

    if (key !== null && championSkins) {
      const skinByKey = findSkinByCarouselKey(championSkins, key);
      if (skinByKey?.chromas?.length > 0) {
        data = { skin: skinByKey, chromas: skinByKey.chromas, championId: champId };
      }
    }

    const thumb = item.querySelector('.skin-selection-thumbnail') || item;
    if (!thumb) continue;

    if (!thumb.style.position) thumb.style.position = 'relative';
    thumb.style.pointerEvents = 'auto';
    thumb.style.overflow = 'visible';

    if (!data) {
      const existing = thumb.querySelector(`.${CHROMA_BTN_CLASS}`);
      if (existing) existing.remove();
      continue;
    }

    const btn = getOrCreateChromaButton(thumb, data);
    if (!btn) continue;
    btn.classList.remove('hidden');
    Object.assign(btn.style, {
      position: 'absolute',
      right: '6px',
      bottom: '6px',
      left: '',
      top: '',
      zIndex: '50',
      pointerEvents: 'auto',
    });
  }
}

export function ensureChromaButton() {
  const championSkins = getChampionSkins();
  const skinItems = document.querySelectorAll('.skin-selection-item');
  if (skinItems.length === 0) return;

  const centerItem = findCenterItem(skinItems);
  const chromaData = centerItem ? resolveChromaData(centerItem, championSkins) : null;

  if (!centerItem || !chromaData) {
    closeChromaPanel();
  }

  syncChromaButtons(skinItems, championSkins);
}
