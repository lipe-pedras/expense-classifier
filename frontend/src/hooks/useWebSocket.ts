import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/store/authStore';
import { WS_URL } from '@/api/client';
import type { WsMessage } from '@/types';

export function useWebSocket(onMessage: (msg: WsMessage) => void) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!isAuthenticated || !accessToken) return;

    const ws = new WebSocket(`${WS_URL}/api/ws?token=${encodeURIComponent(accessToken)}`);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as WsMessage;
        onMessageRef.current(msg);
      } catch {
        // ignore malformed frames
      }
    };

    ws.onerror = () => {};

    return () => {
      ws.close();
    };
  }, [isAuthenticated, accessToken]);
}
