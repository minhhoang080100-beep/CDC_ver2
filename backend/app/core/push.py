import requests
import logging

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

def send_push_notification(token: str, title: str, body: str, data: dict = None):
    if not token or not token.startswith("ExponentPushToken"):
        return
        
    payload = {
        "to": token,
        "title": title,
        "body": body,
        "data": data or {}
    }
    
    try:
        response = requests.post(
            EXPO_PUSH_URL,
            json=payload,
            headers={
                "Accept": "application/json",
                "Accept-encoding": "gzip, deflate",
                "Content-Type": "application/json",
            }
        )
        response.raise_for_status()
        logger.info(f"Push sent: {token}")
    except Exception as e:
        logger.error(f"Push error: {str(e)}")

def send_bulk_push_notifications(tokens: list, title: str, body: str, data: dict = None):
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
        response = requests.post(
            EXPO_PUSH_URL,
            json=payloads,
            headers={
                "Accept": "application/json",
                "Accept-encoding": "gzip, deflate",
                "Content-Type": "application/json",
            }
        )
        response.raise_for_status()
        logger.info(f"Bulk push sent: {len(valid_tokens)} devices")
    except Exception as e:
        logger.error(f"Bulk push error: {str(e)}")
