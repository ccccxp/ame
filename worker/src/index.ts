export { RoomDurableObject } from './room';

interface Env {
  ROOM: DurableObjectNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Health check
    if (url.pathname === '/' && request.method === 'GET') {
      return new Response(JSON.stringify({ status: 'ok' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // All room endpoints require a roomKey
    let roomKey: string | null = null;

    if (request.method === 'GET') {
      roomKey = url.searchParams.get('roomKey');
    } else if (request.method === 'POST') {
      try {
        const clone = await request.clone().json<{ roomKey?: string }>();
        roomKey = clone.roomKey || null;
      } catch {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    if (!roomKey) {
      return new Response(JSON.stringify({ error: 'Missing roomKey' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Route to the Durable Object for this room
    const id = env.ROOM.idFromName(roomKey);
    const stub = env.ROOM.get(id);
    return stub.fetch(request);
  },
};
