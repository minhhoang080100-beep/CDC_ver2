import httpx
import logging

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
EXPO_BATCH_LIMIT = 100  # Expo recommends max 100 tokens per request

_PUSH_HEADERS = {
    "Accept": "application/json",
    "Accept-encoding": "gzip, deflate",
    "Content-Type": "application/json",
}


async def send_push_notification_async(token: str, title: str, body: str, data: dict = None):
    """Send push notification to a single device."""
    if not token or not token.startswith("ExponentPushToken"):
        return

    payload = {
        "to": token,
        "title": title,
        "body": body,
        "data": data or {}
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(EXPO_PUSH_URL, json=payload, headers=_PUSH_HEADERS)
            response.raise_for_status()
            logger.info(f"Push sent: {token[:30]}...")
    except Exception as e:
        logger.error(f"Push error: {str(e)}")


async def send_bulk_push_notifications_async(tokens: list, title: str, body: str, data: dict = None):
    """Send push notifications to multiple devices, batched per Expo limits."""
    valid_tokens = [t for t in tokens if t and t.startswith("ExponentPushToken")]
    if not valid_tokens:
        return

    # Batch tokens to respect Expo's limit
    async with httpx.AsyncClient() as client:
        for i in range(0, len(valid_tokens), EXPO_BATCH_LIMIT):
            batch = valid_tokens[i:i + EXPO_BATCH_LIMIT]
            payloads = [
                {"to": token, "title": title, "body": body, "data": data or {}}
                for token in batch
            ]

            try:
                response = await client.post(EXPO_PUSH_URL, json=payloads, headers=_PUSH_HEADERS)
                response.raise_for_status()
                logger.info(f"Bulk push sent: batch {i // EXPO_BATCH_LIMIT + 1} ({len(batch)} devices)")
            except Exception as e:
                logger.error(f"Bulk push error (batch {i // EXPO_BATCH_LIMIT + 1}): {str(e)}")
