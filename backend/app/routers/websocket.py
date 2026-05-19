"""
WebSocket endpoint for real-time notifications.
Usage:
    ws://host:port/api/v1/ws/{user_id}?token=<JWT_ACCESS_TOKEN>

Users connect with their user_id and a valid JWT token to receive live push
events (new posts, activities, feedback replies, etc.) without polling.
"""

import asyncio
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from starlette.websockets import WebSocketState

from app.core.security import decode_token

logger = logging.getLogger(__name__)
router = APIRouter()


class ConnectionManager:
    """Manages active WebSocket connections per user."""

    def __init__(self):
        self._connections: dict[str, list[WebSocket]] = {}

    async def connect(self, user_id: str, ws: WebSocket):
        await ws.accept()
        self._connections.setdefault(user_id, []).append(ws)
        logger.info(f"WS connected: {user_id} (total: {self.count})")

    def disconnect(self, user_id: str, ws: WebSocket):
        conns = self._connections.get(user_id, [])
        if ws in conns:
            conns.remove(ws)
        if not conns:
            self._connections.pop(user_id, None)
        logger.info(f"WS disconnected: {user_id} (total: {self.count})")

    async def send_to_user(self, user_id: str, data: dict):
        """Send JSON data to all connections for a given user."""
        for ws in self._connections.get(user_id, []):
            try:
                await ws.send_json(data)
            except Exception:
                pass  # stale connection, will be cleaned up on next disconnect

    async def broadcast(self, data: dict, user_ids: list[str] | None = None):
        """Broadcast to specific users, or all if user_ids is None."""
        targets = user_ids or list(self._connections.keys())
        for uid in targets:
            await self.send_to_user(uid, data)

    @property
    def count(self) -> int:
        return sum(len(v) for v in self._connections.values())


# Singleton — import from other routers to send events
manager = ConnectionManager()


@router.websocket("/ws/{user_id}")
async def websocket_endpoint(ws: WebSocket, user_id: str, token: str = Query(None)):
    # ─── JWT Authentication ───────────────────────────────────
    if not token:
        await ws.close(code=4001, reason="Token required")
        return

    try:
        payload = decode_token(token)
    except Exception:
        await ws.close(code=4001, reason="Invalid or expired token")
        return

    # Only accept access tokens
    if payload.get("type") != "access":
        await ws.close(code=4001, reason="Invalid token type")
        return

    # Verify user_id matches the token
    token_user_id = payload.get("user_id")
    if token_user_id != user_id:
        await ws.close(code=4003, reason="User ID mismatch")
        return

    # ─── Authenticated — accept connection ────────────────────
    await manager.connect(user_id, ws)
    try:
        while True:
            try:
                await asyncio.wait_for(ws.receive_text(), timeout=25)
            except asyncio.TimeoutError:
                if ws.client_state == WebSocketState.CONNECTED:
                    await ws.send_json({"type": "ping"})
    except WebSocketDisconnect:
        manager.disconnect(user_id, ws)
    except Exception:
        manager.disconnect(user_id, ws)

