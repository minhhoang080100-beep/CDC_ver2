from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List
from datetime import datetime, timezone
from bson import ObjectId
from app.core.database import db
from app.core.security import get_current_user
from app.models.feedback import FeedbackCreate, FeedbackReply, FeedbackStatusUpdate

router = APIRouter()

@router.get("")
async def get_feedback(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] == "SUPER_ADMIN":
        query = {}
    elif current_user["role"].startswith("BCH_"):
        query = {"targetRecipients": current_user["_id"]}
    else:
        query = {"senderId": current_user["_id"]}

    total = await db.feedback.count_documents(query)
    feedback_list = await db.feedback.find(query).sort("createdAt", -1).skip(skip).limit(limit).to_list(limit)

    items = [{
        "id": str(fb["_id"]),
        "subject": fb["subject"],
        "content": fb["content"],
        "senderId": fb.get("senderId"),
        "senderName": fb.get("senderName"),
        "senderDepartment": fb.get("senderDepartment"),
        "isAnonymous": fb["isAnonymous"],
        "status": fb["status"],
        "targetRecipients": fb["targetRecipients"],
        "replies": fb.get("replies", []),
        "createdAt": fb["createdAt"]
    } for fb in feedback_list]

    return {"items": items, "total": total, "hasMore": skip + limit < total}

@router.post("")
async def create_feedback(feedback: FeedbackCreate, current_user: dict = Depends(get_current_user)):
    target_recipients = []
    
    if current_user["department"] == "VAN_PHONG_CANG":
        bch_users = await db.users.find({"role": "BCH_VANPHONG"}).to_list(100)
        target_recipients = [str(u["_id"]) for u in bch_users]
    elif current_user["department"] == "CUA_LO":
        bch_users = await db.users.find({
            "role": {"$in": ["BCH_CUALO", "BCH_VANPHONG"]}
        }).to_list(100)
        target_recipients = [str(u["_id"]) for u in bch_users]
    elif current_user["department"] == "BEN_THUY":
        bch_users = await db.users.find({
            "role": {"$in": ["BCH_BENTHUY", "BCH_VANPHONG"]}
        }).to_list(100)
        target_recipients = [str(u["_id"]) for u in bch_users]
    
    feedback_data = {
        "subject": feedback.subject,
        "content": feedback.content,
        "senderId": None if feedback.isAnonymous else current_user["_id"],
        "senderName": None if feedback.isAnonymous else current_user["fullName"],
        "senderDepartment": None if feedback.isAnonymous else current_user["department"],
        "isAnonymous": feedback.isAnonymous,
        "status": "PENDING",
        "targetRecipients": target_recipients,
        "replies": [],
        "createdAt": datetime.now(timezone.utc)
    }
    
    result = await db.feedback.insert_one(feedback_data)
    
    return {
        "id": str(result.inserted_id),
        "message": "Feedback submitted successfully"
    }

@router.post("/{feedback_id}/reply")
async def reply_feedback(feedback_id: str, reply: FeedbackReply, current_user: dict = Depends(get_current_user)):
    if not (current_user["role"] == "SUPER_ADMIN" or current_user["role"].startswith("BCH_")):
        raise HTTPException(status_code=403, detail="You don't have permission to reply")
    
    feedback_doc = await db.feedback.find_one({"_id": ObjectId(feedback_id)})
    if not feedback_doc:
        raise HTTPException(status_code=404, detail="Feedback not found")
    
    if current_user["role"] != "SUPER_ADMIN" and current_user["_id"] not in feedback_doc["targetRecipients"]:
        raise HTTPException(status_code=403, detail="You don't have permission to reply to this feedback")
    
    reply_data = {
        "userId": current_user["_id"],
        "userName": current_user["fullName"],
        "content": reply.content,
        "repliedAt": datetime.now(timezone.utc)
    }
    
    await db.feedback.update_one(
        {"_id": ObjectId(feedback_id)},
        {
            "$push": {"replies": reply_data},
            "$set": {"status": "REPLIED"}
        }
    )
    
    return {"status": "success", "message": "Reply added"}

@router.put("/{feedback_id}/status")
async def update_feedback_status(feedback_id: str, status_update: FeedbackStatusUpdate, current_user: dict = Depends(get_current_user)):
    if not (current_user["role"] == "SUPER_ADMIN" or current_user["role"].startswith("BCH_")):
        raise HTTPException(status_code=403, detail="You don't have permission to update status")
    
    feedback_doc = await db.feedback.find_one({"_id": ObjectId(feedback_id)})
    if not feedback_doc:
        raise HTTPException(status_code=404, detail="Feedback not found")
        
    if current_user["role"] != "SUPER_ADMIN" and current_user["_id"] not in feedback_doc["targetRecipients"]:
        raise HTTPException(status_code=403, detail="You don't have permission to modify this feedback")
        
    valid_statuses = ["PENDING", "IN_PROGRESS", "REPLIED", "RESOLVED", "CLOSED"]
    if status_update.status not in valid_statuses:
        raise HTTPException(status_code=400, detail="Invalid status")
        
    await db.feedback.update_one(
        {"_id": ObjectId(feedback_id)},
        {"$set": {"status": status_update.status}}
    )
    
    return {"status": "success", "message": "Status updated successfully"}
