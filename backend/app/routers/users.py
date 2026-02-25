from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional
from datetime import datetime
from bson import ObjectId
from app.core.database import db
import re
from app.core.security import get_current_user, hash_password
from pydantic import BaseModel
from app.models.user import UpdatePushToken

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


class ResetPasswordRequest(BaseModel):
    newPassword: str


class BulkUserCreate(BaseModel):
    users: List[UserCreate]


VALID_ROLES = ["SUPER_ADMIN", "BCH_VANPHONG", "BCH_CUALO", "BCH_BENTHUY", "MEMBER"]
VALID_DEPARTMENTS = ["VAN_PHONG_CANG", "CUA_LO", "BEN_THUY"]


@router.get("")
async def get_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    search: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] != "SUPER_ADMIN":
        raise HTTPException(status_code=403, detail="Only SUPER_ADMIN can manage users")
    
    query = {}
    
    # Filter conditions
    if search:
        search_regex = re.compile(search, re.IGNORECASE)
        query["$or"] = [
            {"fullName": search_regex},
            {"username": search_regex},
            {"unionId": search_regex}
        ]
    if department:
        query["department"] = department
    if role:
        query["role"] = role
    if status:
        query["status"] = status

    # Get total count for pagination info
    total = await db.users.count_documents(query)
    
    users = await db.users.find(
        query, {"password": 0}  # Exclude password field
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

    return {
        "total": total,
        "items": result_users
    }


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


@router.put("/{user_id}/approve")
async def approve_user(user_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "SUPER_ADMIN":
        raise HTTPException(status_code=403, detail="Only SUPER_ADMIN can approve users")
    
    existing = await db.users.find_one({"_id": ObjectId(user_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")
        
    if existing.get("status") != "PENDING":
        raise HTTPException(status_code=400, detail="Tài khoản này không ở trạng thái Chờ phê duyệt")
    
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"status": "ACTIVE", "updatedAt": datetime.utcnow()}}
    )
    
    return {"status": "success", "message": f"Đã phê duyệt tài khoản {existing['fullName']}"}


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


@router.post("/{user_id}/reset-password")
async def reset_password(user_id: str, request: ResetPasswordRequest, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "SUPER_ADMIN":
        raise HTTPException(status_code=403, detail="Only SUPER_ADMIN can reset passwords")
    
    existing = await db.users.find_one({"_id": ObjectId(user_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")
        
    if len(request.newPassword) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
        
    hashed_pw = hash_password(request.newPassword)
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"password": hashed_pw, "updatedAt": datetime.utcnow()}}
    )
    
    return {"status": "success", "message": "Password reset successfully"}


@router.post("/bulk")
async def bulk_import_users(data: BulkUserCreate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "SUPER_ADMIN":
        raise HTTPException(status_code=403, detail="Only SUPER_ADMIN can import users")
        
    if not data.users:
        raise HTTPException(status_code=400, detail="No users provided")
        
    # Check for duplicate usernames in the batch and in DB
    usernames_in_batch = [u.username for u in data.users]
    if len(usernames_in_batch) != len(set(usernames_in_batch)):
        raise HTTPException(status_code=400, detail="Batch contains duplicate usernames")
        
    existing_users = await db.users.find({"username": {"$in": usernames_in_batch}}).to_list(1000)
    if existing_users:
        duplicates = [u["username"] for u in existing_users]
        raise HTTPException(status_code=400, detail=f"Usernames already exist in database: {', '.join(duplicates)}")
        
    new_users = []
    for user_data in data.users:
        if user_data.role not in VALID_ROLES:
            continue # Skip invalid roles instead of failing the whole batch or throw error? Let's throw an error for now.
             
        new_users.append({
            "username": user_data.username,
            "password": hash_password(user_data.password),
            "fullName": user_data.fullName,
            "unionId": user_data.unionId,
            "role": user_data.role if user_data.role in VALID_ROLES else "MEMBER",
            "department": user_data.department if user_data.department in VALID_DEPARTMENTS else "VAN_PHONG_CANG",
            "avatar": user_data.avatar,
            "status": "active",
            "createdAt": datetime.utcnow()
        })
        
    if new_users:
        await db.users.insert_many(new_users)
        
    return {
        "status": "success", 
        "message": f"Successfully imported {len(new_users)} users",
        "count": len(new_users)
    }

@router.put("/push-token")
async def update_push_token(data: UpdatePushToken, current_user: dict = Depends(get_current_user)):
    user_id = current_user["_id"]
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"pushToken": data.token, "updatedAt": datetime.utcnow()}}
    )
    return {"status": "success", "message": "Push token updated"}
