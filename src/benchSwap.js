import { onSetting } from './websocket';

let enabled = false;
let markedEl = null;
let markedId = null;
let markLabel = null;
let swapObserver = null;
let attached = false;

export function loadBenchSwapSetting() {
  onSetting('benchSwap', (v) => { enabled = v; if (!v) clearMark(); });
}

function champIdFrom(el) {
  const bg = el.querySelector('.bench-champion-background');
  if (!bg) return null;
  const m = bg.style.backgroundImage.match(/champion-icons\/(\d+)\.png/);
  return m ? Number(m[1]) : null;
}

function hasCooldown(el) {
  for (const c of el.classList) {
    if (c.startsWith('on-cooldown')) return true;
  }
  return false;
}

function clearMark() {
  if (markLabel?.parentNode) markLabel.remove();
  markLabel = null;
  markedEl = null;
  markedId = null;
  if (swapObserver) {
    swapObserver.disconnect();
    swapObserver = null;
  }
}

function doSwap(championId) {
  fetch(`/lol-champ-select/v1/session/bench/swap/${championId}`, { method: 'POST' })
    .catch(() => {});
}

function mark(el, id) {
  clearMark();
  markedEl = el;
  markedId = id;

  el.style.position = 'relative';
  const dot = document.createElement('div');
  dot.className = 'ame-bench-mark';
  el.appendChild(dot);
  markLabel = dot;

  // Already off cooldown — swap immediately
  if (!hasCooldown(el)) {
    const swapId = markedId;
    clearMark();
    doSwap(swapId);
    return;
  }

  swapObserver = new MutationObserver(() => {
    if (!markedEl) return;

    if (!markedEl.isConnected || markedEl.classList.contains('empty-bench-item')) {
      clearMark();
      return;
    }

    if (!hasCooldown(markedEl)) {
      const swapId = markedId;
      clearMark();
      doSwap(swapId);
    }
  });

  swapObserver.observe(el, { attributes: true, attributeFilter: ['class'] });
}

function onClick(e) {
  if (!enabled) return;
  const item = e.target.closest('.champion-bench-item');
  if (!item) return;
  if (item.classList.contains('empty-bench-item')) return;
  if (!hasCooldown(item)) return;

  const id = champIdFrom(item);
  if (!id) return;

  if (markedEl === item) {
    clearMark();
    return;
  }

  mark(item, id);
}

export function ensureBenchSwap() {
  if (attached) return;
  const container = document.querySelector('.bench-container');
  if (!container) return;
  attached = true;
  container.addEventListener('click', onClick);
}

export function cleanupBenchSwap() {
  clearMark();
  attached = false;
}
