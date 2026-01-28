let championSkins = null;
let cachedChampionId = null;

export async function getMyChampionId() {
  try {
    const res = await fetch('/lol-champ-select/v1/session');
    if (!res.ok) return null;
    const session = await res.json();
    const me = session.myTeam?.find(p => p.cellId === session.localPlayerCellId);
    return me?.championId || null;
  } catch {
    return null;
  }
}

export async function loadChampionSkins(championId) {
  if (championId === cachedChampionId && championSkins) return championSkins;
  try {
    const res = await fetch(`/lol-game-data/assets/v1/champions/${championId}.json`);
    if (!res.ok) return null;
    const data = await res.json();
    cachedChampionId = championId;
    championSkins = data.skins || [];
    return championSkins;
  } catch {
    return null;
  }
}

export function getChampionSkins() {
  return championSkins;
}

export function resetSkinsCache() {
  championSkins = null;
  cachedChampionId = null;
}
