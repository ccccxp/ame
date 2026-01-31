import { AUTO_SELECT_DELAY_MS } from './constants';
import { onSetting, onAutoSelectRoles } from './websocket';
import { fetchJson } from './api';

let enabled = false;
let rolesConfig = {};
let actedActionIds = new Set();
let acting = false;

export function loadAutoSelectSetting() {
  onSetting('autoSelect', (v) => { enabled = v; });
  onAutoSelectRoles((roles) => { rolesConfig = roles; });
}

export function resetAutoSelect() {
  actedActionIds = new Set();
  acting = false;
}

export function handleChampSelectSession(session) {
  if (!enabled || acting) return;

  const me = session.myTeam?.find(p => p.cellId === session.localPlayerCellId);
  if (!me) return;

  const position = me.assignedPosition;
  if (!position) return;

  const roleConfig = rolesConfig[position];
  if (!roleConfig) return;

  // Find all actions flattened
  const allActions = session.actions?.flat() || [];

  // Find my in-progress action
  const myAction = allActions.find(
    a => a.actorCellId === session.localPlayerCellId && a.isInProgress && !a.completed
  );
  if (!myAction) return;
  if (actedActionIds.has(myAction.id)) return;

  const priorityList = myAction.type === 'ban' ? roleConfig.bans : roleConfig.picks;
  if (!priorityList || priorityList.length === 0) return;

  // Collect unavailable champion IDs
  const unavailable = new Set();
  for (const action of allActions) {
    if (action.completed && action.championId) {
      unavailable.add(action.championId);
    }
  }
  // Also check team picks that are in progress (teammates hovering)
  if (myAction.type === 'pick') {
    for (const teammate of (session.myTeam || [])) {
      if (teammate.cellId !== session.localPlayerCellId && teammate.championId) {
        unavailable.add(teammate.championId);
      }
    }
  }

  const championId = priorityList.find(id => !unavailable.has(id));
  if (!championId) return;

  actedActionIds.add(myAction.id);
  acting = true;
  performAction(myAction.id, championId);
}

async function performAction(actionId, championId) {
  try {
    // Hover the champion first
    await fetch(`/lol-champ-select/v1/session/actions/${actionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ championId }),
    });

    // Wait before locking in
    await new Promise(r => setTimeout(r, AUTO_SELECT_DELAY_MS));

    // Lock in — single PATCH with completed: true
    await fetch(`/lol-champ-select/v1/session/actions/${actionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ championId, completed: true }),
    });
  } catch {
    // Silently fail — user can pick manually
  } finally {
    acting = false;
  }
}
