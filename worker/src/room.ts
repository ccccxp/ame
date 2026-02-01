import { DurableObject } from 'cloudflare:workers';

interface SkinInfo {
  championId: string;
  skinId: string;
  baseSkinId: string;
  championName: string;
  skinName: string;
  chromaName: string;
}

interface MemberRow {
  puuid: string;
  champion_id: string;
  skin_id: string;
  base_skin_id: string;
  champion_name: string;
  skin_name: string;
  chroma_name: string;
  last_seen: number;
}

export class RoomDurableObject extends DurableObject {
  private initialized = false;

  private ensureTable() {
    if (this.initialized) return;
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS members (
        puuid TEXT PRIMARY KEY,
        champion_id TEXT NOT NULL DEFAULT '',
        skin_id TEXT NOT NULL DEFAULT '',
        base_skin_id TEXT NOT NULL DEFAULT '',
        champion_name TEXT NOT NULL DEFAULT '',
        skin_name TEXT NOT NULL DEFAULT '',
        chroma_name TEXT NOT NULL DEFAULT '',
        last_seen INTEGER NOT NULL
      )
    `);
    this.initialized = true;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (request.method === 'POST' && path === '/rooms/join') {
        return this.handleJoin(request);
      }
      if (request.method === 'GET' && path === '/rooms/members') {
        return this.handleMembers(url);
      }
      if (request.method === 'POST' && path === '/rooms/leave') {
        return this.handleLeave(request);
      }
      return json({ error: 'Not found' }, 404);
    } catch (e) {
      return json({ error: 'Internal error' }, 500);
    }
  }

  private async handleJoin(request: Request): Promise<Response> {
    this.ensureTable();
    const body = await request.json<{
      puuid: string;
      skinInfo?: SkinInfo;
    }>();

    if (!body.puuid) {
      return json({ error: 'Missing puuid' }, 400);
    }

    const skin = body.skinInfo || {} as SkinInfo;
    const now = Math.floor(Date.now() / 1000);

    this.ctx.storage.sql.exec(
      `INSERT OR REPLACE INTO members (puuid, champion_id, skin_id, base_skin_id, champion_name, skin_name, chroma_name, last_seen)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      body.puuid,
      skin.championId || '',
      skin.skinId || '',
      skin.baseSkinId || '',
      skin.championName || '',
      skin.skinName || '',
      skin.chromaName || '',
      now,
    );

    // Set auto-expire alarm if not already set
    const alarm = await this.ctx.storage.getAlarm();
    if (!alarm) {
      await this.ctx.storage.setAlarm(Date.now() + 30 * 60 * 1000);
    }

    return json({ ok: true });
  }

  private handleMembers(url: URL): Response {
    this.ensureTable();
    const puuid = url.searchParams.get('puuid') || '';
    const now = Math.floor(Date.now() / 1000);
    const staleThreshold = now - 120;

    // Update caller's last_seen
    if (puuid) {
      this.ctx.storage.sql.exec(
        `UPDATE members SET last_seen = ? WHERE puuid = ?`,
        now,
        puuid,
      );
    }

    // Delete stale members
    this.ctx.storage.sql.exec(
      `DELETE FROM members WHERE last_seen < ?`,
      staleThreshold,
    );

    // Return all other members
    const rows = this.ctx.storage.sql.exec(
      `SELECT puuid, champion_id, skin_id, base_skin_id, champion_name, skin_name, chroma_name, last_seen
       FROM members WHERE puuid != ?`,
      puuid,
    ).toArray() as MemberRow[];

    const members = rows.map(row => ({
      puuid: row.puuid,
      skinInfo: {
        championId: row.champion_id,
        skinId: row.skin_id,
        baseSkinId: row.base_skin_id,
        championName: row.champion_name,
        skinName: row.skin_name,
        chromaName: row.chroma_name,
      },
    }));

    return json({ members });
  }

  private async handleLeave(request: Request): Promise<Response> {
    this.ensureTable();
    const body = await request.json<{ puuid: string }>();
    if (body.puuid) {
      this.ctx.storage.sql.exec(`DELETE FROM members WHERE puuid = ?`, body.puuid);
    }
    return json({ ok: true });
  }

  async alarm() {
    this.ensureTable();
    this.ctx.storage.sql.exec(`DELETE FROM members`);
  }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
