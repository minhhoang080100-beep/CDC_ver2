from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks
from typing import List, Optional
from datetime import datetime, timezone
from bson import ObjectId
from app.core.database import db
import asyncio
import re
from app.core.security import get_current_user, hash_password, validate_object_id, validate_password
from app.models.user import UserCreate, UserUpdate, ResetPasswordRequest, BulkUserCreate, UpdatePushToken
from app.core.cloudinary_utils import delete_cloudinary_asset
from app.core.permissions import VALID_ROLES, VALID_DEPARTMENTS, MANAGER_ROLE_TO_DEPT

router = APIRouter()


USER_MANAGER_ROLES = ["SUPER_ADMIN"] + list(MANAGER_ROLE_TO_DEPT.keys())


def manager_department(current_user: dict) -> Optional[str]:
    return MANAGER_ROLE_TO_DEPT.get(current_user.get("role"))


def require_user_admin(current_user: dict, action: str = "manage users") -> None:
    if current_user.get("role") not in USER_MANAGER_ROLES:
        raise HTTPException(status_code=403, detail=f"Not authorized to {action}")


def build_user_visibility_filter(current_user: dict) -> dict:
    if current_user.get("role") == "SUPER_ADMIN":
        return {}

    dept = manager_department(current_user)
    if dept:
        return {"department": dept}

    raise HTTPException(status_code=403, detail="Not authorized to view users")


def add_query_condition(query: dict, condition: dict) -> dict:
    if not query:
        return condition
    return {"$and": [query, condition]}



def can_manage_department(current_user: dict, target_dept: str) -> bool:
    if current_user["role"] == "SUPER_ADMIN":
        return True
    if current_user["role"] in MANAGER_ROLE_TO_DEPT:
        return MANAGER_ROLE_TO_DEPT[current_user["role"]] == target_dept
    return False

def can_manage_user(current_user: dict, target_user: dict) -> bool:
    if current_user["role"] == "SUPER_ADMIN":
        return True
    
    # Manager can only manage MEMBER roles within their department
    # They shouldn't be able to manage other BCH or SUPER_ADMINs
    if current_user["role"] in MANAGER_ROLE_TO_DEPT:
        is_same_dept = MANAGER_ROLE_TO_DEPT[current_user["role"]] == target_user.get("department")
        is_target_member = target_user.get("role") == "MEMBER"
        return is_same_dept and is_target_member
        
    return False


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
    require_user_admin(current_user, "view users")

    query = build_user_visibility_filter(current_user)

    if current_user["role"] == "SUPER_ADMIN":
        if department:
            if department not in VALID_DEPARTMENTS:
                raise HTTPException(status_code=400, detail="Invalid department")
            query = add_query_condition(query, {"department": department})
        if role:
            if role not in VALID_ROLES:
                raise HTTPException(status_code=400, detail="Invalid role")
            query = add_query_condition(query, {"role": role})
    else:
        own_department = manager_department(current_user)
        if department and department != own_department:
            raise HTTPException(status_code=403, detail="Cannot view users outside your department")
        if role:
            if role not in VALID_ROLES:
                raise HTTPException(status_code=400, detail="Invalid role")
            query = add_query_condition(query, {"role": role})

    # Filter conditions
    search_value = search.strip() if search else ""
    if search_value:
        search_regex = re.compile(re.escape(search_value), re.IGNORECASE)
        query = add_query_condition(query, {"$or": [
            {"fullName": search_regex},
            {"username": search_regex},
            {"unionId": search_regex}
        ]})
    if status:
        query = add_query_condition(query, {"status": status})

    users_cursor = db.users.find(
        query, {"password": 0}  # Exclude password field
    ).sort("fullName", 1).skip(skip).limit(limit).to_list(limit)

    total, users = await asyncio.gather(
        db.users.count_documents(query),
        users_cursor,
    )
    
    items = [{
        "id": str(user["_id"]),
        "username": user["username"],
        "fullName": user["fullName"],
        "unionId": user.get("unionId", ""),
        "role": user["role"],
        "department": user["department"],
        "avatar": user.get("avatar"),
        "status": user.get("status", "ACTIVE"),
        "createdAt": user.get("createdAt")
    } for user in users]

    return {
        "items": items,
        "total": total,
        "hasMore": skip + limit < total,
    }


@router.post("")
async def create_user(user_data: UserCreate, current_user: dict = Depends(get_current_user)):
    require_user_admin(current_user, "create users")

    # Validate role and department
    if user_data.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {VALID_ROLES}")
    if user_data.department not in VALID_DEPARTMENTS:
        raise HTTPException(status_code=400, detail=f"Invalid department. Must be one of: {VALID_DEPARTMENTS}")

    if current_user["role"] != "SUPER_ADMIN":
        own_department = manager_department(current_user)
        if user_data.role != "MEMBER" or user_data.department != own_department:
            raise HTTPException(status_code=403, detail="Managers can only create member accounts in their department")
    
    # Check duplicate username
    existing = await db.users.find_one({"username": user_data.username})
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    # Validate password
    validate_password(user_data.password)
    
    new_user = {
        "username": user_data.username,
        "password": hash_password(user_data.password),
        "fullName": user_data.fullName,
        "unionId": user_data.unionId,
        "cccdNumber": user_data.cccdNumber,
        "role": user_data.role,
        "department": user_data.department,
        "avatar": user_data.avatar,
        "status": "ACTIVE",
        "createdAt": datetime.now(timezone.utc)
    }
    
    result = await db.users.insert_one(new_user)
    
    return {
        "id": str(result.inserted_id),
        "username": new_user["username"],
        "fullName": new_user["fullName"],
        "role": new_user["role"],
        "department": new_user["department"],
        "status": "ACTIVE"
    }


@router.put("/{user_id}")
async def update_user(
    user_id: str, 
    user_data: UserUpdate, 
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] not in ["SUPER_ADMIN"] + list(MANAGER_ROLE_TO_DEPT.keys()):
        raise HTTPException(status_code=403, detail="Not authorized to update users")
    
    existing = await db.users.find_one({"_id": validate_object_id(user_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Check if Manager can manage this specific user
    if not can_manage_user(current_user, existing):
        raise HTTPException(status_code=403, detail="Cannot modify this user")
    
    update_fields = {}
    if user_data.fullName is not None:
        update_fields["fullName"] = user_data.fullName
    if user_data.role is not None:
        if user_data.role not in VALID_ROLES:
            raise HTTPException(status_code=400, detail=f"Invalid role")
        # Managers cannot change roles
        if current_user["role"] in MANAGER_ROLE_TO_DEPT and user_data.role != existing.get("role"):
             raise HTTPException(status_code=403, detail="Managers cannot change user roles")
        update_fields["role"] = user_data.role
        
    if user_data.department is not None:
        if user_data.department not in VALID_DEPARTMENTS:
            raise HTTPException(status_code=400, detail=f"Invalid department")
        # Managers cannot move users between departments
        if current_user["role"] in MANAGER_ROLE_TO_DEPT and user_data.department != existing.get("department"):
             raise HTTPException(status_code=403, detail="Managers cannot change user departments")
        update_fields["department"] = user_data.department
        
    if user_data.status is not None:
        update_fields["status"] = user_data.status
        
    if user_data.cccdNumber is not None:
        update_fields["cccdNumber"] = user_data.cccdNumber
        
    if user_data.avatar is not None:
        # Check if old avatar exists to clean up
        old_avatar = existing.get("avatar")
        if old_avatar and old_avatar != user_data.avatar:
             background_tasks.add_task(delete_cloudinary_asset, old_avatar)
        update_fields["avatar"] = user_data.avatar
    
    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    update_fields["updatedAt"] = datetime.now(timezone.utc)
    
    await db.users.update_one(
        {"_id": validate_object_id(user_id)},
        {"$set": update_fields}
    )
    
    return {"status": "success", "message": "User updated"}


@router.put("/{user_id}/approve")
async def approve_user(user_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["SUPER_ADMIN"] + list(MANAGER_ROLE_TO_DEPT.keys()):
        raise HTTPException(status_code=403, detail="Not authorized to approve users")
    
    existing = await db.users.find_one({"_id": validate_object_id(user_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")
        
    if not can_manage_user(current_user, existing):
        raise HTTPException(status_code=403, detail="Cannot approve this user")
        
    if existing.get("status") != "PENDING":
        raise HTTPException(status_code=400, detail="Tài khoản này không ở trạng thái Chờ phê duyệt")
    
    await db.users.update_one(
        {"_id": validate_object_id(user_id)},
        {"$set": {"status": "ACTIVE", "updatedAt": datetime.now(timezone.utc)}}
    )
    
    return {"status": "success", "message": f"Đã phê duyệt tài khoản {existing['fullName']}"}


@router.delete("/{user_id}")
async def delete_user(
    user_id: str, 
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] not in ["SUPER_ADMIN"] + list(MANAGER_ROLE_TO_DEPT.keys()):
        raise HTTPException(status_code=403, detail="Not authorized to delete users")
    
    # Prevent self-deletion
    if user_id == current_user["_id"]:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    existing = await db.users.find_one({"_id": validate_object_id(user_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")
        
    if not can_manage_user(current_user, existing):
        raise HTTPException(status_code=403, detail="Cannot delete this user")
    
    # Delete avatar from Cloudinary if it exists
    avatar = existing.get("avatar")
    if avatar:
        background_tasks.add_task(delete_cloudinary_asset, avatar)
        
    await db.users.delete_one({"_id": validate_object_id(user_id)})
    
    return {"status": "success", "message": "User deleted"}


@router.post("/{user_id}/reset-password")
async def reset_password(user_id: str, request: ResetPasswordRequest, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["SUPER_ADMIN"] + list(MANAGER_ROLE_TO_DEPT.keys()):
        raise HTTPException(status_code=403, detail="Not authorized to reset passwords")
    
    existing = await db.users.find_one({"_id": validate_object_id(user_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")
        
    if not can_manage_user(current_user, existing):
        raise HTTPException(status_code=403, detail="Cannot reset password for this user")
        
    validate_password(request.newPassword)
        
    hashed_pw = hash_password(request.newPassword)
    await db.users.update_one(
        {"_id": validate_object_id(user_id)},
        {"$set": {"password": hashed_pw, "updatedAt": datetime.now(timezone.utc)}}
    )
    
    return {"status": "success", "message": "Password reset successfully"}


@router.post("/bulk")
async def bulk_import_users(data: BulkUserCreate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["SUPER_ADMIN"] + list(MANAGER_ROLE_TO_DEPT.keys()):
        raise HTTPException(status_code=403, detail="Not authorized to import users")
        
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
    manager_dept = MANAGER_ROLE_TO_DEPT.get(current_user["role"])
    
    for user_data in data.users:
        if user_data.role not in VALID_ROLES:
            continue # Skip invalid roles instead of failing the whole batch or throw error? Let's throw an error for now.
             
        # Enforce Manager rules
        final_role = user_data.role
        final_department = user_data.department
        
        if current_user["role"] in MANAGER_ROLE_TO_DEPT:
            final_role = "MEMBER" # Managers can only create members
            final_department = manager_dept # Managers can only add to their dept
        else:
            final_role = user_data.role if user_data.role in VALID_ROLES else "MEMBER"
            final_department = user_data.department if user_data.department in VALID_DEPARTMENTS else "VAN_PHONG_CANG"

        new_users.append({
            "username": user_data.username,
            "password": hash_password(user_data.password),
            "fullName": user_data.fullName,
            "unionId": user_data.unionId,
            "role": final_role,
            "department": final_department,
            "avatar": user_data.avatar,
            "status": "ACTIVE",
            "createdAt": datetime.now(timezone.utc)
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
        {"_id": validate_object_id(user_id)},
        {"$set": {"pushToken": data.token, "updatedAt": datetime.now(timezone.utc)}}
    )
    return {"status": "success", "message": "Push token updated"}
