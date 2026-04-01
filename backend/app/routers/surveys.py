from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks
from typing import List, Optional
from datetime import datetime, timezone
from bson import ObjectId
from app.core.database import db
from app.core.security import get_current_user
from app.core.permissions import resolve_target_departments, ADMIN_ROLES, require_admin
from app.core.push import send_bulk_push_notifications_async
from app.models.survey import SurveyCreate, SurveyUpdate, SurveySubmission
from app.services.survey_service import (
    get_surveys as svc_get_surveys,
    create_survey as svc_create_survey,
    delete_survey as svc_delete_survey,
    submit_survey as svc_submit_survey,
    notify_new_survey,
)
from app.routers.websocket import manager

router = APIRouter()



@router.get("")
async def get_surveys(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=50),
    status: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """Get surveys visible to current user"""
    return await svc_get_surveys(skip, limit, status, current_user)


@router.post("")
async def create_survey(
    survey: SurveyCreate,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Create a new survey (Admin/BCH only)"""
    survey_dict = {
        "title": survey.title,
        "description": survey.description,
        "questions": [q.dict() for q in survey.questions],
        "isAnonymous": survey.isAnonymous,
        "deadline": survey.deadline,
        "targetDepartments": survey.targetDepartments,
    }
    result, survey_status, target_departments, survey_id = await svc_create_survey(survey_dict, current_user)

    # Push notification if survey is active
    if survey_status == "ACTIVE":
        background_tasks.add_task(notify_new_survey, survey.title, target_departments, survey_id)

    # WebSocket broadcast
    background_tasks.add_task(
        manager.broadcast,
        {"type": "new_survey", "title": f"Khảo sát mới: {survey.title}", "data": {"surveyId": survey_id}}
    )

    return result


@router.get("/{survey_id}")
async def get_survey(survey_id: str, current_user: dict = Depends(get_current_user)):
    """Get survey detail"""
    if not ObjectId.is_valid(survey_id):
        raise HTTPException(status_code=400, detail="Invalid survey ID")

    survey = await db.surveys.find_one({"_id": ObjectId(survey_id), "isDeleted": {"$ne": True}})
    if not survey:
        raise HTTPException(status_code=404, detail="Không tìm thấy khảo sát")

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

    existing = await db.surveys.find_one({"_id": ObjectId(survey_id), "isDeleted": {"$ne": True}})
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
    """Delete a survey — soft delete (Admin/BCH only)"""
    return await svc_delete_survey(survey_id, current_user)


@router.post("/{survey_id}/submit")
async def submit_survey(
    survey_id: str,
    submission: SurveySubmission,
    current_user: dict = Depends(get_current_user)
):
    """Submit survey response"""
    return await svc_submit_survey(survey_id, submission.answers, current_user)


@router.get("/{survey_id}/stats")
async def get_survey_stats(survey_id: str, current_user: dict = Depends(get_current_user)):
    """Get survey statistics (Admin/BCH only)"""
    if current_user["role"] not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Không có quyền xem thống kê")

    if not ObjectId.is_valid(survey_id):
        raise HTTPException(status_code=400, detail="Invalid survey ID")

    survey = await db.surveys.find_one({"_id": ObjectId(survey_id), "isDeleted": {"$ne": True}})
    if not survey:
        raise HTTPException(status_code=404, detail="Không tìm thấy khảo sát")

    questions = survey.get("questions", [])

    # ─── Aggregation: total responses + department breakdown ──
    summary_pipeline = [
        {"$match": {"surveyId": survey_id}},
        {"$group": {
            "_id": "$department",
            "count": {"$sum": 1}
        }}
    ]
    dept_results = await db.survey_responses.aggregate(summary_pipeline).to_list(100)
    dept_counts = {d["_id"] or "Unknown": d["count"] for d in dept_results}
    total_responses = sum(dept_counts.values())

    # ─── Build stats per question using aggregation ───────────
    question_stats = []
    for i, q in enumerate(questions):
        q_stat = {
            "index": i,
            "content": q["content"],
            "type": q["type"],
            "totalAnswers": 0,
        }

        if q["type"] in ["SINGLE_CHOICE", "MULTIPLE_CHOICE"]:
            # Aggregation: unwind answers, match questionIndex, count options
            choice_pipeline = [
                {"$match": {"surveyId": survey_id}},
                {"$unwind": "$answers"},
                {"$match": {"answers.questionIndex": i}},
                {"$group": {"_id": None, "count": {"$sum": 1}}},
            ]
            count_result = await db.survey_responses.aggregate(choice_pipeline).to_list(1)
            q_stat["totalAnswers"] = count_result[0]["count"] if count_result else 0

            # Count per option
            option_counts = {opt: 0 for opt in q.get("options", [])}
            # For SINGLE_CHOICE: answer is a string; for MULTIPLE_CHOICE: answer is a list
            if q["type"] == "MULTIPLE_CHOICE":
                opt_pipeline = [
                    {"$match": {"surveyId": survey_id}},
                    {"$unwind": "$answers"},
                    {"$match": {"answers.questionIndex": i}},
                    {"$unwind": "$answers.answer"},
                    {"$group": {"_id": "$answers.answer", "count": {"$sum": 1}}},
                ]
            else:
                opt_pipeline = [
                    {"$match": {"surveyId": survey_id}},
                    {"$unwind": "$answers"},
                    {"$match": {"answers.questionIndex": i}},
                    {"$group": {"_id": "$answers.answer", "count": {"$sum": 1}}},
                ]
            opt_results = await db.survey_responses.aggregate(opt_pipeline).to_list(100)
            for r in opt_results:
                if r["_id"] in option_counts:
                    option_counts[r["_id"]] = r["count"]
            q_stat["optionCounts"] = option_counts

        elif q["type"] == "STAR_RATING":
            rating_pipeline = [
                {"$match": {"surveyId": survey_id}},
                {"$unwind": "$answers"},
                {"$match": {"answers.questionIndex": i}},
                {"$group": {
                    "_id": None,
                    "count": {"$sum": 1},
                    "avg": {"$avg": {"$toInt": "$answers.answer"}},
                }},
            ]
            rating_result = await db.survey_responses.aggregate(rating_pipeline).to_list(1)
            if rating_result:
                q_stat["totalAnswers"] = rating_result[0]["count"]
                q_stat["averageRating"] = round(rating_result[0]["avg"] or 0, 1)
            else:
                q_stat["averageRating"] = 0

            # Rating distribution
            dist_pipeline = [
                {"$match": {"surveyId": survey_id}},
                {"$unwind": "$answers"},
                {"$match": {"answers.questionIndex": i}},
                {"$group": {"_id": {"$toInt": "$answers.answer"}, "count": {"$sum": 1}}},
            ]
            dist_results = await db.survey_responses.aggregate(dist_pipeline).to_list(10)
            distribution = {str(r): 0 for r in range(1, 6)}
            for d in dist_results:
                distribution[str(d["_id"])] = d["count"]
            q_stat["ratingDistribution"] = distribution

        elif q["type"] == "OPEN_TEXT":
            text_pipeline = [
                {"$match": {"surveyId": survey_id}},
                {"$unwind": "$answers"},
                {"$match": {"answers.questionIndex": i, "answers.answer": {"$ne": None, "$ne": ""}}},
                {"$project": {
                    "text": "$answers.answer",
                    "userName": 1,
                    "department": 1,
                }},
                {"$limit": 500},
            ]
            text_results = await db.survey_responses.aggregate(text_pipeline).to_list(500)
            q_stat["totalAnswers"] = len(text_results)
            q_stat["textResponses"] = [{
                "text": t.get("text"),
                "userName": t.get("userName"),
                "department": t.get("department"),
            } for t in text_results]

        question_stats.append(q_stat)

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


# notify_new_survey moved to survey_service.py
