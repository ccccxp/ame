import { wsSend, onGamePath, onSetting, refreshSettings } from './websocket';

const NAV_TITLE_CLASS = 'lol-settings-nav-title';
const AME_NAV_NAME = 'ame-settings';
const AME_PANEL_CLASS = 'ame-settings-panel';

let settingsObserver = null;
let injected = false;
let retryTimer = null;

function buildNavGroup() {
  const frag = document.createDocumentFragment();

  const title = document.createElement('div');
  title.className = NAV_TITLE_CLASS;
  title.textContent = 'Ame';
  title.dataset.ame = '1';

  const bar = document.createElement('lol-uikit-navigation-bar');
  bar.setAttribute('direction', 'down');
  bar.setAttribute('type', 'tabbed');
  bar.setAttribute('selectedindex', '-1');
  bar.dataset.ame = '1';

  const item = document.createElement('lol-uikit-navigation-item');
  item.setAttribute('name', AME_NAV_NAME);
  item.className = 'lol-settings-nav';

  const label = document.createElement('div');
  label.textContent = 'SETTINGS';
  item.appendChild(label);
  bar.appendChild(item);

  frag.appendChild(title);
  frag.appendChild(bar);
  return frag;
}

function buildToggle(id, labelText, settingKey) {
  const row = document.createElement('div');
  row.className = 'ame-settings-toggle-row';

  const checkbox = document.createElement('lol-uikit-flat-checkbox');
  checkbox.setAttribute('for', id);

  const input = document.createElement('input');
  input.setAttribute('slot', 'input');
  input.setAttribute('name', id);
  input.type = 'checkbox';
  input.id = id;
  checkbox.appendChild(input);

  const cbLabel = document.createElement('label');
  cbLabel.setAttribute('slot', 'label');
  cbLabel.textContent = labelText;
  checkbox.appendChild(cbLabel);

  input.addEventListener('change', () => {
    wsSend({ type: `set${settingKey.charAt(0).toUpperCase()}${settingKey.slice(1)}`, enabled: input.checked });
  });

  onSetting(settingKey, (enabled) => { input.checked = enabled; });

  row.appendChild(checkbox);
  return row;
}

function buildPanel() {
  const panel = document.createElement('div');
  panel.className = AME_PANEL_CLASS;

  // Game path section
  const section = document.createElement('div');
  section.className = 'lol-settings-ingame-section-title';
  section.textContent = 'Game Path';

  const row = document.createElement('div');
  row.className = 'ame-settings-row';

  const flatInput = document.createElement('lol-uikit-flat-input');
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'C:\\Riot Games\\League of Legends\\Game';
  flatInput.appendChild(input);

  const btn = document.createElement('lol-uikit-flat-button');
  btn.className = 'ame-settings-save';
  btn.textContent = 'Save';
  btn.addEventListener('click', () => {
    const path = input.value.trim();
    if (!path) return;
    wsSend({ type: 'setGamePath', path });
  });

  row.appendChild(flatInput);
  row.appendChild(btn);
  panel.appendChild(section);
  panel.appendChild(row);

  // Auto Accept Match toggle
  const autoAcceptSection = document.createElement('div');
  autoAcceptSection.className = 'lol-settings-ingame-section-title ame-settings-section-gap';
  autoAcceptSection.textContent = 'Auto Accept Match';
  panel.appendChild(autoAcceptSection);
  panel.appendChild(buildToggle('ameAutoAccept', 'Automatically accept match when found', 'autoAccept'));

  // Bench Swap toggle
  const benchSwapSection = document.createElement('div');
  benchSwapSection.className = 'lol-settings-ingame-section-title ame-settings-section-gap';
  benchSwapSection.textContent = 'ARAM Bench Swap';
  panel.appendChild(benchSwapSection);

  const benchSwapDesc = document.createElement('label');
  benchSwapDesc.className = 'ame-settings-description';
  benchSwapDesc.textContent = 'Click a champion on the bench while it\'s on cooldown to mark it. When the cooldown ends, it will automatically be swapped to you.';
  panel.appendChild(benchSwapDesc);

  panel.appendChild(buildToggle('ameBenchSwap', 'Enable auto bench swap in ARAM', 'benchSwap'));

  return panel;
}

function deselectAllNav(container) {
  container.querySelectorAll('lol-uikit-navigation-item').forEach(el => {
    el.removeAttribute('active');
  });
  container.querySelectorAll('lol-uikit-navigation-bar').forEach(bar => {
    bar.setAttribute('selectedindex', '-1');
  });
}

function showAmePanel(settingsContainer) {
  const optionsArea = settingsContainer.querySelector('.lol-settings-options');
  if (!optionsArea) return;

  for (const child of optionsArea.children) {
    if (!child.classList.contains(AME_PANEL_CLASS)) {
      child.dataset.ameHidden = child.style.display;
      child.style.display = 'none';
    }
  }

  let panel = optionsArea.querySelector(`.${AME_PANEL_CLASS}`);
  if (!panel) {
    panel = buildPanel();
    optionsArea.appendChild(panel);
  }
  panel.style.display = '';

  const input = panel.querySelector('input[type="text"]');
  if (input) {
    onGamePath((path) => { input.value = path || ''; });
    wsSend({ type: 'getGamePath' });
  }

  refreshSettings();
}

function hideAmePanel(settingsContainer) {
  const optionsArea = settingsContainer.querySelector('.lol-settings-options');
  if (!optionsArea) return;

  const panel = optionsArea.querySelector(`.${AME_PANEL_CLASS}`);
  if (panel) panel.style.display = 'none';

  for (const child of optionsArea.children) {
    if (child.dataset.ameHidden !== undefined) {
      child.style.display = child.dataset.ameHidden;
      delete child.dataset.ameHidden;
    }
  }

  const ameItem = settingsContainer.querySelector(`lol-uikit-navigation-item[name="${AME_NAV_NAME}"]`);
  if (ameItem) ameItem.removeAttribute('active');
}

function inject(settingsContainer) {
  if (injected) return;

  const scrollerContent = settingsContainer.querySelector('.lol-settings-nav-scroller > div');
  if (!scrollerContent) return;

  if (scrollerContent.querySelector(`[data-ame="1"]`)) {
    injected = true;
    return;
  }

  scrollerContent.prepend(buildNavGroup());
  injected = true;

  const ameItem = scrollerContent.querySelector(`lol-uikit-navigation-item[name="${AME_NAV_NAME}"]`);
  if (ameItem) {
    ameItem.addEventListener('click', (e) => {
      e.stopPropagation();
      const navArea = settingsContainer.querySelector('.lol-settings-navs') || scrollerContent;
      deselectAllNav(navArea);
      ameItem.setAttribute('active', 'true');
      showAmePanel(settingsContainer);
    });
  }

  scrollerContent.addEventListener('click', (e) => {
    const navItem = e.target.closest('lol-uikit-navigation-item');
    if (!navItem) return;
    if (navItem.getAttribute('name') === AME_NAV_NAME) return;
    hideAmePanel(settingsContainer);
  });
}

function stopRetry() {
  if (retryTimer) { clearInterval(retryTimer); retryTimer = null; }
}

function cleanup() {
  injected = false;
  stopRetry();
}

function tryInject() {
  const container = document.querySelector('.lol-settings-container');
  if (!container) {
    cleanup();
    return;
  }
  inject(container);
  if (injected) stopRetry();
}

export function initSettings() {
  if (settingsObserver) return;

  if (!document.body) {
    setTimeout(initSettings, 250);
    return;
  }

  document.addEventListener('click', (e) => {
    if (e.target.closest('.app-controls-settings')) {
      if (!retryTimer) {
        retryTimer = setInterval(tryInject, 200);
      }
    }
  });

  settingsObserver = new MutationObserver(() => {
    const container = document.querySelector('.lol-settings-container');
    if (container) {
      if (!injected && !retryTimer) {
        retryTimer = setInterval(tryInject, 200);
      }
    } else {
      cleanup();
    }
  });

  settingsObserver.observe(document.body, { childList: true, subtree: true });
  tryInject();
}
