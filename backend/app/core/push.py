import httpx
import logging
import asyncio

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

_PUSH_HEADERS = {
    "Accept": "application/json",
    "Accept-encoding": "gzip, deflate",
    "Content-Type": "application/json",
}


async def send_push_notification_async(token: str, title: str, body: str, data: dict = None):
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
            logger.info(f"Push sent: {token}")
    except Exception as e:
        logger.error(f"Push error: {str(e)}")


async def send_bulk_push_notifications_async(tokens: list, title: str, body: str, data: dict = None):
    valid_tokens = [t for t in tokens if t and t.startswith("ExponentPushToken")]
    if not valid_tokens:
        return

    payloads = [
        {
            "to": token,
            "title": title,
            "body": body,
            "data": data or {}
        }
        for token in valid_tokens
    ]

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(EXPO_PUSH_URL, json=payloads, headers=_PUSH_HEADERS)
            response.raise_for_status()
            logger.info(f"Bulk push sent: {len(valid_tokens)} devices")
    except Exception as e:
        logger.error(f"Bulk push error: {str(e)}")


# Backward-compatible sync versions (giữ lại cho các background_tasks)
def send_push_notification(token: str, title: str, body: str, data: dict = None):
    if not token or not token.startswith("ExponentPushToken"):
        return
    try:
        import requests
        payload = {"to": token, "title": title, "body": body, "data": data or {}}
        response = requests.post(EXPO_PUSH_URL, json=payload, headers=_PUSH_HEADERS)
        response.raise_for_status()
        logger.info(f"Push sent: {token}")
    except Exception as e:
        logger.error(f"Push error: {str(e)}")


def send_bulk_push_notifications(tokens: list, title: str, body: str, data: dict = None):
    valid_tokens = [t for t in tokens if t and t.startswith("ExponentPushToken")]
    if not valid_tokens:
        return
    try:
        import requests
        payloads = [{"to": t, "title": title, "body": body, "data": data or {}} for t in valid_tokens]
        response = requests.post(EXPO_PUSH_URL, json=payloads, headers=_PUSH_HEADERS)
        response.raise_for_status()
        logger.info(f"Bulk push sent: {len(valid_tokens)} devices")
    except Exception as e:
        logger.error(f"Bulk push error: {str(e)}")
