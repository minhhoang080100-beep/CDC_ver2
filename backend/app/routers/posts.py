from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List
from datetime import datetime
from bson import ObjectId
from app.core.database import db
from app.core.security import get_current_user
from app.core.permissions import build_content_filter, resolve_target_departments, can_manage_content
from app.models.post import PostCreate

router = APIRouter()

@router.get("", response_model=List[dict])
async def get_posts(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user)
):
    content_filter = build_content_filter(current_user)
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
        "createdAt": post["createdAt"],
        "updatedAt": post["updatedAt"]
    } for post in posts]

@router.post("")
async def create_post(post: PostCreate, current_user: dict = Depends(get_current_user)):
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
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    }
    
    result = await db.posts.insert_one(post_data)
    post_data["_id"] = result.inserted_id
    
    return {
        "id": str(post_data["_id"]),
        **{k: v for k, v in post_data.items() if k != "_id"}
    }

@router.put("/{post_id}")
async def update_post(post_id: str, post: PostCreate, current_user: dict = Depends(get_current_user)):
    existing_post = await db.posts.find_one({"_id": ObjectId(post_id)})
    if not existing_post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    if current_user["role"] != "SUPER_ADMIN" and existing_post["authorId"] != current_user["_id"]:
        raise HTTPException(status_code=403, detail="You don't have permission to edit this post")
    
    target_departments = resolve_target_departments(current_user, post.targetDepartments)
    
    update_data = {
        "title": post.title,
        "content": post.content,
        "summary": post.summary,
        "category": post.category,
        "image": post.image,
        "targetDepartments": target_departments,
        "updatedAt": datetime.utcnow()
    }
    
    await db.posts.update_one(
        {"_id": ObjectId(post_id)},
        {"$set": update_data}
    )
    
    return {"status": "success", "message": "Post updated"}

@router.delete("/{post_id}")
async def delete_post(post_id: str, current_user: dict = Depends(get_current_user)):
    existing_post = await db.posts.find_one({"_id": ObjectId(post_id)})
    if not existing_post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    if current_user["role"] != "SUPER_ADMIN" and existing_post["authorId"] != current_user["_id"]:
        raise HTTPException(status_code=403, detail="You don't have permission to delete this post")
    
    await db.posts.delete_one({"_id": ObjectId(post_id)})
    
    return {"status": "success", "message": "Post deleted"}
