from fastapi import APIRouter, HTTPException, Depends, Request, status
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel
from bson import ObjectId
from datetime import datetime, timezone, timedelta
import time
from app.core.database import db
from app.core.security import (
    verify_password, hash_password, create_access_token, create_refresh_token,
    decode_token, get_current_user, validate_password, validate_object_id
)
from app.models.user import UserLogin, ChangePassword, UserCreate

router = APIRouter()

# ─── Rate Limiting Config ──────────────────────────────────
RATE_LIMIT_WINDOW = 60  # seconds
RATE_LIMIT_MAX = 5  # max attempts per window


async def _check_rate_limit(key: str):
    """MongoDB-backed rate limiting — persists across restarts, works multi-instance."""
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(seconds=RATE_LIMIT_WINDOW)

    # Count recent attempts within the window
    count = await db.rate_limits.count_documents({
        "key": key,
        "timestamp": {"$gte": window_start}
    })

    if count >= RATE_LIMIT_MAX:
        raise HTTPException(
            status_code=429,
            detail="Quá nhiều lần thử. Vui lòng đợi 1 phút rồi thử lại."
        )

    # Record this attempt (TTL index auto-cleans old records)
    await db.rate_limits.insert_one({
        "key": key,
        "timestamp": now,
        "expiresAt": now + timedelta(seconds=RATE_LIMIT_WINDOW)
    })


class RefreshTokenRequest(BaseModel):
    refreshToken: str


@router.post("/login")
async def login(user_login: UserLogin, request: Request):
    # Rate limiting theo IP (MongoDB-backed)
    client_ip = request.client.host if request.client else "unknown"
    await _check_rate_limit(f"login:{client_ip}")

    user = await db.users.find_one({"username": user_login.username})
    if not user or not verify_password(user_login.password, user["password"]):
        raise HTTPException(status_code=401, detail="Tên đăng nhập hoặc mật khẩu không đúng")

    if user.get("status") == "PENDING":
        raise HTTPException(status_code=403, detail="Tài khoản của bạn đang chờ Quản trị viên phê duyệt")
    if user.get("status") != "ACTIVE":
        raise HTTPException(status_code=403, detail="Tài khoản của bạn đã bị vô hiệu hóa")

    user_id = str(user["_id"])
    token = create_access_token({"user_id": user_id})
    refresh = create_refresh_token({"user_id": user_id})

    # ─── Store refresh token in DB for revocation ────────────
    await db.refresh_tokens.insert_one({
        "userId": user_id,
        "token": refresh,
        "createdAt": datetime.now(timezone.utc),
        "expiresAt": datetime.now(timezone.utc) + timedelta(days=30),
    })

    return {
        "token": token,
        "refreshToken": refresh,
        "user": {
            "id": user_id,
            "username": user["username"],
            "fullName": user["fullName"],
            "unionId": user.get("unionId"),
            "role": user["role"],
            "department": user["department"],
            "avatar": user.get("avatar"),
            "status": user["status"]
        }
    }


@router.post("/refresh")
async def refresh_token(data: RefreshTokenRequest):
    """Dùng refresh token để lấy access token mới."""
    payload = decode_token(data.refreshToken)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Token không hợp lệ")

    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token không hợp lệ")

    # ─── Check refresh token exists in DB (not revoked) ──────
    stored = await db.refresh_tokens.find_one({
        "userId": user_id,
        "token": data.refreshToken
    })
    if not stored:
        raise HTTPException(status_code=401, detail="Token đã bị thu hồi hoặc không hợp lệ")

    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user or user.get("status") != "ACTIVE":
        raise HTTPException(status_code=401, detail="Tài khoản không tồn tại hoặc đã bị vô hiệu hóa")

    new_token = create_access_token({"user_id": user_id})
    return {"token": new_token}


@router.post("/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    """Logout — revoke all refresh tokens for this user."""
    user_id = str(current_user["_id"])
    result = await db.refresh_tokens.delete_many({"userId": user_id})
    return {"status": "success", "message": "Đã đăng xuất", "revokedTokens": result.deleted_count}


@router.post("/register")
async def register_user(user_data: UserCreate, request: Request):
    # Rate limiting theo IP (MongoDB-backed)
    client_ip = request.client.host if request.client else "unknown"
    await _check_rate_limit(f"register:{client_ip}")

    # Check duplicate username
    existing_username = await db.users.find_one({"username": user_data.username})
    if existing_username:
        raise HTTPException(status_code=400, detail="Tên đăng nhập đã tồn tại")

    # Check duplicate unionId only if provided (giữ lại compatibility cho code cũ)
    if user_data.unionId:
        existing_union = await db.users.find_one({"unionId": user_data.unionId})
        if existing_union:
            raise HTTPException(status_code=400, detail="Mã đoàn viên này đã được đăng ký")

    # Check duplicate CCCD
    if getattr(user_data, 'cccdNumber', None):
        existing_cccd = await db.users.find_one({"cccdNumber": user_data.cccdNumber})
        if existing_cccd:
            raise HTTPException(status_code=400, detail="Số Căn cước công dân này đã tồn tại tài khoản")

    # Validate password (chữ hoa + chữ thường + số, >=8 ký tự)
    validate_password(user_data.password)

    new_user = {
        "username": user_data.username,
        "password": hash_password(user_data.password),
        "fullName": user_data.fullName,
        "unionId": user_data.unionId,
        "cccdNumber": user_data.cccdNumber,
        "role": "MEMBER",
        "department": user_data.department,
        "avatar": user_data.avatar,
        "status": "PENDING",
        "createdAt": datetime.now(timezone.utc)
    }

    result = await db.users.insert_one(new_user)

    return {
        "status": "success",
        "message": "Đăng ký thành công. Vui lòng chờ Quản trị viên (BCH) phê duyệt tài khoản.",
        "id": str(result.inserted_id)
    }


@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return {
        "id": current_user["_id"],
        "username": current_user["username"],
        "fullName": current_user["fullName"],
        "unionId": current_user.get("unionId"),
        "role": current_user["role"],
        "department": current_user["department"],
        "avatar": current_user.get("avatar"),
        "status": current_user["status"]
    }


@router.put("/change-password")
async def change_password(data: ChangePassword, current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"_id": validate_object_id(current_user["_id"])})
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")

    if not verify_password(data.currentPassword, user["password"]):
        raise HTTPException(status_code=400, detail="Mật khẩu hiện tại không đúng")

    # Validate mật khẩu mới
    validate_password(data.newPassword)

    hashed = hash_password(data.newPassword)
    await db.users.update_one(
        {"_id": validate_object_id(current_user["_id"])},
        {"$set": {"password": hashed}}
    )

    return {"status": "success", "message": "Đổi mật khẩu thành công"}

