from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional
from datetime import datetime
from bson import ObjectId
from app.core.database import db
from app.core.security import get_current_user, hash_password
from pydantic import BaseModel

router = APIRouter()


class UserCreate(BaseModel):
    username: str
    password: str
    fullName: str
    unionId: str
    role: str
    department: str
    avatar: Optional[str] = None


class UserUpdate(BaseModel):
    fullName: Optional[str] = None
    role: Optional[str] = None
    department: Optional[str] = None
    status: Optional[str] = None
    avatar: Optional[str] = None


VALID_ROLES = ["SUPER_ADMIN", "BCH_VANPHONG", "BCH_CUALO", "BCH_BENTHUY", "MEMBER"]
VALID_DEPARTMENTS = ["VAN_PHONG_CANG", "CUA_LO", "BEN_THUY"]


@router.get("")
async def get_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] != "SUPER_ADMIN":
        raise HTTPException(status_code=403, detail="Only SUPER_ADMIN can manage users")
    
    users = await db.users.find(
        {}, {"password": 0}  # Exclude password field
    ).sort("fullName", 1).skip(skip).limit(limit).to_list(limit)
    
    return [{
        "id": str(user["_id"]),
        "username": user["username"],
        "fullName": user["fullName"],
        "unionId": user["unionId"],
        "role": user["role"],
        "department": user["department"],
        "avatar": user.get("avatar"),
        "status": user.get("status", "active"),
        "createdAt": user.get("createdAt")
    } for user in users]


@router.post("")
async def create_user(user_data: UserCreate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "SUPER_ADMIN":
        raise HTTPException(status_code=403, detail="Only SUPER_ADMIN can create users")
    
    # Validate role and department
    if user_data.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {VALID_ROLES}")
    if user_data.department not in VALID_DEPARTMENTS:
        raise HTTPException(status_code=400, detail=f"Invalid department. Must be one of: {VALID_DEPARTMENTS}")
    
    # Check duplicate username
    existing = await db.users.find_one({"username": user_data.username})
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    # Validate password
    if len(user_data.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    new_user = {
        "username": user_data.username,
        "password": hash_password(user_data.password),
        "fullName": user_data.fullName,
        "unionId": user_data.unionId,
        "role": user_data.role,
        "department": user_data.department,
        "avatar": user_data.avatar,
        "status": "active",
        "createdAt": datetime.utcnow()
    }
    
    result = await db.users.insert_one(new_user)
    
    return {
        "id": str(result.inserted_id),
        "username": new_user["username"],
        "fullName": new_user["fullName"],
        "role": new_user["role"],
        "department": new_user["department"],
        "status": "active"
    }


@router.put("/{user_id}")
async def update_user(user_id: str, user_data: UserUpdate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "SUPER_ADMIN":
        raise HTTPException(status_code=403, detail="Only SUPER_ADMIN can update users")
    
    existing = await db.users.find_one({"_id": ObjectId(user_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_fields = {}
    if user_data.fullName is not None:
        update_fields["fullName"] = user_data.fullName
    if user_data.role is not None:
        if user_data.role not in VALID_ROLES:
            raise HTTPException(status_code=400, detail=f"Invalid role")
        update_fields["role"] = user_data.role
    if user_data.department is not None:
        if user_data.department not in VALID_DEPARTMENTS:
            raise HTTPException(status_code=400, detail=f"Invalid department")
        update_fields["department"] = user_data.department
    if user_data.status is not None:
        update_fields["status"] = user_data.status
    if user_data.avatar is not None:
        update_fields["avatar"] = user_data.avatar
    
    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    update_fields["updatedAt"] = datetime.utcnow()
    
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": update_fields}
    )
    
    return {"status": "success", "message": "User updated"}


@router.delete("/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "SUPER_ADMIN":
        raise HTTPException(status_code=403, detail="Only SUPER_ADMIN can delete users")
    
    # Prevent self-deletion
    if user_id == current_user["_id"]:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    existing = await db.users.find_one({"_id": ObjectId(user_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")
    
    await db.users.delete_one({"_id": ObjectId(user_id)})
    
    return {"status": "success", "message": "User deleted"}
