from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List
from datetime import datetime
from bson import ObjectId
from app.core.database import db
from app.core.security import get_current_user
from app.core.permissions import build_content_filter, resolve_target_departments, can_manage_content
from app.models.activity import ActivityCreate

router = APIRouter()

@router.get("", response_model=List[dict])
async def get_activities(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user)
):
    content_filter = build_content_filter(current_user)
    activities = await db.activities.find(content_filter).sort("createdAt", -1).skip(skip).limit(limit).to_list(limit)
    
    return [{
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
        "createdAt": activity["createdAt"]
    } for activity in activities]

@router.post("/{activity_id}/register")
async def register_activity(activity_id: str, current_user: dict = Depends(get_current_user)):
    activity = await db.activities.find_one({"_id": ObjectId(activity_id)})
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
            "registeredAt": datetime.utcnow()
        })
        action = "registered"
    
    await db.activities.update_one(
        {"_id": ObjectId(activity_id)},
        {"$set": {"registrations": registrations}}
    )
    
    return {"status": "success", "action": action}

@router.post("")
async def create_activity(activity: ActivityCreate, current_user: dict = Depends(get_current_user)):
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
        "createdAt": datetime.utcnow()
    }
    
    result = await db.activities.insert_one(activity_data)
    activity_data["_id"] = result.inserted_id
    
    return {
        "id": str(activity_data["_id"]),
        **{k: v for k, v in activity_data.items() if k != "_id"}
    }

@router.put("/{activity_id}")
async def update_activity(activity_id: str, activity: ActivityCreate, current_user: dict = Depends(get_current_user)):
    existing_activity = await db.activities.find_one({"_id": ObjectId(activity_id)})
    if not existing_activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    
    if current_user["role"] != "SUPER_ADMIN" and existing_activity["createdBy"] != current_user["_id"]:
        raise HTTPException(status_code=403, detail="You don't have permission to edit this activity")
    
    target_departments = resolve_target_departments(current_user, activity.targetDepartments)
    
    update_data = {
        "name": activity.name,
        "description": activity.description,
        "time": activity.time,
        "location": activity.location,
        "type": activity.type,
        "image": activity.image,
        "targetDepartments": target_departments,
        "updatedAt": datetime.utcnow()
    }
    
    await db.activities.update_one(
        {"_id": ObjectId(activity_id)},
        {"$set": update_data}
    )
    
    return {"status": "success", "message": "Activity updated"}

@router.delete("/{activity_id}")
async def delete_activity(activity_id: str, current_user: dict = Depends(get_current_user)):
    existing_activity = await db.activities.find_one({"_id": ObjectId(activity_id)})
    if not existing_activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    
    if current_user["role"] != "SUPER_ADMIN" and existing_activity["createdBy"] != current_user["_id"]:
        raise HTTPException(status_code=403, detail="You don't have permission to delete this activity")
    
    await db.activities.delete_one({"_id": ObjectId(activity_id)})
    
    return {"status": "success", "message": "Activity deleted"}
