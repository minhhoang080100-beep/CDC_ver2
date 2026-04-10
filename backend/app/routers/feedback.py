from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks

from datetime import datetime, timezone
from bson import ObjectId
from app.core.database import db
from app.core.security import get_current_user, validate_object_id
from app.models.feedback import FeedbackCreate, FeedbackReply, FeedbackStatusUpdate
from app.routers.websocket import manager
from app.core.push import send_bulk_push_notifications_async

router = APIRouter()

@router.get("")
async def get_feedback(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    mine: bool = Query(False, description="If true, only return feedback sent by the current user"),
    current_user: dict = Depends(get_current_user)
):
    if mine:
        # User-facing: only show their own sent feedback
        query = {"senderId": current_user["_id"]}
    elif current_user["role"] == "SUPER_ADMIN":
        query = {}
    elif current_user["role"].startswith("BCH_"):
        query = {"targetRecipients": current_user["_id"]}
    else:
        query = {"senderId": current_user["_id"]}

    total = await db.feedback.count_documents(query)
    feedback_list = await db.feedback.find(query).sort("createdAt", -1).skip(skip).limit(limit).to_list(limit)

    items = []
    for fb in feedback_list:
        is_mine = fb.get("senderId") == current_user["_id"]
        is_anon = fb.get("isAnonymous", False)
        
        items.append({
            "id": str(fb["_id"]),
            "subject": fb["subject"],
            "content": fb["content"],
            "senderId": fb.get("senderId") if not is_anon or is_mine else None,
            "senderName": fb.get("senderName") if not is_anon or is_mine else "Người dùng ẩn danh",
            "senderDepartment": fb.get("senderDepartment") if not is_anon or is_mine else None,
            "isAnonymous": is_anon,
            "status": fb.get("status", "PENDING"),
            "targetRecipients": fb.get("targetRecipients", []),
            "replies": fb.get("replies", []),
            "attachedFiles": fb.get("attachedFiles", []),
            "createdAt": fb["createdAt"]
        })

    return {"items": items, "total": total, "hasMore": skip + limit < total}

@router.get("/dump")
async def dump_feedbacks():
    items = await db.feedback.find({}).to_list(100)
    for i in items:
        i["_id"] = str(i["_id"])
        if "createdAt" in i:
            i["createdAt"] = str(i["createdAt"])
    return items

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
        "senderId": current_user["_id"],
        "senderName": current_user["fullName"],
        "senderDepartment": current_user["department"],
        "isAnonymous": feedback.isAnonymous,
        "status": "PENDING",
        "targetRecipients": target_recipients,
        "replies": [],
        "attachedFiles": feedback.attachedFiles or [],
        "createdAt": datetime.now(timezone.utc)
    }
    
    result = await db.feedback.insert_one(feedback_data)

    # WebSocket broadcast to BCH recipients
    await manager.broadcast(
        {"type": "new_feedback", "title": f"Góp ý mới: {feedback.subject}", "data": {"feedbackId": str(result.inserted_id)}}
    )
    
    return {
        "id": str(result.inserted_id),
        "message": "Feedback submitted successfully"
    }

@router.post("/{feedback_id}/reply")
async def reply_feedback(
    feedback_id: str, 
    reply: FeedbackReply, 
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    if not (current_user["role"] == "SUPER_ADMIN" or current_user["role"].startswith("BCH_")):
        raise HTTPException(status_code=403, detail="You don't have permission to reply")
    
    oid = validate_object_id(feedback_id, "Feedback ID")
    feedback_doc = await db.feedback.find_one({"_id": oid})
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
    
    update_ops = {
        "$push": {"replies": reply_data}
    }
    
    if feedback_doc.get("status") not in ["RESOLVED", "CLOSED"]:
        update_ops["$set"] = {"status": "REPLIED"}
        
    await db.feedback.update_one(
        {"_id": oid},
        update_ops
    )
    
    sender_id = feedback_doc.get("senderId")
    if sender_id:
        title = f"Phản hồi ý kiến: {feedback_doc.get('subject', '')}"
        body = reply.content
        # 1. DB Notification
        notif_doc = {
            "userId": str(sender_id),
            "type": "feedback",
            "title": title,
            "body": body,
            "data": {"feedbackId": feedback_id},
            "read": False,
            "createdAt": datetime.now(timezone.utc)
        }
        await db.notifications.insert_one(notif_doc)

        # 2. WebSocket
        background_tasks.add_task(
            manager.send_to_user,
            str(sender_id),
            {"type": "new_feedback", "title": title, "data": {"feedbackId": feedback_id}}
        )

        # 3. Push Notification
        sender_user = await db.users.find_one({"_id": ObjectId(sender_id)})
        if sender_user and sender_user.get("pushToken"):
            background_tasks.add_task(
                send_bulk_push_notifications_async,
                tokens=[sender_user["pushToken"]],
                title=title,
                body=body,
                data={"feedbackId": feedback_id}
            )
    
    return {"status": "success", "message": "Reply added"}

@router.put("/{feedback_id}/status")
async def update_feedback_status(feedback_id: str, status_update: FeedbackStatusUpdate, current_user: dict = Depends(get_current_user)):
    if not (current_user["role"] == "SUPER_ADMIN" or current_user["role"].startswith("BCH_")):
        raise HTTPException(status_code=403, detail="You don't have permission to update status")
    
    oid = validate_object_id(feedback_id, "Feedback ID")
    feedback_doc = await db.feedback.find_one({"_id": oid})
    if not feedback_doc:
        raise HTTPException(status_code=404, detail="Feedback not found")
        
    if current_user["role"] != "SUPER_ADMIN" and current_user["_id"] not in feedback_doc["targetRecipients"]:
        raise HTTPException(status_code=403, detail="You don't have permission to modify this feedback")
        
    valid_statuses = ["PENDING", "IN_PROGRESS", "REPLIED", "RESOLVED", "CLOSED"]
    if status_update.status not in valid_statuses:
        raise HTTPException(status_code=400, detail="Invalid status")
        
    await db.feedback.update_one(
        {"_id": oid},
        {"$set": {"status": status_update.status}}
    )
    
    return {"status": "success", "message": "Status updated successfully"}
