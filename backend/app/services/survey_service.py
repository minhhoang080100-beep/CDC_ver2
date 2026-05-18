"""
Survey service — business logic extracted from surveys router.
"""

from datetime import datetime, timezone
from bson import ObjectId
from fastapi import HTTPException

from app.core.database import db
from app.core.permissions import resolve_target_departments, ADMIN_ROLES
from app.core.push import send_bulk_push_notifications_async


async def get_surveys(skip: int, limit: int, status, current_user: dict):
    match_stage: dict = {"isDeleted": {"$ne": True}}

    if current_user["role"] not in ADMIN_ROLES:
        match_stage["status"] = "ACTIVE"
        match_stage["$or"] = [
            {"targetDepartments": {"$in": [current_user["department"], "ALL"]}},
            {"targetDepartments": {"$size": 0}},
            {"targetDepartments": {"$exists": False}},
        ]
    else:
        if status:
            match_stage["status"] = status

    total = await db.surveys.count_documents(match_stage)

    pipeline = [
        {"$match": match_stage},
        {"$sort": {"createdAt": -1}},
        {"$skip": skip},
        {"$limit": limit},
        {"$lookup": {
            "from": "survey_responses",
            "let": {"sid": {"$toString": "$_id"}},
            "pipeline": [
                {"$match": {"$expr": {"$eq": ["$surveyId", "$$sid"]}}},
                {"$group": {
                    "_id": None,
                    "count": {"$sum": 1},
                    "userResponded": {
                        "$sum": {"$cond": [{"$eq": ["$userId", current_user["_id"]]}, 1, 0]}
                    }
                }}
            ],
            "as": "responseStats"
        }},
        {"$addFields": {
            "responseCount": {
                "$ifNull": [{"$arrayElemAt": ["$responseStats.count", 0]}, 0]
            },
            "hasResponded": {
                "$gt": [{"$ifNull": [{"$arrayElemAt": ["$responseStats.userResponded", 0]}, 0]}, 0]
            }
        }},
        {"$project": {"responseStats": 0}}
    ]

    surveys = await db.surveys.aggregate(pipeline).to_list(limit)

    result = []
    for s in surveys:
        result.append({
            "id": str(s["_id"]),
            "title": s["title"],
            "description": s.get("description"),
            "questionCount": len(s.get("questions", [])),
            "isAnonymous": s.get("isAnonymous", False),
            "isQuiz": s.get("isQuiz", False),
            "deadline": s.get("deadline"),
            "targetDepartments": s.get("targetDepartments", []),
            "status": s.get("status", "DRAFT"),
            "createdBy": s.get("createdBy"),
            "creatorName": s.get("creatorName"),
            "createdAt": s.get("createdAt"),
            "responseCount": s.get("responseCount", 0),
            "hasResponded": s.get("hasResponded", False),
            "attachments": s.get("attachments", []),
        })

    return {"items": result, "total": total, "hasMore": skip + limit < total}


async def create_survey(survey_data: dict, current_user: dict):
    if current_user["role"] not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Không có quyền tạo khảo sát")

    target_departments = resolve_target_departments(current_user, survey_data.get("targetDepartments", []))

    doc = {
        "title": survey_data["title"],
        "description": survey_data.get("description"),
        "questions": survey_data.get("questions", []),
        "isAnonymous": survey_data.get("isAnonymous", False),
        "isQuiz": survey_data.get("isQuiz", False),
        "deadline": survey_data.get("deadline"),
        "targetDepartments": target_departments,
        "attachments": survey_data.get("attachments", []),
        "status": "ACTIVE" if survey_data.get("questions") else "DRAFT",
        "isDeleted": False,
        "createdBy": current_user["_id"],
        "creatorName": current_user["fullName"],
        "createdAt": datetime.now(timezone.utc),
    }

    result = await db.surveys.insert_one(doc)
    survey_id = str(result.inserted_id)

    return {
        "id": survey_id,
        "title": doc["title"],
        "status": doc["status"],
        "message": "Tạo khảo sát thành công"
    }, doc["status"], target_departments, survey_id


async def delete_survey(survey_id: str, current_user: dict):
    if current_user["role"] not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Không có quyền xóa khảo sát")

    if not ObjectId.is_valid(survey_id):
        raise HTTPException(status_code=400, detail="Invalid survey ID")

    existing = await db.surveys.find_one({"_id": ObjectId(survey_id), "isDeleted": {"$ne": True}})
    if not existing:
        raise HTTPException(status_code=404, detail="Không tìm thấy khảo sát")

    # Soft delete
    await db.surveys.update_one(
        {"_id": ObjectId(survey_id)},
        {"$set": {"isDeleted": True, "deletedAt": datetime.now(timezone.utc)}}
    )

    return {"status": "success", "message": "Đã xóa khảo sát"}


async def submit_survey(survey_id: str, answers: list, current_user: dict):
    if not ObjectId.is_valid(survey_id):
        raise HTTPException(status_code=400, detail="Invalid survey ID")

    survey = await db.surveys.find_one({"_id": ObjectId(survey_id), "isDeleted": {"$ne": True}})
    if not survey:
        raise HTTPException(status_code=404, detail="Không tìm thấy khảo sát")

    if survey.get("status") != "ACTIVE":
        raise HTTPException(status_code=400, detail="Khảo sát đã đóng hoặc chưa mở")

    # Check deadline
    if survey.get("deadline"):
        try:
            deadline = datetime.fromisoformat(survey["deadline"].replace("Z", "+00:00"))
            if datetime.now(timezone.utc) > deadline:
                raise HTTPException(status_code=400, detail="Khảo sát đã hết hạn")
        except (ValueError, TypeError):
            pass

    # Check if already responded
    existing_response = await db.survey_responses.find_one({
        "surveyId": survey_id,
        "userId": current_user["_id"]
    })
    if existing_response:
        raise HTTPException(status_code=400, detail="Bạn đã tham gia khảo sát này rồi")

    if not answers:
        raise HTTPException(status_code=400, detail="Vui lòng trả lời ít nhất một câu hỏi")

    response_data = {
        "surveyId": survey_id,
        "userId": current_user["_id"],
        "userName": current_user["fullName"] if not survey.get("isAnonymous") else None,
        "userAvatar": current_user.get("avatar") if not survey.get("isAnonymous") else None,
        "department": current_user["department"],
        "answers": answers,
        "submittedAt": datetime.now(timezone.utc),
    }

    await db.survey_responses.insert_one(response_data)

    return {"status": "success", "message": "Cảm ơn bạn đã tham gia khảo sát!"}


async def notify_new_survey(title: str, target_departments: list, survey_id: str):
    from datetime import datetime
    query = {"status": "ACTIVE"}
    if "ALL" not in target_departments and target_departments:
        query["department"] = {"$in": target_departments}

    users = await db.users.find(query).to_list(10000)
    if not users:
        return

    # 1. Create internal notifications
    now = datetime.utcnow()
    notifications = []
    for u in users:
        notifications.append({
            "userId": str(u["_id"]),
            "type": "survey",
            "title": "📋 Khảo sát mới",
            "body": title,
            "data": {"surveyId": survey_id},
            "read": False,
            "createdAt": now
        })
    if notifications:
        await db.notifications.insert_many(notifications)

    # 2. Send push notifications
    tokens = [u["pushToken"] for u in users if u.get("pushToken")]
    if tokens:
        await send_bulk_push_notifications_async(
            tokens,
            "📋 Khảo sát mới",
            title,
            {"type": "survey", "surveyId": survey_id}
        )
