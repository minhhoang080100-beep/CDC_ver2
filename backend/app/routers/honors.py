from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from bson import ObjectId
from app.core.database import db
from app.core.security import get_current_user
from app.core.permissions import resolve_target_departments
from app.core.push import send_bulk_push_notifications_async
from app.models.honor import CampaignCreate, CampaignUpdate, NominationCreate

router = APIRouter()


# ─── Honor Board (Public View) ─ MUST be before /{campaign_id} ──

@router.get("/board")
async def get_honor_board(current_user=Depends(get_current_user)):
    """Get all approved nominations grouped by campaign for public display"""
    campaigns = []
    cursor = db.campaigns.find({}).sort("createdAt", -1)
    async for c in cursor:
        cid = str(c["_id"])
        approved = []
        nom_cursor = db.nominations.find({"campaignId": cid, "status": "APPROVED"}).sort("createdAt", -1)
        async for n in nom_cursor:
            approved.append({
                "id": str(n["_id"]),
                "nomineeName": n.get("nomineeName"),
                "nomineeDepartment": n.get("nomineeDepartment"),
                "reason": n.get("reason"),
                "achievements": n.get("achievements"),
                "nominatorName": n.get("nominatorName"),
            })
        if approved:
            campaigns.append({
                "id": cid,
                "title": c.get("title"),
                "description": c.get("description"),
                "type": c.get("type", "INDIVIDUAL"),
                "status": c.get("status"),
                "approvedNominations": approved,
            })
    return campaigns


# ─── Nominations (fixed paths before /{campaign_id}) ─────

@router.post("/nominate")
async def create_nomination(data: NominationCreate, current_user=Depends(get_current_user)):
    campaign = await db.campaigns.find_one({"_id": ObjectId(data.campaignId)})
    if not campaign:
        raise HTTPException(404, "Chiến dịch không tồn tại")
    if campaign.get("status") != "ACTIVE":
        raise HTTPException(400, "Chiến dịch đã đóng")

    existing = await db.nominations.find_one({
        "campaignId": data.campaignId,
        "nominatorId": str(current_user["_id"]),
        "nomineeName": data.nomineeName,
    })
    if existing:
        raise HTTPException(400, "Bạn đã đề cử người này rồi")

    nomination = {
        "campaignId": data.campaignId,
        "nomineeName": data.nomineeName,
        "nomineeDepartment": data.nomineeDepartment,
        "reason": data.reason,
        "achievements": data.achievements,
        "status": "PENDING",
        "nominatorId": str(current_user["_id"]),
        "nominatorName": current_user.get("fullName", ""),
        "nominatorDepartment": current_user.get("department", ""),
        "createdAt": datetime.now(timezone.utc),
    }
    result = await db.nominations.insert_one(nomination)
    return {"id": str(result.inserted_id), "message": "Đề cử thành công, đang chờ duyệt"}


@router.put("/nominations/{nomination_id}/review")
async def review_nomination(
    nomination_id: str,
    action: str,
    note: str = "",
    current_user=Depends(get_current_user)
):
    if current_user["role"] not in ["SUPER_ADMIN"] and not current_user["role"].startswith("BCH_"):
        raise HTTPException(403, "Không có quyền duyệt")

    if action not in ["APPROVED", "REJECTED"]:
        raise HTTPException(400, "action phải là APPROVED hoặc REJECTED")

    result = await db.nominations.update_one(
        {"_id": ObjectId(nomination_id)},
        {"$set": {
            "status": action,
            "reviewedBy": str(current_user["_id"]),
            "reviewerName": current_user.get("fullName", ""),
            "reviewNote": note,
            "reviewedAt": datetime.now(timezone.utc),
        }}
    )
    if result.modified_count == 0:
        raise HTTPException(404, "Đề cử không tồn tại")

    status_text = "được duyệt" if action == "APPROVED" else "bị từ chối"
    return {"message": f"Đề cử đã {status_text}"}


@router.delete("/nominations/{nomination_id}")
async def delete_nomination(nomination_id: str, current_user=Depends(get_current_user)):
    if current_user["role"] not in ["SUPER_ADMIN"] and not current_user["role"].startswith("BCH_"):
        raise HTTPException(403, "Không có quyền xóa")

    await db.nominations.delete_one({"_id": ObjectId(nomination_id)})
    return {"message": "Đã xóa đề cử"}


# ─── Campaigns ───────────────────────────────────────────

@router.get("")
async def list_campaigns(
    skip: int = 0,
    limit: int = 50,
    status: str = None,
    current_user=Depends(get_current_user)
):
    query = {}
    if status:
        query["status"] = status

    total = await db.campaigns.count_documents(query)

    # Aggregation pipeline to avoid N+1 queries
    pipeline = [
        {"$match": query},
        {"$sort": {"createdAt": -1}},
        {"$skip": skip},
        {"$limit": limit},
        {"$addFields": {"campaignIdStr": {"$toString": "$_id"}}},
        {"$lookup": {
            "from": "nominations",
            "let": {"cid": "$campaignIdStr"},
            "pipeline": [
                {"$match": {"$expr": {"$eq": ["$campaignId", "$$cid"]}}},
                {"$group": {
                    "_id": None,
                    "total": {"$sum": 1},
                    "approved": {
                        "$sum": {"$cond": [{"$eq": ["$status", "APPROVED"]}, 1, 0]}
                    }
                }}
            ],
            "as": "nomStats"
        }},
        {"$addFields": {
            "nominationCount": {"$ifNull": [{"$arrayElemAt": ["$nomStats.total", 0]}, 0]},
            "approvedCount": {"$ifNull": [{"$arrayElemAt": ["$nomStats.approved", 0]}, 0]},
        }},
        {"$project": {"nomStats": 0, "campaignIdStr": 0}}
    ]

    campaigns = await db.campaigns.aggregate(pipeline).to_list(limit)

    items = []
    for c in campaigns:
        items.append({
            "id": str(c["_id"]),
            "title": c.get("title", ""),
            "description": c.get("description"),
            "type": c.get("type", "INDIVIDUAL"),
            "startDate": c.get("startDate"),
            "endDate": c.get("endDate"),
            "status": c.get("status", "ACTIVE"),
            "targetDepartments": c.get("targetDepartments", []),
            "creatorName": c.get("creatorName"),
            "createdAt": c.get("createdAt", ""),
            "nominationCount": c.get("nominationCount", 0),
            "approvedCount": c.get("approvedCount", 0),
        })
    return {"items": items, "total": total, "hasMore": skip + limit < total}


@router.get("/{campaign_id}")
async def get_campaign(campaign_id: str, current_user=Depends(get_current_user)):
    campaign = await db.campaigns.find_one({"_id": ObjectId(campaign_id)})
    if not campaign:
        raise HTTPException(404, "Chiến dịch không tồn tại")

    nominations = []
    cursor = db.nominations.find({"campaignId": campaign_id}).sort("createdAt", -1)
    async for n in cursor:
        nominations.append({
            "id": str(n["_id"]),
            "nomineeName": n.get("nomineeName"),
            "nomineeDepartment": n.get("nomineeDepartment"),
            "reason": n.get("reason"),
            "achievements": n.get("achievements"),
            "status": n.get("status", "PENDING"),
            "nominatorName": n.get("nominatorName"),
            "nominatorDepartment": n.get("nominatorDepartment"),
            "createdAt": n.get("createdAt"),
            "reviewedAt": n.get("reviewedAt"),
            "reviewNote": n.get("reviewNote"),
        })

    return {
        "id": str(campaign["_id"]),
        "title": campaign.get("title"),
        "description": campaign.get("description"),
        "type": campaign.get("type", "INDIVIDUAL"),
        "startDate": campaign.get("startDate"),
        "endDate": campaign.get("endDate"),
        "status": campaign.get("status"),
        "targetDepartments": campaign.get("targetDepartments", []),
        "creatorName": campaign.get("creatorName"),
        "createdAt": campaign.get("createdAt"),
        "nominations": nominations,
    }


@router.post("")
async def create_campaign(data: CampaignCreate, current_user=Depends(get_current_user)):
    if current_user["role"] not in ["SUPER_ADMIN"] and not current_user["role"].startswith("BCH_"):
        raise HTTPException(403, "Không có quyền tạo chiến dịch")

    campaign = {
        "title": data.title,
        "description": data.description,
        "type": data.type.value if data.type else "INDIVIDUAL",
        "startDate": data.startDate,
        "endDate": data.endDate,
        "targetDepartments": data.targetDepartments,
        "status": "ACTIVE",
        "createdBy": str(current_user["_id"]),
        "creatorName": current_user.get("fullName", ""),
        "createdAt": datetime.now(timezone.utc),
    }
    result = await db.campaigns.insert_one(campaign)
    return {"id": str(result.inserted_id), "message": "Tạo chiến dịch thành công"}


@router.put("/{campaign_id}")
async def update_campaign(campaign_id: str, data: CampaignUpdate, current_user=Depends(get_current_user)):
    if current_user["role"] not in ["SUPER_ADMIN"] and not current_user["role"].startswith("BCH_"):
        raise HTTPException(403, "Không có quyền chỉnh sửa")

    update_data = {k: v for k, v in data.dict(exclude_unset=True).items() if v is not None}
    if "status" in update_data and hasattr(update_data["status"], "value"):
        update_data["status"] = update_data["status"].value
    if "type" in update_data and hasattr(update_data["type"], "value"):
        update_data["type"] = update_data["type"].value

    if update_data:
        update_data["updatedAt"] = datetime.now(timezone.utc)
        await db.campaigns.update_one({"_id": ObjectId(campaign_id)}, {"$set": update_data})
    return {"message": "Cập nhật thành công"}


@router.delete("/{campaign_id}")
async def delete_campaign(campaign_id: str, current_user=Depends(get_current_user)):
    if current_user["role"] not in ["SUPER_ADMIN"] and not current_user["role"].startswith("BCH_"):
        raise HTTPException(403, "Không có quyền xóa")

    await db.campaigns.delete_one({"_id": ObjectId(campaign_id)})
    await db.nominations.delete_many({"campaignId": campaign_id})
    return {"message": "Đã xóa chiến dịch"}


# ─── Stats ────────────────────────────────────────────────

@router.get("/{campaign_id}/stats")
async def get_campaign_stats(campaign_id: str, current_user=Depends(get_current_user)):
    if current_user["role"] not in ["SUPER_ADMIN"] and not current_user["role"].startswith("BCH_"):
        raise HTTPException(403, "Không có quyền xem thống kê")

    campaign = await db.campaigns.find_one({"_id": ObjectId(campaign_id)})
    if not campaign:
        raise HTTPException(404, "Chiến dịch không tồn tại")

    total = await db.nominations.count_documents({"campaignId": campaign_id})
    pending = await db.nominations.count_documents({"campaignId": campaign_id, "status": "PENDING"})
    approved = await db.nominations.count_documents({"campaignId": campaign_id, "status": "APPROVED"})
    rejected = await db.nominations.count_documents({"campaignId": campaign_id, "status": "REJECTED"})

    dept_breakdown = {}
    cursor = db.nominations.find({"campaignId": campaign_id})
    async for n in cursor:
        dept = n.get("nomineeDepartment", "Unknown")
        dept_breakdown[dept] = dept_breakdown.get(dept, 0) + 1

    return {
        "title": campaign.get("title"),
        "totalNominations": total,
        "pending": pending,
        "approved": approved,
        "rejected": rejected,
        "departmentBreakdown": dept_breakdown,
    }


# ─── Push Notification ────────────────────────────────────

@router.post("/{campaign_id}/notify")
async def notify_campaign(campaign_id: str, current_user=Depends(get_current_user)):
    if current_user["role"] not in ["SUPER_ADMIN"] and not current_user["role"].startswith("BCH_"):
        raise HTTPException(403, "Không có quyền gửi thông báo")

    campaign = await db.campaigns.find_one({"_id": ObjectId(campaign_id)})
    if not campaign:
        raise HTTPException(404, "Chiến dịch không tồn tại")

    title = campaign.get("title", "")
    target_depts = campaign.get("targetDepartments", [])
    query = {"status": "ACTIVE", "pushToken": {"$exists": True, "$ne": None}}
    if target_depts and "ALL" not in target_depts:
        query["department"] = {"$in": target_depts}

    users = await db.users.find(query, {"pushToken": 1}).to_list(5000)
    tokens = [u["pushToken"] for u in users if u.get("pushToken")]

    if tokens:
        await send_bulk_push_notifications_async(
            tokens,
            "🏆 Chiến dịch vinh danh mới",
            title,
            {"type": "campaign", "campaignId": campaign_id}
        )

    return {"message": f"Đã gửi thông báo đến {len(tokens)} người"}
