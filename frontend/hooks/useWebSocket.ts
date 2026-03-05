import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

type WebSocketMessage = {
    type: string;
    title?: string;
    body?: string;
    data?: Record<string, any>;
};

type UseWebSocketOptions = {
    /** Called when a message is received from the server */
    onMessage?: (message: WebSocketMessage) => void;
    /** Auto-reconnect on disconnect (default: true) */
    autoReconnect?: boolean;
    /** Reconnect delay in ms (default: 3000) */
    reconnectDelay?: number;
};

/**
 * Hook to connect to the WebSocket endpoint with JWT authentication.
 *
 * Usage:
 * ```tsx
 * useWebSocket({
 *   onMessage: (msg) => {
 *     if (msg.type === 'new_post') queryClient.invalidateQueries(['posts']);
 *   },
 * });
 * ```
 */
export function useWebSocket(options: UseWebSocketOptions = {}) {
    const { user, token } = useAuth();
    const { onMessage, autoReconnect = true, reconnectDelay = 3000 } = options;

    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const isUnmountedRef = useRef(false);

    const connect = useCallback(() => {
        if (!user?.id || !token || isUnmountedRef.current) return;

        // Build WebSocket URL with JWT token
        const wsProtocol = BACKEND_URL.startsWith('https') ? 'wss' : 'ws';
        const wsHost = BACKEND_URL.replace(/^https?:\/\//, '');
        const wsUrl = `${wsProtocol}://${wsHost}/api/v1/ws/${user.id}?token=${token}`;

        try {
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log('🟢 WebSocket connected');
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data) as WebSocketMessage;
                    onMessage?.(data);
                } catch {
                    console.warn('WS: Failed to parse message', event.data);
                }
            };

            ws.onclose = (event) => {
                console.log(`🔴 WebSocket closed (code: ${event.code})`);
                wsRef.current = null;

                // Auto-reconnect unless intentionally closed or auth error
                if (autoReconnect && !isUnmountedRef.current && event.code !== 4001 && event.code !== 4003) {
                    reconnectTimerRef.current = setTimeout(connect, reconnectDelay);
                }
            };

            ws.onerror = () => {
                // onclose will fire after onerror, so just log here
                console.warn('🟡 WebSocket error');
            };
        } catch (error) {
            console.error('WS: Connection failed', error);
        }
    }, [user?.id, token, onMessage, autoReconnect, reconnectDelay]);

    // Connect when user/token available, disconnect on cleanup
    useEffect(() => {
        isUnmountedRef.current = false;
        connect();

        return () => {
            isUnmountedRef.current = true;
            clearTimeout(reconnectTimerRef.current);
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
        };
    }, [connect]);

    return wsRef;
}
