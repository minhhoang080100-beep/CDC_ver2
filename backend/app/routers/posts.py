from fastapi import APIRouter, HTTPException, Depends
from typing import List
from datetime import datetime
from bson import ObjectId
from backend.app.core.database import db
from backend.app.core.security import get_current_user
from backend.app.models.post import PostCreate

router = APIRouter()

@router.get("", response_model=List[dict])
async def get_posts(current_user: dict = Depends(get_current_user)):
    # Permission logic
    if current_user["role"] in ["SUPER_ADMIN", "BCH_VANPHONG"]:
        posts = await db.posts.find().sort("createdAt", -1).to_list(100)
    elif current_user["role"].startswith("BCH_"):
        posts = await db.posts.find({
            "$or": [
                {"targetDepartments": current_user["department"]},
                {"targetDepartments": "ALL"}
            ]
        }).sort("createdAt", -1).to_list(100)
    else:
        posts = await db.posts.find({
            "$or": [
                {"targetDepartments": current_user["department"]},
                {"targetDepartments": "ALL"}
            ]
        }).sort("createdAt", -1).to_list(100)
    
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
    if not (current_user["role"] == "SUPER_ADMIN" or current_user["role"].startswith("BCH_")):
        raise HTTPException(status_code=403, detail="You don't have permission to create posts")
    
    target_departments = post.targetDepartments
    
    if current_user["role"] == "BCH_CUALO":
        target_departments = ["CUA_LO", "VAN_PHONG_CANG"]
    elif current_user["role"] == "BCH_BENTHUY":
        target_departments = ["BEN_THUY", "VAN_PHONG_CANG"]
    elif current_user["role"] == "BCH_VANPHONG" and not target_departments:
        target_departments = ["ALL"]
    
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
    
    target_departments = post.targetDepartments
    if current_user["role"] == "BCH_CUA_LO":
        target_departments = ["CUA_LO", "VAN_PHONG_CANG"]
    elif current_user["role"] == "BCH_BEN_THUY":
        target_departments = ["BEN_THUY", "VAN_PHONG_CANG"]
    elif current_user["role"] == "BCH_VAN_PHONG" and not target_departments:
        target_departments = ["ALL"]
    
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
