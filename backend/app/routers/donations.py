from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime, timezone
from bson import ObjectId
from typing import Optional, List
import logging

from app.core.database import db
from app.core.security import get_current_user, validate_object_id
from app.core.permissions import is_admin, require_admin, build_content_filter
from app.core.cloudinary_utils import delete_cloudinary_asset
from app.core.push import send_push_notification_async
from app.models.donation import DonationCreate, DonationRequestCreate, DonationRejectRequest, DonationCompleteRequest
from app.routers.websocket import manager

router = APIRouter()
logger = logging.getLogger(__name__)

async def _notify_user(user_id: str, title: str, message: str):
    await db.notifications.insert_one({
        "userId": user_id,
        "title": title,
        "message": message,
        "type": "donation",
        "read": False,
        "createdAt": datetime.now(timezone.utc)
    })
    try:
        user = await db.users.find_one({"_id": validate_object_id(user_id)})
        if user and user.get("pushToken"):
            await send_push_notification_async(user["pushToken"], title, message, {"type": "donation"})
    except Exception as e:
        logger.error(f"Error sending push to {user_id}: {e}")

def format_donation(doc):
    doc["id"] = str(doc["_id"])
    doc["_id"] = str(doc["_id"])
    return doc

@router.post("/")
async def create_donation(
    donation: DonationCreate,
    current_user: dict = Depends(get_current_user)
):
    donation_dict = donation.model_dump()
    donation_dict.update({
        "donorId": str(current_user["_id"]),
        "donorName": current_user.get("fullName", current_user.get("username")),
        "donorDepartment": current_user.get("department"),
        "donorAvatar": current_user.get("avatar"),
        "status": "PENDING",
        "requesters": [],
        "createdAt": datetime.now(timezone.utc),
        "updatedAt": datetime.now(timezone.utc)
    })
    
    result = await db.donations.insert_one(donation_dict)
    created_donation = await db.donations.find_one({"_id": result.inserted_id})
    
    # Cập nhật thông báo ngầm cho admin khi có người tặng (không truyền title để tránh hiện Popup cho toàn bộ user)
    await manager.broadcast(
        {"type": "new_donation_pending", "donorName": donation_dict["donorName"]},
    )
    
    # Gửi thông báo cho tất cả Quản trị viên (Admin/BCH)
    admins = await db.users.find({"role": {"$in": ["SUPER_ADMIN", "BCH_VANPHONG", "BCH_CUALO", "BCH_BENTHUY"]}}).to_list(None)
    for admin in admins:
        await _notify_user(
            user_id=str(admin["_id"]),
            title="Có món đồ mới chờ duyệt",
            message=f"{donation_dict['donorName']} vừa đăng tặng một món đồ mới trên Kho 0 Đồng."
        )
    
    return format_donation(created_donation)

@router.get("/")
async def list_donations(
    skip: int = Query(0, ge=0),
    limit: int = Query(1000, ge=1),
    category: Optional[str] = None,
    department: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    condition: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}}
        ]
        
    if category:
        query["category"] = category
    if department:
        query["donorDepartment"] = department
    if condition:
        query["condition"] = condition
        
    if is_admin(current_user):
        if status:
            query["status"] = status
        else:
            # By default admins see everything except ARCHIVED unless specified
            query["status"] = {"$ne": "ARCHIVED"}
    else:
        # Members can see APPROVED, MATCHED and COMPLETED items in the public list
        if status and status in ["APPROVED", "MATCHED", "COMPLETED"]:
            query["status"] = status
        else:
            query["status"] = "APPROVED"

    cursor = db.donations.find(query).sort("createdAt", -1).skip(skip).limit(limit)
    
    user_id_str = str(current_user["_id"])
    items = []
    async for doc in cursor:
        fmt_doc = format_donation(doc)
        fmt_doc["hasRequested"] = any(r["userId"] == user_id_str for r in doc.get("requesters", []))
        if not is_admin(current_user) and user_id_str != doc.get("donorId"):
            fmt_doc.pop("requesters", None)
        items.append(fmt_doc)
        
    total = await db.donations.count_documents(query)
    
    return {"total": total, "items": items}

@router.get("/my-donations")
async def my_donations(
    current_user: dict = Depends(get_current_user)
):
    query = {"donorId": str(current_user["_id"])}
    cursor = db.donations.find(query).sort("createdAt", -1)
    items = [format_donation(doc) async for doc in cursor]
    return items

@router.get("/my-received")
async def my_received(
    current_user: dict = Depends(get_current_user)
):
    query = {
        "receiverId": str(current_user["_id"]),
        "status": {"$in": ["MATCHED", "COMPLETED"]}
    }
    cursor = db.donations.find(query).sort("createdAt", -1)
    items = [format_donation(doc) async for doc in cursor]
    return items

@router.get("/stats")
async def get_stats(
    current_user: dict = Depends(get_current_user)
):
    pipeline = [
        {"$group": {
            "_id": "$status",
            "count": {"$sum": 1}
        }}
    ]
    results = await db.donations.aggregate(pipeline).to_list(None)
    
    stats = {
        "totalDonations": 0,
        "totalCompleted": 0,
        "totalAvailable": 0,
        "totalPending": 0
    }
    
    for r in results:
        status = r["_id"]
        count = r["count"]
        stats["totalDonations"] += count
        if status == "COMPLETED":
            stats["totalCompleted"] = count
        elif status == "APPROVED":
            stats["totalAvailable"] = count
        elif status == "PENDING":
            stats["totalPending"] = count
            
    return stats

@router.get("/{id}")
async def get_donation(
    id: str,
    current_user: dict = Depends(get_current_user)
):
    obj_id = validate_object_id(id)
    donation = await db.donations.find_one({"_id": obj_id})
    if not donation:
        raise HTTPException(status_code=404, detail="Không tìm thấy mục này")
    
    result = format_donation(donation)
    
    user_id_str = str(current_user["_id"])
    has_requested = any(r["userId"] == user_id_str for r in donation.get("requesters", []))
    result["hasRequested"] = has_requested
    
    # Chỉ admin hoặc chủ bài mới được xem danh sách người đăng ký nhận
    if not is_admin(current_user) and user_id_str != donation.get("donorId"):
        result.pop("requesters", None)
    
    return result

@router.put("/{id}")
async def update_donation(
    id: str,
    update_data: DonationCreate,
    current_user: dict = Depends(get_current_user)
):
    obj_id = validate_object_id(id)
    donation = await db.donations.find_one({"_id": obj_id})
    if not donation:
        raise HTTPException(status_code=404, detail="Không tìm thấy mục này")
        
    if str(current_user["_id"]) != donation["donorId"]:
        raise HTTPException(status_code=403, detail="Bạn không có quyền sửa mục này")
        
    if donation["status"] != "PENDING":
        raise HTTPException(status_code=400, detail="Chỉ có thể sửa khi đang ở trạng thái PENDING")
        
    update_dict = update_data.model_dump()
    update_dict["updatedAt"] = datetime.now(timezone.utc)
    
    # Xóa ảnh cũ trên Cloudinary nếu bị gỡ
    old_images = set(donation.get("images", []))
    new_images = set(update_dict.get("images", []))
    removed_images = old_images - new_images
    for img in removed_images:
        try:
            await delete_cloudinary_asset(img)
        except Exception as e:
            logger.error(f"Error deleting removed image {img}: {e}")
    
    await db.donations.update_one({"_id": obj_id}, {"$set": update_dict})
    updated = await db.donations.find_one({"_id": obj_id})
    return format_donation(updated)

@router.delete("/{id}")
async def delete_donation(
    id: str,
    current_user: dict = Depends(get_current_user)
):
    obj_id = validate_object_id(id)
    donation = await db.donations.find_one({"_id": obj_id})
    if not donation:
        raise HTTPException(status_code=404, detail="Không tìm thấy mục này")
        
    is_owner = str(current_user["_id"]) == donation["donorId"]
    if not is_owner and not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Bạn không có quyền xóa mục này")
        
    if is_owner and not is_admin(current_user) and donation["status"] not in ["PENDING", "REJECTED"]:
        raise HTTPException(status_code=400, detail="Bạn chỉ có thể xóa bài khi đang chờ duyệt hoặc bị từ chối")
        
    await db.donations.delete_one({"_id": obj_id})
    
    # Xóa ảnh trên Cloudinary
    for img in donation.get("images", []):
        try:
            await delete_cloudinary_asset(img)
        except Exception as e:
            logger.error(f"Error deleting image {img}: {e}")
    
    # Thông báo cho các bên liên quan khi admin xóa
    if is_admin(current_user) and not is_owner:
        # Admin xóa bài của người khác → thông báo cho chủ bài
        await _notify_user(
            user_id=donation["donorId"],
            title="Bài đăng đã bị gỡ",
            message=f"Bài đăng '{donation['title']}' của bạn đã bị quản trị viên gỡ khỏi Kho 0 Đồng."
        )
    
    if donation.get("receiverId") and donation["status"] == "MATCHED":
        # Đã có người nhận được chọn → thông báo cho họ
        await _notify_user(
            user_id=donation["receiverId"],
            title="Món đồ đã bị hủy",
            message=f"Món đồ '{donation['title']}' mà bạn được chọn nhận đã bị hủy."
        )
            
    return {"message": "Đã xóa thành công"}

@router.put("/{id}/approve")
async def approve_donation(
    id: str,
    current_user: dict = Depends(get_current_user)
):
    require_admin(current_user)
    obj_id = validate_object_id(id)
    donation = await db.donations.find_one({"_id": obj_id})
    if not donation:
        raise HTTPException(status_code=404, detail="Không tìm thấy mục này")
        
    if donation["status"] != "PENDING":
        raise HTTPException(status_code=400, detail="Mục này không ở trạng thái PENDING")
        
    result = await db.donations.update_one(
        {"_id": obj_id, "status": "PENDING"},
        {"$set": {
            "status": "APPROVED",
            "approvedAt": datetime.now(timezone.utc),
            "updatedAt": datetime.now(timezone.utc)
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="Mục này đã được xử lý bởi người khác hoặc không còn ở trạng thái PENDING")
    
    await manager.broadcast({"type": "new_donation", "title": donation["title"]})
    
    # Notify donor
    await _notify_user(
        user_id=donation["donorId"],
        title="Món đồ đã được duyệt",
        message=f"Món đồ '{donation['title']}' của bạn đã được duyệt và hiện trên Kho 0 Đồng."
    )
    
    updated = await db.donations.find_one({"_id": obj_id})
    return format_donation(updated)

@router.put("/{id}/reject")
async def reject_donation(
    id: str,
    data: DonationRejectRequest,
    current_user: dict = Depends(get_current_user)
):
    require_admin(current_user)
    obj_id = validate_object_id(id)
    donation = await db.donations.find_one({"_id": obj_id})
    if not donation:
        raise HTTPException(status_code=404, detail="Không tìm thấy mục này")
        
    if donation["status"] != "PENDING":
        raise HTTPException(status_code=400, detail="Mục này không ở trạng thái PENDING")
        
    result = await db.donations.update_one(
        {"_id": obj_id, "status": "PENDING"},
        {"$set": {
            "status": "REJECTED",
            "rejectReason": data.reason,
            "updatedAt": datetime.now(timezone.utc)
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="Mục này đã được xử lý bởi người khác hoặc không còn ở trạng thái PENDING")
    
    # Notify donor
    await _notify_user(
        user_id=donation["donorId"],
        title="Món đồ không được duyệt",
        message=f"Món đồ '{donation['title']}' của bạn không được duyệt. Lý do: {data.reason}"
    )
    
    updated = await db.donations.find_one({"_id": obj_id})
    return format_donation(updated)

@router.post("/{id}/request")
async def request_donation(
    id: str,
    data: DonationRequestCreate,
    current_user: dict = Depends(get_current_user)
):
    obj_id = validate_object_id(id)
    donation = await db.donations.find_one({"_id": obj_id})
    if not donation:
        raise HTTPException(status_code=404, detail="Không tìm thấy mục này")
        
    if donation["status"] != "APPROVED":
        raise HTTPException(status_code=400, detail="Mục này không có sẵn để nhận")
        
    user_id_str = str(current_user["_id"])
    if user_id_str == donation["donorId"]:
        raise HTTPException(status_code=400, detail="Bạn không thể nhận món đồ do chính bạn tặng")
            
    requester = {
        "userId": user_id_str,
        "userName": current_user.get("fullName", current_user.get("username")),
        "userDepartment": current_user.get("department"),
        "userAvatar": current_user.get("avatar"),
        "reason": data.reason,
        "requestedAt": datetime.now(timezone.utc)
    }
    
    # Atomic update: chỉ push nếu status vẫn APPROVED VÀ user chưa có trong requesters
    result = await db.donations.update_one(
        {
            "_id": obj_id,
            "status": "APPROVED",
            "requesters.userId": {"$ne": user_id_str}
        },
        {"$push": {"requesters": requester}, "$set": {"updatedAt": datetime.now(timezone.utc)}}
    )
    
    if result.modified_count == 0:
        # Phân biệt lý do: đã đăng ký rồi hay trạng thái đã thay đổi
        current = await db.donations.find_one({"_id": obj_id})
        if current and any(r["userId"] == user_id_str for r in current.get("requesters", [])):
            raise HTTPException(status_code=400, detail="Bạn đã đăng ký nhận món đồ này rồi")
        raise HTTPException(status_code=400, detail="Mục này không còn khả dụng để đăng ký nhận")
    
    # Notify donor
    await _notify_user(
        user_id=donation["donorId"],
        title="Có người muốn nhận món đồ của bạn",
        message=f"{requester['userName']} muốn nhận món đồ '{donation['title']}' của bạn."
    )
    
    updated = await db.donations.find_one({"_id": obj_id})
    return format_donation(updated)

@router.put("/{id}/confirm/{userId}")
async def confirm_receiver(
    id: str,
    userId: str,
    current_user: dict = Depends(get_current_user)
):
    obj_id = validate_object_id(id)
    donation = await db.donations.find_one({"_id": obj_id})
    if not donation:
        raise HTTPException(status_code=404, detail="Không tìm thấy mục này")
        
    if str(current_user["_id"]) != donation["donorId"] and not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Chỉ người tặng hoặc quản trị viên mới có thể xác nhận")
        
    if donation["status"] != "APPROVED":
        raise HTTPException(status_code=400, detail="Mục này không ở trạng thái APPROVED")
        
    requester = next((req for req in donation.get("requesters", []) if req["userId"] == userId), None)
    if not requester:
        raise HTTPException(status_code=404, detail="Không tìm thấy người nhận này trong danh sách đăng ký")
        
    result = await db.donations.update_one(
        {"_id": obj_id, "status": "APPROVED"},
        {"$set": {
            "status": "MATCHED",
            "receiverId": userId,
            "receiverName": requester["userName"],
            "matchedAt": datetime.now(timezone.utc),
            "updatedAt": datetime.now(timezone.utc)
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="Mục này đã được xác nhận cho người khác hoặc trạng thái không hợp lệ")
    
    # Notify receiver
    await _notify_user(
        user_id=userId,
        title="Đăng ký nhận đồ thành công",
        message=f"Bạn đã được chọn để nhận món đồ '{donation['title']}'. Vui lòng liên hệ để nhận đồ."
    )
    
    # Notify donor
    await _notify_user(
        user_id=donation["donorId"],
        title="Đã xác nhận người nhận",
        message=f"Món đồ '{donation['title']}' của bạn đã được xác nhận trao cho {requester['userName']}."
    )
    
    updated = await db.donations.find_one({"_id": obj_id})
    return format_donation(updated)

@router.put("/{id}/complete")
async def complete_donation(
    id: str,
    data: DonationCompleteRequest,
    current_user: dict = Depends(get_current_user)
):
    obj_id = validate_object_id(id)
    donation = await db.donations.find_one({"_id": obj_id})
    if not donation:
        raise HTTPException(status_code=404, detail="Không tìm thấy mục này")
        
    if donation["status"] != "MATCHED":
        raise HTTPException(status_code=400, detail="Mục này chưa được xác nhận người nhận")
        
    if str(current_user["_id"]) != donation.get("receiverId"):
        raise HTTPException(status_code=403, detail="Chỉ người nhận mới có thể xác nhận hoàn thành")
        
    result = await db.donations.update_one(
        {"_id": obj_id, "status": "MATCHED"},
        {"$set": {
            "status": "COMPLETED",
            "completedAt": datetime.now(timezone.utc),
            "thankYouMessage": data.thankYouMessage,
            "updatedAt": datetime.now(timezone.utc)
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="Mục này đã được xác nhận hoàn tất trước đó hoặc trạng thái không hợp lệ")
    
    # Notify donor
    message = f"Món đồ '{donation['title']}' đã được nhận thành công."
    if data.thankYouMessage:
        message += f" Lời cảm ơn: '{data.thankYouMessage}'"
        
    await _notify_user(
        user_id=donation["donorId"],
        title="Hoàn thành trao tặng",
        message=message
    )
    
    updated = await db.donations.find_one({"_id": obj_id})
    return format_donation(updated)

@router.put("/{id}/cancel-request")
async def cancel_request(
    id: str,
    current_user: dict = Depends(get_current_user)
):
    obj_id = validate_object_id(id)
    donation = await db.donations.find_one({"_id": obj_id})
    if not donation:
        raise HTTPException(status_code=404, detail="Không tìm thấy mục này")
    
    if donation["status"] != "APPROVED":
        raise HTTPException(status_code=400, detail="Mục này không ở trạng thái đang cho nhận")
        
    user_id_str = str(current_user["_id"])
    
    result = await db.donations.update_one(
        {"_id": obj_id},
        {"$pull": {"requesters": {"userId": user_id_str}}, "$set": {"updatedAt": datetime.now(timezone.utc)}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="Bạn chưa đăng ký nhận hoặc mục này đã thay đổi")
        
    updated = await db.donations.find_one({"_id": obj_id})
    return format_donation(updated)

@router.put("/{id}/cancel-match")
async def cancel_match(
    id: str,
    current_user: dict = Depends(get_current_user)
):
    obj_id = validate_object_id(id)
    donation = await db.donations.find_one({"_id": obj_id})
    if not donation:
        raise HTTPException(status_code=404, detail="Không tìm thấy mục này")
        
    if str(current_user["_id"]) != donation["donorId"] and not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Chỉ người tặng hoặc quản trị viên mới có thể hủy giao dịch")
        
    if donation["status"] != "MATCHED":
        raise HTTPException(status_code=400, detail="Chỉ có thể hủy khi đang ở trạng thái MATCHED")
        
    receiver_id = donation.get("receiverId")
    
    result = await db.donations.update_one(
        {"_id": obj_id, "status": "MATCHED"},
        {
            "$set": {"status": "APPROVED", "updatedAt": datetime.now(timezone.utc)},
            "$unset": {"receiverId": "", "receiverName": "", "matchedAt": ""}
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="Lỗi khi hủy giao dịch")
        
    if receiver_id:
        await _notify_user(
            user_id=receiver_id,
            title="Giao dịch bị hủy",
            message=f"Giao dịch cho món đồ '{donation['title']}' đã bị người tặng hủy."
        )
        
    updated = await db.donations.find_one({"_id": obj_id})
    return format_donation(updated)

from app.models.donation import DonationCommentCreate

@router.post("/{id}/comments")
async def add_comment(
    id: str,
    data: DonationCommentCreate,
    current_user: dict = Depends(get_current_user)
):
    obj_id = validate_object_id(id)
    donation = await db.donations.find_one({"_id": obj_id})
    if not donation:
        raise HTTPException(status_code=404, detail="Không tìm thấy mục này")
        
    comment = {
        "userId": str(current_user["_id"]),
        "userName": current_user.get("fullName", current_user.get("username")),
        "userAvatar": current_user.get("avatar"),
        "content": data.content,
        "createdAt": datetime.now(timezone.utc)
    }
    
    await db.donations.update_one(
        {"_id": obj_id},
        {"$push": {"comments": comment}}
    )
    
    if str(current_user["_id"]) != donation["donorId"]:
        await _notify_user(
            user_id=donation["donorId"],
            title="Có bình luận mới",
            message=f"{comment['userName']} đã bình luận về món đồ '{donation['title']}' của bạn."
        )
        
    updated = await db.donations.find_one({"_id": obj_id})
    return format_donation(updated)

@router.put("/{id}/archive")
async def archive_donation(
    id: str,
    current_user: dict = Depends(get_current_user)
):
    require_admin(current_user)
    obj_id = validate_object_id(id)
    donation = await db.donations.find_one({"_id": obj_id})
    if not donation:
        raise HTTPException(status_code=404, detail="Không tìm thấy mục này")
        
    if donation["status"] not in ["APPROVED", "PENDING"]:
        raise HTTPException(status_code=400, detail="Chỉ có thể lưu trữ mục APPROVED hoặc PENDING")
        
    await db.donations.update_one(
        {"_id": obj_id},
        {"$set": {"status": "ARCHIVED", "archivedAt": datetime.now(timezone.utc), "updatedAt": datetime.now(timezone.utc)}}
    )
    
    updated = await db.donations.find_one({"_id": obj_id})
    return format_donation(updated)
