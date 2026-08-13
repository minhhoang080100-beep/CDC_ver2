from fastapi import APIRouter, HTTPException, Depends, Request, status, BackgroundTasks
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from bson import ObjectId
from datetime import datetime, timezone, timedelta
from typing import Optional
import time
from app.core.database import db
from app.core.security import (
    verify_password, hash_password, create_access_token, create_refresh_token,
    decode_token, get_current_user, validate_password, validate_object_id,
    create_reset_token
)
from app.models.user import UserLogin, ChangePassword, UserCreate
from app.routers.websocket import manager
from app.core.cloudinary_utils import delete_cloudinary_asset

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


class SelfProfileUpdate(BaseModel):
    fullName: Optional[str] = Field(None, min_length=2, max_length=100)
    avatar: Optional[str] = None
    cccdNumber: Optional[str] = None
    phoneNumber: Optional[str] = Field(None, max_length=30)
    email: Optional[str] = Field(None, max_length=120)
    hometown: Optional[str] = Field(None, max_length=255)
    permanentAddress: Optional[str] = Field(None, max_length=255)
    familyBackground: Optional[str] = Field(None, max_length=500)


def _normalize_blank(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    value = str(value).strip()
    return value or None


def _normalize_cccd(value: Optional[str]) -> Optional[str]:
    value = _normalize_blank(value)
    if not value:
        return None

    cccd = "".join(ch for ch in value if ch.isdigit())
    if len(cccd) == 8:
        cccd = cccd.zfill(9)
    elif len(cccd) == 11:
        cccd = cccd.zfill(12)

    if len(cccd) not in (9, 12):
        raise HTTPException(status_code=400, detail="Số CCCD/CMND phải có 9 hoặc 12 chữ số")

    return cccd


def _cccd_variants(value: Optional[str]) -> set[str]:
    cccd = _normalize_cccd(value)
    if not cccd:
        return set()

    variants = {cccd}
    stripped = cccd.lstrip("0")
    if stripped:
        variants.add(stripped)
        if len(stripped) <= 12:
            variants.add(stripped.zfill(12))
        if len(stripped) <= 9:
            variants.add(stripped.zfill(9))
    if len(cccd) <= 12:
        variants.add(cccd.zfill(12))
    if len(cccd) <= 9:
        variants.add(cccd.zfill(9))
    return variants


async def _find_union_member_by_cccd(cccd_number: Optional[str]):
    try:
        variants = _cccd_variants(cccd_number)
    except HTTPException:
        return None
    if not variants:
        return None
    return await db.union_members.find_one({"cccdNumber": {"$in": list(variants)}})


def _format_date(value):
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.strftime("%d/%m/%Y")
    return str(value)


def _serialize_profile(member: dict) -> dict:
    return {
        "fullName": member.get("fullName"),
        "workUnit": member.get("workUnit"),
        "department": member.get("department"),
        "position": member.get("position"),
        "birthDate": _format_date(member.get("birthDate")),
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
        "partyJoinDate": _format_date(member.get("partyJoinDate")),
        "unionJoinDate": _format_date(member.get("unionJoinDate")),
        "cccdNumber": member.get("cccdNumber"),
        "idNumber": member.get("idNumber"),
        "familyBackground": member.get("familyBackground"),
        "employeeId": member.get("employeeId"),
    }


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
    if user.get("isDeleted") == 1:
        raise HTTPException(status_code=403, detail="Tài khoản của bạn đã bị vô hiệu hóa (Đã nghỉ việc)")
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
            "cccdNumber": user.get("cccdNumber"),
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
    if not user or user.get("status") != "ACTIVE" or user.get("isDeleted") == 1:
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
            
        member = await _find_union_member_by_cccd(user_data.cccdNumber)
        if member and member.get("isDeleted") == 1:
            raise HTTPException(status_code=403, detail="Không thể đăng ký tài khoản cho nhân viên đã nghỉ việc")

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
        "cccdNumber": current_user.get("cccdNumber"),
        "status": current_user["status"]
    }


@router.put("/me")
async def update_me(
    data: SelfProfileUpdate,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
):
    user_id = validate_object_id(current_user["_id"])
    account_updates = {}
    profile_updates = {}

    if data.fullName is not None:
        full_name = _normalize_blank(data.fullName)
        if not full_name:
            raise HTTPException(status_code=400, detail="Họ tên không được để trống")
        account_updates["fullName"] = full_name

    if data.avatar is not None:
        new_avatar = _normalize_blank(data.avatar)
        old_avatar = current_user.get("avatar")
        if old_avatar and old_avatar != new_avatar:
            background_tasks.add_task(delete_cloudinary_asset, old_avatar)
        account_updates["avatar"] = new_avatar

    new_cccd = current_user.get("cccdNumber")
    if data.cccdNumber is not None:
        new_cccd = _normalize_cccd(data.cccdNumber)
        if new_cccd:
            duplicate = await db.users.find_one({
                "_id": {"$ne": user_id},
                "cccdNumber": {"$in": list(_cccd_variants(new_cccd))},
            })
            if duplicate:
                raise HTTPException(status_code=400, detail="Số CCCD/CMND đã được sử dụng bởi tài khoản khác")
            account_updates["cccdNumber"] = new_cccd
        else:
            account_updates["cccdNumber"] = None

    for field in ["phoneNumber", "email", "hometown", "permanentAddress", "familyBackground"]:
        value = getattr(data, field)
        if value is not None:
            profile_updates[field] = _normalize_blank(value)

    if profile_updates.get("email"):
        email = profile_updates["email"]
        if "@" not in email or "." not in email.split("@")[-1]:
            raise HTTPException(status_code=400, detail="Email không hợp lệ")

    if not account_updates and not profile_updates:
        raise HTTPException(status_code=400, detail="Không có thông tin cần cập nhật")

    profile = await _find_union_member_by_cccd(new_cccd)

    if account_updates:
        update_doc = {}
        set_fields = {k: v for k, v in account_updates.items() if v is not None}
        unset_fields = {k: "" for k, v in account_updates.items() if v is None}
        if set_fields:
            update_doc["$set"] = {**set_fields, "updatedAt": datetime.now(timezone.utc)}
        if unset_fields:
            update_doc["$unset"] = unset_fields
            update_doc.setdefault("$set", {})["updatedAt"] = datetime.now(timezone.utc)
        await db.users.update_one({"_id": user_id}, update_doc)

    if profile_updates and profile:
        await db.union_members.update_one(
            {"_id": profile["_id"]},
            {
                "$set": {
                    **profile_updates,
                    "userId": str(user_id),
                    "updatedAt": datetime.now(timezone.utc),
                }
            }
        )
        profile = await db.union_members.find_one({"_id": profile["_id"]})

    updated_user = await db.users.find_one({"_id": user_id})

    return {
        "status": "success",
        "message": "Cập nhật thông tin cá nhân thành công",
        "profileFound": profile is not None,
        "user": {
            "id": str(updated_user["_id"]),
            "username": updated_user["username"],
            "fullName": updated_user["fullName"],
            "unionId": updated_user.get("unionId"),
            "role": updated_user["role"],
            "department": updated_user["department"],
            "avatar": updated_user.get("avatar"),
            "cccdNumber": updated_user.get("cccdNumber"),
            "status": updated_user["status"],
        },
        "profile": _serialize_profile(profile) if profile else None,
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


class VerifyCCCDRequest(BaseModel):
    cccdNumber: str = Field(..., min_length=9, max_length=12)

class ResetPasswordWithTokenRequest(BaseModel):
    resetToken: str = Field(..., min_length=1)
    newPassword: str = Field(..., min_length=1)

@router.post("/verify-cccd")
async def verify_cccd(data: VerifyCCCDRequest, request: Request):
    client_ip = request.client.host if request.client else "unknown"
    await _check_rate_limit(f"verify-cccd:{client_ip}")

    variants = _cccd_variants(data.cccdNumber)
    if not variants:
        raise HTTPException(status_code=400, detail="CCCD không hợp lệ")

    # Tìm user có cccdNumber nằm trong danh sách variants
    user = await db.users.find_one({"cccdNumber": {"$in": list(variants)}})
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản nào khớp với số CCCD này")

    if user.get("status") != "ACTIVE":
        raise HTTPException(status_code=403, detail="Tài khoản này đang bị khóa hoặc chưa được duyệt")

    token = create_reset_token({"user_id": str(user["_id"])})
    return {
        "status": "success",
        "message": "Xác thực CCCD thành công",
        "resetToken": token
    }

@router.post("/reset-password-with-token")
async def reset_password_with_token(data: ResetPasswordWithTokenRequest, request: Request):
    client_ip = request.client.host if request.client else "unknown"
    await _check_rate_limit(f"reset-pw-token:{client_ip}")

    payload = decode_token(data.resetToken)
    if payload.get("type") != "reset":
        raise HTTPException(status_code=401, detail="Phiên làm việc không hợp lệ")

    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Phiên làm việc không hợp lệ")

    user = await db.users.find_one({"_id": validate_object_id(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản")

    validate_password(data.newPassword)
    hashed_pw = hash_password(data.newPassword)

    await db.users.update_one(
        {"_id": validate_object_id(user_id)},
        {"$set": {"password": hashed_pw, "updatedAt": datetime.now(timezone.utc)}}
    )

    # Thu hồi tất cả phiên đăng nhập cũ
    await db.refresh_tokens.delete_many({"userId": user_id})

    return {"status": "success", "message": "Đặt lại mật khẩu thành công"}
