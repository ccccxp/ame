import { wsSend, onRoomPartyUpdate, onSetting } from './websocket';
import { fetchJson } from './api';
import { el } from './dom';
import { ROOM_PARTY_INDICATOR_CLASS } from './constants';

let enabled = false;
let joined = false;
let currentTeammates = [];
let unsubUpdate = null;

export function loadRoomPartySetting() {
  onSetting('roomParty', (v) => {
    enabled = v;
    if (!v && joined) {
      leaveRoom();
    }
  });
}

export async function joinRoom() {
  if (!enabled || joined) return;

  const gameflow = await fetchJson('/lol-gameflow/v1/session');
  if (!gameflow) return;

  const gameId = gameflow.gameData?.gameId;
  if (!gameId) return;

  const summoner = await fetchJson('/lol-summoner/v1/current-summoner');
  if (!summoner?.puuid) return;

  const session = await fetchJson('/lol-champ-select/v1/session');
  if (!session?.myTeam) return;

  const teamPuuids = session.myTeam
    .map(p => p.puuid)
    .filter(p => p && p !== '' && p !== summoner.puuid);

  const roomKey = `${gameId}`;

  wsSend({
    type: 'roomPartyJoin',
    roomKey,
    puuid: summoner.puuid,
    teamPuuids,
  });

  joined = true;

  unsubUpdate = onRoomPartyUpdate((teammates) => {
    currentTeammates = teammates;
    renderTeammateIndicators();
  });
}

export function notifySkinChange(championId, skinId, baseSkinId, championName, skinName, chromaName) {
  if (!enabled || !joined) return;
  wsSend({
    type: 'roomPartySkin',
    championId,
    skinId,
    baseSkinId: baseSkinId || '',
    championName: championName || '',
    skinName: skinName || '',
    chromaName: chromaName || '',
  });
}

export function leaveRoom() {
  if (!joined) return;
  wsSend({ type: 'roomPartyLeave' });
  joined = false;
  currentTeammates = [];
  if (unsubUpdate) {
    unsubUpdate();
    unsubUpdate = null;
  }
  removeTeammateIndicators();
}

export function resetRoomPartyJoin() {
  joined = false;
}

function removeTeammateIndicators() {
  document.querySelectorAll(`.${ROOM_PARTY_INDICATOR_CLASS}`).forEach(e => e.remove());
}

async function renderTeammateIndicators() {
  removeTeammateIndicators();
  if (currentTeammates.length === 0) return;

  const session = await fetchJson('/lol-champ-select/v1/session');
  if (!session?.myTeam) return;

  const teamOrdered = session.myTeam.slice().sort((a, b) => a.cellId - b.cellId);
  const slots = document.querySelectorAll('.ally-slot');
  if (!slots.length) return;

  for (const tm of currentTeammates) {
    if (!tm.skinInfo?.skinName) continue;

    const label = tm.skinInfo.chromaName
      ? `${tm.skinInfo.skinName} (${tm.skinInfo.chromaName})`
      : tm.skinInfo.skinName;

    const targetIndex = teamOrdered.findIndex(p => p.puuid === tm.puuid);
    if (targetIndex < 0 || targetIndex >= slots.length) continue;

    const slot = slots[targetIndex];
    slot.style.position = 'relative';

    const badge = el('div', {
      class: ROOM_PARTY_INDICATOR_CLASS,
      title: `Ame: ${label}`,
    }, el('span', null, label));

    slot.appendChild(badge);
  }
}
