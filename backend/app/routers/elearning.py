from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from bson import ObjectId
from app.core.database import db
from app.core.security import get_current_user
from app.core.permissions import resolve_target_departments
from app.core.push import send_bulk_push_notifications
from app.models.elearning import (
    CourseCreate, CourseUpdate, QuizCreate, QuizUpdate, QuizSubmission
)

router = APIRouter()


# ═══════════════════════════════════════════════════════════
#  COURSES
# ═══════════════════════════════════════════════════════════

@router.get("")
async def list_courses(
    skip: int = 0,
    limit: int = 50,
    status: str = None,
    category: str = None,
    current_user=Depends(get_current_user)
):
    query = {}
    if status:
        query["status"] = status
    if category:
        query["category"] = category

    total = await db.courses.count_documents(query)

    # Aggregation pipeline to avoid N+1 queries
    pipeline = [
        {"$match": query},
        {"$sort": {"createdAt": -1}},
        {"$skip": skip},
        {"$limit": limit},
        {"$addFields": {
            "courseIdStr": {"$toString": "$_id"},
            "lessonCount": {"$size": {"$ifNull": ["$lessons", []]}}
        }},
        # Lookup quiz count
        {"$lookup": {
            "from": "quizzes",
            "let": {"cid": "$courseIdStr"},
            "pipeline": [
                {"$match": {"$expr": {"$eq": ["$courseId", "$$cid"]}}},
                {"$count": "count"}
            ],
            "as": "quizStats"
        }},
        # Lookup enrollment count
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


@router.get("/my-courses")
async def get_my_courses(current_user=Depends(get_current_user)):
    """Get courses assigned to or enrolled by user"""
    user_id = str(current_user["_id"])
    user_dept = current_user.get("department", "")

    # Find all published courses the user can access
    courses_query = {"status": "PUBLISHED"}
    cursor = db.courses.find(courses_query).sort("createdAt", -1)

    my_courses = []
    async for c in cursor:
        cid = str(c["_id"])
        target_depts = c.get("targetDepartments", [])

        # Check if course is for user's department or open to all
        if target_depts and "ALL" not in target_depts and user_dept not in target_depts:
            continue

        # Get enrollment status
        enrollment = await db.enrollments.find_one({"courseId": cid, "userId": user_id})
        lessons = c.get("lessons", [])
        completed_lessons = enrollment.get("completedLessons", []) if enrollment else []
        quiz_result = enrollment.get("quizResult") if enrollment else None

        progress = 0
        if lessons:
            progress = int(len(completed_lessons) / len(lessons) * 100)

        quiz = await db.quizzes.find_one({"courseId": cid})

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
            "hasQuiz": quiz is not None,
            "quizResult": quiz_result,
            "enrolled": enrollment is not None,
        })

    return my_courses


@router.get("/{course_id}")
async def get_course(course_id: str, current_user=Depends(get_current_user)):
    course = await db.courses.find_one({"_id": ObjectId(course_id)})
    if not course:
        raise HTTPException(404, "Khóa học không tồn tại")

    lessons = course.get("lessons", [])
    quizzes = []
    cursor = db.quizzes.find({"courseId": course_id})
    async for q in cursor:
        quizzes.append({
            "id": str(q["_id"]),
            "title": q.get("title"),
            "questionCount": len(q.get("questions", [])),
            "timeLimit": q.get("timeLimit"),
            "passingScore": q.get("passingScore", 70),
        })

    return {
        "id": str(course["_id"]),
        "title": course.get("title"),
        "description": course.get("description"),
        "category": course.get("category"),
        "courseType": course.get("courseType"),
        "status": course.get("status"),
        "targetDepartments": course.get("targetDepartments", []),
        "creatorName": course.get("creatorName"),
        "createdAt": course.get("createdAt"),
        "lessons": [{
            "title": l.get("title"),
            "type": l.get("type"),
            "url": l.get("url"),
            "content": l.get("content"),
            "duration": l.get("duration"),
        } for l in lessons],
        "quizzes": quizzes,
    }


@router.post("")
async def create_course(data: CourseCreate, current_user=Depends(get_current_user)):
    if current_user["role"] not in ["SUPER_ADMIN"] and not current_user["role"].startswith("BCH_"):
        raise HTTPException(403, "Không có quyền tạo khóa học")

    course = {
        "title": data.title,
        "description": data.description,
        "category": data.category,
        "courseType": data.courseType.value if data.courseType else "OPTIONAL",
        "targetDepartments": data.targetDepartments,
        "lessons": [l.dict() for l in data.lessons],
        "status": "PUBLISHED",
        "createdBy": str(current_user["_id"]),
        "creatorName": current_user.get("fullName", ""),
        "createdAt": datetime.now(timezone.utc),
    }
    result = await db.courses.insert_one(course)
    return {"id": str(result.inserted_id), "message": "Tạo khóa học thành công"}


@router.put("/{course_id}")
async def update_course(course_id: str, data: CourseUpdate, current_user=Depends(get_current_user)):
    if current_user["role"] not in ["SUPER_ADMIN"] and not current_user["role"].startswith("BCH_"):
        raise HTTPException(403, "Không có quyền chỉnh sửa")

    update_data = {}
    for k, v in data.dict(exclude_unset=True).items():
        if v is not None:
            if k == "lessons":
                update_data[k] = [l if isinstance(l, dict) else l.dict() for l in v]
            elif hasattr(v, "value"):
                update_data[k] = v.value
            else:
                update_data[k] = v

    if update_data:
        update_data["updatedAt"] = datetime.now(timezone.utc)
        await db.courses.update_one({"_id": ObjectId(course_id)}, {"$set": update_data})
    return {"message": "Cập nhật thành công"}


@router.delete("/{course_id}")
async def delete_course(course_id: str, current_user=Depends(get_current_user)):
    if current_user["role"] not in ["SUPER_ADMIN"] and not current_user["role"].startswith("BCH_"):
        raise HTTPException(403, "Không có quyền xóa")

    await db.courses.delete_one({"_id": ObjectId(course_id)})
    await db.quizzes.delete_many({"courseId": course_id})
    await db.enrollments.delete_many({"courseId": course_id})
    return {"message": "Đã xóa khóa học"}


# ═══════════════════════════════════════════════════════════
#  ENROLLMENT & PROGRESS
# ═══════════════════════════════════════════════════════════

@router.post("/{course_id}/enroll")
async def enroll_course(course_id: str, current_user=Depends(get_current_user)):
    user_id = str(current_user["_id"])
    existing = await db.enrollments.find_one({"courseId": course_id, "userId": user_id})
    if existing:
        return {"message": "Đã đăng ký rồi"}

    enrollment = {
        "courseId": course_id,
        "userId": user_id,
        "userName": current_user.get("fullName", ""),
        "department": current_user.get("department", ""),
        "completedLessons": [],
        "quizResult": None,
        "enrolledAt": datetime.now(timezone.utc),
    }
    await db.enrollments.insert_one(enrollment)
    return {"message": "Đăng ký khóa học thành công"}


@router.post("/{course_id}/complete-lesson")
async def complete_lesson(course_id: str, lessonIndex: int, current_user=Depends(get_current_user)):
    user_id = str(current_user["_id"])

    # Auto-enroll if not yet
    existing = await db.enrollments.find_one({"courseId": course_id, "userId": user_id})
    if not existing:
        enrollment = {
            "courseId": course_id,
            "userId": user_id,
            "userName": current_user.get("fullName", ""),
            "department": current_user.get("department", ""),
            "completedLessons": [lessonIndex],
            "quizResult": None,
            "enrolledAt": datetime.now(timezone.utc),
        }
        await db.enrollments.insert_one(enrollment)
    else:
        completed = existing.get("completedLessons", [])
        if lessonIndex not in completed:
            completed.append(lessonIndex)
            await db.enrollments.update_one(
                {"_id": existing["_id"]},
                {"$set": {"completedLessons": completed}}
            )

    return {"message": "Đã hoàn thành bài học"}


# ═══════════════════════════════════════════════════════════
#  QUIZZES
# ═══════════════════════════════════════════════════════════

@router.post("/quizzes")
async def create_quiz(data: QuizCreate, current_user=Depends(get_current_user)):
    if current_user["role"] not in ["SUPER_ADMIN"] and not current_user["role"].startswith("BCH_"):
        raise HTTPException(403, "Không có quyền tạo đề thi")

    quiz = {
        "courseId": data.courseId,
        "title": data.title,
        "description": data.description,
        "questions": [q.dict() for q in data.questions],
        "timeLimit": data.timeLimit,
        "passingScore": data.passingScore,
        "createdBy": str(current_user["_id"]),
        "createdAt": datetime.now(timezone.utc),
    }
    result = await db.quizzes.insert_one(quiz)
    return {"id": str(result.inserted_id), "message": "Tạo đề thi thành công"}


@router.get("/quizzes/{quiz_id}")
async def get_quiz(quiz_id: str, current_user=Depends(get_current_user)):
    quiz = await db.quizzes.find_one({"_id": ObjectId(quiz_id)})
    if not quiz:
        raise HTTPException(404, "Đề thi không tồn tại")

    # For users: hide correct answers
    is_admin = current_user["role"] in ["SUPER_ADMIN"] or current_user["role"].startswith("BCH_")
    questions = []
    for q in quiz.get("questions", []):
        question = {
            "content": q.get("content"),
            "type": q.get("type"),
            "options": q.get("options", []),
        }
        if is_admin:
            question["correctAnswer"] = q.get("correctAnswer", 0)
        questions.append(question)

    return {
        "id": str(quiz["_id"]),
        "courseId": quiz.get("courseId"),
        "title": quiz.get("title"),
        "description": quiz.get("description"),
        "questions": questions,
        "timeLimit": quiz.get("timeLimit"),
        "passingScore": quiz.get("passingScore", 70),
    }


@router.get("/quizzes/by-course/{course_id}")
async def get_quiz_by_course(course_id: str, current_user=Depends(get_current_user)):
    quiz = await db.quizzes.find_one({"courseId": course_id})
    if not quiz:
        raise HTTPException(404, "Chưa có đề thi cho khóa học này")

    is_admin = current_user["role"] in ["SUPER_ADMIN"] or current_user["role"].startswith("BCH_")
    questions = []
    for q in quiz.get("questions", []):
        question = {
            "content": q.get("content"),
            "type": q.get("type"),
            "options": q.get("options", []),
        }
        if is_admin:
            question["correctAnswer"] = q.get("correctAnswer", 0)
        questions.append(question)

    return {
        "id": str(quiz["_id"]),
        "courseId": quiz.get("courseId"),
        "title": quiz.get("title"),
        "description": quiz.get("description"),
        "questions": questions,
        "timeLimit": quiz.get("timeLimit"),
        "passingScore": quiz.get("passingScore", 70),
    }


@router.post("/quizzes/{quiz_id}/submit")
async def submit_quiz(quiz_id: str, data: QuizSubmission, current_user=Depends(get_current_user)):
    quiz = await db.quizzes.find_one({"_id": ObjectId(quiz_id)})
    if not quiz:
        raise HTTPException(404, "Đề thi không tồn tại")

    questions = quiz.get("questions", [])
    if len(data.answers) != len(questions):
        raise HTTPException(400, "Số câu trả lời không khớp")

    # Grade
    correct = 0
    for i, q in enumerate(questions):
        if data.answers[i] == q.get("correctAnswer", 0):
            correct += 1

    total = len(questions)
    score = int(correct / total * 100) if total > 0 else 0
    passed = score >= quiz.get("passingScore", 70)

    # Save result to enrollment
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


@router.delete("/quizzes/{quiz_id}")
async def delete_quiz(quiz_id: str, current_user=Depends(get_current_user)):
    if current_user["role"] not in ["SUPER_ADMIN"] and not current_user["role"].startswith("BCH_"):
        raise HTTPException(403, "Không có quyền xóa")
    await db.quizzes.delete_one({"_id": ObjectId(quiz_id)})
    return {"message": "Đã xóa đề thi"}


# ═══════════════════════════════════════════════════════════
#  STATS (Admin)
# ═══════════════════════════════════════════════════════════

@router.get("/{course_id}/stats")
async def get_course_stats(course_id: str, current_user=Depends(get_current_user)):
    if current_user["role"] not in ["SUPER_ADMIN"] and not current_user["role"].startswith("BCH_"):
        raise HTTPException(403, "Không có quyền xem thống kê")

    course = await db.courses.find_one({"_id": ObjectId(course_id)})
    if not course:
        raise HTTPException(404, "Khóa học không tồn tại")

    total_enrolled = await db.enrollments.count_documents({"courseId": course_id})
    lesson_count = len(course.get("lessons", []))

    # Get all enrollments
    enrollments = []
    cursor = db.enrollments.find({"courseId": course_id})
    completed_count = 0
    quiz_passed = 0
    quiz_taken = 0
    total_score = 0

    async for e in cursor:
        completed_lessons = e.get("completedLessons", [])
        progress = int(len(completed_lessons) / lesson_count * 100) if lesson_count > 0 else 0
        if progress == 100:
            completed_count += 1

        qr = e.get("quizResult")
        if qr:
            quiz_taken += 1
            total_score += qr.get("score", 0)
            if qr.get("passed"):
                quiz_passed += 1

        enrollments.append({
            "userName": e.get("userName"),
            "department": e.get("department"),
            "progress": progress,
            "completedLessons": len(completed_lessons),
            "quizResult": qr,
        })

    return {
        "title": course.get("title"),
        "totalEnrolled": total_enrolled,
        "completedCount": completed_count,
        "lessonCount": lesson_count,
        "quizTaken": quiz_taken,
        "quizPassed": quiz_passed,
        "averageScore": int(total_score / quiz_taken) if quiz_taken > 0 else 0,
        "enrollments": enrollments,
    }
