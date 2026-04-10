from fastapi import APIRouter, HTTPException, Depends, Request, status, BackgroundTasks
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
from app.routers.websocket import manager

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
async def register_user(user_data: UserCreate, request: Request, background_tasks: BackgroundTasks):
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

    # WebSocket broadcast to Admins
    background_tasks.add_task(
        manager.broadcast,
        {"type": "new_registration", "title": f"Tài khoản đăng ký mới: {user_data.fullName}"}
    )

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


@router.get("/my-profile")
async def get_my_profile(current_user: dict = Depends(get_current_user)):
    """Lấy thông tin cá nhân từ bảng union_members qua cccdNumber.
    Xử lý trường hợp CCCD bị mất số 0 đầu do import từ Excel.
    """
    user_cccd = current_user.get("cccdNumber")
    if not user_cccd:
        return {"found": False, "message": "Tài khoản chưa có số CCCD"}

    # Normalize: bỏ khoảng trắng, convert float string
    user_cccd = str(user_cccd).strip()
    if user_cccd.lower() == "nan":
        return {"found": False, "message": "Tài khoản chưa có số CCCD"}

    # Tạo danh sách các biến thể CCCD để tìm kiếm
    # VD: user có "040200025605" → trong union_members có thể lưu "40200025605" (thiếu số 0 đầu)
    # Hoặc ngược lại: user có "40200025605" → cần thêm "0" để match
    cccd_variants = set()
    cccd_variants.add(user_cccd)

    # Bỏ leading zeros
    stripped = user_cccd.lstrip("0")
    if stripped:
        cccd_variants.add(stripped)

    # Thêm leading zeros cho CCCD (12 chữ số) và CMND (9 chữ số)
    if len(user_cccd) <= 12:
        cccd_variants.add(user_cccd.zfill(12))
    if len(user_cccd) <= 9:
        cccd_variants.add(user_cccd.zfill(9))

    # Cũng thêm variants cho stripped
    if stripped and len(stripped) <= 12:
        cccd_variants.add(stripped.zfill(12))
    if stripped and len(stripped) <= 9:
        cccd_variants.add(stripped.zfill(9))

    # Tìm trong union_members
    member = await db.union_members.find_one({
        "cccdNumber": {"$in": list(cccd_variants)}
    })

    if not member:
        return {"found": False, "message": "Không tìm thấy hồ sơ đoàn viên"}

    # Format dates
    def fmt_date(val):
        if val is None:
            return None
        if isinstance(val, datetime):
            return val.strftime("%d/%m/%Y")
        return str(val)

    return {
        "found": True,
        "profile": {
            "fullName": member.get("fullName"),
            "workUnit": member.get("workUnit"),
            "department": member.get("department"),
            "position": member.get("position"),
            "birthDate": fmt_date(member.get("birthDate")),
            "phoneNumber": member.get("phoneNumber"),
            "hometown": member.get("hometown"),
            "permanentAddress": member.get("permanentAddress"),
            "email": member.get("email"),
            "gender": member.get("gender"),
            "educationLevel": member.get("educationLevel"),
            "qualification": member.get("qualification"),
            "professionalQualification": member.get("professionalQualification"),
            "major": member.get("major"),
            "isPartyMember": member.get("isPartyMember"),
            "partyJoinDate": fmt_date(member.get("partyJoinDate")),
            "unionJoinDate": fmt_date(member.get("unionJoinDate")),
            "cccdNumber": member.get("cccdNumber"),
            "idNumber": member.get("idNumber"),
            "familyBackground": member.get("familyBackground"),
            "employeeId": member.get("employeeId"),
        }
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

