"""
Post service — business logic extracted from posts router.
"""

from datetime import datetime, timezone
from bson import ObjectId
from fastapi import HTTPException

from app.core.database import db
from app.core.permissions import build_content_filter, resolve_target_departments, can_manage_content
from app.core.push import send_bulk_push_notifications_async
from app.core.cloudinary_utils import delete_cloudinary_asset


def _normalize_images(post: dict) -> list:
    """Backward compat: convert old single `image` field to `images` list."""
    images = post.get("images")
    if images:
        return images
    old_image = post.get("image")
    if old_image:
        return [old_image]
    return []


async def get_posts(skip: int, limit: int, cursor, current_user: dict):
    content_filter = build_content_filter(current_user)
    content_filter["isDeleted"] = {"$ne": True}

    if cursor:
        content_filter["createdAt"] = {"$lt": cursor}

    total = await db.posts.count_documents(content_filter)
    posts = await db.posts.find(content_filter).sort("createdAt", -1).skip(skip).limit(limit).to_list(limit)

    items = [{
        "id": str(post["_id"]),
        "title": post["title"],
        "content": post["content"],
        "summary": post["summary"],
        "category": post["category"],
        "images": _normalize_images(post),
        "authorId": post["authorId"],
        "authorName": post["authorName"],
        "authorDepartment": post["authorDepartment"],
        "targetDepartments": post["targetDepartments"],
        "likes": post.get("likes", []),
        "comments": post.get("comments", []),
        "createdAt": post["createdAt"],
        "updatedAt": post["updatedAt"]
    } for post in posts]

    return {"items": items, "total": total, "hasMore": skip + limit < total}


async def create_post(post_data: dict, current_user: dict):
    if not can_manage_content(current_user):
        raise HTTPException(status_code=403, detail="You don't have permission to create posts")

    target_departments = resolve_target_departments(current_user, post_data.get("targetDepartments", []))

    doc = {
        "title": post_data["title"],
        "content": post_data["content"],
        "summary": post_data["summary"],
        "category": post_data["category"],
        "images": post_data.get("images", []),
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

    result = await db.posts.insert_one(doc)
    doc["_id"] = result.inserted_id

    return doc, target_departments


async def update_post(post_id: str, post_data: dict, current_user: dict):
    from app.core.security import validate_object_id
    oid = validate_object_id(post_id, "Post ID")
    existing_post = await db.posts.find_one({"_id": oid, "isDeleted": {"$ne": True}})
    if not existing_post:
        raise HTTPException(status_code=404, detail="Post not found")

    if current_user["role"] != "SUPER_ADMIN" and existing_post["authorId"] != current_user["_id"]:
        raise HTTPException(status_code=403, detail="You don't have permission to edit this post")

    target_departments = resolve_target_departments(current_user, post_data.get("targetDepartments", []))

    # Detect removed images for Cloudinary cleanup
    old_images = set(_normalize_images(existing_post))
    new_images = set(post_data.get("images", []))
    images_to_delete = list(old_images - new_images)

    update_data = {
        "title": post_data["title"],
        "content": post_data["content"],
        "summary": post_data["summary"],
        "category": post_data["category"],
        "images": post_data.get("images", []),
        "targetDepartments": target_departments,
        "updatedAt": datetime.now(timezone.utc)
    }

    await db.posts.update_one({"_id": oid}, {"$set": update_data})

    return {"status": "success", "message": "Post updated"}, images_to_delete


async def delete_post(post_id: str, current_user: dict):
    from app.core.security import validate_object_id
    oid = validate_object_id(post_id, "Post ID")
    existing_post = await db.posts.find_one({"_id": oid, "isDeleted": {"$ne": True}})
    if not existing_post:
        raise HTTPException(status_code=404, detail="Post not found")

    if current_user["role"] != "SUPER_ADMIN" and existing_post["authorId"] != current_user["_id"]:
        raise HTTPException(status_code=403, detail="You don't have permission to delete this post")

    images = _normalize_images(existing_post)
    await db.posts.update_one({"_id": oid}, {"$set": {"isDeleted": True, "images": []}})

    return images  # caller handles async cleanup


async def toggle_like(post_id: str, current_user: dict):
    from app.core.security import validate_object_id
    oid = validate_object_id(post_id, "Post ID")
    post = await db.posts.find_one({"_id": oid, "isDeleted": {"$ne": True}})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    user_id_str = str(current_user["_id"])
    likes = post.get("likes", [])

    if user_id_str in likes:
        await db.posts.update_one({"_id": oid}, {"$pull": {"likes": user_id_str}})
        action = "unliked"
    else:
        await db.posts.update_one({"_id": oid}, {"$addToSet": {"likes": user_id_str}})
        action = "liked"

    updated = await db.posts.find_one({"_id": oid}, {"likes": 1})

    return {"status": "success", "action": action, "likes": updated.get("likes", [])}


async def notify_new_post(title: str, body: str, target_departments: list, post_id: str):
    query = {"status": "ACTIVE", "pushToken": {"$exists": True, "$ne": None}}
    if "ALL" not in target_departments and target_departments:
        query["department"] = {"$in": target_departments}

    users = await db.users.find(query).to_list(1000)
    tokens = [u["pushToken"] for u in users if u.get("pushToken")]

    if tokens:
        await send_bulk_push_notifications_async(
            tokens=tokens,
            title=title,
            body=body,
            data={"postId": post_id}
        )
