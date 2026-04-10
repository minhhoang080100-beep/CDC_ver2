from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks
from typing import Optional
from datetime import datetime, timezone
from bson import ObjectId
from app.core.database import db
from app.core.security import get_current_user, validate_object_id
from app.core.permissions import build_content_filter, resolve_target_departments, can_manage_content
from app.models.post import PostCreate, PostCommentCreate
from app.core.cloudinary_utils import delete_cloudinary_asset
from app.services.post_service import (
    get_posts as svc_get_posts,
    create_post as svc_create_post,
    update_post as svc_update_post,
    delete_post as svc_delete_post,
    toggle_like as svc_toggle_like,
    notify_new_post,
)
from app.routers.websocket import manager

router = APIRouter()

@router.get("")
async def get_posts(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    cursor: Optional[datetime] = Query(None, description="Cursor for pagination (ISO datetime string)"),
    current_user: dict = Depends(get_current_user)
):
    return await svc_get_posts(skip, limit, cursor, current_user)

@router.post("")
async def create_post(post: PostCreate, background_tasks: BackgroundTasks, current_user: dict = Depends(get_current_user)):
    post_data, target_departments = await svc_create_post(post.model_dump(), current_user)

    post_id = str(post_data["_id"])

    # Push notification (async background)
    background_tasks.add_task(
        notify_new_post,
        title=f"Bản tin: {post.title}",
        body=post.summary,
        target_departments=target_departments,
        post_id=post_id
    )

    # WebSocket broadcast (real-time)
    background_tasks.add_task(
        manager.broadcast,
        {"type": "new_post", "title": f"Bản tin mới: {post.title}", "data": {"postId": post_id}}
    )

    return {
        "id": post_id,
        **{k: v for k, v in post_data.items() if k != "_id"}
    }

@router.put("/{post_id}")
async def update_post(
    post_id: str, 
    post: PostCreate, 
    background_tasks: BackgroundTasks,
    notify_update: bool = Query(False),
    current_user: dict = Depends(get_current_user)
):
    result, images_to_delete = await svc_update_post(post_id, post.model_dump(), current_user)

    if images_to_delete:
        for img in images_to_delete:
            background_tasks.add_task(delete_cloudinary_asset, img)

    if notify_update:
        target_departments = resolve_target_departments(current_user, post.targetDepartments)
        background_tasks.add_task(
            notify_new_post,
            title=f"[Cập nhật] {post.title}",
            body=post.summary,
            target_departments=target_departments,
            post_id=post_id
        )
        background_tasks.add_task(
            manager.broadcast,
            {"type": "new_post", "title": f"[Cập nhật] {post.title}", "data": {"postId": post_id}}
        )

    return result

@router.delete("/{post_id}")
async def delete_post(
    post_id: str, 
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    images = await svc_delete_post(post_id, current_user)

    if images:
        for img in images:
            background_tasks.add_task(delete_cloudinary_asset, img)

    return {"status": "success", "message": "Post deleted"}

@router.post("/{post_id}/like")
async def toggle_like(post_id: str, current_user: dict = Depends(get_current_user)):
    return await svc_toggle_like(post_id, current_user)

@router.post("/{post_id}/comments")
async def add_comment(post_id: str, comment: PostCommentCreate, current_user: dict = Depends(get_current_user)):
    oid = validate_object_id(post_id, "Post ID")
    post = await db.posts.find_one({"_id": oid, "isDeleted": {"$ne": True}})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
        
    comment_data = {
        "id": str(ObjectId()),
        "userId": str(current_user["_id"]),
        "userName": current_user["fullName"],
        "userDepartment": current_user["department"],
        "content": comment.content,
        "createdAt": datetime.now(timezone.utc)
    }
    
    await db.posts.update_one(
        {"_id": oid},
        {"$push": {"comments": comment_data}}
    )
    
    return {"status": "success", "comment": comment_data}
