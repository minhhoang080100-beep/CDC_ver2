from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks

from datetime import datetime, timezone
from bson import ObjectId
from app.core.database import db
from app.core.security import get_current_user, validate_object_id
from app.core.permissions import build_content_filter, resolve_target_departments, can_manage_content
from app.models.activity import ActivityCreate, CheckInRequest
from app.core.push import send_bulk_push_notifications_async
from app.core.cloudinary_utils import delete_cloudinary_asset
import json

router = APIRouter()

@router.get("")
async def get_activities(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user)
):
    content_filter = build_content_filter(current_user)
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
        "createdAt": activity["createdAt"]
    } for activity in activities]

    return {"items": items, "total": total, "hasMore": skip + limit < total}

@router.post("/{activity_id}/register")
async def register_activity(activity_id: str, current_user: dict = Depends(get_current_user)):
    oid = validate_object_id(activity_id, "Activity ID")
    activity = await db.activities.find_one({"_id": oid})
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
    activity = await db.activities.find_one({"_id": oid})
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
        "createdAt": datetime.now(timezone.utc)
    }
    
    result = await db.activities.insert_one(activity_data)
    activity_data["_id"] = result.inserted_id
    
    background_tasks.add_task(
        notify_new_activity,
        title=f"Hoạt động mới: {activity.name}",
        body=activity.description,
        target_departments=target_departments,
        activity_id=str(activity_data["_id"])
    )
    
    return {
        "id": str(activity_data["_id"]),
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
    existing_activity = await db.activities.find_one({"_id": oid})
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
    existing_activity = await db.activities.find_one({"_id": oid})
    if not existing_activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    
    if current_user["role"] != "SUPER_ADMIN" and existing_activity["createdBy"] != current_user["_id"]:
        raise HTTPException(status_code=403, detail="You don't have permission to delete this activity")
    
    # Delete image from Cloudinary if it exists
    image = existing_activity.get("image")
    if image:
        background_tasks.add_task(delete_cloudinary_asset, image)
        
    await db.activities.delete_one({"_id": oid})
    
    return {"status": "success", "message": "Activity deleted"}
