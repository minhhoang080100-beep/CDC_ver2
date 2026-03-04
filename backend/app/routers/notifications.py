from fastapi import APIRouter, Depends, Query
from datetime import datetime, timezone
from bson import ObjectId
from app.core.database import db
from app.core.security import get_current_user

router = APIRouter()


@router.get("")
async def get_notifications(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=50),
    current_user: dict = Depends(get_current_user)
):
    user_id = str(current_user["_id"])
    query = {"userId": user_id}

    total = await db.notifications.count_documents(query)
    unread = await db.notifications.count_documents({**query, "read": False})
    notifications = await db.notifications.find(query).sort(
        "createdAt", -1
    ).skip(skip).limit(limit).to_list(limit)

    items = [{
        "id": str(n["_id"]),
        "type": n["type"],
        "title": n["title"],
        "body": n.get("body", ""),
        "data": n.get("data", {}),
        "read": n["read"],
        "createdAt": n["createdAt"]
    } for n in notifications]

    return {"items": items, "total": total, "unread": unread, "hasMore": skip + limit < total}


@router.post("/read-all")
async def mark_all_read(current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    result = await db.notifications.update_many(
        {"userId": user_id, "read": False},
        {"$set": {"read": True}}
    )
    return {"status": "success", "count": result.modified_count}


@router.post("/{notification_id}/read")
async def mark_read(notification_id: str, current_user: dict = Depends(get_current_user)):
    await db.notifications.update_one(
        {"_id": ObjectId(notification_id), "userId": str(current_user["_id"])},
        {"$set": {"read": True}}
    )
    return {"status": "success"}


# ─── Helper: Create notification (called from other routers) ────
async def create_notification(user_id: str, type: str, title: str, body: str = "", data: dict = None):
    """Create a notification for a user. Call from other routers."""
    await db.notifications.insert_one({
        "userId": user_id,
        "type": type,
        "title": title,
        "body": body,
        "data": data or {},
        "read": False,
        "createdAt": datetime.now(timezone.utc)
    })
