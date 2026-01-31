import { AUTO_ACCEPT_DELAY_MS } from './constants';
import { onSetting } from './websocket';

let enabled = false;
let pendingTimer = null;

export function loadAutoAcceptSetting() {
  onSetting('autoAccept', (v) => { enabled = v; });
}

export function handleReadyCheck() {
  if (!enabled) return;
  if (pendingTimer) return;

  pendingTimer = setTimeout(async () => {
    pendingTimer = null;
    try {
      const res = await fetch('/lol-matchmaking/v1/ready-check');
      if (!res.ok) return;

      const { playerResponse } = await res.json();
      if (playerResponse === 'Declined' || playerResponse === 'Accepted') return;

      await fetch('/lol-matchmaking/v1/ready-check/accept', { method: 'POST' });
    } catch {
      // Ready check may have expired
    }
  }, AUTO_ACCEPT_DELAY_MS);
}

export function cancelPendingAccept() {
  if (pendingTimer) {
    clearTimeout(pendingTimer);
    pendingTimer = null;
  }
}
