"""
Elearning service — business logic extracted from elearning router.
"""

from datetime import datetime, timezone
from bson import ObjectId
from fastapi import HTTPException

from app.core.database import db
from app.core.permissions import require_admin, is_admin


async def list_courses(skip: int, limit: int, status, category, current_user: dict):
    query: dict = {"isDeleted": {"$ne": True}}
    if status:
        query["status"] = status
    if category:
        query["category"] = category

    total = await db.courses.count_documents(query)

    pipeline = [
        {"$match": query},
        {"$sort": {"createdAt": -1}},
        {"$skip": skip},
        {"$limit": limit},
        {"$addFields": {
            "courseIdStr": {"$toString": "$_id"},
            "lessonCount": {"$size": {"$ifNull": ["$lessons", []]}}
        }},
        {"$lookup": {
            "from": "quizzes",
            "let": {"cid": "$courseIdStr"},
            "pipeline": [
                {"$match": {"$expr": {"$eq": ["$courseId", "$$cid"]}}},
                {"$count": "count"}
            ],
            "as": "quizStats"
        }},
        {"$lookup": {
            "from": "enrollments",
            "let": {"cid": "$courseIdStr"},
            "pipeline": [
                {"$match": {"$expr": {"$eq": ["$courseId", "$$cid"]}}},
                {"$count": "count"}
            ],
            "as": "enrollStats"
        }},
        {"$addFields": {
            "quizCount": {"$ifNull": [{"$arrayElemAt": ["$quizStats.count", 0]}, 0]},
            "enrollmentCount": {"$ifNull": [{"$arrayElemAt": ["$enrollStats.count", 0]}, 0]},
        }},
        {"$project": {"quizStats": 0, "enrollStats": 0, "courseIdStr": 0, "lessons": 0}}
    ]

    courses = await db.courses.aggregate(pipeline).to_list(limit)

    items = []
    for c in courses:
        items.append({
            "id": str(c["_id"]),
            "title": c.get("title", ""),
            "description": c.get("description"),
            "category": c.get("category"),
            "courseType": c.get("courseType", "OPTIONAL"),
            "status": c.get("status", "DRAFT"),
            "targetDepartments": c.get("targetDepartments", []),
            "lessonCount": c.get("lessonCount", 0),
            "quizCount": c.get("quizCount", 0),
            "enrollmentCount": c.get("enrollmentCount", 0),
            "creatorName": c.get("creatorName"),
            "createdAt": c.get("createdAt", ""),
        })
    return {"items": items, "total": total, "hasMore": skip + limit < total}


async def create_course(data: dict, current_user: dict):
    require_admin(current_user, "Không có quyền tạo khóa học")

    course = {
        "title": data["title"],
        "description": data.get("description"),
        "category": data.get("category"),
        "courseType": data.get("courseType", "OPTIONAL"),
        "targetDepartments": data.get("targetDepartments", []),
        "lessons": data.get("lessons", []),
        "status": "PUBLISHED",
        "isDeleted": False,
        "createdBy": str(current_user["_id"]),
        "creatorName": current_user.get("fullName", ""),
        "createdAt": datetime.now(timezone.utc),
    }
    result = await db.courses.insert_one(course)
    return {"id": str(result.inserted_id), "message": "Tạo khóa học thành công"}


async def delete_course(course_id: str, current_user: dict):
    require_admin(current_user, "Không có quyền xóa")

    existing_course = await db.courses.find_one({
        "_id": ObjectId(course_id),
        "isDeleted": {"$ne": True}
    })
    if not existing_course:
        raise HTTPException(status_code=404, detail="Khóa học không tồn tại")

    # Collect Cloudinary URLs for cleanup
    urls_to_delete = []
    for l in existing_course.get("lessons", []):
        url = l.get("url")
        if url and "cloudinary.com" in url:
            urls_to_delete.append(url)

    # Soft delete course
    await db.courses.update_one(
        {"_id": ObjectId(course_id)},
        {"$set": {"isDeleted": True, "deletedAt": datetime.now(timezone.utc)}}
    )

    return urls_to_delete


async def get_my_courses(current_user: dict):
    user_id = str(current_user["_id"])
    user_dept = current_user.get("department", "")

    courses = await db.courses.find({
        "status": "PUBLISHED",
        "isDeleted": {"$ne": True}
    }).sort("createdAt", -1).to_list(500)

    if not courses:
        return []

    course_ids = [str(c["_id"]) for c in courses]

    enrollment_cursor = db.enrollments.find({"userId": user_id, "courseId": {"$in": course_ids}})
    enrollments_list = await enrollment_cursor.to_list(500)
    enrollment_map = {e["courseId"]: e for e in enrollments_list}

    quiz_cursor = db.quizzes.find({"courseId": {"$in": course_ids}}, {"courseId": 1})
    quizzes_list = await quiz_cursor.to_list(500)
    quiz_set = {q["courseId"] for q in quizzes_list}

    my_courses = []
    for c in courses:
        cid = str(c["_id"])
        target_depts = c.get("targetDepartments", [])

        if target_depts and "ALL" not in target_depts and user_dept not in target_depts:
            continue

        enrollment = enrollment_map.get(cid)
        lessons = c.get("lessons", [])
        completed_lessons = enrollment.get("completedLessons", []) if enrollment else []
        quiz_result = enrollment.get("quizResult") if enrollment else None

        progress = 0
        if lessons:
            progress = int(len(completed_lessons) / len(lessons) * 100)

        my_courses.append({
            "id": cid,
            "title": c.get("title"),
            "description": c.get("description"),
            "category": c.get("category"),
            "courseType": c.get("courseType", "OPTIONAL"),
            "lessons": [{
                "title": l.get("title"),
                "type": l.get("type"),
                "url": l.get("url"),
                "content": l.get("content"),
                "duration": l.get("duration"),
            } for l in lessons],
            "progress": progress,
            "completedLessons": completed_lessons,
            "hasQuiz": cid in quiz_set,
            "quizResult": quiz_result,
            "enrolled": enrollment is not None,
        })

    return my_courses


async def submit_quiz(quiz_id: str, answers: list, current_user: dict):
    quiz = await db.quizzes.find_one({"_id": ObjectId(quiz_id)})
    if not quiz:
        raise HTTPException(404, "Đề thi không tồn tại")

    questions = quiz.get("questions", [])
    if len(answers) != len(questions):
        raise HTTPException(400, "Số câu trả lời không khớp")

    correct = 0
    for i, q in enumerate(questions):
        if answers[i] == q.get("correctAnswer", 0):
            correct += 1

    total = len(questions)
    score = int(correct / total * 100) if total > 0 else 0
    passed = score >= quiz.get("passingScore", 70)

    course_id = quiz.get("courseId")
    user_id = str(current_user["_id"])

    quiz_result = {
        "quizId": quiz_id,
        "score": score,
        "correct": correct,
        "total": total,
        "passed": passed,
        "submittedAt": datetime.now(timezone.utc),
    }

    enrollment = await db.enrollments.find_one({"courseId": course_id, "userId": user_id})
    if enrollment:
        await db.enrollments.update_one(
            {"_id": enrollment["_id"]},
            {"$set": {"quizResult": quiz_result}}
        )
    else:
        await db.enrollments.insert_one({
            "courseId": course_id,
            "userId": user_id,
            "userName": current_user.get("fullName", ""),
            "department": current_user.get("department", ""),
            "completedLessons": [],
            "quizResult": quiz_result,
            "enrolledAt": datetime.now(timezone.utc),
        })

    return {
        "score": score,
        "correct": correct,
        "total": total,
        "passed": passed,
        "passingScore": quiz.get("passingScore", 70),
        "message": "Chúc mừng! Bạn đã đạt!" if passed else "Chưa đạt. Hãy thử lại!",
    }
