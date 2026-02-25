from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
from app.core.database import db
from app.core.security import get_current_user

router = APIRouter()

@router.get("")
async def get_analytics(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "SUPER_ADMIN":
        raise HTTPException(status_code=403, detail="Chỉ Super Admin mới xem được thống kê")
    
    # 1. User stats
    total_users = await db.users.count_documents({})
    active_users = await db.users.count_documents({"status": "active"})
    
    # 2. Activity stats
    total_activities = await db.activities.count_documents({})
    activities = await db.activities.find({}).to_list(1000)
    total_registrations = sum(len(a.get("registrations", [])) for a in activities)
    total_checkins = sum(len(a.get("attendances", [])) for a in activities)
    
    # 3. Post stats
    total_posts = await db.posts.count_documents({})
    
    # 4. Feedback stats
    feedbacks = await db.feedback.find({}).to_list(1000)
    total_feedbacks = len(feedbacks)
    resolved_feedbacks = len([f for f in feedbacks if f.get("status") in ["RESOLVED", "CLOSED"]])
    pending_feedbacks = total_feedbacks - resolved_feedbacks
    
    # 5. Posts by Category for Chart
    pipeline_posts = [
        {"$group": {"_id": "$category", "count": {"$sum": 1}}}
    ]
    posts_by_category_cursor = db.posts.aggregate(pipeline_posts)
    posts_by_category = [{"name": doc["_id"], "count": doc["count"]} async for doc in posts_by_category_cursor]
    
    # 6. Users by Department for Chart
    pipeline_users = [
        {"$group": {"_id": "$department", "count": {"$sum": 1}}}
    ]
    users_by_dept_cursor = db.users.aggregate(pipeline_users)
    users_by_dept = [{"name": doc["_id"], "count": doc["count"]} async for doc in users_by_dept_cursor]

    return {
        "summary": {
            "totalUsers": total_users,
            "activeUsers": active_users,
            "totalActivities": total_activities,
            "totalRegistrations": total_registrations,
            "totalCheckins": total_checkins,
            "totalPosts": total_posts,
            "totalFeedbacks": total_feedbacks,
            "resolvedFeedbacks": resolved_feedbacks,
            "pendingFeedbacks": pending_feedbacks
        },
        "charts": {
            "postsByCategory": posts_by_category,
            "usersByDepartment": users_by_dept
        }
    }
