from fastapi import APIRouter, HTTPException, Depends
from typing import List
from datetime import datetime
from bson import ObjectId
from backend.app.core.database import db
from backend.app.core.security import get_current_user
from backend.app.models.activity import ActivityCreate

router = APIRouter()

@router.get("", response_model=List[dict])
async def get_activities(current_user: dict = Depends(get_current_user)):
    if current_user["role"] in ["SUPER_ADMIN", "BCH_VANPHONG"]:
        activities = await db.activities.find().sort("createdAt", -1).to_list(100)
    elif current_user["role"].startswith("BCH_"):
        activities = await db.activities.find({
            "$or": [
                {"targetDepartments": current_user["department"]},
                {"targetDepartments": "ALL"}
            ]
        }).sort("createdAt", -1).to_list(100)
    else:
        activities = await db.activities.find({
            "$or": [
                {"targetDepartments": current_user["department"]},
                {"targetDepartments": "ALL"}
            ]
        }).sort("createdAt", -1).to_list(100)
    
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
    if not (current_user["role"] == "SUPER_ADMIN" or current_user["role"].startswith("BCH_")):
        raise HTTPException(status_code=403, detail="You don't have permission to create activities")
    
    target_departments = activity.targetDepartments
    
    if current_user["role"] == "BCH_CUALO":
        target_departments = ["CUA_LO", "VAN_PHONG_CANG"]
    elif current_user["role"] == "BCH_BENTHUY":
        target_departments = ["BEN_THUY", "VAN_PHONG_CANG"]
    elif current_user["role"] == "BCH_VANPHONG" and not target_departments:
        target_departments = ["ALL"]
    
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
