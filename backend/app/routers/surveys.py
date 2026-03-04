from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks
from typing import List, Optional
from datetime import datetime, timezone
from bson import ObjectId
from app.core.database import db
from app.core.security import get_current_user
from app.core.permissions import resolve_target_departments
from app.core.push import send_bulk_push_notifications
from app.models.survey import SurveyCreate, SurveyUpdate, SurveySubmission

router = APIRouter()

ADMIN_ROLES = ["SUPER_ADMIN", "BCH_VANPHONG", "BCH_CUALO", "BCH_BENTHUY"]


@router.get("")
async def get_surveys(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=50),
    status: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """Get surveys visible to current user"""
    match_stage: dict = {}

    # Admin sees all; members see only ACTIVE surveys for their department
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

    # Aggregation pipeline to avoid N+1 queries
    pipeline = [
        {"$match": match_stage},
        {"$sort": {"createdAt": -1}},
        {"$skip": skip},
        {"$limit": limit},
        # Lookup response counts
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
            "deadline": s.get("deadline"),
            "targetDepartments": s.get("targetDepartments", []),
            "status": s.get("status", "DRAFT"),
            "createdBy": s.get("createdBy"),
            "creatorName": s.get("creatorName"),
            "createdAt": s.get("createdAt"),
            "responseCount": s.get("responseCount", 0),
            "hasResponded": s.get("hasResponded", False),
        })

    return {"items": result, "total": total, "hasMore": skip + limit < total}


@router.post("")
async def create_survey(
    survey: SurveyCreate,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Create a new survey (Admin/BCH only)"""
    if current_user["role"] not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Không có quyền tạo khảo sát")

    target_departments = resolve_target_departments(current_user, survey.targetDepartments)

    survey_data = {
        "title": survey.title,
        "description": survey.description,
        "questions": [q.dict() for q in survey.questions],
        "isAnonymous": survey.isAnonymous,
        "deadline": survey.deadline,
        "targetDepartments": target_departments,
        "status": "ACTIVE" if survey.questions else "DRAFT",
        "createdBy": current_user["_id"],
        "creatorName": current_user["fullName"],
        "createdAt": datetime.now(timezone.utc),
    }

    result = await db.surveys.insert_one(survey_data)
    survey_id = str(result.inserted_id)

    # Send push notification if survey is active
    if survey_data["status"] == "ACTIVE":
        background_tasks.add_task(
            notify_new_survey,
            survey.title,
            target_departments,
            survey_id,
        )

    return {
        "id": survey_id,
        "title": survey_data["title"],
        "status": survey_data["status"],
        "message": "Tạo khảo sát thành công"
    }


@router.get("/{survey_id}")
async def get_survey(survey_id: str, current_user: dict = Depends(get_current_user)):
    """Get survey detail"""
    if not ObjectId.is_valid(survey_id):
        raise HTTPException(status_code=400, detail="Invalid survey ID")

    survey = await db.surveys.find_one({"_id": ObjectId(survey_id)})
    if not survey:
        raise HTTPException(status_code=404, detail="Không tìm thấy khảo sát")

    # Check if user has already responded
    has_responded = await db.survey_responses.find_one({
        "surveyId": survey_id,
        "userId": current_user["_id"]
    })

    response_count = await db.survey_responses.count_documents({"surveyId": survey_id})

    return {
        "id": str(survey["_id"]),
        "title": survey["title"],
        "description": survey.get("description"),
        "questions": survey.get("questions", []),
        "isAnonymous": survey.get("isAnonymous", False),
        "deadline": survey.get("deadline"),
        "targetDepartments": survey.get("targetDepartments", []),
        "status": survey.get("status", "DRAFT"),
        "createdBy": survey.get("createdBy"),
        "creatorName": survey.get("creatorName"),
        "createdAt": survey.get("createdAt"),
        "responseCount": response_count,
        "hasResponded": has_responded is not None,
    }


@router.put("/{survey_id}")
async def update_survey(
    survey_id: str,
    survey: SurveyUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a survey (Admin/BCH only)"""
    if current_user["role"] not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Không có quyền sửa khảo sát")

    if not ObjectId.is_valid(survey_id):
        raise HTTPException(status_code=400, detail="Invalid survey ID")

    existing = await db.surveys.find_one({"_id": ObjectId(survey_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Không tìm thấy khảo sát")

    update_fields = {}
    if survey.title is not None:
        update_fields["title"] = survey.title
    if survey.description is not None:
        update_fields["description"] = survey.description
    if survey.questions is not None:
        update_fields["questions"] = [q.dict() for q in survey.questions]
    if survey.isAnonymous is not None:
        update_fields["isAnonymous"] = survey.isAnonymous
    if survey.deadline is not None:
        update_fields["deadline"] = survey.deadline
    if survey.targetDepartments is not None:
        update_fields["targetDepartments"] = resolve_target_departments(
            current_user, survey.targetDepartments
        )
    if survey.status is not None:
        update_fields["status"] = survey.status.value

    if not update_fields:
        raise HTTPException(status_code=400, detail="Không có trường nào để cập nhật")

    update_fields["updatedAt"] = datetime.now(timezone.utc)

    await db.surveys.update_one(
        {"_id": ObjectId(survey_id)},
        {"$set": update_fields}
    )

    return {"status": "success", "message": "Cập nhật khảo sát thành công"}


@router.delete("/{survey_id}")
async def delete_survey(survey_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a survey (Admin/BCH only)"""
    if current_user["role"] not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Không có quyền xóa khảo sát")

    if not ObjectId.is_valid(survey_id):
        raise HTTPException(status_code=400, detail="Invalid survey ID")

    existing = await db.surveys.find_one({"_id": ObjectId(survey_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Không tìm thấy khảo sát")

    # Delete survey and all its responses
    await db.surveys.delete_one({"_id": ObjectId(survey_id)})
    await db.survey_responses.delete_many({"surveyId": survey_id})

    return {"status": "success", "message": "Đã xóa khảo sát"}


@router.post("/{survey_id}/submit")
async def submit_survey(
    survey_id: str,
    submission: SurveySubmission,
    current_user: dict = Depends(get_current_user)
):
    """Submit survey response"""
    if not ObjectId.is_valid(survey_id):
        raise HTTPException(status_code=400, detail="Invalid survey ID")

    survey = await db.surveys.find_one({"_id": ObjectId(survey_id)})
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

    # Validate answers count matches questions
    questions = survey.get("questions", [])
    if not submission.answers:
        raise HTTPException(status_code=400, detail="Vui lòng trả lời ít nhất một câu hỏi")

    response_data = {
        "surveyId": survey_id,
        "userId": current_user["_id"],
        "userName": current_user["fullName"] if not survey.get("isAnonymous") else None,
        "department": current_user["department"],
        "answers": submission.answers,
        "submittedAt": datetime.now(timezone.utc),
    }

    await db.survey_responses.insert_one(response_data)

    return {"status": "success", "message": "Cảm ơn bạn đã tham gia khảo sát!"}


@router.get("/{survey_id}/stats")
async def get_survey_stats(survey_id: str, current_user: dict = Depends(get_current_user)):
    """Get survey statistics (Admin/BCH only)"""
    if current_user["role"] not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Không có quyền xem thống kê")

    if not ObjectId.is_valid(survey_id):
        raise HTTPException(status_code=400, detail="Invalid survey ID")

    survey = await db.surveys.find_one({"_id": ObjectId(survey_id)})
    if not survey:
        raise HTTPException(status_code=404, detail="Không tìm thấy khảo sát")

    responses = await db.survey_responses.find({"surveyId": survey_id}).to_list(10000)
    questions = survey.get("questions", [])

    total_responses = len(responses)

    # Build stats per question
    question_stats = []
    for i, q in enumerate(questions):
        q_stat = {
            "index": i,
            "content": q["content"],
            "type": q["type"],
            "totalAnswers": 0,
        }

        if q["type"] in ["SINGLE_CHOICE", "MULTIPLE_CHOICE"]:
            option_counts = {}
            for opt in q.get("options", []):
                option_counts[opt] = 0

            for resp in responses:
                for ans in resp.get("answers", []):
                    if ans.get("questionIndex") == i:
                        q_stat["totalAnswers"] += 1
                        answer_val = ans.get("answer")
                        if isinstance(answer_val, list):
                            for v in answer_val:
                                if v in option_counts:
                                    option_counts[v] += 1
                        elif answer_val in option_counts:
                            option_counts[answer_val] += 1

            q_stat["optionCounts"] = option_counts

        elif q["type"] == "STAR_RATING":
            ratings = []
            for resp in responses:
                for ans in resp.get("answers", []):
                    if ans.get("questionIndex") == i:
                        q_stat["totalAnswers"] += 1
                        try:
                            ratings.append(int(ans.get("answer", 0)))
                        except (ValueError, TypeError):
                            pass
            q_stat["averageRating"] = round(sum(ratings) / len(ratings), 1) if ratings else 0
            q_stat["ratingDistribution"] = {str(r): ratings.count(r) for r in range(1, 6)}

        elif q["type"] == "OPEN_TEXT":
            texts = []
            for resp in responses:
                for ans in resp.get("answers", []):
                    if ans.get("questionIndex") == i:
                        q_stat["totalAnswers"] += 1
                        if ans.get("answer"):
                            texts.append({
                                "text": ans["answer"],
                                "userName": resp.get("userName"),
                                "department": resp.get("department"),
                            })
            q_stat["textResponses"] = texts

        question_stats.append(q_stat)

    # Department breakdown
    dept_counts = {}
    for resp in responses:
        dept = resp.get("department", "Unknown")
        dept_counts[dept] = dept_counts.get(dept, 0) + 1

    return {
        "surveyId": survey_id,
        "title": survey["title"],
        "totalResponses": total_responses,
        "departmentBreakdown": dept_counts,
        "questionStats": question_stats,
    }


@router.get("/{survey_id}/responses")
async def get_survey_responses(
    survey_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(get_current_user)
):
    """Get individual survey responses (Admin/BCH only)"""
    if current_user["role"] not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Không có quyền xem phản hồi")

    if not ObjectId.is_valid(survey_id):
        raise HTTPException(status_code=400, detail="Invalid survey ID")

    total = await db.survey_responses.count_documents({"surveyId": survey_id})
    responses = await db.survey_responses.find(
        {"surveyId": survey_id}
    ).sort("submittedAt", -1).skip(skip).limit(limit).to_list(limit)

    return {
        "total": total,
        "items": [{
            "id": str(r["_id"]),
            "userName": r.get("userName"),
            "department": r.get("department"),
            "answers": r.get("answers", []),
            "submittedAt": r.get("submittedAt"),
        } for r in responses]
    }


async def notify_new_survey(title: str, target_departments: list, survey_id: str):
    """Send push notification for new survey"""
    query = {"status": "ACTIVE", "pushToken": {"$exists": True, "$ne": None}}
    if "ALL" not in target_departments and target_departments:
        query["department"] = {"$in": target_departments}

    users = await db.users.find(query, {"pushToken": 1}).to_list(10000)
    tokens = [u["pushToken"] for u in users if u.get("pushToken")]

    if tokens:
        send_bulk_push_notifications(
            tokens,
            "📋 Khảo sát mới",
            title,
            {"type": "survey", "surveyId": survey_id}
        )
