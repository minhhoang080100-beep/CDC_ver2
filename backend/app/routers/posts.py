from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks
from typing import List, Optional
from datetime import datetime, timezone
from bson import ObjectId
from app.core.database import db
from app.core.security import get_current_user
from app.core.permissions import build_content_filter, resolve_target_departments, can_manage_content
from app.models.post import PostCreate, PostCommentCreate
from app.core.push import send_bulk_push_notifications
from app.core.cloudinary_utils import delete_cloudinary_asset

router = APIRouter()

@router.get("", response_model=List[dict])
async def get_posts(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    cursor: Optional[datetime] = Query(None, description="Cursor for pagination (ISO datetime string)"),
    current_user: dict = Depends(get_current_user)
):
    content_filter = build_content_filter(current_user)
    content_filter["isDeleted"] = {"$ne": True}
    
    if cursor:
        content_filter["createdAt"] = {"$lt": cursor}
        
    posts = await db.posts.find(content_filter).sort("createdAt", -1).skip(skip).limit(limit).to_list(limit)
    
    return [{
        "id": str(post["_id"]),
        "title": post["title"],
        "content": post["content"],
        "summary": post["summary"],
        "category": post["category"],
        "image": post.get("image"),
        "authorId": post["authorId"],
        "authorName": post["authorName"],
        "authorDepartment": post["authorDepartment"],
        "targetDepartments": post["targetDepartments"],
        "likes": post.get("likes", []),
        "comments": post.get("comments", []),
        "createdAt": post["createdAt"],
        "updatedAt": post["updatedAt"]
    } for post in posts]

@router.post("")
async def create_post(post: PostCreate, background_tasks: BackgroundTasks, current_user: dict = Depends(get_current_user)):
    if not can_manage_content(current_user):
        raise HTTPException(status_code=403, detail="You don't have permission to create posts")
    
    target_departments = resolve_target_departments(current_user, post.targetDepartments)
    
    post_data = {
        "title": post.title,
        "content": post.content,
        "summary": post.summary,
        "category": post.category,
        "image": post.image,
        "authorId": current_user["_id"],
        "authorName": current_user["fullName"],
        "authorDepartment": current_user["department"],
        "targetDepartments": target_departments,
        "likes": [],
        "comments": [],
        "isDeleted": False,
        "createdAt": datetime.now(timezone.utc),
        "updatedAt": datetime.now(timezone.utc)
    }
    
    result = await db.posts.insert_one(post_data)
    post_data["_id"] = result.inserted_id
    
    # Notify users asynchronously
    background_tasks.add_task(
        notify_new_post,
        title=f"Bản tin: {post.title}",
        body=post.summary,
        target_departments=target_departments,
        post_id=str(post_data["_id"])
    )
    
    return {
        "id": str(post_data["_id"]),
        **{k: v for k, v in post_data.items() if k != "_id"}
    }

async def notify_new_post(title: str, body: str, target_departments: list, post_id: str):
    query = {"status": "ACTIVE", "pushToken": {"$exists": True, "$ne": None}}
    if "ALL" not in target_departments and target_departments:
        query["department"] = {"$in": target_departments}
        
    users = await db.users.find(query).to_list(1000)
    tokens = [u["pushToken"] for u in users if u.get("pushToken")]
    
    if tokens:
        # Note: calls a sync method in a background task thread
        send_bulk_push_notifications(
            tokens=tokens, 
            title=title, 
            body=body,
            data={"postId": post_id}
        )

@router.put("/{post_id}")
async def update_post(
    post_id: str, 
    post: PostCreate, 
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    existing_post = await db.posts.find_one({"_id": ObjectId(post_id), "isDeleted": {"$ne": True}})
    if not existing_post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    if current_user["role"] != "SUPER_ADMIN" and existing_post["authorId"] != current_user["_id"]:
        raise HTTPException(status_code=403, detail="You don't have permission to edit this post")
    
    target_departments = resolve_target_departments(current_user, post.targetDepartments)
    
    # Check if image changed to clean up old image from Cloudinary 
    old_image = existing_post.get("image")
    if old_image and old_image != post.image:
        background_tasks.add_task(delete_cloudinary_asset, old_image)
    
    update_data = {
        "title": post.title,
        "content": post.content,
        "summary": post.summary,
        "category": post.category,
        "image": post.image,
        "targetDepartments": target_departments,
        "updatedAt": datetime.now(timezone.utc)
    }
    
    await db.posts.update_one(
        {"_id": ObjectId(post_id)},
        {"$set": update_data}
    )
    
    return {"status": "success", "message": "Post updated"}

@router.delete("/{post_id}")
async def delete_post(
    post_id: str, 
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    existing_post = await db.posts.find_one({"_id": ObjectId(post_id), "isDeleted": {"$ne": True}})
    if not existing_post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    if current_user["role"] != "SUPER_ADMIN" and existing_post["authorId"] != current_user["_id"]:
        raise HTTPException(status_code=403, detail="You don't have permission to delete this post")
    
    # Soft delete the post but wipe the image from Cloudinary to save space
    image = existing_post.get("image")
    if image:
        background_tasks.add_task(delete_cloudinary_asset, image)
        
    await db.posts.update_one({"_id": ObjectId(post_id)}, {"$set": {"isDeleted": True, "image": None}})
    
    return {"status": "success", "message": "Post deleted"}

@router.post("/{post_id}/like")
async def toggle_like(post_id: str, current_user: dict = Depends(get_current_user)):
    post = await db.posts.find_one({"_id": ObjectId(post_id), "isDeleted": {"$ne": True}})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
        
    user_id_str = str(current_user["_id"])
    likes = post.get("likes", [])
    
    if user_id_str in likes:
        likes.remove(user_id_str)
        action = "unliked"
    else:
        likes.append(user_id_str)
        action = "liked"
        
    await db.posts.update_one(
        {"_id": ObjectId(post_id)},
        {"$set": {"likes": likes}}
    )
    
    return {"status": "success", "action": action, "likes": likes}

@router.post("/{post_id}/comments")
async def add_comment(post_id: str, comment: PostCommentCreate, current_user: dict = Depends(get_current_user)):
    post = await db.posts.find_one({"_id": ObjectId(post_id), "isDeleted": {"$ne": True}})
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
        {"_id": ObjectId(post_id)},
        {"$push": {"comments": comment_data}}
    )
    
    return {"status": "success", "comment": comment_data}
