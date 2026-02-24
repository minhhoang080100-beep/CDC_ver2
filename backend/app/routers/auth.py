from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPAuthorizationCredentials
from bson import ObjectId
from app.core.database import db
from app.core.security import verify_password, hash_password, create_access_token, get_current_user
from app.models.user import UserLogin, ChangePassword

router = APIRouter()

@router.post("/login")
async def login(user_login: UserLogin):
    user = await db.users.find_one({"username": user_login.username})
    if not user or not verify_password(user_login.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if user.get("status") != "ACTIVE":
        raise HTTPException(status_code=403, detail="Account is inactive")
    
    token = create_access_token({"user_id": str(user["_id"])})
    
    return {
        "token": token,
        "user": {
            "id": str(user["_id"]),
            "username": user["username"],
            "fullName": user["fullName"],
            "unionId": user["unionId"],
            "role": user["role"],
            "department": user["department"],
            "avatar": user.get("avatar"),
            "status": user["status"]
        }
    }

@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return {
        "id": current_user["_id"],
        "username": current_user["username"],
        "fullName": current_user["fullName"],
        "unionId": current_user["unionId"],
        "role": current_user["role"],
        "department": current_user["department"],
        "avatar": current_user.get("avatar"),
        "status": current_user["status"]
    }

@router.put("/change-password")
async def change_password(data: ChangePassword, current_user: dict = Depends(get_current_user)):
    # Verify current password
    user = await db.users.find_one({"_id": ObjectId(current_user["_id"])})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if not verify_password(data.currentPassword, user["password"]):
        raise HTTPException(status_code=400, detail="Mật khẩu hiện tại không đúng")
    
    # Validate new password
    if len(data.newPassword) < 6:
        raise HTTPException(status_code=400, detail="Mật khẩu mới phải có ít nhất 6 ký tự")
    
    # Hash and update
    hashed = hash_password(data.newPassword)
    await db.users.update_one(
        {"_id": ObjectId(current_user["_id"])},
        {"$set": {"password": hashed}}
    )
    
    return {"status": "success", "message": "Đổi mật khẩu thành công"}
