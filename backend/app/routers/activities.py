from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks

from datetime import datetime, timezone
from bson import ObjectId
from app.core.database import db
from app.core.security import get_current_user, validate_object_id
from app.core.permissions import build_content_filter, resolve_target_departments, can_manage_content
from app.models.activity import ActivityCreate, CheckInRequest, SelfCheckinRequest
from app.core.push import send_bulk_push_notifications_async
from app.core.cloudinary_utils import delete_cloudinary_asset
from app.routers.websocket import manager
import json
import hmac
import hashlib
import secrets as secrets_mod
import time as time_mod

router = APIRouter()

@router.get("")
async def get_activities(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user)
):
    content_filter = build_content_filter(current_user)
    content_filter["isDeleted"] = {"$ne": True}
    total = await db.activities.count_documents(content_filter)
    activities = await db.activities.find(content_filter).sort("createdAt", -1).skip(skip).limit(limit).to_list(limit)
    
    items = [{
        "id": str(activity["_id"]),
        "name": activity["name"],
        "description": activity["description"],
        "time": activity["time"],
        "location": activity["location"],
        "type": activity["type"],
        "image": activity.get("image"),
        "createdBy": activity["createdBy"],
        "targetDepartments": activity.get("targetDepartments", ["ALL"]),
        "registrations": activity.get("registrations", []),
        "attendances": activity.get("attendances", []),
        "checkinEnabled": activity.get("checkinEnabled", False),
        "createdAt": activity["createdAt"]
    } for activity in activities]

    return {"items": items, "total": total, "hasMore": skip + limit < total}

@router.post("/{activity_id}/register")
async def register_activity(activity_id: str, current_user: dict = Depends(get_current_user)):
    oid = validate_object_id(activity_id, "Activity ID")
    activity = await db.activities.find_one({"_id": oid, "isDeleted": {"$ne": True}})
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    
    registrations = activity.get("registrations", [])
    user_registered = any(r["userId"] == current_user["_id"] for r in registrations)
    
    if user_registered:
        registrations = [r for r in registrations if r["userId"] != current_user["_id"]]
        action = "unregistered"
    else:
        registrations.append({
            "userId": current_user["_id"],
            "userName": current_user["fullName"],
            "registeredAt": datetime.now(timezone.utc)
        })
        action = "registered"
    
    await db.activities.update_one(
        {"_id": oid},
        {"$set": {"registrations": registrations}}
    )
    
    return {"status": "success", "action": action}

@router.post("/{activity_id}/checkin")
async def checkin_activity(activity_id: str, request: CheckInRequest, current_user: dict = Depends(get_current_user)):
    if not can_manage_content(current_user):
         raise HTTPException(status_code=403, detail="Chỉ có BCH mới được phép điểm danh bằng QR")
    
    oid = validate_object_id(activity_id, "Activity ID")
    activity = await db.activities.find_one({"_id": oid, "isDeleted": {"$ne": True}})
    if not activity:
        raise HTTPException(status_code=404, detail="Không tìm thấy hoạt động")
        
    try:
        qr_json = json.loads(request.qr_data)
        user_id = qr_json.get("id")
        union_id = qr_json.get("unionId")
        user_name = qr_json.get("name")
    except Exception as e:
        raise HTTPException(status_code=400, detail="Mã QR không hợp lệ")
        
    if not user_id or not union_id:
        raise HTTPException(status_code=400, detail="Dữ liệu QR không đủ thông tin")
        
    # Check if user exists in DB to be safe
    attendee = await db.users.find_one({"_id": ObjectId(user_id), "unionId": union_id})
    if not attendee:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản đoàn viên này trong hệ thống")

    # Record attendance
    # We can store attendances directly in the activity document or a separate collection.
    # Storing in activity is easier to fetch details. Let's add "attendances" array to activity.
    attendances = activity.get("attendances", [])
    already_checked_in = any(a["userId"] == user_id for a in attendances)
    
    if already_checked_in:
        return {"status": "success", "message": f"Đoàn viên {attendee['fullName']} đã được điểm danh trước đó.", "already_checked_in": True}
        
    attendances.append({
        "userId": user_id,
        "userName": attendee["fullName"],
        "unionId": union_id,
        "checkedInAt": datetime.now(timezone.utc),
        "checkedInBy": current_user["_id"] # Admin who scanned it
    })
    
    await db.activities.update_one(
        {"_id": oid},
        {"$set": {"attendances": attendances}}
    )
    
    return {"status": "success", "message": f"Điểm danh thành công cho {attendee['fullName']}", "already_checked_in": False}

# ─── Self Check-in (Members scan event QR) ─────────────────────

@router.post("/{activity_id}/toggle-checkin")
async def toggle_checkin(activity_id: str, current_user: dict = Depends(get_current_user)):
    """BCH enables/disables self-check-in mode for an activity."""
    if not can_manage_content(current_user):
        raise HTTPException(status_code=403, detail="Chỉ BCH mới có quyền bật/tắt điểm danh")
    
    oid = validate_object_id(activity_id, "Activity ID")
    activity = await db.activities.find_one({"_id": oid, "isDeleted": {"$ne": True}})
    if not activity:
        raise HTTPException(status_code=404, detail="Không tìm thấy hoạt động")
    
    currently_enabled = activity.get("checkinEnabled", False)
    
    if currently_enabled:
        await db.activities.update_one({"_id": oid}, {"$set": {"checkinEnabled": False}})
        return {"checkinEnabled": False, "message": "Đã tắt chế độ điểm danh"}
    else:
        secret = secrets_mod.token_hex(32)
        await db.activities.update_one({"_id": oid}, {"$set": {
            "checkinEnabled": True,
            "checkinSecret": secret
        }})
        return {"checkinEnabled": True, "message": "Đã bật chế độ điểm danh tại chỗ"}

@router.get("/{activity_id}/checkin-token")
async def get_checkin_token(activity_id: str, current_user: dict = Depends(get_current_user)):
    """Returns rotating QR data (30s window) for BCH to display at the event."""
    if not can_manage_content(current_user):
        raise HTTPException(status_code=403, detail="Chỉ BCH mới có quyền hiển thị QR điểm danh")
    
    oid = validate_object_id(activity_id, "Activity ID")
    activity = await db.activities.find_one({"_id": oid, "isDeleted": {"$ne": True}})
    if not activity:
        raise HTTPException(status_code=404, detail="Không tìm thấy hoạt động")
    
    if not activity.get("checkinEnabled"):
        raise HTTPException(status_code=400, detail="Chế độ điểm danh chưa được bật")
    
    secret = activity["checkinSecret"]
    ts = int(time_mod.time())
    window = ts // 30
    token = hmac.new(secret.encode(), str(window).encode(), hashlib.sha256).hexdigest()[:16]
    
    qr_data = json.dumps({
        "type": "activity_checkin",
        "activityId": activity_id,
        "token": token,
        "ts": ts
    })
    
    attendance_count = len(activity.get("attendances", []))
    
    return {
        "qrData": qr_data,
        "expiresIn": 30 - (ts % 30),
        "attendanceCount": attendance_count,
        "activityName": activity["name"]
    }

@router.post("/{activity_id}/self-checkin")
async def self_checkin(activity_id: str, request: SelfCheckinRequest, current_user: dict = Depends(get_current_user)):
    """Member scans activity QR to check themselves in."""
    oid = validate_object_id(activity_id, "Activity ID")
    activity = await db.activities.find_one({"_id": oid, "isDeleted": {"$ne": True}})
    if not activity:
        raise HTTPException(status_code=404, detail="Không tìm thấy hoạt động")
    
    if not activity.get("checkinEnabled"):
        raise HTTPException(status_code=400, detail="Chế độ điểm danh chưa được bật cho hoạt động này")
    
    try:
        qr_json = json.loads(request.qr_data)
        token = qr_json["token"]
    except Exception:
        raise HTTPException(status_code=400, detail="Mã QR không hợp lệ")
    
    # Validate HMAC against current and previous 30s window
    secret = activity["checkinSecret"]
    current_window = int(time_mod.time()) // 30
    valid = False
    for w in [current_window, current_window - 1]:
        expected = hmac.new(secret.encode(), str(w).encode(), hashlib.sha256).hexdigest()[:16]
        if hmac.compare_digest(token, expected):
            valid = True
            break
    
    if not valid:
        raise HTTPException(status_code=400, detail="Mã QR đã hết hạn. Vui lòng quét lại mã mới trên màn hình.")
    
    # Check already checked in
    attendances = activity.get("attendances", [])
    if any(a["userId"] == current_user["_id"] for a in attendances):
        return {"status": "success", "message": "Bạn đã điểm danh trước đó rồi.", "already_checked_in": True}
    
    attendances.append({
        "userId": current_user["_id"],
        "userName": current_user["fullName"],
        "unionId": current_user.get("unionId", ""),
        "checkedInAt": datetime.now(timezone.utc),
        "checkedInBy": "self"
    })
    
    await db.activities.update_one({"_id": oid}, {"$set": {"attendances": attendances}})
    
    # Broadcast to update attendance count in real-time
    await manager.broadcast(
        {"type": "checkin_update", "activityId": activity_id, "count": len(attendances)}
    )
    
    return {"status": "success", "message": f"Điểm danh thành công! Chào mừng {current_user['fullName']}.", "already_checked_in": False}

@router.post("")
async def create_activity(activity: ActivityCreate, background_tasks: BackgroundTasks, current_user: dict = Depends(get_current_user)):
    if not can_manage_content(current_user):
        raise HTTPException(status_code=403, detail="You don't have permission to create activities")
    
    target_departments = resolve_target_departments(current_user, activity.targetDepartments)
    
    activity_data = {
        "name": activity.name,
        "description": activity.description,
        "time": activity.time,
        "location": activity.location,
        "type": activity.type,
        "image": activity.image,
        "createdBy": current_user["_id"],
        "targetDepartments": target_departments,
        "registrations": [],
        "isDeleted": False,
        "createdAt": datetime.now(timezone.utc)
    }
    
    result = await db.activities.insert_one(activity_data)
    activity_data["_id"] = result.inserted_id
    activity_id = str(activity_data["_id"])
    
    background_tasks.add_task(
        notify_new_activity,
        title=f"Hoạt động mới: {activity.name}",
        body=activity.description,
        target_departments=target_departments,
        activity_id=activity_id
    )

    # WebSocket broadcast
    background_tasks.add_task(
        manager.broadcast,
        {"type": "new_activity", "title": f"Hoạt động mới: {activity.name}", "data": {"activityId": activity_id}}
    )
    
    return {
        "id": activity_id,
        **{k: v for k, v in activity_data.items() if k != "_id"}
    }

async def notify_new_activity(title: str, body: str, target_departments: list, activity_id: str):
    query = {"status": "ACTIVE", "pushToken": {"$exists": True, "$ne": None}}
    if "ALL" not in target_departments and target_departments:
        query["department"] = {"$in": target_departments}
        
    users = await db.users.find(query).to_list(1000)
    tokens = [u["pushToken"] for u in users if u.get("pushToken")]
    
    if tokens:
        await send_bulk_push_notifications_async(
            tokens=tokens, 
            title=title, 
            body=body,
            data={"activityId": activity_id}
        )

@router.put("/{activity_id}")
async def update_activity(
    activity_id: str, 
    activity: ActivityCreate, 
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    oid = validate_object_id(activity_id, "Activity ID")
    existing_activity = await db.activities.find_one({"_id": oid, "isDeleted": {"$ne": True}})
    if not existing_activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    
    if current_user["role"] != "SUPER_ADMIN" and existing_activity["createdBy"] != current_user["_id"]:
        raise HTTPException(status_code=403, detail="You don't have permission to edit this activity")
    
    target_departments = resolve_target_departments(current_user, activity.targetDepartments)
    
    # Check if image changed to clean up old image from Cloudinary 
    old_image = existing_activity.get("image")
    if old_image and old_image != activity.image:
        background_tasks.add_task(delete_cloudinary_asset, old_image)
    
    update_data = {
        "name": activity.name,
        "description": activity.description,
        "time": activity.time,
        "location": activity.location,
        "type": activity.type,
        "image": activity.image,
        "targetDepartments": target_departments,
        "updatedAt": datetime.now(timezone.utc)
    }
    
    await db.activities.update_one(
        {"_id": oid},
        {"$set": update_data}
    )
    
    return {"status": "success", "message": "Activity updated"}

@router.delete("/{activity_id}")
async def delete_activity(
    activity_id: str, 
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    oid = validate_object_id(activity_id, "Activity ID")
    existing_activity = await db.activities.find_one({"_id": oid, "isDeleted": {"$ne": True}})
    if not existing_activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    
    if current_user["role"] != "SUPER_ADMIN" and existing_activity["createdBy"] != current_user["_id"]:
        raise HTTPException(status_code=403, detail="You don't have permission to delete this activity")
    
    # Delete image from Cloudinary if it exists
    image = existing_activity.get("image")
    if image:
        background_tasks.add_task(delete_cloudinary_asset, image)

    # Soft delete
    await db.activities.update_one(
        {"_id": oid},
        {"$set": {"isDeleted": True, "image": None, "deletedAt": datetime.now(timezone.utc)}}
    )
    
    return {"status": "success", "message": "Activity deleted"}
