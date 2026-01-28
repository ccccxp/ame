import { WS_URL, WS_RECONNECT_BASE_MS, WS_RECONNECT_MAX_MS } from './constants';

let ws = null;
let wsReconnectDelay = WS_RECONNECT_BASE_MS;
let wsReconnectTimer = null;

export function wsConnect() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
  try {
    ws = new WebSocket(WS_URL);
    ws.onopen = () => {
      console.log('[ame] WebSocket connected');
      wsReconnectDelay = WS_RECONNECT_BASE_MS;
    };
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'status') {
          if (typeof Toast !== 'undefined') {
            if (msg.status === 'error') {
              Toast.error(msg.message);
            } else if (msg.status === 'ready') {
              Toast.success(msg.message);
            } else if (msg.status === 'downloading' || msg.status === 'injecting') {
              Toast.success(msg.message);
            }
          }
        }
      } catch (err) {
        console.log('[ame] onmessage error:', err);
      }
    };
    ws.onclose = () => wsScheduleReconnect();
    ws.onerror = () => {};
  } catch {
    wsScheduleReconnect();
  }
}

function wsScheduleReconnect() {
  if (wsReconnectTimer) return;
  wsReconnectTimer = setTimeout(() => {
    wsReconnectTimer = null;
    wsReconnectDelay = Math.min(wsReconnectDelay * 2, WS_RECONNECT_MAX_MS);
    wsConnect();
  }, wsReconnectDelay);
}

export function wsSend(obj) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(obj));
  }
}
